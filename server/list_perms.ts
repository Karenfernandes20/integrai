
import './env';
import { pool } from './db';

async function check() {
    try {
        const email = 'lojaleo@integrai.com';
        const res = await pool.query(`
            SELECT instagram_access_token FROM companies 
            WHERE id = (SELECT company_id FROM app_users WHERE LOWER(email) = LOWER($1))
        `, [email]);
        const token = res.rows[0]?.instagram_access_token;
        if (!token) return;

        const resPerm = await fetch(`https://graph.facebook.com/v18.0/me/permissions?access_token=${token}`);
        const dataPerm = await resPerm.json();
        const perms = dataPerm.data?.map((p: any) => p.permission);
        console.log('PERMISSIONS_LIST:', perms.join(', '));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
