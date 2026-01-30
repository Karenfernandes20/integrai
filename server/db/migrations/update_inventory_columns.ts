
import { pool } from '../index';

export const runInventoryUpdateMigration = async () => {
    if (!pool) return;
    try {
        console.log("Adding new columns to inventory table...");

        await pool.query(`
            ALTER TABLE inventory 
            ADD COLUMN IF NOT EXISTS location VARCHAR(100),
            ADD COLUMN IF NOT EXISTS margin DECIMAL(12, 2);
        `);

        console.log("Inventory columns added successfully.");
    } catch (e) {
        console.error("Error updating inventory table:", e);
    }
};
