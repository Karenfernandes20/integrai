
import { pool } from './index';

export const runLavajatoMigrations = async () => {
    if (!pool) return;
    try {
        console.log("*************************************************");
        console.log("STARTING LAVAJATO MIGRATIONS");
        console.log("*************************************************");

        // 1. Update Companies Table
        try {
            await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'generic';`);
            console.log("Verified category in companies");
        } catch (e) { console.error("Error adding category to companies:", e); }

        // 2. Lavajato Boxes
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS lavajato_boxes (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                    name VARCHAR(100) NOT NULL,
                    type VARCHAR(50) DEFAULT 'Lavagem', -- Lavagem, Secagem, Polimento, etc
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            `);
            console.log("Verified table: lavajato_boxes");
        } catch (e) { console.error("Error creating lavajato_boxes:", e); }

        // 3. Lavajato Services
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS lavajato_services (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                    estimated_time INTEGER DEFAULT 60, -- em minutos
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            `);
            console.log("Verified table: lavajato_services");
        } catch (e) { console.error("Error creating lavajato_services:", e); }

        // 4. Lavajato Vehicles
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS lavajato_vehicles (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                    instance_id INTEGER, -- Ref to company_instances.id
                    client_id INTEGER REFERENCES crm_leads(id) ON DELETE SET NULL,
                    plate VARCHAR(20) NOT NULL,
                    brand VARCHAR(100),
                    model VARCHAR(100),
                    color VARCHAR(50),
                    vehicle_type VARCHAR(20) DEFAULT 'Carro', -- Carro, Moto, Caminhão, etc
                    observations TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_lavajato_vehicles_plate ON lavajato_vehicles(plate);
                CREATE INDEX IF NOT EXISTS idx_lavajato_vehicles_company_instance ON lavajato_vehicles(company_id, instance_id);
            `);
            console.log("Verified table: lavajato_vehicles");
        } catch (e) { console.error("Error creating lavajato_vehicles:", e); }

        // 5. Lavajato Appointments (Agenda)
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS lavajato_appointments (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                    instance_id INTEGER, 
                    vehicle_id INTEGER REFERENCES lavajato_vehicles(id) ON DELETE CASCADE,
                    client_id INTEGER REFERENCES crm_leads(id) ON DELETE CASCADE,
                    service_id INTEGER REFERENCES lavajato_services(id) ON DELETE SET NULL,
                    box_id INTEGER REFERENCES lavajato_boxes(id) ON DELETE SET NULL,
                    staff_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                    appointment_date DATE NOT NULL,
                    start_time TIME NOT NULL,
                    end_time TIME NOT NULL,
                    estimated_value DECIMAL(10, 2) DEFAULT 0.00,
                    status VARCHAR(50) DEFAULT 'agendado', -- agendado, confirmado, chegou, lavagem, finalizado, cancelado, faltou
                    observations TEXT,
                    qr_code_id VARCHAR(100), -- For Check-in logic
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_lavajato_appt_company_instance ON lavajato_appointments(company_id, instance_id);
                CREATE INDEX IF NOT EXISTS idx_lavajato_appt_date ON lavajato_appointments(appointment_date);
            `);
            console.log("Verified table: lavajato_appointments");
        } catch (e) { console.error("Error creating lavajato_appointments:", e); }

        // 6. Lavajato Service Orders (OS)
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS lavajato_service_orders (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                    instance_id INTEGER,
                    appointment_id INTEGER REFERENCES lavajato_appointments(id) ON DELETE SET NULL,
                    vehicle_id INTEGER REFERENCES lavajato_vehicles(id) ON DELETE CASCADE,
                    client_id INTEGER REFERENCES crm_leads(id) ON DELETE CASCADE,
                    staff_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                    items JSONB DEFAULT '[]', -- List of services/products added
                    total_value DECIMAL(12, 2) DEFAULT 0.00,
                    payment_status VARCHAR(20) DEFAULT 'pending', -- pending, paid, partial
                    payment_method VARCHAR(50),
                    status VARCHAR(20) DEFAULT 'aberta', -- aberta, em_execucao, finalizada, paga
                    started_at TIMESTAMP,
                    finished_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_lavajato_os_company_instance ON lavajato_service_orders(company_id, instance_id);
                CREATE INDEX IF NOT EXISTS idx_lavajato_os_status ON lavajato_service_orders(status);
            `);
            console.log("Verified table: lavajato_service_orders");
        } catch (e) { console.error("Error creating lavajato_service_orders:", e); }

        // 7. Lavajato VIP Plans
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS lavajato_plans (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                    name VARCHAR(100) NOT NULL,
                    description TEXT,
                    price DECIMAL(10, 2) NOT NULL,
                    wash_limit INTEGER DEFAULT 4,
                    billing_cycle VARCHAR(20) DEFAULT 'mensal',
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
                
                CREATE TABLE IF NOT EXISTS lavajato_client_subscriptions (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                    instance_id INTEGER,
                    client_id INTEGER NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
                    plan_id INTEGER NOT NULL REFERENCES lavajato_plans(id) ON DELETE CASCADE,
                    status VARCHAR(20) DEFAULT 'active', -- active, overdue, cancelled
                    last_wash_at TIMESTAMP,
                    washes_used_this_month INTEGER DEFAULT 0,
                    next_billing_date DATE,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);
            console.log("Verified VIP Plan tables");
        } catch (e) { console.error("Error creating plan tables:", e); }

        // 8. Enforce instance_id in existing related tables
        try {
            await pool.query(`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS instance_id INTEGER REFERENCES company_instances(id) ON DELETE SET NULL;`);
            await pool.query(`ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS instance_id INTEGER REFERENCES company_instances(id) ON DELETE SET NULL;`);
            await pool.query(`ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS instance_id INTEGER REFERENCES company_instances(id) ON DELETE SET NULL;`);
            await pool.query(`ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS instance_id INTEGER REFERENCES company_instances(id) ON DELETE SET NULL;`);

            console.log("Extended existing tables with instance_id");
        } catch (e) { console.error("Error extending existing tables:", e); }

        console.log("LAVAJATO MIGRATIONS FINISHED.");
    } catch (e) {
        console.error("Lavajato Migration Error:", e);
    }
};
