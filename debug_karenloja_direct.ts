
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    console.log("--- Instância 'karenloja' ---");
    const instanceRes = await pool.query(
        "SELECT id, company_id, name, instance_key, status, provider FROM company_instances WHERE LOWER(instance_key) = LOWER($1) OR LOWER(name) = LOWER($1)",
        ['karenloja']
    );
    console.table(instanceRes.rows);

    if (instanceRes.rows.length > 0) {
        const companyId = instanceRes.rows[0].company_id;
        console.log(`--- Mensagens recentes da Empresa ID: ${companyId} ---`);
        const msgRes = await pool.query(
            "SELECT id, conversation_id, content, sent_at, instance_name FROM whatsapp_messages WHERE company_id = $1 ORDER BY sent_at DESC LIMIT 5",
            [companyId]
        );
        console.table(msgRes.rows);

        console.log("--- Conversas recentes da Empresa ID: ${companyId} ---");
        const convRes = await pool.query(
            "SELECT id, external_id, contact_name, updated_at FROM whatsapp_conversations WHERE company_id = $1 ORDER BY updated_at DESC LIMIT 5",
            [companyId]
        );
        console.table(convRes.rows);
    }

    await pool.end();
}
check();
