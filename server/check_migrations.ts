import "./env";
import { runMigrations } from './db/migrations';
import { pool } from './db';

const check = async () => {
    try {
        await runMigrations();
        console.log("Migrations Success");
    } catch (e) {
        console.error("Migrations Failed:", e);
    } finally {
        await pool.end();
    }
};

check();
