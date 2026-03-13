-- ============================================================
-- Formentera Work Order App — Supabase Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension (already enabled in Supabase by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- employees
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  job_title   TEXT,
  manager     TEXT,
  work_email  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- equipment_Type
-- ============================================================
CREATE TABLE IF NOT EXISTS "equipment_Type" (
  id                  TEXT PRIMARY KEY,
  equipment_type      TEXT NOT NULL,
  department_owner_id TEXT
);

-- ============================================================
-- equipment_library
-- ============================================================
CREATE TABLE IF NOT EXISTS equipment_library (
  id          SERIAL PRIMARY KEY,
  match_type  TEXT,         -- 'Well' or 'Facility'
  equip_name  TEXT NOT NULL,
  equip_code  TEXT,
  type        TEXT          -- links to equipment_Type.equipment_type
);

-- ============================================================
-- Maintenance_Form_Submission
-- ============================================================
CREATE TABLE IF NOT EXISTS "Maintenance_Form_Submission" (
  id                      SERIAL PRIMARY KEY,
  "Department"            TEXT,
  "Issue_Date"            TIMESTAMPTZ DEFAULT NOW(),
  "Location_Type"         TEXT,
  "Field"                 TEXT,
  "Route"                 TEXT,
  "Facility"              TEXT,
  "Equipment_Type"        TEXT,
  "Equipment"             TEXT,
  "Issue_Description"     TEXT,
  "Troubleshooting_Conducted" TEXT,
  "Contacted_Vendor"      TEXT,
  "Priority_of_Issue"     TEXT,
  "Issue_Photos"          JSONB DEFAULT '[]',
  "Well"                  TEXT,
  "Created_by_Email"      TEXT,
  "Created_by_Name"       TEXT,
  "Ticket_Status"         TEXT DEFAULT 'Open',
  "Asset"                 TEXT,
  "Area"                  TEXT,
  "Work_Order_Type"       TEXT,
  "Self_Dispatch_Assignee" TEXT,
  "Estimate_Cost"         NUMERIC(12, 2),
  assigned_foreman        TEXT
);

-- ============================================================
-- Dispatch
-- ============================================================
CREATE TABLE IF NOT EXISTS "Dispatch" (
  id                      SERIAL PRIMARY KEY,
  ticket_id               INTEGER REFERENCES "Maintenance_Form_Submission"(id) ON DELETE CASCADE,
  maintenance_foreman     TEXT,
  date_assigned           TIMESTAMPTZ,
  due_date                TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  production_foreman      TEXT,
  work_order_decision     TEXT,
  ticket_status           TEXT,
  self_dispatch_assignee  TEXT,
  "Estimate_Cost"         NUMERIC(12, 2)
);

-- ============================================================
-- Repairs_Closeout
-- ============================================================
CREATE TABLE IF NOT EXISTS "Repairs_Closeout" (
  id                  SERIAL PRIMARY KEY,
  ticket_id           INTEGER REFERENCES "Maintenance_Form_Submission"(id) ON DELETE CASCADE,
  start_date          TIMESTAMPTZ,
  repair_details      TEXT,
  repair_images       JSONB DEFAULT '[]',
  vendor              TEXT,
  total_repair_cost   NUMERIC(12, 2),
  date_completed      TIMESTAMPTZ,
  final_status        TEXT,
  date_closed         TIMESTAMPTZ,
  closed_by           TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  created_by          TEXT,
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  "Work_Order_Type"   TEXT,
  "Priority_of_Issue" TEXT
);

-- ============================================================
-- vendor_payment_details
-- ============================================================
CREATE TABLE IF NOT EXISTS vendor_payment_details (
  id              SERIAL PRIMARY KEY,
  ticket_id       INTEGER UNIQUE REFERENCES "Maintenance_Form_Submission"(id) ON DELETE CASCADE,
  vendor          TEXT,
  vendor_cost     NUMERIC(12, 2),
  vendor_2        TEXT,
  vendor_cost_2   NUMERIC(12, 2),
  vendor_3        TEXT,
  vendor_cost_3   NUMERIC(12, 2),
  vendor_4        TEXT,
  vendor_cost_4   NUMERIC(12, 2),
  vendor_5        TEXT,
  vendor_cost_5   NUMERIC(12, 2),
  vendor_6        TEXT,
  vendor_cost_6   NUMERIC(12, 2),
  vendor_7        TEXT,
  vendor_cost_7   NUMERIC(12, 2),
  total_cost      NUMERIC(12, 2),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ticket_comments — matches existing comments table exactly
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
  id            SERIAL PRIMARY KEY,
  ticket_id     INTEGER REFERENCES "Maintenance_Form_Submission"(id) ON DELETE CASCADE,
  author_name   TEXT,
  author_email  TEXT,
  body          TEXT NOT NULL,
  parent_id     INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- workorder_ticket_summary (view — replaces CSV table)
-- ============================================================
CREATE OR REPLACE VIEW workorder_ticket_summary AS
SELECT
  m.id                          AS ticket_id,
  m."Department"                AS department,
  m."Issue_Date"                AS issue_date,
  m."Work_Order_Type"           AS work_order_type,
  m."Estimate_Cost"             AS "Estimate_Cost",
  m."Priority_of_Issue"         AS priority_of_issue,
  m."Issue_Description"         AS issue_description,
  m."Location_Type"             AS location_type,
  m."Equipment_Type"            AS equipment_type,
  m."Equipment"                 AS equipment_name,
  m."Asset"                     AS asset,
  m."Area"                      AS area,
  m."Field"                     AS field,
  m."Route"                     AS route,
  m."Well"                      AS well,
  m."Facility"                  AS facility,
  m."Ticket_Status"             AS ticket_status,
  d.work_order_decision,
  d.self_dispatch_assignee,
  d.production_foreman,
  d.maintenance_foreman,
  d.date_assigned,
  d.due_date,
  rc.final_status,
  rc.start_date                 AS repair_start_date,
  rc.repair_details,
  rc.vendor                     AS repair_vendor,
  rc.total_repair_cost,
  rc.date_completed             AS repair_date_completed,
  rc.date_closed                AS repair_date_closed,
  rc.closed_by,
  m."Created_by_Name"           AS created_by
FROM "Maintenance_Form_Submission" m
LEFT JOIN LATERAL (
  SELECT * FROM "Dispatch" d
  WHERE d.ticket_id = m.id
  ORDER BY d.date_assigned DESC NULLS LAST, d.id DESC
  LIMIT 1
) d ON TRUE
LEFT JOIN LATERAL (
  SELECT * FROM "Repairs_Closeout" rc
  WHERE rc.ticket_id = m.id
  ORDER BY rc.created_at DESC NULLS LAST, rc.id DESC
  LIMIT 1
) rc ON TRUE;

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_mfs_ticket_status   ON "Maintenance_Form_Submission"("Ticket_Status");
CREATE INDEX IF NOT EXISTS idx_mfs_issue_date      ON "Maintenance_Form_Submission"("Issue_Date" DESC);
CREATE INDEX IF NOT EXISTS idx_mfs_asset           ON "Maintenance_Form_Submission"("Asset");
CREATE INDEX IF NOT EXISTS idx_mfs_created_by_email ON "Maintenance_Form_Submission"("Created_by_Email");
CREATE INDEX IF NOT EXISTS idx_dispatch_ticket_id  ON "Dispatch"(ticket_id);
CREATE INDEX IF NOT EXISTS idx_rc_ticket_id        ON "Repairs_Closeout"(ticket_id);
CREATE INDEX IF NOT EXISTS idx_vpd_ticket_id       ON vendor_payment_details(ticket_id);
CREATE INDEX IF NOT EXISTS idx_comments_ticket_id  ON comments(ticket_id);

-- ============================================================
-- Row Level Security (enable after configuring Supabase Auth)
-- ============================================================
-- ALTER TABLE "Maintenance_Form_Submission" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Dispatch" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Repairs_Closeout" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE vendor_payment_details ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
