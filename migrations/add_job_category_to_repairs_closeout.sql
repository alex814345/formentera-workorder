-- Add Job_Category column to Repairs_Closeout.
-- Populated from FO_PRODUCTION_DB.GOLD_DEVELOPMENT.DIM_JOB.JOB_CATEGORY
-- for the selected AFE Number on the repairs form.

ALTER TABLE "Repairs_Closeout"
  ADD COLUMN IF NOT EXISTS "Job_Category" TEXT;
