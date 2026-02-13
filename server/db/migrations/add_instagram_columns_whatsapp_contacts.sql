ALTER TABLE whatsapp_contacts
ADD COLUMN IF NOT EXISTS instagram_username VARCHAR(255);

ALTER TABLE whatsapp_contacts
ADD COLUMN IF NOT EXISTS instagram_id VARCHAR(255);
