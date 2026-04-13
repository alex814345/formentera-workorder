import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `You are an assistant for an oil & gas field operations work order app. You help foremen and analysts understand maintenance data.

You have access to aggregated work order data that is refreshed on every question. When the user asks a question, respond with a JSON object in one of these two formats:

1. For questions that can be shown as a chart:
{
  "type": "chart",
  "chartType": "bar" | "line" | "pie",
  "title": "Chart title",
  "data": [{ "label": "...", "value": 123, ... }],
  "xKey": "label",
  "series": [{ "key": "value", "label": "Display label", "color": "#1B2E6B" }],
  "insight": "One sentence takeaway from this data."
}

2. For questions best answered as text:
{
  "type": "text",
  "text": "Your answer here in plain language."
}

Rules:
- ALWAYS return valid JSON only. No markdown, no explanation outside the JSON.
- For bar/line charts: xKey must be a field that exists in every data object.
- For pie charts: data objects need "label" and "value" fields.
- Use these colors in order: "#1B2E6B", "#3B82F6", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6"
- Keep data arrays to max 10 items (top N).
- Costs are in USD. Format large numbers naturally in the insight (e.g. "$1.3M", "$45K").
- If a question is outside the scope of the data, set type to "text" and explain what data is available.
- Status values are: Open, In Progress, Backlogged, Awaiting Cost, Closed
- Work order types are: LOE, AFE - Workover, AFE - Capital, Unspecified
- You support multi-turn conversation. If the user refers to a previous chart or question (e.g. "filter that by department", "now show it as a pie"), use the conversation history to understand what they mean.`

const BACKLOG_STATUSES = ['Open', 'In Progress', 'Backlogged']
const OPEN_STATUSES = ['Open', 'In Progress', 'Backlogged', 'Awaiting Cost']

async function fetchFreshData(userAssets: string[], startDate: string, endDate: string) {
  const db = supabaseAdmin()
  const BATCH = 1000
  const rows: {
    ticket_id: number
    asset: string
    field: string
    department: string
    equipment_name: string
    work_order_type: string | null
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
      .select('ticket_id, asset, field, department, equipment_name, work_order_type, ticket_status, issue_date, repair_date_closed, Estimate_Cost, repair_cost')
      .order('ticket_id', { ascending: true })
      .range(from, from + BATCH - 1)
    if (userAssets.length > 0) q = q.in('asset', userAssets)
    if (startDate) q = q.gte('issue_date', startDate)
    if (endDate) q = q.lte('issue_date', endDate + 'T23:59:59')
    const { data, error } = await q
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < BATCH) break
    from += BATCH
  }

  // Status counts
  const statusCounts: Record<string, number> = {}
  for (const r of rows) {
    const s = r.ticket_status || 'Open'
    statusCounts[s] = (statusCounts[s] || 0) + 1
  }

  // Top equipment
  const equipMap = new Map<string, number>()
  for (const r of rows) {
    const equip = r.equipment_name || 'Unknown'
    equipMap.set(equip, (equipMap.get(equip) || 0) + 1)
  }
  const topEquipment = Array.from(equipMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  // Cost by department
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

  // Monthly trend
  const monthCountMap = new Map<string, number>()
  for (const r of rows) {
    const month = (r.issue_date || '').slice(0, 7)
    if (month) monthCountMap.set(month, (monthCountMap.get(month) || 0) + 1)
  }
  const monthlyTrend = [...monthCountMap.keys()]
    .sort()
    .slice(-12)
    .map(month => ({
      label: new Date(month + '-02').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      count: monthCountMap.get(month) || 0,
    }))

  // Cost trend
  const costTrendMap = new Map<string, { estCost: number; repairCost: number }>()
  for (const r of rows) {
    const month = (r.issue_date || '').slice(0, 7)
    if (!month) continue
    const existing = costTrendMap.get(month) || { estCost: 0, repairCost: 0 }
    existing.estCost += r.Estimate_Cost || 0
    existing.repairCost += r.repair_cost || 0
    costTrendMap.set(month, existing)
  }
  const costTrend = [...costTrendMap.keys()]
    .sort()
    .slice(-12)
    .map(month => ({
      label: new Date(month + '-02').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      estCost: Math.round(costTrendMap.get(month)?.estCost || 0),
      repairCost: Math.round(costTrendMap.get(month)?.repairCost || 0),
    }))
    .filter(m => m.estCost > 0 || m.repairCost > 0)

  // Backlog health
  const now = Date.now()
  const backlogMap: Record<string, { totalDays: number; count: number }> = {}
  for (const s of BACKLOG_STATUSES) backlogMap[s] = { totalDays: 0, count: 0 }
  for (const r of rows) {
    if (!BACKLOG_STATUSES.includes(r.ticket_status)) continue
    const days = Math.floor((now - new Date(r.issue_date).getTime()) / 86_400_000)
    backlogMap[r.ticket_status].totalDays += days
    backlogMap[r.ticket_status].count++
  }
  const backlogHealth = BACKLOG_STATUSES.map(status => ({
    status,
    count: backlogMap[status].count,
    avgDays: backlogMap[status].count > 0 ? Math.round(backlogMap[status].totalDays / backlogMap[status].count) : 0,
  }))

  // Work type breakdown (closed only)
  const workTypeMap = new Map<string, number>()
  for (const r of rows) {
    if (r.ticket_status !== 'Closed') continue
    const type = r.work_order_type || 'Unspecified'
    workTypeMap.set(type, (workTypeMap.get(type) || 0) + 1)
  }
  const workTypeBreakdown = Array.from(workTypeMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  // Aged tickets (ID > 700)
  const agedTickets = rows
    .filter(r => OPEN_STATUSES.includes(r.ticket_status) && r.ticket_id > 700)
    .map(r => ({
      ticket_id: r.ticket_id,
      field: r.field || '',
      equipment: r.equipment_name || 'Unknown',
      status: r.ticket_status,
      days_open: Math.floor((now - new Date(r.issue_date).getTime()) / 86_400_000),
    }))
    .sort((a, b) => b.days_open - a.days_open)
    .slice(0, 10)

  // Field breakdown
  const fieldMap = new Map<string, number>()
  for (const r of rows) {
    const field = r.field || 'Unknown'
    fieldMap.set(field, (fieldMap.get(field) || 0) + 1)
  }
  const fieldBreakdown = Array.from(fieldMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([field, count]) => ({ field, count }))

  return { statusCounts, topEquipment, costByDept, monthlyTrend, costTrend, backlogHealth, workTypeBreakdown, agedTickets, fieldBreakdown, totalTickets: rows.length }
}

function buildDataContext(data: Awaited<ReturnType<typeof fetchFreshData>>) {
  return `
Here is the current aggregated work order data (freshly queried):

TOTAL TICKETS: ${data.totalTickets}

TICKET COUNTS BY STATUS:
${Object.entries(data.statusCounts).map(([status, count]) => `- ${status}: ${count} tickets`).join('\n')}

TOP EQUIPMENT BY TICKET COUNT:
${data.topEquipment.map(e => `- ${e.name}: ${e.count} tickets`).join('\n')}

COST BY DEPARTMENT:
${data.costByDept.map(d => `- ${d.dept}: Est $${d.estCost.toLocaleString()}, Repair $${d.repairCost.toLocaleString()}, Savings $${(d.estCost - d.repairCost).toLocaleString()}`).join('\n')}

MONTHLY TICKET TREND:
${data.monthlyTrend.map(m => `- ${m.label}: ${m.count} tickets`).join('\n')}

COST TREND BY MONTH:
${data.costTrend.map(m => `- ${m.label}: Est $${m.estCost.toLocaleString()}, Repair $${m.repairCost.toLocaleString()}`).join('\n')}

BACKLOG HEALTH:
${data.backlogHealth.map(b => `- ${b.status}: ${b.count} tickets, avg ${b.avgDays} days open`).join('\n')}

WORK TYPE BREAKDOWN (closed tickets):
${data.workTypeBreakdown.map(w => `- ${w.type}: ${w.count} tickets`).join('\n')}

TICKETS BY FIELD:
${data.fieldBreakdown.map(f => `- ${f.field}: ${f.count} tickets`).join('\n')}

TOP AGED OPEN TICKETS (oldest unresolved):
${data.agedTickets.slice(0, 5).map(t => `- Ticket #${t.ticket_id}: ${t.equipment} (${t.field}), ${t.status}, ${t.days_open} days open`).join('\n')}
`
}

export async function POST(req: NextRequest) {
  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ type: 'text', text: 'AI chat is not configured yet. Please contact your administrator.', noKey: true }, { status: 200 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const { question, messages, userAssets, startDate, endDate } = await req.json() as {
      question: string
      messages: { role: 'user' | 'assistant'; text?: string }[]
      userAssets: string[]
      startDate: string
      endDate: string
    }

    if (!question) {
      return NextResponse.json({ error: 'Missing question' }, { status: 400 })
    }

    // Fetch fresh data from Supabase
    const freshData = await fetchFreshData(userAssets || [], startDate || '', endDate || '')
    const dataContext = buildDataContext(freshData)

    // Build multi-turn message history
    const claudeMessages: { role: 'user' | 'assistant'; content: string }[] = []

    // First message always includes data context
    if (messages && messages.length > 0) {
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i]
        if (i === 0 && msg.role === 'user') {
          claudeMessages.push({ role: 'user', content: `${dataContext}\n\nUser question: ${msg.text}` })
        } else if (msg.text) {
          claudeMessages.push({ role: msg.role, content: msg.text })
        }
      }
    }

    // Add current question
    claudeMessages.push({
      role: 'user',
      content: claudeMessages.length === 0
        ? `${dataContext}\n\nUser question: ${question}`
        : `User question: ${question}`,
    })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: claudeMessages,
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      parsed = { type: 'text', text: cleaned }
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json({ error: 'Failed to process question' }, { status: 500 })
  }
}
