import { NextResponse } from 'next/server'
import { snowflakeQuery } from '@/lib/snowflake'

export const dynamic = 'force-dynamic'

type JobRow = { AFE_NUMBER_PRIMARY: string }

async function login(base: string, id: string, key: string): Promise<string> {
  const res = await fetch(`${base}/api/Authentication/ApiKey/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ Id: id, Key: key }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  if (!data?.AuthenticationToken) throw new Error('No AuthenticationToken')
  return data.AuthenticationToken as string
}

async function logout(base: string, token: string): Promise<void> {
  try {
    await fetch(`${base}/api/Authentication/Logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ AuthenticationToken: token }),
      cache: 'no-store',
    })
  } catch {}
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const unitId = (searchParams.get('unitId') || '').trim()
    if (!unitId) return NextResponse.json({ error: 'unitId is required' }, { status: 400 })

    const jobRows = await snowflakeQuery<JobRow>(`
      SELECT DISTINCT j.AFE_NUMBER_PRIMARY
      FROM FO_STAGE_DB.DEV_INTERMEDIATE.RETOOL_WELL_FACILITY w
      JOIN FO_PRODUCTION_DB.GOLD_DEVELOPMENT.DIM_JOB j
        ON j.WELL_ID = w.WVWELLID
      WHERE w.UNITID = ?
        AND j.AFE_NUMBER_PRIMARY IS NOT NULL
        AND j.AFE_NUMBER_PRIMARY <> ''
    `, [unitId])
    const wellNumbers = jobRows.map(r => r.AFE_NUMBER_PRIMARY)

    const base = (process.env.AFE_EXECUTE_BASE_URL || '').replace(/\/+$/, '')
    const id = process.env.AFE_EXECUTE_API_KEY_ID
    const key = process.env.AFE_EXECUTE_API_KEY
    if (!base || !id || !key) return NextResponse.json({ error: 'AFE creds missing' }, { status: 500 })

    const token = await login(base, id, key)
    try {
      const res = await fetch(`${base}/api/Documents/Reporting/Execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          AuthenticationToken: token,
          DocumentType: 'AFE',
          ReportType: 'AFE',
          Columns: [
            'AFENUMBER_DOC/AFENUMBER',
            'DESCRIPTION',
            'STATUS_DESC',
            'CUSTOM/OPERATOR_STATUS',
          ],
          SortColumns: [],
          Filter: [],
          GlobalSearch: '',
          MaxRowCount: 5000,
          SkipRows: 0,
          IncludeArchived: false,
          IncludeRawData: false,
        }),
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`Report fetch failed: ${res.status} ${(await res.text()).slice(0, 300)}`)
      const payload = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = Array.isArray(payload?.Rows) ? payload.Rows : []

      const byNumber = new Map<string, { number: string; description: string; status: string; operatorStatus: string }>()
      for (const r of rows) {
        const data = Array.isArray(r?.Data) ? r.Data : []
        const number = String(data[0] ?? '').trim()
        if (!number) continue
        byNumber.set(number, {
          number,
          description: String(data[1] ?? ''),
          status: String(data[2] ?? ''),
          operatorStatus: String(data[3] ?? ''),
        })
      }

      const enriched = wellNumbers.map(n => {
        const e = byNumber.get(n)
        if (!e) return { number: n, description: '', status: '(not in Execute)', operatorStatus: '', wouldShow: false }
        const wouldShow = e.status === 'Fully Approved' && e.operatorStatus === 'Operated'
        return { ...e, wouldShow }
      })

      return NextResponse.json({ unitId, wellNumbers, enriched })
    } finally {
      await logout(base, token)
    }
  } catch (error) {
    console.error('debug well-afes error:', error)
    const message = error instanceof Error ? error.message : 'Failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
