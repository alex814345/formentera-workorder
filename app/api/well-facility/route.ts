import { NextResponse } from 'next/server'
import { snowflakeQuery, WELL_FACILITY_QUERY } from '@/lib/snowflake'

// Cache in memory for the session to avoid hammering Snowflake on every keystroke
let cache: { data: Record<string, string[]>; ts: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function GET() {
  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json(cache.data)
    }

    const rows = await snowflakeQuery<Record<string, string>>(WELL_FACILITY_QUERY)

    // Transpose rows into columnar arrays (same shape as Retool's .data)
    const result: Record<string, string[]> = {
      Asset: [],
      Area: [],
      FIELD: [],
      WELLNAME: [],
      Facility_Name: [],
      ROUTENAME: [],
      UNITID: [],
    }

    for (const row of rows) {
      result.Asset.push(row.Asset ?? row.ASSET ?? '')
      result.Area.push(row.Area ?? row.AREA ?? '')
      result.FIELD.push(row.FIELD ?? '')
      result.WELLNAME.push(row.WELLNAME ?? '')
      result.Facility_Name.push(row.Facility_Name ?? row.FACILITY_NAME ?? '')
      result.ROUTENAME.push(row.ROUTENAME ?? '')
      result.UNITID.push(row.UNITID ?? '')
    }

    cache = { data: result, ts: Date.now() }
    return NextResponse.json(result)
  } catch (error) {
    console.error('Snowflake well-facility error:', error)
    return NextResponse.json({ error: 'Failed to fetch location data' }, { status: 500 })
  }
}
