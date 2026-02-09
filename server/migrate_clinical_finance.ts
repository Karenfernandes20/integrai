
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('Starting Clinical Finance migration...');

        await client.query('BEGIN');

        // Add clinical columns to financial_transactions
        await client.query(`
      ALTER TABLE financial_transactions
      ADD COLUMN IF NOT EXISTS patient_id INTEGER,
      ADD COLUMN IF NOT EXISTS professional_id INTEGER,
      ADD COLUMN IF NOT EXISTS insurance_plan_id INTEGER, -- FK to insurance_plans
      ADD COLUMN IF NOT EXISTS procedure_type VARCHAR(255), -- e.g. 'CONSULTA', 'EXAME', 'CIRURGIA'
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50), -- 'DINHEIRO', 'CARTAO', 'PIX', 'CONVENIO'
      ADD COLUMN IF NOT EXISTS attachment_url TEXT,
      ADD COLUMN IF NOT EXISTS installments JSONB DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS recurrence_id UUID DEFAULT NULL;
    `);

        // Ensure cost_centers table exists (it seems to be used by frontend)
        await client.query(`
      CREATE TABLE IF NOT EXISTS cost_centers (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

        // Add cost_center_id if helpful, but existing code might use string or simple relation.
        // Let's add reference if not exists, but keep flexible
        await client.query(`
        ALTER TABLE financial_transactions
        ADD COLUMN IF NOT EXISTS cost_center_id INTEGER REFERENCES cost_centers(id) ON DELETE SET NULL;
    `);

        await client.query('COMMIT');
        console.log('Clinical Finance migration completed successfully!');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        client.release();
        pool.end();
    }
}

runMigration();
