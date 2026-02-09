
import 'dotenv/config';
import { pool } from './server/db';
import fs from 'fs';

async function audit() {
    let log = '';
    const l = (s: string) => { console.log(s); log += s + '\n'; };

    l('--- START AUDIT ---');
    try {
        const res = await pool.query(`
            SELECT id, company_id, title, start_time, created_at, 
                   responsible_id,
                   client_name
            FROM crm_appointments 
            WHERE created_at > NOW() - INTERVAL '1 hour'
            ORDER BY created_at DESC
        `);

        l(`Found ${res.rowCount} appointments created in last hour.`);
        res.rows.forEach(r => {
            const d = new Date(r.start_time);
            l(`[ID ${r.id}] Company: ${r.company_id} | Title: "${r.title}" | Start DB: "${r.start_time}"`);
            l(`   -> JS Date: ${d.toString()}`);
            l(`   -> ISO: ${d.toISOString()}`);
            l(`   -> Resp: ${r.responsible_id}`);
        });

    } catch (e: any) {
        l(e.message);
    }
    fs.writeFileSync('audit_log.txt', log);
    process.exit(0);
}
audit();
