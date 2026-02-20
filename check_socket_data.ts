
import './server/env';
import { pool } from './server/db/index.js';
import fs from 'fs';

async function checkInstances() {
    try {
        const d: any = {};
        const res = await pool.query(`SELECT id, company_id, name, instance_key FROM company_instances`);
        d.company_instances = res.rows;

        const res2 = await pool.query(`SELECT id, whatsapp_instance_id, instance_key FROM companies`);
        d.companies = res2.rows;

        const res3 = await pool.query(`SELECT id, status, company_id, instance_key FROM whatsapp_messages ORDER BY id DESC LIMIT 5`);
        d.messages = res3.rows;

        fs.writeFileSync('socket_debug_final.json', JSON.stringify(d, null, 2), 'utf-8');

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

checkInstances();
