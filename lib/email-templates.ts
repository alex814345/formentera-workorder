const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formentera-workorder.vercel.app'

type RepairRow = {
  final_status?: string
  start_date?: string
  Work_Order_Type?: string
  Priority_of_Issue?: string
  repair_details?: string
  date_completed?: string
  date_closed?: string
  closed_by?: string
  total_repair_cost?: number
  repair_images?: string[]
}

type VendorDetails = {
  vendor?: string;      vendor_cost?: number
  vendor_2?: string;    vendor_cost_2?: number
  vendor_3?: string;    vendor_cost_3?: number
  vendor_4?: string;    vendor_cost_4?: number
  vendor_5?: string;    vendor_cost_5?: number
  vendor_6?: string;    vendor_cost_6?: number
  vendor_7?: string;    vendor_cost_7?: number
  total_cost?: number
}

type TicketRow = {
  id: number
  Department?: string
  Issue_Date?: string
  Location_Type?: string
  Field?: string
  Area?: string
  Route?: string
  Well?: string
  Facility?: string
  Equipment_Type?: string
  Equipment?: string
  Issue_Description?: string
  Troubleshooting_Conducted?: string
  Issue_Photos?: string[]
  Created_by_Name?: string
  Asset?: string
  assigned_foreman?: string
  Estimate_Cost?: number | null
}

type DispatchExtras = {
  self_dispatch_assignee?: string
  date_assigned?: string
  work_order_decision?: string
}

const clean = (v: unknown): string =>
  v === null || v === undefined || String(v).trim() === '' ? '—' : String(v).trim()

const fmtDate = (v: unknown): string => {
  if (!v) return '—'
  const d = new Date(String(v))
  return isNaN(d.getTime()) ? clean(v) : d.toLocaleDateString()
}

const section = (title: string, lines: string[]) =>
  `<div style="margin:14px 0;"><strong>${title}</strong><br><br>${lines.map(l => `${l}<br>`).join('')}<br></div>`

function buildEmailParts(r: TicketRow) {
  const well = clean(r.Well)
  const facility = clean(r.Facility)
  const wfLabel = well !== '—' ? 'Well' : 'Facility'
  const wfValue = well !== '—' ? well : facility !== '—' ? facility : '—'

  const id             = String(r.id)
  const department     = clean(r.Department)
  const issueDate      = fmtDate(r.Issue_Date)
  const locationType   = clean(r.Location_Type)
  const field          = clean(r.Field)
  const area           = clean(r.Area)
  const route          = clean(r.Route)
  const submittedBy    = clean(r.Created_by_Name)
  const issueDesc      = clean(r.Issue_Description)
  const troubleshoot   = clean(r.Troubleshooting_Conducted)
  const equipmentType  = clean(r.Equipment_Type)
  const equipment      = clean(r.Equipment)
  const asset          = clean(r.Asset)
  const assignedForeman = clean(r.assigned_foreman)

  const photoUrls: string[] = Array.isArray(r.Issue_Photos)
    ? r.Issue_Photos.filter(Boolean)
    : []

  const ticketUrl = `${APP_URL}/tickets/${id}`

  const deeplinkHtml = `
    <div style="margin:16px 0 24px;">
      <a href="${ticketUrl}"
         style="display:inline-block;padding:12px 18px;border-radius:6px;
                background:#1B2E6B;color:#fff;text-decoration:none;font-weight:600;">
        View Ticket #${id}
      </a>
    </div>
  `

  const locLines = [
    `Asset: ${asset}`,
    `Area: ${area}`,
    `Field: ${field}`,
    `Route: ${route}`,
    `Location Type: ${locationType}`,
    `${wfLabel}: ${wfValue}`,
    `Submission Date: ${issueDate}`,
    ...(assignedForeman !== '—' ? [`Assigned Foreman: ${assignedForeman}`] : []),
    `Submitted by: ${submittedBy}`,
  ]

  const locHtml      = section('Maintenance Details', locLines)
  const eqpHtml      = section('Equipment Details', [`Equipment Type: ${equipmentType}`, `Equipment: ${equipment}`])
  const issueHtml    = section('Issue Details', [`Department: ${department}`, `Issue Description: ${issueDesc}`, `Troubleshooting Conducted: ${troubleshoot}`])

  const photosHtml = photoUrls.length
    ? `<div style="margin:14px 0;"><strong>Issue Photos</strong><br><br>${photoUrls.map((u, i) =>
        `<div style="margin:8px 0;"><img src="${u}" alt="Issue photo ${i + 1}" style="max-width:600px;width:100%;height:auto;display:block;border-radius:8px;"></div>`
      ).join('')}</div>`
    : ''

  const sectionsHtml = locHtml + eqpHtml + issueHtml + photosHtml

  return { id, wfValue, deeplinkHtml, sectionsHtml }
}

export function newTicketEmail(r: TicketRow) {
  const { id, wfValue, deeplinkHtml, sectionsHtml } = buildEmailParts(r)
  return {
    subject: `New ticket #${id} — ${wfValue}`,
    html: deeplinkHtml + sectionsHtml,
  }
}

export function newTicketDispatchEmail(r: TicketRow, dispatch: DispatchExtras & { maintenance_foreman?: string; production_foreman?: string; self_dispatch_assignee?: string }) {
  const { id, wfValue, deeplinkHtml, sectionsHtml } = buildEmailParts(r)

  const hasVal = (v?: string) => v != null && v.trim() !== '' && v !== '—'

  const toTitleCase = (s?: string) =>
    s ? s.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '—'

  const estimatedCost = (() => {
    const n = Number(r.Estimate_Cost)
    return Number.isFinite(n) && r.Estimate_Cost != null
      ? n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
      : '—'
  })()

  const dispatchLines = [
    `Work Order Decision: ${clean(dispatch.work_order_decision)}`,
    ...(hasVal(estimatedCost) && estimatedCost !== '—' ? [`Estimated Cost: ${estimatedCost}`] : []),
    ...(hasVal(dispatch.self_dispatch_assignee) ? [`Self Dispatch Assignee: ${toTitleCase(dispatch.self_dispatch_assignee)}`] : []),
    ...(hasVal(dispatch.maintenance_foreman) ? [`Assigned Foreman: ${dispatch.maintenance_foreman}`] : []),
    ...(hasVal(dispatch.production_foreman) ? [`Production Foreman: ${dispatch.production_foreman}`] : []),
    `Date Assigned: ${fmtDate(dispatch.date_assigned)}`,
  ]

  const dispatchHtml = section('Dispatch Details', dispatchLines)

  return {
    subject: `Ticket #${id} Dispatched – ${wfValue}`,
    html: deeplinkHtml + dispatchHtml + sectionsHtml,
  }
}

type DispatchData = {
  work_order_decision?: string
  Estimate_Cost?: number | null
  self_dispatch_assignee?: string
  maintenance_foreman?: string
  production_foreman?: string
  date_assigned?: string
}

export function repairCloseoutEmail(
  r: TicketRow,
  repairs: RepairRow,
  vendorData: VendorDetails | null,
  dispatch: DispatchData | null,
) {
  const { id, wfValue, deeplinkHtml, sectionsHtml } = buildEmailParts(r)
  const priority = clean(repairs.Priority_of_Issue)

  const hasVal = (v: unknown) => v != null && String(v).trim() !== '' && String(v).trim().toLowerCase() !== 'null' && String(v).trim() !== '—'

  const fmtMoney = (v: unknown): string => {
    const n = Number(String(v).replace(/[^\d.-]/g, ''))
    return Number.isFinite(n)
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
      : clean(v)
  }

  const toTitleCase = (s: unknown): string => {
    const str = clean(s)
    if (str === '—') return str
    return str.toLowerCase().split(' ').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  // Total repair cost: prefer vpd.total_cost, else rc.total_repair_cost
  const totalRepairCost = vendorData?.total_cost != null && String(vendorData.total_cost).trim() !== ''
    ? fmtMoney(vendorData.total_cost)
    : repairs.total_repair_cost != null ? fmtMoney(repairs.total_repair_cost) : '—'

  // Vendor breakdown lines
  const vendorBreakdownLines: string[] = []
  if (vendorData) {
    const pairs: [string | undefined, number | undefined][] = [
      [vendorData.vendor,   vendorData.vendor_cost],
      [vendorData.vendor_2, vendorData.vendor_cost_2],
      [vendorData.vendor_3, vendorData.vendor_cost_3],
      [vendorData.vendor_4, vendorData.vendor_cost_4],
      [vendorData.vendor_5, vendorData.vendor_cost_5],
      [vendorData.vendor_6, vendorData.vendor_cost_6],
      [vendorData.vendor_7, vendorData.vendor_cost_7],
    ]
    pairs.forEach(([v, c], i) => {
      if (hasVal(v) || hasVal(c)) {
        const nm = clean(v)
        const cs = hasVal(c) ? fmtMoney(c) : ''
        vendorBreakdownLines.push(`Vendor ${i + 1}: ${nm}${cs ? ` — Cost: ${cs}` : ''}`)
      }
    })
  }

  // Repair / Closeout Details (with vendor breakdown nested inside)
  const closeoutLines: string[] = [
    ...(hasVal(repairs.final_status) ? [`Final Status: ${clean(repairs.final_status)}`] : []),
    ...(hasVal(repairs.start_date) ? [`Start Date: ${fmtDate(repairs.start_date)}`] : []),
    ...(hasVal(repairs.Work_Order_Type) ? [`Work Order Type: ${clean(repairs.Work_Order_Type)}`] : []),
    ...(hasVal(priority) && priority !== '—' ? [`Priority: ${priority}`] : []),
    ...(hasVal(repairs.repair_details) ? [`Repair Details: ${clean(repairs.repair_details)}`] : []),
    ...(hasVal(totalRepairCost) && totalRepairCost !== '—' ? [`Total Repair Cost: ${totalRepairCost}`] : []),
    ...(hasVal(repairs.date_completed) ? [`Date Completed: ${fmtDate(repairs.date_completed)}`] : []),
    ...(hasVal(repairs.date_closed) ? [`Date Closed: ${fmtDate(repairs.date_closed)}`] : []),
    ...(hasVal(repairs.closed_by) ? [`Closed By: ${toTitleCase(repairs.closed_by)}`] : []),
    ...(vendorBreakdownLines.length ? ['<br><strong>Vendor Breakdown</strong><br>', ...vendorBreakdownLines] : []),
  ]
  const closeoutHtml = section('Repair / Closeout Details', closeoutLines)

  // Dispatch Details section
  const estimatedCost = (() => {
    const v = dispatch?.Estimate_Cost ?? r.Estimate_Cost
    if (v == null || String(v).trim() === '') return '—'
    const n = Number(v)
    return Number.isFinite(n) ? n.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : clean(v)
  })()

  const dispatchLines: string[] = [
    ...(hasVal(dispatch?.work_order_decision) ? [`Work Order Decision: ${clean(dispatch?.work_order_decision)}`] : []),
    ...(hasVal(estimatedCost) && estimatedCost !== '—' ? [`Estimated Cost: ${estimatedCost}`] : []),
    ...(hasVal(dispatch?.self_dispatch_assignee) ? [`Self Dispatch Assignee: ${toTitleCase(dispatch?.self_dispatch_assignee)}`] : []),
    ...(hasVal(dispatch?.maintenance_foreman) ? [`Assigned Foreman: ${toTitleCase(dispatch?.maintenance_foreman)}`] : []),
    ...(hasVal(dispatch?.production_foreman) ? [`Production Foreman: ${toTitleCase(dispatch?.production_foreman)}`] : []),
    ...(hasVal(dispatch?.date_assigned) ? [`Date Assigned: ${fmtDate(dispatch?.date_assigned)}`] : []),
  ]
  const dispatchHtml = dispatchLines.length > 0 ? section('Dispatch Details', dispatchLines) : ''

  // Repair Photos
  const repairImgUrls = Array.isArray(repairs.repair_images) ? repairs.repair_images.filter(Boolean) : []
  const repairPhotosHtml = repairImgUrls.length
    ? `<div style="margin:14px 0;"><strong>Repair Photos</strong><br><br>${repairImgUrls.map((u, i) =>
        `<div style="margin:8px 0;"><img src="${u}" alt="Repair photo ${i + 1}" style="max-width:600px;width:100%;height:auto;display:block;border-radius:8px;"></div>`
      ).join('')}</div>`
    : ''

  // Order: deeplink → closeout → dispatch → maintenance/equipment/issue/issuePhotos → repairPhotos
  return {
    subject: `Repair / Closeout for ticket #${id} – ${wfValue} (${priority})`,
    html: deeplinkHtml + closeoutHtml + dispatchHtml + sectionsHtml + repairPhotosHtml,
  }
}

export function selfDispatchEmail(r: TicketRow, dispatch: DispatchExtras) {
  const { id, wfValue, deeplinkHtml, sectionsHtml } = buildEmailParts(r)

  const toTitleCase = (s?: string) =>
    s ? s.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '—'

  const estimatedCost = (() => {
    const n = Number(r.Estimate_Cost)
    return Number.isFinite(n)
      ? n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
      : '—'
  })()

  const dispatchHtml = section('Dispatch Details', [
    `Work Order Decision: ${dispatch.work_order_decision ?? 'Proceed with Repair'}`,
    `Estimated Cost: ${estimatedCost}`,
    `Self Dispatch Assignee: ${toTitleCase(dispatch.self_dispatch_assignee)}`,
    `Date Assigned: ${fmtDate(dispatch.date_assigned)}`,
  ])

  return {
    subject: `Ticket #${id} Self Dispatched — ${wfValue}`,
    html: deeplinkHtml + dispatchHtml + sectionsHtml,
  }
}
