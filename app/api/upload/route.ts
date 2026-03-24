import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const path = `issue-photos/${fileName}`

    const db = supabaseAdmin()
    const { error } = await db.storage
      .from('work-orders')
      .upload(path, buffer, { contentType: file.type })

    if (error) throw error

    const { data: { publicUrl } } = db.storage
      .from('work-orders')
      .getPublicUrl(path)

    return NextResponse.json({ url: publicUrl })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })

    const marker = '/work-orders/'
    const idx = url.indexOf(marker)
    if (idx === -1) return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })

    const path = url.slice(idx + marker.length)
    const db = supabaseAdmin()
    const { error } = await db.storage.from('work-orders').remove([path])
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
