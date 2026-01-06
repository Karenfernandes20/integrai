
import './env.ts';
import { pool } from './db/index.ts';

async function migrateCostCenter() {
    try {
        if (!pool) { console.log('No pool'); process.exit(1); }
        console.log('Adding cost_center column to financial_transactions...');

        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_transactions' AND column_name = 'cost_center') THEN 
                    ALTER TABLE financial_transactions ADD COLUMN cost_center VARCHAR(255); 
                END IF; 
            END $$;
        `);

        console.log('Column cost_center added or already exists.');
        process.exit(0);
    } catch (e: any) {
        console.error("MIGRATION ERROR:", e.message);
        process.exit(1);
    }
}

migrateCostCenter();
