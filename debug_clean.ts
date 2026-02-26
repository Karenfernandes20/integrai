
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    try {
        const nameToSearch = 'karenloja';
        const instanceRes = await pool.query(
            "SELECT * FROM company_instances WHERE LOWER(instance_key) = LOWER($1) OR LOWER(name) = LOWER($1)",
            [nameToSearch]
        );

        if (instanceRes.rows.length > 0) {
            const row = instanceRes.rows[0];
            console.log(`INSTANCIA_ENCONTRADA: ID=${row.id}, CompanyID=${row.company_id}, Key=${row.instance_key}, Name=${row.name}`);

            const msgCount = await pool.query("SELECT COUNT(*) FROM whatsapp_messages WHERE company_id = $1", [row.company_id]);
            console.log(`TOTAL_MENSAGENS_EMPRESA: ${msgCount.rows[0].count}`);

            const recentMsgs = await pool.query(
                "SELECT content, sent_at FROM whatsapp_messages WHERE company_id = $1 ORDER BY sent_at DESC LIMIT 3",
                [row.company_id]
            );
            recentMsgs.rows.forEach(m => {
                console.log(`MSG: ${m.sent_at} - ${m.content?.substring(0, 50)}`);
            });
        } else {
            console.log("INSTANCIA_NAO_ENCONTRADA");
        }
    } catch (e: any) {
        console.log("ERRO: " + e.message);
    } finally {
        await pool.end();
    }
}
check();
