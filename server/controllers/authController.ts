import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // Login fixo para SUPERADMIN (pedido do cliente)
        const isFirstAdmin = email === 'dev.karenfernandes@gmail.com' && password === 'Klpf1212!';
        const isSecondAdmin = email === 'integraiempresa01@gmail.com' && password === 'integr1234';

        if (isFirstAdmin || isSecondAdmin) {
            console.log(`[Auth] Fixed admin login detected for ${email}`);
            if (!pool) {
                console.error('[Auth] Database pool not available');
                return res.status(500).json({ error: 'Database not configured' });
            }

            // Ensure these users exist in DB to get a numeric ID for foreign keys
            // Case-insensitive email lookup
            let userRes = await pool.query('SELECT id, full_name, email, role, email_validated, user_type FROM app_users WHERE LOWER(email) = LOWER($1)', [email]);
            let dbUser;

            if (userRes.rows.length === 0) {
                const name = isFirstAdmin ? 'Superadmin ViaMoveCar' : 'Integrai Empresa 01';
                console.log(`[Auth] Creating missing fixed admin user: ${email}`);
                const insertRes = await pool.query(
                    'INSERT INTO app_users (full_name, email, role, is_active, email_validated, user_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                    [name, email, 'SUPERADMIN', true, true, 'superadmin']
                );
                dbUser = insertRes.rows[0];
            } else {
                dbUser = userRes.rows[0];
                // Ensure existing user has superadmin role if they are using these credentials
                if (dbUser.role !== 'SUPERADMIN' || !dbUser.is_active) {
                    await pool.query('UPDATE app_users SET role = $1, is_active = $2 WHERE id = $3', ['SUPERADMIN', true, dbUser.id]);
                }
            }

            const superadminPayload = {
                id: dbUser.id,
                email: dbUser.email,
                role: 'SUPERADMIN',
                company_id: null // Added for consistency
            };

            const token = jwt.sign(superadminPayload, JWT_SECRET, { expiresIn: '24h' });

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
                company_id: user.company_id // Critical for company authorization checks
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Update last login
        await pool.query('UPDATE app_users SET last_login = NOW() WHERE id = $1', [user.id]);

        // Fetch company details if applicable
        let companyDetails = null;
        if (user.company_id) {
            const compRes = await pool.query('SELECT id, name, logo_url FROM companies WHERE id = $1', [user.company_id]);
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
        const result = await pool.query(
            `INSERT INTO app_users 
             (full_name, email, password_hash, phone, role, email_validated, is_active, user_type, city_id, state, created_at)
             VALUES ($1, $2, $3, $4, 'USUARIO', false, true, 'user', 1, 'SP', NOW())
             RETURNING id, full_name, email, role`,
            [full_name, email, hash, phone || '']
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
