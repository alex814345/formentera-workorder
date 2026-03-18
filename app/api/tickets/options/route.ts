import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode') || 'all'
  const userEmail = searchParams.get('userEmail') || ''
  const userName = searchParams.get('userName') || ''

  try {
    const db = supabaseAdmin()

    let query = db
      .from('Maintenance_Form_Submission')
      .select('Asset, Department, Equipment, assigned_foreman, Created_by_Name')

    if (mode === 'mine') {
      query = query.or(
        `Created_by_Email.ilike.${userEmail},Created_by_Name.ilike.${userName},assigned_foreman.ilike.${userName}`
      )
    }

    const { data, error } = await query

    if (error) throw error

    const rows = data || []
    const unique = <T>(arr: T[]) => [...new Set(arr.filter(Boolean))].sort() as T[]

    return NextResponse.json({
      assets:      unique(rows.map(r => r.Asset)),
      departments: unique(rows.map(r => r.Department)),
      equipments:  unique(rows.map(r => r.Equipment)),
      foremans:    unique(rows.map(r => r.assigned_foreman)),
      submitters:  unique(rows.map(r => r.Created_by_Name)),
    })
  } catch (error) {
    console.error('Options fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch options' }, { status: 500 })
  }
}
