
import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;

async function checkConversations() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await client.connect();
        console.log('Connected');

        // Check indexes for whatsapp_conversations
        const indexes = await client.query(`
      SELECT
          indexname,
          indexdef
      FROM
          pg_indexes
      WHERE
          tablename = 'whatsapp_conversations';
    `);
        console.log('Indexes for whatsapp_conversations:');
        console.log(JSON.stringify(indexes.rows, null, 2));

        await client.end();
    } catch (err) {
        console.error(err);
    }
}

checkConversations();
