import './server/env';
import { pool } from './server/db';
async function main() {
    if (!pool) return;
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name LIKE 'bot%' OR table_name LIKE 'chatbot%')");
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit();
}
main();
