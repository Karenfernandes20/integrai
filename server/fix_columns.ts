
import "./env";
import { pool } from './db';

async function main() {
    if (!pool) return;
    console.log("Adding columns...");
    try {
        await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_limit INTEGER DEFAULT 1`);
        await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS instagram_limit INTEGER DEFAULT 1`);
        await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS messenger_limit INTEGER DEFAULT 1`);
        console.log("Done.");
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

main();
