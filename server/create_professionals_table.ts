
import 'dotenv/config';
import { pool } from './db';

const setupProfessionals = async () => {
    if (!pool) {
        console.error("No DB Pool");
        return;
    }
    try {
        console.log("Creating crm_professionals table...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm_professionals (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                specialty VARCHAR(100),
                phone VARCHAR(50),
                email VARCHAR(255),
                active BOOLEAN DEFAULT TRUE,
                color VARCHAR(7) DEFAULT '#3b82f6',
                user_id INTEGER, -- Optional link to app_users
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("Table created.");

        // We need to allow responsible_id to point to professionals.
        // First, check if there's a constraint to app_users and drop it.
        // We can't easily check explicitly in SQL without complex queries, but DROP CONSTRAINT IF EXISTS is safe in Postgres if we know the name.
        // Usually: crm_appointments_responsible_id_fkey

        console.log("Adjusting crm_appointments constraints...");
        try {
            await pool.query(`ALTER TABLE crm_appointments DROP CONSTRAINT IF EXISTS crm_appointments_responsible_id_fkey;`);
        } catch (e) {
            console.log("Constraint might not exist or already dropped.", e);
        }

        // Add foreign key to crm_professionals?
        // IF we want to enforce it. But if we have mixed legacy data (pointing to users), we might have issues if we enforce strictly.
        // For now, let's just drop the restriction to app_users so we can insert Professional IDs.
        // Ideally we should migrate existing appointments.
        // But assuming this is a new feature or we can live with loose coupling for legacy.

        console.log("Setup complete.");
    } catch (error) {
        console.error("Error setting up professionals:", error);
    } finally {
        pool.end();
    }
};

setupProfessionals();
