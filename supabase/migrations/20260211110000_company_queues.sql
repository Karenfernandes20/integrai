CREATE TABLE IF NOT EXISTS company_queues (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#3B82F6',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS company_queues_unique_name_per_company
  ON company_queues(company_id, LOWER(name));

ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS queue_id INTEGER REFERENCES company_queues(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_queue_id
  ON whatsapp_conversations(queue_id);
