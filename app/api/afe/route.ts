import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type AfeOption = {
  number: string
  description: string
  type: string | null
  wellName: string | null
  closed: boolean
}

let cache: { data: AfeOption[]; ts: number } | null = null
const CACHE_TTL = 10 * 60 * 1000

function basicAuthHeader() {
  const id = process.env.AFE_EXECUTE_API_KEY_ID
  const key = process.env.AFE_EXECUTE_API_KEY
  if (!id || !key) throw new Error('AFE Execute credentials not configured')
  return 'Basic ' + Buffer.from(`${id}:${key}`).toString('base64')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(doc: any): AfeOption | null {
  const number = doc?.NUMBER ?? doc?.number ?? null
  if (!number) return null
  return {
    number: String(number),
    description: String(doc?.DESCRIPTION ?? doc?.description ?? ''),
    type: doc?.CUSTOM?.AFE_TYPE ?? doc?.custom?.afe_type ?? null,
    wellName: doc?.CUSTOM?.WELL_NAME ?? doc?.custom?.well_name ?? null,
    closed: Boolean(doc?.CLOSED ?? doc?.closed ?? false),
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const refresh = searchParams.get('refresh') === '1'
    const includeClosed = searchParams.get('includeClosed') === '1'

    if (!refresh && cache && Date.now() - cache.ts < CACHE_TTL) {
      const data = includeClosed ? cache.data : cache.data.filter(a => !a.closed)
      return NextResponse.json(data)
    }

    const base = (process.env.AFE_EXECUTE_BASE_URL || '').replace(/\/+$/, '')
    if (!base) throw new Error('AFE_EXECUTE_BASE_URL not configured')

    const url = `${base}/fetch/document/?type=AFE&limit=1000`
    const res = await fetch(url, {
      headers: {
        Authorization: basicAuthHeader(),
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('AFE Execute fetch failed:', res.status, body.slice(0, 500))
      return NextResponse.json(
        { error: `AFE fetch failed: ${res.status}` },
        { status: 502 }
      )
    }

    const payload = await res.json()
    const docs: unknown[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.documents)
      ? payload.documents
      : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.results)
      ? payload.results
      : []

    const normalized = docs
      .map(normalize)
      .filter((x): x is AfeOption => x !== null)
      .sort((a, b) => a.number.localeCompare(b.number))

    cache = { data: normalized, ts: Date.now() }
    const data = includeClosed ? normalized : normalized.filter(a => !a.closed)
    return NextResponse.json(data)
  } catch (error) {
    console.error('AFE route error:', error)
    return NextResponse.json({ error: 'Failed to fetch AFE list' }, { status: 500 })
  }
}
