
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    try {
        console.log("--- Todas as instâncias no banco ---");
        const allInstances = await pool.query("SELECT id, company_id, name, instance_key, provider FROM company_instances");
        console.log(JSON.stringify(allInstances.rows, null, 2));

        const nameToSearch = 'karenloja';
        console.log(`\n--- Buscando especificamente por: ${nameToSearch} ---`);
        const instanceRes = await pool.query(
            "SELECT * FROM company_instances WHERE LOWER(instance_key) = LOWER($1) OR LOWER(name) = LOWER($1)",
            [nameToSearch]
        );
        console.log(JSON.stringify(instanceRes.rows, null, 2));

        if (instanceRes.rows.length > 0) {
            const companyId = instanceRes.rows[0].company_id;
            console.log(`\n--- Mensagens recentes da Empresa ID: ${companyId} ---`);
            const msgRes = await pool.query(
                "SELECT id, content, sent_at, instance_name FROM whatsapp_messages WHERE company_id = $1 ORDER BY sent_at DESC LIMIT 5",
                [companyId]
            );
            console.log(JSON.stringify(msgRes.rows, null, 2));
        } else {
            console.log("\n⚠️ Nenhuma instância encontrada com este nome.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
