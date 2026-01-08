import 'dotenv/config';
import { pool } from './server/db';

async function migrate() {
    if (!pool) {
        console.error("Pool not initialized");
        process.exit(1);
    }

    try {
        console.log("Creating admin_tasks table...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_tasks (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                status VARCHAR(20) DEFAULT 'pending',
                priority VARCHAR(20) DEFAULT 'medium',
                due_date TIMESTAMP,
                responsible_id INTEGER REFERENCES app_users(id),
                company_id INTEGER REFERENCES companies(id),
                created_by INTEGER REFERENCES app_users(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                completed_at TIMESTAMP
            );
        `);

        console.log("Creating admin_task_history table...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_task_history (
                id SERIAL PRIMARY KEY,
                task_id INTEGER REFERENCES admin_tasks(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES app_users(id),
                action TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        console.log("Migration successful");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        process.exit();
    }
}

migrate();
