
import { pool } from '../index';

export const runCrmAppointmentsMigration = async () => {
    if (!pool) return;
    try {
        console.log("Running CRM Appointments Migration...");

        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm_appointments (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                lead_id INTEGER REFERENCES crm_leads(id) ON DELETE SET NULL,
                client_name VARCHAR(255),
                phone VARCHAR(50),
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP NOT NULL,
                status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, confirmed, in_progress, completed, cancelled, no_show
                type VARCHAR(50) DEFAULT 'meeting', -- meeting, call, demo, support, sale
                responsible_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                description TEXT,
                location VARCHAR(255),
                meeting_link VARCHAR(255),
                google_event_id VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Indexes
        await pool.query('CREATE INDEX IF NOT EXISTS idx_crm_appointments_company ON crm_appointments(company_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_crm_appointments_date ON crm_appointments(start_time)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_crm_appointments_responsible ON crm_appointments(responsible_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_crm_appointments_lead ON crm_appointments(lead_id)');

        console.log("CRM Appointments table created/verified.");

    } catch (e) {
        console.error("Error running CRM Appointments migration:", e);
    }
};
