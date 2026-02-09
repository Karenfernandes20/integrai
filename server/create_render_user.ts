
import "./env";
import { pool } from './db';
import bcrypt from 'bcryptjs';

async function createUser() {
    if (!pool) return;
    try {
        const email = 'karen@clientes.com';
        const password = 'Abc123';
        const existing = await pool.query("SELECT id FROM app_users WHERE email = $1", [email]);

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // Get default company if exists
        const companyRes = await pool.query("SELECT id FROM companies LIMIT 1");
        const companyId = companyRes.rows[0]?.id;

        if (existing.rows.length > 0) {
            console.log(`User ${email} exists, updating password...`);
            await pool.query("UPDATE app_users SET password_hash = $1, is_active = true WHERE email = $2", [hash, email]);
            console.log("Password updated.");
        } else {
            console.log(`User ${email} does not exist, creating...`);
            if (!companyId) {
                // Create dummy company if none
                await pool.query("INSERT INTO companies (name, cnpj) VALUES ('Empresa Padrão', '00000000000')");
            }
            const compId = (await pool.query("SELECT id FROM companies LIMIT 1")).rows[0].id;

            await pool.query(`
                INSERT INTO app_users (full_name, email, password_hash, role, company_id, is_active, user_type)
                VALUES ('Karen', $1, $2, 'SUPERADMIN', $3, true, 'admin')
            `, [email, hash, compId]);
            console.log("User created.");
        }
    } catch (e) {
        console.error("Error creating/updating user:", e);
    } finally {
        process.exit();
    }
}

createUser();
