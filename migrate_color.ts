
import { pool } from './server/db';

async function migrate() {
    try {
        console.log("Adding color column to company_instances...");
        await pool.query("ALTER TABLE company_instances ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#3b82f6'");
        console.log("Migration successful!");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
migrate();
