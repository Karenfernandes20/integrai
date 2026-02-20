-- Add Instagram Business ID support to companies without breaking existing records
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS instagram_business_id VARCHAR;

-- Fix missing group_subject column for environments that use whatsapp_conversations
ALTER TABLE whatsapp_conversations
ADD COLUMN IF NOT EXISTS group_subject VARCHAR;

-- Fix missing group_subject column for environments that still use conversations table naming
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
  ) THEN
    EXECUTE 'ALTER TABLE conversations ADD COLUMN IF NOT EXISTS group_subject VARCHAR';
  END IF;
END $$;

-- Optional performance for Instagram webhook company resolution
CREATE INDEX IF NOT EXISTS idx_companies_instagram_business_id
  ON companies (instagram_business_id)
  WHERE instagram_business_id IS NOT NULL;
