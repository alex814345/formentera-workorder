import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const db = supabaseAdmin()

    // Upsert repairs/closeout
    const { data: repairData, error: repairError } = await db
      .from('Repairs_Closeout')
      .insert([{
        ticket_id: body.ticket_id,
        start_date: body.start_date || null,
        repair_details: body.repair_details || null,
        repair_images: body.repair_images || [],
        vendor: body.vendor || null,
        total_repair_cost: body.total_repair_cost || null,
        date_completed: body.date_completed || null,
        final_status: body.final_status || null,
        Work_Order_Type: body.Work_Order_Type || null,
        Priority_of_Issue: body.Priority_of_Issue || null,
        created_by: body.created_by,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single()

    if (repairError) throw repairError

    // Upsert vendor payment details
    if (body.vendors) {
      const vendorPayload = {
        ticket_id: body.ticket_id,
        vendor: body.vendors[0]?.vendor || null,
        vendor_cost: body.vendors[0]?.cost || null,
        vendor_2: body.vendors[1]?.vendor || null,
        vendor_cost_2: body.vendors[1]?.cost || null,
        vendor_3: body.vendors[2]?.vendor || null,
        vendor_cost_3: body.vendors[2]?.cost || null,
        vendor_4: body.vendors[3]?.vendor || null,
        vendor_cost_4: body.vendors[3]?.cost || null,
        vendor_5: body.vendors[4]?.vendor || null,
        vendor_cost_5: body.vendors[4]?.cost || null,
        vendor_6: body.vendors[5]?.vendor || null,
        vendor_cost_6: body.vendors[5]?.cost || null,
        vendor_7: body.vendors[6]?.vendor || null,
        vendor_cost_7: body.vendors[6]?.cost || null,
        total_cost: body.vendors.reduce((sum: number, v: { cost?: number }) => sum + (v.cost || 0), 0),
        updated_at: new Date().toISOString(),
      }

      await db
        .from('vendor_payment_details')
        .upsert(vendorPayload, { onConflict: 'ticket_id' })
    }

    // Update ticket status to Closed if final_status set
    if (body.final_status) {
      await db
        .from('Maintenance_Form_Submission')
        .update({ Ticket_Status: 'Closed' })
        .eq('id', body.ticket_id)

      // Mark closeout date
      await db
        .from('Repairs_Closeout')
        .update({ date_closed: new Date().toISOString(), closed_by: body.created_by })
        .eq('id', repairData.id)
    }

    return NextResponse.json(repairData, { status: 201 })
  } catch (error) {
    console.error('Repairs error:', error)
    return NextResponse.json({ error: 'Failed to save repairs' }, { status: 500 })
  }
}
