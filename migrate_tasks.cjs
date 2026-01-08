const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const migrate = async () => {
    console.log("Connecting...");
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected. Creating tables...");

        await client.query(`
            CREATE TABLE IF NOT EXISTS admin_tasks (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                status VARCHAR(20) DEFAULT 'pending',
                priority VARCHAR(20) DEFAULT 'medium',
                due_date TIMESTAMP,
                responsible_id INTEGER,
                company_id INTEGER,
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                completed_at TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS admin_task_history (
                id SERIAL PRIMARY KEY,
                task_id INTEGER REFERENCES admin_tasks(id) ON DELETE CASCADE,
                user_id INTEGER,
                action TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        console.log("Tables created/verified.");

        const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'admin_tasks'");
        console.log("Verify admin_tasks:", res.rows);

    } catch (e) {
        console.error('Migration Error:', e);
    } finally {
        await client.end();
        process.exit();
    }
};

migrate();
