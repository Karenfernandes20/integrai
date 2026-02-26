
import './server/env.js';
import { pool } from './server/db/index.js';

async function migrate() {
    if (!pool) {
        console.error('Database pool not initialized');
        process.exit(1);
    }

    try {
        console.log('Running migrations for Local Instances...');

        // 1. Add columns to company_instances
        await pool.query(`
            ALTER TABLE company_instances 
            ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'evolution',
            ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'disconnected'
        `);
        console.log('Columns added to company_instances.');

        // 2. Ensure status values are correct
        // (Status is already a text field, but we want to make sure the user's expected values will fit)

        console.log('Migration completed successfully.');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        process.exit(0);
    }
}

migrate();
