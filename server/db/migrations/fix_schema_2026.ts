import { pool } from '../index.js';

export const runFixSchema = async () => {
    if (!pool) return;
    try {
        console.log("Starting Critical Schema Fixes...");

        // 1. Create trigger function
        await pool.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);

        // 2. Tables to padronize timestamps
        const timestampTables = [
            'companies', 'app_users', 'plans', 'queues', 'chatbots', 'bots',
            'whatsapp_conversations', 'whatsapp_messages', 'whatsapp_contacts',
            'whatsapp_campaigns', 'whatsapp_campaign_contacts', 'whatsapp_audit_logs',
            'bot_instances', 'chatbot_instances', 'company_instances', 'bot_sessions',
            'chatbot_sessions', 'crm_leads', 'crm_stages', 'crm_tags', 'leads_tags',
            'conversations_tags', 'system_logs', 'admin_alerts', 'audit_logs',
            'workflow_executions', 'entity_links', 'cities', 'financial_categories',
            'financial_transactions', 'subscriptions', 'suppliers'
        ];

        for (const table of timestampTables) {
            try {
                // Ensure column exists
                await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
                await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);

                // Ensure trigger exists
                await pool.query(`DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table}`);
                await pool.query(`
                    CREATE TRIGGER update_${table}_updated_at
                    BEFORE UPDATE ON ${table}
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                `);
            } catch (e) {
                // Silently skip if table doesn't exist
            }
        }

        // 3. Fix potential INTEGER columns to TEXT for IDs and Phones
        const externalColumns = [
            'phone', 'sender_id', 'remote_jid', 'external_id',
            'instagram_id', 'whatsapp_id', 'meta_id', 'jid',
            'instagram_user_id', 'instagram_message_id', 'messenger_user_id',
            'whatsapp_official_phone', 'whatsapp_official_phone_number_id',
            'whatsapp_official_business_account_id', 'sender_jid', 'contact_key'
        ];

        // Audit all tables for these columns
        const allColsRes = await pool.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
        `);

        for (const c of allColsRes.rows) {
            const isTargetCol = externalColumns.some(tc => c.column_name === tc || c.column_name.includes(tc));
            const isWrongType = c.data_type.includes('int') || c.data_type.includes('num');

            // Skip actual internal IDs that should be integers
            if (c.column_name === 'id' || (c.column_name.endsWith('_id') && !c.column_name.includes('external') && !c.column_name.includes('instagram') && !c.column_name.includes('meta'))) {
                continue;
            }

            if (isTargetCol && isWrongType) {
                console.log(`[SchemaFix] Altering ${c.table_name}.${c.column_name} from ${c.data_type} to TEXT`);
                try {
                    await pool.query(`ALTER TABLE ${c.table_name} ALTER COLUMN ${c.column_name} TYPE TEXT USING ${c.column_name}::TEXT`);
                } catch (err) {
                    console.error(`[SchemaFix] Failed to alter ${c.table_name}.${c.column_name}:`, err);
                }
            }
        }

        // 4. Special fix for onboarding_step
        try {
            await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 1`);
        } catch (e) { }

        console.log("Critical Schema Fixes completed.");
    } catch (e) {
        console.error("Critical Schema Fixes Error:", e);
    }
};
