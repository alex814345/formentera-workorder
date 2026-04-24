import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const tenantId = process.env.MS_TENANT_ID
  const clientId = process.env.MS_CLIENT_ID
  const clientSecret = process.env.MS_CLIENT_SECRET
  const senderEmail = process.env.MS_SENDER_EMAIL

  return NextResponse.json({
    MS_TENANT_ID: {
      set: Boolean(tenantId),
      length: tenantId?.length ?? 0,
    },
    MS_CLIENT_ID: {
      set: Boolean(clientId),
      length: clientId?.length ?? 0,
    },
    MS_CLIENT_SECRET: {
      set: Boolean(clientSecret),
      length: clientSecret?.length ?? 0,
    },
    MS_SENDER_EMAIL: {
      set: Boolean(senderEmail),
      value: senderEmail ?? null,
    },
  })
}
