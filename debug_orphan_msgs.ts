
import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkOrphanMessages() {
    let log = '';
    const print = (msg: any) => {
        const s = typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2);
        console.log(s);
        log += s + '\n';
    };

    try {
        const companyId = 34;
        const instanceKey = 'karenloja';

        print(`--- Checking Messages for Company ${companyId} ---`);
        const msgsByCompany = await pool.query('SELECT count(*) FROM whatsapp_messages WHERE company_id = $1', [companyId]);
        print(`Messages for company_id ${companyId}: ${msgsByCompany.rows[0].count}`);

        print(`\n--- Searching for messages by instance_key '${instanceKey}' ---`);
        // Check if there are messages with this instance key string in any column or linked by instance_id
        const msgsByInstance = await pool.query(`
      SELECT m.* 
      FROM whatsapp_messages m 
      JOIN company_instances ci ON m.instance_id = ci.id 
      WHERE ci.instance_key = $1
      ORDER BY m.sent_at DESC
      LIMIT 5
    `, [instanceKey]);
        print('Recent messages by instance_key:');
        print(msgsByInstance.rows);

        print('\n--- Recent overall messages in the system ---');
        const allRecent = await pool.query(`
      SELECT m.id, m.company_id, m.instance_id, m.sender_name, m.message_body, m.sent_at, ci.instance_key
      FROM whatsapp_messages m
      LEFT JOIN company_instances ci ON m.instance_id = ci.id
      ORDER BY m.sent_at DESC
      LIMIT 10
    `);
        print(allRecent.rows);

        fs.writeFileSync('debug_orphan_msgs.txt', log, 'utf8');
        await pool.end();
    } catch (err) {
        console.error(err);
    }
}

checkOrphanMessages();
