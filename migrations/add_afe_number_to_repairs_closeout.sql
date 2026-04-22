-- Add AFE_Number column to repairs_closeout for AFE Execute integration.
-- Stores the selected AFE number when Work_Order_Type is "AFE - Workover" or "AFE - Capital".

ALTER TABLE repairs_closeout
  ADD COLUMN IF NOT EXISTS "AFE_Number" TEXT;
