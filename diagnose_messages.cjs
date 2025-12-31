const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function diagnose() {
    try {
        console.log('--- DIAGNOSTIC START ---');

        // 1. Check total conversations
        const convCount = await pool.query('SELECT COUNT(*) FROM whatsapp_conversations');
        console.log(`Total Conversations: ${convCount.rows[0].count}`);

        // 2. Check total messages
        const msgCount = await pool.query('SELECT COUNT(*) FROM whatsapp_messages');
        console.log(`Total Messages: ${msgCount.rows[0].count}`);

        // 3. Get last 5 conversations and their message counts
        const lastConvs = await pool.query(`
      SELECT c.id, c.phone, c.contact_name, c.company_id, COUNT(m.id) as msg_count 
      FROM whatsapp_conversations c 
      LEFT JOIN whatsapp_messages m ON c.id = m.conversation_id 
      GROUP BY c.id, c.phone, c.contact_name, c.company_id 
      ORDER BY c.updated_at DESC 
      LIMIT 5
    `);

        console.log('\nTop 5 Recent Conversations:');
        lastConvs.rows.forEach(r => {
            console.log(`ID: ${r.id} | Phone: ${r.phone} | Name: ${r.contact_name} | Company: ${r.company_id} | Msgs: ${r.msg_count}`);
        });

        // 4. Pick the first conversation with messages and show them
        const convWithMsgs = lastConvs.rows.find(r => r.msg_count > 0);
        if (convWithMsgs) {
            console.log(`\nMessages for Conversation ID ${convWithMsgs.id}:`);
            const msgs = await pool.query('SELECT id, content, sent_at, direction FROM whatsapp_messages WHERE conversation_id = $1 ORDER BY sent_at DESC LIMIT 3', [convWithMsgs.id]);
            msgs.rows.forEach(m => {
                console.log(`[${m.direction}] ${m.sent_at}: ${m.content}`);
            });
        } else {
            console.log('\nNo messages found in the recent conversations.');
        }

        console.log('--- DIAGNOSTIC END ---');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

diagnose();
