
import "./env";
import { pool } from './db';

async function listUsers() {
    if (!pool) return;
    try {
        console.log("Listing users in Render DB...");

        const res = await pool.query(`
            SELECT id, full_name, email, role, user_type, company_id, is_active, last_login 
            FROM app_users 
            ORDER BY id ASC
        `);

        if (res.rows.length === 0) {
            console.log("No users found.");
        } else {
            console.table(res.rows.map(u => ({
                id: u.id,
                name: u.full_name,
                email: u.email,
                role: u.role,
                type: u.user_type,
                active: u.is_active
            })));
        }

    } catch (e) {
        console.error("Error listing users:", e);
    } finally {
        process.exit();
    }
}

listUsers();
