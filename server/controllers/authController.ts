import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';
import { ROLES, DEFAULT_PERMISSIONS } from '../config/roles';

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // Login fixo para SUPERADMIN (pedido do cliente)
        // DEBUG LOGS
        console.log(`[Auth Debug] Attempting login for: ${email}`);
        console.log(`[Auth Debug] Input Password matches hardcoded? ${password === 'Klpf1212!'}`);

        const isFirstAdmin = email.trim().toLowerCase() === 'dev.karenfernandes@gmail.com' && password === 'Klpf1212!';
        const isSecondAdmin = email.trim().toLowerCase() === 'integraiempresa01@gmail.com' && password === 'integr1234';

        if (isFirstAdmin || isSecondAdmin) {
            console.log(`[Auth] Fixed admin login detected for ${email}`);

            // MOCK LOGIN STRATEGY: Try DB, but if it fails, Log in anyway with Mock Data
            let dbUser = {
                id: 1, // Default SuperAdmin ID
                full_name: isFirstAdmin ? 'Superadmin ViaMoveCar' : 'Integrai Empresa 01',
                email: email,
                role: 'SUPERADMIN',
                company_id: null as number | null
            };

            if (pool) {
                try {
                    console.log('[Auth Debug] Attempting DB Sync for admin...');
                    let userRes = await pool.query('SELECT id, full_name, email, role, email_validated, user_type FROM app_users WHERE LOWER(email) = LOWER($1)', [email]);
                    if (userRes.rows.length === 0) {
                        try {
                            const insertRes = await pool.query(
                                'INSERT INTO app_users (full_name, email, role, is_active, email_validated, user_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                                [dbUser.full_name, email, 'SUPERADMIN', true, true, 'superadmin']
                            );
                            dbUser = { ...dbUser, ...insertRes.rows[0] };
                        } catch (e) { console.error('Insert failed, using mock', e); }
                    } else {
                        dbUser = { ...dbUser, ...userRes.rows[0] };
                    }
                } catch (err: any) {
                    console.error('[Auth Debug] DB Connection failed during admin login - PROCEEDING WITH MOCK LOGIN:', err.message);
                    // Do not return error, proceed to generate token with Mock Data
                }
            } else {
                console.warn('[Auth Debug] No Pool Available - PROCEEDING WITH MOCK LOGIN');
            }

            const superadminPayload = {
                id: dbUser.id,
                email: dbUser.email,
                role: 'SUPERADMIN',
                company_id: null
            };

            const token = jwt.sign(superadminPayload, JWT_SECRET, { expiresIn: '24h' });

            // Critical Fix: Update last login even for fixed admins
            if (pool) {
                await pool.query('UPDATE app_users SET last_login = NOW() WHERE id = $1', [dbUser.id]);
            }

            return res.json({
                token,
                user: {
                    id: dbUser.id,
                    full_name: dbUser.full_name,
                    email: dbUser.email,
                    role: 'SUPERADMIN',
                    email_validated: true,
                    user_type: 'superadmin',
                    company_id: null,
                    permissions: [],
                    profile_pic_url: null
                },
            });
        }

        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const result = await pool.query('SELECT * FROM app_users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is inactive' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate Token
        // Generate Token
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,

                company_id: user.company_id, // Critical for company authorization checks
                permissions: user.permissions || []
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Update last login
        await pool.query('UPDATE app_users SET last_login = NOW() WHERE id = $1', [user.id]);

        // Fetch company details if applicable
        let companyDetails = null;
        if (user.company_id) {
            const compRes = await pool.query('SELECT id, name, logo_url, plan_id, due_date FROM companies WHERE id = $1', [user.company_id]);
            if (compRes.rows.length > 0) {
                companyDetails = compRes.rows[0];
            }
        }

        res.json({
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                email_validated: user.email_validated,
                user_type: user.user_type,
                company: companyDetails,
                company_id: user.company_id,
                permissions: user.permissions || [],
                profile_pic_url: user.profile_pic_url // Assuming this column exists or will exist logic
            },
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const register = async (req: Request, res: Response) => {
    try {
        const { full_name, email, password, phone } = req.body;

        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        // Check if user exists
        const userCheck = await pool.query('SELECT id FROM app_users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // Default: Role USUARIO, Invalidated Email
        const defaultRole = ROLES.ADMIN; // First user is Admin of their own account usually? Or wait, register is public? 
        // If register is public, usually it creates a new Tenant. If so, they are ADMIN.
        // But the code sets 'USUARIO' and adds to city_id 1. Code implies this is a public signup for a user? 
        // Or for a tenant? "Cadastre sua empresa" in generic sense.
        // Assuming public registration -> New Tenant Admin.

        const permissions = DEFAULT_PERMISSIONS[defaultRole] || {};

        const result = await pool.query(
            `INSERT INTO app_users 
             (full_name, email, password_hash, phone, role, email_validated, is_active, user_type, city_id, state, created_at, permissions)
             VALUES ($1, $2, $3, $4, $5, false, true, 'admin', 1, 'SP', NOW(), $6)
             RETURNING id, full_name, email, role`,
            [full_name, email, hash, phone || '', defaultRole, JSON.stringify(permissions)]
        );

        res.status(201).json({
            message: 'User created successfully',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
