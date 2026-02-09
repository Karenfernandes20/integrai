
import 'dotenv/config';
import { pool } from './server/db';

async function migrate() {
    try {
        await pool.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'light'");
        console.log("Column 'theme' added to app_users");
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
migrate();
