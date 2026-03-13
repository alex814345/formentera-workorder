import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin()
      .from('employees')
      .select('id, name, job_title, work_email')
      .order('name')

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Employees fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
}
