
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    try {
        const res = await pool.query("SELECT id, name, created_at FROM companies ORDER BY id DESC LIMIT 20");
        console.log("LIST_RESULTS_START");
        res.rows.forEach(row => {
            console.log(`ID: ${row.id} | Name: ${row.name} | CreatedAt: ${row.created_at}`);
        });
        console.log("LIST_RESULTS_END");
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
}

main();
