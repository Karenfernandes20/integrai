
import { pool } from './server/db/index';

async function runMigration() {
    if (!pool) {
        console.error("Pool not scheduled");
        return;
    }

    try {
        console.log("Checking column type...");
        const check = await pool.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'crm_appointments' AND column_name = 'start_time'");
        const currentType = check.rows[0]?.data_type;

        console.log(`Current type: ${currentType}`);

        if (currentType !== 'timestamp with time zone') {
            console.log("Migrating crm_appointments to TIMESTAMPTZ...");

            // Backup or just allow implicit cast. 
            // We use USING to interpret existing timestamps as UTC, then converting to TZ aware.
            // If stored "12:00", we want it to be "12:00+00".
            // "AT TIME ZONE 'UTC'" on a timestamp-without-zone interprets it as UTC.

            await pool.query("ALTER TABLE crm_appointments ALTER COLUMN start_time TYPE TIMESTAMPTZ USING start_time AT TIME ZONE 'UTC'");
            await pool.query("ALTER TABLE crm_appointments ALTER COLUMN end_time TYPE TIMESTAMPTZ USING end_time AT TIME ZONE 'UTC'");

            console.log("Migration successful.");
        } else {
            console.log("Already migrated.");
        }

    } catch (e) {
        console.error("Migration failed:", e);
    }
    process.exit();
}

runMigration();
