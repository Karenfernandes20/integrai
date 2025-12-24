import "./env";
import { pool } from "./db";

async function check() {
    try {
        console.log("Checking database...");

        // 1. List Tables
        const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
        console.log("Tables found:", tables.rows.map(r => r.table_name));

        // 2. Check Conversations
        const conversations = await pool.query('SELECT count(*) FROM whatsapp_conversations');
        console.log("Conversations count:", conversations.rows[0].count);

        // 3. Check Messages
        const messages = await pool.query('SELECT count(*) FROM whatsapp_messages');
        console.log("Messages count:", messages.rows[0].count);

        // 4. List last 5 messages
        const lastMsgs = await pool.query('SELECT * FROM whatsapp_messages ORDER BY created_at DESC LIMIT 5');
        console.log("Last 5 messages:", lastMsgs.rows);

    } catch (error) {
        console.error("Check failed:", error);
    } finally {
        pool.end();
    }
}

check();
