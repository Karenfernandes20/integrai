
import "./env";
import { pool } from './db';
import bcrypt from 'bcryptjs';

async function createSuperAdmin() {
    if (!pool) return;
    try {
        const email = 'dev.karenfernandes@gmail.com';
        const password = 'Klpf1212!';

        console.log(`Checking superadmin: ${email}`);

        const existing = await pool.query("SELECT id FROM app_users WHERE email = $1", [email]);

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // Get default company if exists
        const companyRes = await pool.query("SELECT id FROM companies LIMIT 1");
        let companyId = companyRes.rows[0]?.id;

        if (!companyId) {
            await pool.query("INSERT INTO companies (name, cnpj) VALUES ('Empresa Padrão', '00000000000')");
            companyId = (await pool.query("SELECT id FROM companies LIMIT 1")).rows[0].id;
        }

        if (existing.rows.length > 0) {
            console.log(`User exists, updating password...`);
            await pool.query("UPDATE app_users SET password_hash = $1, is_active = true, role = 'SUPERADMIN' WHERE email = $2", [hash, email]);
            console.log("Password and Role updated.");
        } else {
            console.log(`User does not exist, creating...`);
            await pool.query(`
                INSERT INTO app_users (full_name, email, password_hash, role, company_id, is_active, user_type)
                VALUES ('Dev Karen', $1, $2, 'SUPERADMIN', $3, true, 'admin')
            `, [email, hash, companyId]);
            console.log("User created.");
        }
    } catch (e) {
        console.error("Error creating/updating superadmin:", e);
    } finally {
        process.exit();
    }
}

createSuperAdmin();
