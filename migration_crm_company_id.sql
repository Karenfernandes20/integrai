-- Migration: Add company_id to crm_stages and crm_leads
-- Run this in Supabase SQL Editor

-- 1. Add company_id column to crm_stages
ALTER TABLE crm_stages 
ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

-- 2. Add company_id column to crm_leads (if not exists)
ALTER TABLE crm_leads 
ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

-- 3. Create index for better performance
CREATE INDEX IF NOT EXISTS idx_crm_stages_company ON crm_stages(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_company ON crm_leads(company_id);

-- 4. Update existing stages to belong to first company (if any exist without company_id)
UPDATE crm_stages 
SET company_id = (SELECT MIN(id) FROM companies) 
WHERE company_id IS NULL;

-- 5. Update existing leads to belong to first company (if any exist without company_id)
UPDATE crm_leads 
SET company_id = (SELECT MIN(id) FROM companies) 
WHERE company_id IS NULL;
-- 6. Add color column to crm_stages
ALTER TABLE crm_stages 
ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#cbd5e1';
