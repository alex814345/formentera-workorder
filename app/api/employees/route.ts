import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const asset = searchParams.get('asset')

    let query = supabaseAdmin()
      .from('employees')
      .select('id, name, job_title, work_email, assets')
      .or('job_title.ilike.%Foreman%,job_title.ilike.%Superintendent%')
      .order('name')

    const { data, error } = await query

    if (error) throw error

    const filtered = asset
      ? (data || []).filter(e => Array.isArray(e.assets) && e.assets.includes(asset))
      : data

    return NextResponse.json(filtered)
  } catch (error) {
    console.error('Employees fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
}
