
import "./env";
import { pool } from './db';
import bcrypt from 'bcryptjs';

async function ensureUsers() {
    if (!pool) return;
    try {
        console.log("Ensuring users exist...");

        // 1. SuperAdmin
        await ensureUser(
            'dev.karenfernandes@gmail.com',
            'Klpf1212!',
            'SUPERADMIN',
            'admin',
            'Dev Karen'
        );

        // 2. Client
        await ensureUser(
            'karen@clientes.com',
            'Abc123',
            'ADMIN', // or whatever role fits
            'admin',
            'Karen Cliente'
        );

    } catch (e) {
        console.error("Error ensuring users:", e);
    } finally {
        process.exit();
    }
}

async function ensureUser(email: string, pass: string, role: string, type: string, name: string) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(pass, salt);

    const check = await pool.query("SELECT id FROM app_users WHERE email = $1", [email]);

    // Get default company
    const companyRes = await pool.query("SELECT id FROM companies LIMIT 1");
    let companyId = companyRes.rows[0]?.id;

    if (!companyId) {
        await pool.query("INSERT INTO companies (name, cnpj) VALUES ('Empresa Default', '00000000000')");
        companyId = (await pool.query("SELECT id FROM companies LIMIT 1")).rows[0].id;
    }

    if (check.rows.length > 0) {
        console.log(`User ${email} found. Updating password & role...`);
        await pool.query(`
            UPDATE app_users 
            SET password_hash = $1, role = $2, is_active = true 
            WHERE email = $3
        `, [hash, role, email]);
    } else {
        console.log(`User ${email} NOT found. Creating...`);
        await pool.query(`
            INSERT INTO app_users (full_name, email, password_hash, role, company_id, is_active, user_type)
            VALUES ($1, $2, $3, $4, $5, true, $6)
        `, [name, email, hash, role, companyId, type]);
    }
}

ensureUsers();
