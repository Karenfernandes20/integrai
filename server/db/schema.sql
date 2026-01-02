-- Schema inicial do banco de dados ViaMoveCar Admin (Postgres)
-- Compatível com Render + PgHero

-- Tabela de cidades
CREATE TABLE IF NOT EXISTS cities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  state CHAR(2) NOT NULL,
  color_hex VARCHAR(7), -- Cor usada na interface (ex: #FFCC00)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuários administrativos (superadmin, admin)
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuários finais (passageiros, motoristas)
CREATE TABLE IF NOT EXISTS app_users (
  id SERIAL PRIMARY KEY,
  full_name TEXT,
  phone TEXT UNIQUE,
  email TEXT,
  user_type TEXT NOT NULL CHECK (user_type IN ('passenger', 'driver')),
  city_id INTEGER REFERENCES cities(id),
  state CHAR(2),
  status TEXT DEFAULT 'active', -- active, pending, blocked
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Corridas
CREATE TABLE IF NOT EXISTS rides (
  id SERIAL PRIMARY KEY,
  passenger_id INTEGER REFERENCES app_users(id),
  driver_id INTEGER REFERENCES app_users(id),
  origin_city_id INTEGER REFERENCES cities(id),
  destination_city_id INTEGER REFERENCES cities(id),
  price NUMERIC(10,2) NOT NULL,
  platform_commission NUMERIC(10,2) DEFAULT 0,
  driver_commission NUMERIC(10,2) DEFAULT 0,
  local_partner_commission NUMERIC(10,2) DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('requested', 'in_progress', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lançamentos financeiros genéricos (a pagar / a receber)
CREATE TABLE IF NOT EXISTS financial_transactions (
  id SERIAL PRIMARY KEY,
  city_id INTEGER REFERENCES cities(id),
  ride_id INTEGER REFERENCES rides(id),
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('payable', 'receivable')),
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'cancelled')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fases do funil do CRM
CREATE TABLE IF NOT EXISTS crm_stages (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  color VARCHAR(7) DEFAULT '#cbd5e1',
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads do CRM
CREATE TABLE IF NOT EXISTS crm_leads (
  id SERIAL PRIMARY KEY,
  name TEXT,
  phone TEXT,
  city_id INTEGER REFERENCES cities(id),
  state CHAR(2),
  origin TEXT, -- WhatsApp, App, Indicação, etc.
  stage_id INTEGER REFERENCES crm_stages(id),
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversas de WhatsApp (Atendimento)
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id SERIAL PRIMARY KEY,
  external_id TEXT UNIQUE, -- ID da conversa no provedor (ex: Evolution API)
  phone TEXT NOT NULL,
  contact_name TEXT,
  city_id INTEGER REFERENCES cities(id),
  state CHAR(2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mensagens de WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT,
  media_url TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
