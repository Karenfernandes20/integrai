
import { pool } from './server/db';
import fs from 'fs';
async function main() {
    if (!pool) return;
    const res = await pool.query("SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'companies'::regclass AND contype = 'c'");
    fs.writeFileSync('constraints_output.json', JSON.stringify(res.rows, null, 2));
    process.exit();
}
main();
