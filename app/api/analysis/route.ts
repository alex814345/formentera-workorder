import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const STATUS_ORDER = ['Open', 'In Progress', 'Backlogged', 'Awaiting Cost', 'Closed']
const BACKLOG_STATUSES = ['Open', 'In Progress', 'Backlogged']

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userAssetsParam = searchParams.get('userAssets') || ''
  const userAssets = userAssetsParam ? userAssetsParam.split(',').map(a => a.trim()).filter(Boolean) : []
  const mode = searchParams.get('mode') || 'agg'

  const db = supabaseAdmin()

  try {
    if (mode === 'table') {
      const page = parseInt(searchParams.get('page') || '0')
      const pageSize = parseInt(searchParams.get('pageSize') || '25')
      const search = searchParams.get('search') || ''
      const statusFilter = searchParams.get('status') || ''
      const deptFilter = searchParams.get('department') || ''
      const startDate = searchParams.get('startDate') || ''
      const endDate = searchParams.get('endDate') || ''

      let query = db
        .from('workorder_ticket_summary')
        .select(
          'ticket_id, asset, field, department, work_order_type, location_type, well, facility, equipment_name, issue_description, ticket_status, issue_date, repair_date_closed, Estimate_Cost, repair_cost',
          { count: 'exact' }
        )

      if (userAssets.length > 0) query = query.in('asset', userAssets)
      if (search) {
        query = query.or(
          `ticket_id::text.ilike.%${search}%,equipment_name.ilike.%${search}%,issue_description.ilike.%${search}%,field.ilike.%${search}%,well.ilike.%${search}%,facility.ilike.%${search}%,department.ilike.%${search}%`
        )
      }
      if (statusFilter && statusFilter !== 'All') query = query.eq('ticket_status', statusFilter)
      if (deptFilter && deptFilter !== 'All') query = query.eq('department', deptFilter)
      if (startDate) query = query.gte('issue_date', startDate)
      if (endDate) query = query.lte('issue_date', endDate + 'T23:59:59')

      query = query
        .order('issue_date', { ascending: false })
        .order('ticket_id', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      const { data, error, count } = await query
      if (error) throw error
      return NextResponse.json({ data: data || [], count })
    }

    // Aggregation mode — batch-fetch all rows
    const BATCH = 1000
    const rows: {
      ticket_id: number
      asset: string
      field: string
      department: string
      equipment_name: string
      ticket_status: string
      issue_date: string
      repair_date_closed: string | null
      Estimate_Cost: number | null
      repair_cost: number | null
    }[] = []

    let from = 0
    while (true) {
      let q = db
        .from('workorder_ticket_summary')
        .select('ticket_id, asset, field, department, equipment_name, ticket_status, issue_date, repair_date_closed, Estimate_Cost, repair_cost')
        .order('ticket_id', { ascending: true })
        .range(from, from + BATCH - 1)
      if (userAssets.length > 0) q = q.in('asset', userAssets)
      const { data, error } = await q
      if (error) throw error
      rows.push(...(data || []))
      if (!data || data.length < BATCH) break
      from += BATCH
    }

    // 1. Status tables — grouped by asset + field + dept
    const statusTableMap: Record<string, Map<string, { count: number; estCost: number; repairCost: number }>> = {}
    for (const s of STATUS_ORDER) statusTableMap[s] = new Map()

    for (const r of rows) {
      const status = r.ticket_status || 'Open'
      if (!statusTableMap[status]) statusTableMap[status] = new Map()
      const key = `${r.asset || ''}||${r.field || ''}||${r.department || ''}`
      const existing = statusTableMap[status].get(key) || { count: 0, estCost: 0, repairCost: 0 }
      existing.count++
      existing.estCost += r.Estimate_Cost || 0
      existing.repairCost += r.repair_cost || 0
      statusTableMap[status].set(key, existing)
    }

    const statusTables: Record<string, { asset: string; field: string; dept: string; count: number; estCost: number; repairCost: number; savings: number }[]> = {}
    for (const s of STATUS_ORDER) {
      statusTables[s] = Array.from(statusTableMap[s].entries())
        .map(([key, val]) => {
          const [asset, field, dept] = key.split('||')
          return { asset, field, dept, ...val, savings: val.estCost - val.repairCost }
        })
        .sort((a, b) => b.count - a.count)
    }

    // 2. Field + Equipment Type + Department chart data
    const fieldEquipMap = new Map<string, number>()
    for (const r of rows) {
      const key = `${r.field || 'Unknown'}||${r.equipment_name || 'Unknown'}||${r.department || 'Unknown'}`
      fieldEquipMap.set(key, (fieldEquipMap.get(key) || 0) + 1)
    }
    const fieldEquipChart = Array.from(fieldEquipMap.entries())
      .map(([key, count]) => {
        const [field, equip, dept] = key.split('||')
        return { field, equip, dept, count }
      })
      .sort((a, b) => b.count - a.count)

    // Unique departments
    const departments = [...new Set(rows.map(r => r.department).filter(Boolean))].sort() as string[]

    // 3. Cost by Department
    const costDeptMap = new Map<string, { estCost: number; repairCost: number }>()
    for (const r of rows) {
      const dept = r.department || 'Unknown'
      const existing = costDeptMap.get(dept) || { estCost: 0, repairCost: 0 }
      existing.estCost += r.Estimate_Cost || 0
      existing.repairCost += r.repair_cost || 0
      costDeptMap.set(dept, existing)
    }
    const costByDept = Array.from(costDeptMap.entries())
      .map(([dept, val]) => ({ dept, estCost: Math.round(val.estCost), repairCost: Math.round(val.repairCost) }))
      .filter(d => d.estCost > 0 || d.repairCost > 0)
      .sort((a, b) => b.estCost - a.estCost)

    // 4. Backlog Health — avg days open per open status
    const backlogMap: Record<string, { totalDays: number; count: number }> = {}
    for (const s of BACKLOG_STATUSES) backlogMap[s] = { totalDays: 0, count: 0 }
    const now = Date.now()
    for (const r of rows) {
      if (!BACKLOG_STATUSES.includes(r.ticket_status)) continue
      const days = Math.floor((now - new Date(r.issue_date).getTime()) / 86_400_000)
      backlogMap[r.ticket_status].totalDays += days
      backlogMap[r.ticket_status].count++
    }
    const backlogHealth = BACKLOG_STATUSES.map(status => ({
      status,
      count: backlogMap[status].count,
      avgDays: backlogMap[status].count > 0
        ? Math.round(backlogMap[status].totalDays / backlogMap[status].count)
        : 0,
    }))

    // 5. Monthly trend — last 12 months
    const monthMap = new Map<string, number>()
    const monthLabels = new Map<string, string>()
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - i)
      const key = d.toISOString().slice(0, 7)
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      monthMap.set(key, 0)
      monthLabels.set(key, label)
    }
    for (const r of rows) {
      const month = (r.issue_date || '').slice(0, 7)
      if (monthMap.has(month)) monthMap.set(month, (monthMap.get(month) || 0) + 1)
    }
    const monthlyTrend = Array.from(monthMap.entries()).map(([month, count]) => ({
      month,
      label: monthLabels.get(month) || month,
      count,
    }))

    return NextResponse.json(
      { statusTables, fieldEquipChart, costByDept, backlogHealth, monthlyTrend, departments },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' } }
    )
  } catch (err) {
    console.error('Analysis fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch analysis data' }, { status: 500 })
  }
}
