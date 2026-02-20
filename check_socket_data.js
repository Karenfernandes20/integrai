"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("./server/db/index.js");
async function checkInstances() {
    try {
        console.log("=== Company Instances Check ===");
        const res = await index_js_1.pool.query(`SELECT id, company_id, name, instance_key FROM company_instances`);
        console.table(res.rows);
        console.log("=== Companies Check ===");
        const res2 = await index_js_1.pool.query(`SELECT id, whatsapp_instance_id, instance_key FROM companies`);
        console.table(res2.rows);
        console.log("=== Last 5 Messages Check (to see status and company_id) ===");
        const res3 = await index_js_1.pool.query(`
            SELECT id, conversation_id, content, status, company_id, sent_at 
            FROM whatsapp_messages 
            ORDER BY sent_at DESC LIMIT 5
        `);
        console.table(res3.rows);
        console.log("=== Last 5 Conversations Check (to see status and company_id) ===");
        const res4 = await index_js_1.pool.query(`
            SELECT id, phone, status, company_id, unread_count, updated_at 
            FROM whatsapp_conversations 
            ORDER BY updated_at DESC LIMIT 5
        `);
        console.table(res4.rows);
    }
    catch (e) {
        console.error(e);
    }
    finally {
        await index_js_1.pool.end();
    }
}
checkInstances();
