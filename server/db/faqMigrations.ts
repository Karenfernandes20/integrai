import { pool } from "./index";

export const runFaqMigrations = async () => {
    if (!pool) return;
    try {
        console.log("Running FAQ migrations...");

        // 1. Create faq_questions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS faq_questions (
                id SERIAL PRIMARY KEY,
                question TEXT NOT NULL,
                answer TEXT,
                user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
                is_public BOOLEAN DEFAULT FALSE, -- After SuperAdmin answers, it can become public in the list
                is_answered BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Check columns
        const addColumn = async (col: string, type: string) => {
            try {
                await pool.query(`ALTER TABLE faq_questions ADD COLUMN ${col} ${type};`);
            } catch (e) { }
        };

        await addColumn('is_answered', 'BOOLEAN DEFAULT FALSE');
        await addColumn('is_public', 'BOOLEAN DEFAULT FALSE');

        console.log("FAQ migrations finished.");
    } catch (e) {
        console.error("FAQ Migration Error:", e);
    }
};
