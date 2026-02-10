
-- Chatbot Professional Evolution Migration

-- 1. Create chatbots table (or rename bots if you prefer, but let's create a clean one for the new system)
CREATE TABLE IF NOT EXISTS chatbots (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft', -- draft, published
  active_version_id INTEGER, -- FK to chatbot_versions (added after table creation)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create chatbot_versions table
CREATE TABLE IF NOT EXISTS chatbot_versions (
  id SERIAL PRIMARY KEY,
  chatbot_id INTEGER REFERENCES chatbots(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  flow_json JSONB NOT NULL DEFAULT '{}',
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add the circular reference back to chatbots
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'chatbots_active_version_id_fkey') THEN
    ALTER TABLE chatbots ADD CONSTRAINT chatbots_active_version_id_fkey 
    FOREIGN KEY (active_version_id) REFERENCES chatbot_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Create chatbot_sessions table (Contextual state)
CREATE TABLE IF NOT EXISTS chatbot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id INTEGER REFERENCES chatbots(id) ON DELETE CASCADE,
  contact_key VARCHAR(100) NOT NULL, -- phone number or unique ID
  instance_key VARCHAR(100) NOT NULL,
  current_node_id VARCHAR(100),
  variables JSONB DEFAULT '{}',
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(chatbot_id, contact_key, instance_key)
);

-- 4. Create chatbot_logs table
CREATE TABLE IF NOT EXISTS chatbot_logs (
  id SERIAL PRIMARY KEY,
  chatbot_id INTEGER REFERENCES chatbots(id) ON DELETE CASCADE,
  contact_key VARCHAR(100),
  instance_key VARCHAR(100),
  node_id VARCHAR(100),
  payload_received TEXT,
  response_sent TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Linking Chatbots to Instances (Multi-instance support)
CREATE TABLE IF NOT EXISTS chatbot_instances (
  id SERIAL PRIMARY KEY,
  chatbot_id INTEGER REFERENCES chatbots(id) ON DELETE CASCADE,
  instance_key VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(chatbot_id, instance_key)
);
