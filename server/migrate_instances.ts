
import './env';
import { pool } from './db/index';

const runMigration = async () => {
    try {
        console.log('Starting migration...');

        if (!pool) {
            console.error('Database configuration failed - pool is null. Check environment variables.');
            process.exit(1);
        }

        await pool.query(`
            ALTER TABLE companies ADD COLUMN IF NOT EXISTS max_instances INTEGER DEFAULT 1;
        `);
        console.log('Added max_instances to companies.');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS company_instances (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                name TEXT NOT NULL, 
                instance_key TEXT NOT NULL, 
                api_key TEXT,
                status TEXT DEFAULT 'disconnected',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(company_id, name),
                UNIQUE(instance_key)
            );
        `);
        console.log('Created company_instances table.');

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error: any) {
        console.error('Migration failed:', error.message);
        console.error('Code:', error.code);
        console.error('Detail:', error.detail);
        process.exit(1);
    }
};

runMigration();
