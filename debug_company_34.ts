
import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkCompany34() {
    let log = '';
    const print = (msg: any) => {
        const s = typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2);
        console.log(s);
        log += s + '\n';
    };

    try {
        const companyId = 34;

        print(`--- Checking Company ${companyId} ---`);
        const company = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
        print('Company:');
        print(company.rows[0]);

        print('\n--- Instances for Company 34 ---');
        const instances = await pool.query('SELECT id, name, provider, status, instance_key FROM company_instances WHERE company_id = $1', [companyId]);
        print(instances.rows);

        print('\n--- Recent Conversations for Company 34 ---');
        const convs = await pool.query(`
      SELECT id, contact_name, last_message, status, updated_at 
      FROM whatsapp_conversations 
      WHERE company_id = $1 
      ORDER BY updated_at DESC 
      LIMIT 10
    `, [companyId]);
        print(convs.rows);

        if (convs.rows.length > 0) {
            for (const conv of convs.rows) {
                print(`\n--- Recent Messages for Conversation ${conv.id} (${conv.contact_name}) ---`);
                const msgs = await pool.query(`
          SELECT id, sender_name, message_body, sent_at, from_me 
          FROM whatsapp_messages 
          WHERE conversation_id = $1 
          ORDER BY sent_at DESC 
          LIMIT 3
        `, [conv.id]);
                print(msgs.rows);
            }
        }

        fs.writeFileSync('debug_34_clean.txt', log, 'utf8');
        await pool.end();
    } catch (err) {
        console.error(err);
    }
}

checkCompany34();
