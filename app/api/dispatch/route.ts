import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const db = supabaseAdmin()

    // Upsert dispatch record
    const { data: dispatchData, error: dispatchError } = await db
      .from('Dispatch')
      .insert([{
        ticket_id: body.ticket_id,
        work_order_decision: body.work_order_decision,
        Estimate_Cost: body.Estimate_Cost,
        production_foreman: body.production_foreman || null,
        maintenance_foreman: body.maintenance_foreman || null,
        self_dispatch_assignee: body.self_dispatch_assignee || null,
        date_assigned: body.date_assigned || new Date().toISOString(),
        due_date: body.due_date || null,
        ticket_status: 'In Progress',
        created_at: new Date().toISOString(),
      }])
      .select()
      .single()

    if (dispatchError) throw dispatchError

    // Update ticket status
    await db
      .from('Maintenance_Form_Submission')
      .update({
        Ticket_Status: 'In Progress',
        Estimate_Cost: body.Estimate_Cost,
        assigned_foreman: body.production_foreman || body.maintenance_foreman || null,
      })
      .eq('id', body.ticket_id)

    return NextResponse.json(dispatchData, { status: 201 })
  } catch (error) {
    console.error('Dispatch error:', error)
    return NextResponse.json({ error: 'Failed to dispatch ticket' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const db = supabaseAdmin()

    const { data, error } = await db
      .from('Dispatch')
      .update({
        work_order_decision: body.work_order_decision,
        Estimate_Cost: body.Estimate_Cost,
        production_foreman: body.production_foreman || null,
        maintenance_foreman: body.maintenance_foreman || null,
        self_dispatch_assignee: body.self_dispatch_assignee || null,
        date_assigned: body.date_assigned,
        due_date: body.due_date || null,
      })
      .eq('id', body.dispatch_id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Dispatch update error:', error)
    return NextResponse.json({ error: 'Failed to update dispatch' }, { status: 500 })
  }
}
