-- Fix columns to TEXT to avoid 'value too long' errors for Instagram/Messenger

-- whatsapp_messages
ALTER TABLE whatsapp_messages ALTER COLUMN external_id TYPE TEXT;
ALTER TABLE whatsapp_messages ALTER COLUMN sender_jid TYPE TEXT;
ALTER TABLE whatsapp_messages ALTER COLUMN instagram_message_id TYPE TEXT;

-- whatsapp_conversations
ALTER TABLE whatsapp_conversations ALTER COLUMN external_id TYPE TEXT;
ALTER TABLE whatsapp_conversations ALTER COLUMN phone TYPE TEXT;
ALTER TABLE whatsapp_conversations ALTER COLUMN instance TYPE TEXT;
ALTER TABLE whatsapp_conversations ALTER COLUMN instagram_user_id TYPE TEXT;
ALTER TABLE whatsapp_conversations ALTER COLUMN instagram_username TYPE TEXT;
ALTER TABLE whatsapp_conversations ALTER COLUMN messenger_user_id TYPE TEXT;

-- whatsapp_contacts
ALTER TABLE whatsapp_contacts ALTER COLUMN jid TYPE TEXT;
ALTER TABLE whatsapp_contacts ALTER COLUMN name TYPE TEXT;
ALTER TABLE whatsapp_contacts ALTER COLUMN push_name TYPE TEXT;
ALTER TABLE whatsapp_contacts ALTER COLUMN instance TYPE TEXT;
