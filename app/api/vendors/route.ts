import { NextResponse } from 'next/server'
import { snowflakeQuery, VENDORS_QUERY } from '@/lib/snowflake'

let cache: { data: string[]; ts: number } | null = null
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export async function GET() {
  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json(cache.data)
    }

    const rows = await snowflakeQuery<{ VENDOR_NAME: string }>(VENDORS_QUERY)
    const vendors = rows
      .map((r) => r.VENDOR_NAME)
      .filter((v) => v != null && String(v).trim() !== '')

    cache = { data: vendors, ts: Date.now() }
    return NextResponse.json(vendors)
  } catch (error) {
    console.error('Snowflake vendors error:', error)
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 })
  }
}
