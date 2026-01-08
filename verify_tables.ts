import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const check = async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'admin_task%'");
        console.log('Task tables found:', res.rows.map(t => t.table_name));
    } catch (e) {
        console.error('DB Error:', e);
    } finally {
        await client.end();
        process.exit();
    }
};

check();
