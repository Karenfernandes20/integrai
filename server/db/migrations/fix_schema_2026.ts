import { pool } from '../index.js';

export const runFixSchema = async () => {
    if (!pool) return;
    try {
        console.log("Starting Schema Fixes...");

        // 1. Add missing updated_at to various tables
        const tables = [
            'cities', 'companies', 'app_users', 'financial_categories', 'crm_tags',
            'leads_tags', 'conversations_tags', 'crm_stages', 'queues', 'whatsapp_messages',
            'whatsapp_audit_logs', 'whatsapp_campaign_contacts', 'system_logs', 'admin_alerts',
            'audit_logs', 'workflow_executions', 'entity_links', 'plans'
        ];

        for (const table of tables) {
            try {
                await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
                // Create trigger for auto-update if missing? 
                // For simplicity, we just ensure the column exists.
            } catch (e) {
                console.error(`Error adding updated_at to ${table}:`, e);
            }
        }

        // 2. Add onboarding_step to companies
        try {
            await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 1`);
        } catch (e) {
            console.error("Error adding onboarding_step to companies:", e);
        }

        // 3. Ensure phone/external_id columns are TEXT (VARCHAR) and not INTEGER
        // This is tricky if data exists, but SERIAL/INTEGER to TEXT usually allows direct CAST or ALTER with USING
        const textFixes = [
            { table: 'whatsapp_conversations', col: 'phone' },
            { table: 'whatsapp_conversations', col: 'external_id' },
            { table: 'whatsapp_messages', col: 'external_id' },
            { table: 'whatsapp_contacts', col: 'jid' },
            { table: 'whatsapp_contacts', col: 'phone' },
            { table: 'crm_leads', col: 'phone' },
            { table: 'app_users', col: 'phone' }
        ];

        for (const fix of textFixes) {
            try {
                // Check current type first to avoid redundant work
                const typeRes = await pool.query(`
                    SELECT data_type 
                    FROM information_schema.columns 
                    WHERE table_name = $1 AND column_name = $2
                `, [fix.table, fix.col]);

                if (typeRes.rows.length > 0 && (typeRes.rows[0].data_type.includes('int') || typeRes.rows[0].data_type.includes('numeric'))) {
                    console.log(`Fixing column type for ${fix.table}.${fix.col} (was ${typeRes.rows[0].data_type})`);
                    await pool.query(`ALTER TABLE ${fix.table} ALTER COLUMN ${fix.col} TYPE VARCHAR(255) USING ${fix.col}::VARCHAR`);
                }
            } catch (e) {
                console.error(`Error fixing type for ${fix.table}.${fix.col}:`, e);
            }
        }

        // 4. Create trigger for updated_at auto-update
        await pool.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);

        for (const table of tables) {
            try {
                await pool.query(`
                    DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
                    CREATE TRIGGER update_${table}_updated_at
                    BEFORE UPDATE ON ${table}
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                `);
            } catch (e) {
                // Some tables might not exist or triggers might fail
            }
        }

        console.log("Schema Fixes completed.");
    } catch (e) {
        console.error("Schema Fixes Error:", e);
    }
};
