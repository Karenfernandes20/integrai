
import { pool } from './server/db';
import fs from 'fs';

async function main() {
    if (!pool) return;
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'companies'");
    fs.writeFileSync('columns.json', JSON.stringify(res.rows.map(r => r.column_name), null, 2));
    process.exit();
}
main();
