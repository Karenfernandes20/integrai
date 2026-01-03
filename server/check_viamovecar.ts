import { pool } from "./db/index.ts";

async function checkViamovecar() {
    if (!pool) {
        console.error("Database pool not available");
        process.exit(1);
    }

    try {
        const res = await pool.query("SELECT * FROM companies WHERE evolution_instance = 'viamovecar'");
        if (res.rows.length === 0) {
            console.log("No company found with evolution_instance='viamovecar'");
            const all = await pool.query("SELECT id, name, evolution_instance FROM companies");
            console.log("Existing companies:", all.rows);
        } else {
            console.log("Company 'viamovecar' config:");
            console.log(res.rows[0]);
        }
    } catch (err) {
        console.error("Error querying database:", err);
    } finally {
        process.exit(0);
    }
}

checkViamovecar();
