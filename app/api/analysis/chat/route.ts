import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are an assistant for an oil & gas field operations work order app. You help foremen and analysts understand maintenance data.

You have access to aggregated work order data. When the user asks a question, respond with a JSON object in one of these two formats:

1. For questions that can be shown as a chart:
{
  "type": "chart",
  "chartType": "bar" | "line" | "pie",
  "title": "Chart title",
  "data": [{ "label": "...", "value": 123, ... }],
  "xKey": "label",
  "series": [{ "key": "value", "label": "Display label", "color": "#1B2E6B" }],
  "insight": "One sentence takeaway from this data."
}

2. For questions best answered as text:
{
  "type": "text",
  "text": "Your answer here in plain language."
}

Rules:
- ALWAYS return valid JSON only. No markdown, no explanation outside the JSON.
- For bar/line charts: xKey must be a field that exists in every data object.
- For pie charts: data objects need "label" and "value" fields.
- Use these colors in order: "#1B2E6B", "#3B82F6", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6"
- Keep data arrays to max 10 items (top N).
- Costs are in USD. Format large numbers naturally in the insight (e.g. "$1.3M", "$45K").
- If a question is outside the scope of the data, set type to "text" and explain what data is available.
- Status values are: Open, In Progress, Backlogged, Awaiting Cost, Closed
- Work order types are: LOE, AFE - Workover, AFE - Capital, Unspecified`

export async function POST(req: NextRequest) {
  try {
    const { question, aggData } = await req.json()

    if (!question || !aggData) {
      return NextResponse.json({ error: 'Missing question or data' }, { status: 400 })
    }

    const dataContext = `
Here is the current aggregated work order data:

TICKET COUNTS BY STATUS:
${Object.entries(aggData.statusTables as Record<string, { count: number }[]>)
  .map(([status, rows]) => `- ${status}: ${rows.reduce((s, r) => s + r.count, 0)} tickets`)
  .join('\n')}

TOP EQUIPMENT BY TICKET COUNT:
${(aggData.topEquipment as { name: string; count: number }[]).slice(0, 10)
  .map((e: { name: string; count: number }) => `- ${e.name}: ${e.count} tickets`)
  .join('\n')}

COST BY DEPARTMENT:
${(aggData.costByDept as { dept: string; estCost: number; repairCost: number }[])
  .map((d: { dept: string; estCost: number; repairCost: number }) => `- ${d.dept}: Est $${d.estCost.toLocaleString()}, Repair $${d.repairCost.toLocaleString()}`)
  .join('\n')}

MONTHLY TICKET TREND (last 12 months):
${(aggData.monthlyTrend as { label: string; count: number }[]).slice(-12)
  .map((m: { label: string; count: number }) => `- ${m.label}: ${m.count} tickets`)
  .join('\n')}

COST TREND BY MONTH (last 12 months):
${(aggData.costTrend as { label: string; estCost: number; repairCost: number }[]).slice(-12)
  .map((m: { label: string; estCost: number; repairCost: number }) => `- ${m.label}: Est $${m.estCost.toLocaleString()}, Repair $${m.repairCost.toLocaleString()}`)
  .join('\n')}

BACKLOG HEALTH:
${(aggData.backlogHealth as { status: string; count: number; avgDays: number }[])
  .map((b: { status: string; count: number; avgDays: number }) => `- ${b.status}: ${b.count} tickets, avg ${b.avgDays} days open`)
  .join('\n')}

WORK TYPE BREAKDOWN (closed tickets):
${(aggData.workTypeBreakdown as { type: string; count: number }[])
  .map((w: { type: string; count: number }) => `- ${w.type}: ${w.count} tickets`)
  .join('\n')}

TOP AGED OPEN TICKETS (oldest unresolved, ID > 700):
${(aggData.agedTickets as { ticket_id: number; equipment: string; status: string; days_open: number; field: string }[]).slice(0, 5)
  .map((t: { ticket_id: number; equipment: string; status: string; days_open: number; field: string }) => `- Ticket #${t.ticket_id}: ${t.equipment} (${t.field}), ${t.status}, ${t.days_open} days open`)
  .join('\n')}
`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `${dataContext}\n\nUser question: ${question}`,
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      parsed = { type: 'text', text: cleaned }
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json({ error: 'Failed to process question' }, { status: 500 })
  }
}
