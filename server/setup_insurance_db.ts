
import 'dotenv/config';
import { pool } from './db';

const setupClinicalInsuranceAndBI = async () => {
    if (!pool) {
        console.error("No DB Pool");
        return;
    }
    try {
        console.log("Creating Insurance and BI tables for Clinical module...");

        // 1. Insurance Plans Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm_insurance_plans (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                code VARCHAR(100),
                type VARCHAR(50), -- 'CONVENIO', 'PLANO_PROPRIO', 'PARTICULAR'
                contact_phone VARCHAR(50),
                email VARCHAR(255),
                region VARCHAR(255),
                status VARCHAR(20) DEFAULT 'ACTIVE',
                repayment_days_avg INTEGER DEFAULT 30,
                rules TEXT,
                procedures_table JSONB DEFAULT '[]',
                color VARCHAR(7) DEFAULT '#3b82f6',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 2. Professional-Insurance Config mapping
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm_professional_insurance_config (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                professional_id INTEGER NOT NULL REFERENCES crm_professionals(id) ON DELETE CASCADE,
                insurance_plan_id INTEGER NOT NULL REFERENCES crm_insurance_plans(id) ON DELETE CASCADE,
                consultation_value DECIMAL(10,2) DEFAULT 0,
                commission_value DECIMAL(10,2) DEFAULT 0,
                commission_type VARCHAR(20) DEFAULT 'FIXED', -- 'FIXED', 'PERCENT'
                monthly_limit INTEGER,
                priority INTEGER DEFAULT 0,
                active BOOLEAN DEFAULT TRUE,
                UNIQUE(professional_id, insurance_plan_id)
            );
        `);

        // 3. Update Appointments for Insurance
        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_appointments' AND column_name='insurance_plan_id') THEN
                    ALTER TABLE crm_appointments ADD COLUMN insurance_plan_id INTEGER REFERENCES crm_insurance_plans(id) ON DELETE SET NULL;
                    ALTER TABLE crm_appointments ADD COLUMN procedure_code VARCHAR(50);
                    ALTER TABLE crm_appointments ADD COLUMN billing_amount DECIMAL(10,2) DEFAULT 0;
                    ALTER TABLE crm_appointments ADD COLUMN billing_status VARCHAR(50) DEFAULT 'PENDING'; -- 'PENDING', 'PAID', 'GLOSA', 'PARTIAL'
                    ALTER TABLE crm_appointments ADD COLUMN glosa_reason TEXT;
                    ALTER TABLE crm_appointments ADD COLUMN glosa_value DECIMAL(10,2) DEFAULT 0;
                END IF;
            END $$;
        `);

        // 4. Update Leads for Insurance
        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='insurance_plan_id') THEN
                    ALTER TABLE crm_leads ADD COLUMN insurance_plan_id INTEGER REFERENCES crm_insurance_plans(id) ON DELETE SET NULL;
                    ALTER TABLE crm_leads ADD COLUMN insurance_card_number VARCHAR(100);
                    ALTER TABLE crm_leads ADD COLUMN insurance_validity DATE;
                    ALTER TABLE crm_leads ADD COLUMN insurance_coverage_type VARCHAR(100);
                END IF;
            END $$;
        `);

        console.log("Clinical Insurance & BI Database Setup Complete.");
    } catch (error) {
        console.error("Error setting up clinical insurance tables:", error);
    } finally {
        pool.end();
    }
};

setupClinicalInsuranceAndBI();
