import { pool } from './db/index.js';
async function test() {
    const convs = await pool.query('SELECT external_id, is_group, updated_at FROM whatsapp_conversations WHERE is_group=true ORDER BY updated_at DESC LIMIT 5');
    console.log("Groups:", convs.rows);
    const msgs = await pool.query('SELECT external_id, content FROM whatsapp_messages WHERE conversation_id IN (SELECT id FROM whatsapp_conversations WHERE is_group=true) ORDER BY sent_at DESC LIMIT 5');
    console.log("Messages in Groups:", msgs.rows);
    process.exit(0);
}
test();
