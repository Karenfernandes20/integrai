
import { pool } from '../index';

export const migrateTimestamps = async () => {
    if (!pool) return;
    try {
        console.log("Migrating crm_appointments to TIMESTAMPTZ...");
        await pool.query("ALTER TABLE crm_appointments ALTER COLUMN start_time TYPE TIMESTAMPTZ USING start_time AT TIME ZONE 'UTC'");
        await pool.query("ALTER TABLE crm_appointments ALTER COLUMN end_time TYPE TIMESTAMPTZ USING end_time AT TIME ZONE 'UTC'");
        console.log("Migration successful.");
    } catch (e) {
        console.error("Migration failed:", e);
    }
};
