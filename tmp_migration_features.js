
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function migrate() {
    try {
        console.log("Starting migration: company_feature_flags");

        await pool.query(`
      CREATE TABLE IF NOT EXISTS company_feature_flags (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        feature_key VARCHAR(100) NOT NULL,
        is_enabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, feature_key)
      );
    `);

        console.log("Table company_feature_flags created successfully.");

        // Initial seed for company 42 if needed
        const features = [
            'whatsapp_official', 'whatsapp_internal', 'webhook', 'crm_integration',
            'payment_gateway', 'email_integration', 'ai_integration', 'erp_integration',
            'google_integration', 'meta_ads', 'web_chat',
            'multi_agents', 'conversation_transfer', 'multi_queues', 'auto_close', 'supervisor_mode',
            'chatbot', 'quick_replies', 'auto_messages', 'auto_assign', 'sla',
            'ai_assistant', 'ai_auto_reply', 'ai_suggestions', 'sentiment_analysis',
            'advanced_reports', 'export_csv', 'export_pdf', 'dashboard_manager',
            '2fa_enabled', 'activity_log', 'ip_restriction', 'session_control',
            'edit_contact', 'delete_conversation', 'full_history', 'custom_tags'
        ];

        for (const key of features) {
            await pool.query(`
        INSERT INTO company_feature_flags (company_id, feature_key, is_enabled)
        VALUES (42, $1, TRUE)
        ON CONFLICT (company_id, feature_key) DO NOTHING
      `, [key]);
        }

        console.log("Seeded initial features for company 42.");

    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await pool.end();
    }
}

migrate();
