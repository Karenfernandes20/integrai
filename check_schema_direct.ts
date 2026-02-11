
import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;

async function checkSchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await client.connect();
        console.log('Connected');

        // Check tables
        const tables = await client.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
        console.log('Tables:', tables.rows.map(r => r.tablename));

        // Check indexes for whatsapp_contacts
        if (tables.rows.some(r => r.tablename === 'whatsapp_contacts')) {
            const indexes = await client.query(`
          SELECT
              indexname,
              indexdef
          FROM
              pg_indexes
          WHERE
              tablename = 'whatsapp_contacts';
        `);
            console.log('Indexes for whatsapp_contacts:');
            console.log(JSON.stringify(indexes.rows, null, 2));
        } else {
            console.log('whatsapp_contacts table NOT FOUND');
        }

        await client.end();
    } catch (err) {
        console.error(err);
    }
}

checkSchema();
