import { NextResponse } from 'next/server'
import { snowflakeQuery } from '@/lib/snowflake'

export const dynamic = 'force-dynamic'

type Row = { AFE_NUMBER_PRIMARY: string; JOB_CATEGORY: string | null }

export async function GET(
  _req: Request,
  { params }: { params: { unitId: string } },
) {
  try {
    const unitId = (params.unitId || '').trim()
    if (!unitId) return NextResponse.json([])

    // Pick the most recent job per AFE number (job categories are consistent
    // across multiple jobs for the same AFE, but QUALIFY keeps us honest).
    const sql = `
      SELECT AFE_NUMBER_PRIMARY, JOB_CATEGORY
      FROM FO_STAGE_DB.DEV_INTERMEDIATE.RETOOL_WELL_FACILITY w
      JOIN FO_PRODUCTION_DB.GOLD_DEVELOPMENT.DIM_JOB j
        ON j.WELL_ID = w.WVWELLID
      WHERE w.UNITID = ?
        AND j.AFE_NUMBER_PRIMARY IS NOT NULL
        AND j.AFE_NUMBER_PRIMARY <> ''
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY j.AFE_NUMBER_PRIMARY
        ORDER BY j.JOB_START_AT DESC NULLS LAST
      ) = 1
    `
    const rows = await snowflakeQuery<Row>(sql, [unitId])
    const afes = rows.map(r => ({
      number: r.AFE_NUMBER_PRIMARY,
      jobCategory: r.JOB_CATEGORY ?? '',
    }))
    return NextResponse.json(afes)
  } catch (error) {
    console.error('Well AFEs error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch well AFEs'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
