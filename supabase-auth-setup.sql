-- ============================================================
-- Supabase Auth Setup
-- Run this AFTER supabase-migration.sql
-- ============================================================

-- 1. Enable Email auth in Supabase dashboard:
--    Authentication → Providers → Email → Enable

-- 2. Optional: Disable email confirmation for internal apps
--    Authentication → Settings → Disable "Enable email confirmations"

-- 3. Create users manually in Supabase dashboard:
--    Authentication → Users → Add user
--    OR use the SQL below to invite users programmatically

-- ============================================================
-- Row Level Security — enable once auth is working
-- ============================================================

ALTER TABLE "Maintenance_Form_Submission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Dispatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Repairs_Closeout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_payment_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipment_Type" ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_library ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Policies: All authenticated users can read/write
-- (tighten these per role later if needed)
-- ============================================================

-- Maintenance_Form_Submission
CREATE POLICY "auth_select" ON "Maintenance_Form_Submission"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert" ON "Maintenance_Form_Submission"
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update" ON "Maintenance_Form_Submission"
  FOR UPDATE TO authenticated USING (true);

-- Dispatch
CREATE POLICY "auth_select" ON "Dispatch"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert" ON "Dispatch"
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update" ON "Dispatch"
  FOR UPDATE TO authenticated USING (true);

-- Repairs_Closeout
CREATE POLICY "auth_select" ON "Repairs_Closeout"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert" ON "Repairs_Closeout"
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update" ON "Repairs_Closeout"
  FOR UPDATE TO authenticated USING (true);

-- vendor_payment_details
CREATE POLICY "auth_select" ON vendor_payment_details
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert" ON vendor_payment_details
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update" ON vendor_payment_details
  FOR UPDATE TO authenticated USING (true);

-- comments
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select" ON comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert" ON comments
  FOR INSERT TO authenticated WITH CHECK (true);

-- employees (read-only for all authenticated)
CREATE POLICY "auth_select" ON employees
  FOR SELECT TO authenticated USING (true);

-- equipment_Type (read-only)
CREATE POLICY "auth_select" ON "equipment_Type"
  FOR SELECT TO authenticated USING (true);

-- equipment_library (read-only)
CREATE POLICY "auth_select" ON equipment_library
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- User profile helper (optional)
-- Stores display name synced from auth.users metadata
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  email       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile" ON user_profiles
  FOR ALL TO authenticated USING (auth.uid() = id);

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
