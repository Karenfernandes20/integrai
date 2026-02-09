
import "./env";
import { pool } from './db';

async function listUsersSimple() {
    if (!pool) return;
    try {
        console.log("--- USERS LIST ---");
        const res = await pool.query(`SELECT email, role, is_active FROM app_users ORDER BY id ASC`);
        res.rows.forEach(u => {
            console.log(`Email: ${u.email} | Role: ${u.role} | Active: ${u.is_active}`);
        });
        console.log("------------------");
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

listUsersSimple();
