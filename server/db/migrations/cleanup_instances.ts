
import { pool } from '../index.js';

export const runCleanupInstances = async () => {
    if (!pool) return;
    try {
        console.log("Starting Instance Cleanup & Unification...");

        // 1. Create definitive company_instances table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS company_instances (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                instance_key VARCHAR(255) NOT NULL,
                api_key VARCHAR(255),
                status VARCHAR(50) DEFAULT 'disconnected', -- connected, disconnected, connecting
                server_url VARCHAR(255),
                qrcode TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(company_id, instance_key)
            );
        `);
        console.log("Verified table: company_instances");

        // 2. Remove obsolete tables (if they exist)
        try {
            await pool.query(`DROP TABLE IF EXISTS whatsapp_instances CASCADE;`);
            console.log("Dropped table: whatsapp_instances (cleanup)");
        } catch (e) { }
        try {
            await pool.query(`DROP TABLE IF EXISTS bot_instances CASCADE;`);
            console.log("Dropped table: bot_instances (cleanup)");
        } catch (e) { }

        // 3. Migrate from legacy companies columns if needed
        // If company has evolution_instance/evolution_apikey, create entry in company_instances
        const legacyCompanies = await pool.query(`
            SELECT id, name, evolution_instance, evolution_apikey, evolution_url 
            FROM companies 
            WHERE evolution_instance IS NOT NULL AND evolution_instance != ''
        `);

        for (const company of legacyCompanies.rows) {
            try {
                await pool.query(`
                    INSERT INTO company_instances (company_id, name, instance_key, api_key, server_url, status)
                    VALUES ($1, $2, $3, $4, $5, 'disconnected')
                    ON CONFLICT (company_id, instance_key) DO UPDATE 
                    SET api_key = EXCLUDED.api_key,
                        server_url = EXCLUDED.server_url;
                `, [
                    company.id,
                    company.evolution_instance, // Use stored instance key as name initially
                    company.evolution_instance,
                    company.evolution_apikey,
                    company.evolution_url
                ]);
            } catch (err: any) {
                console.error(`Error migrating company instance ${company.id}:`, err.message);
            }
        }
        console.log(`Migrated ${legacyCompanies.rows.length} legacy instances to company_instances.`);

        // 4. Ensure indexes
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_ci_company ON company_instances(company_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_ci_key ON company_instances(instance_key);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_ci_status ON company_instances(status);`);

        console.log("Instance Cleanup Finished.");

    } catch (e) {
        console.error("Cleanup Instances Error:", e);
    }
};
