
import './env';
import { pool } from './db';

async function check() {
    try {
        const email = 'lojaleo@integrai.com';
        const res = await pool.query(`
            SELECT instagram_access_token, instagram_page_id, name
            FROM companies 
            WHERE id = (SELECT company_id FROM app_users WHERE LOWER(email) = LOWER($1))
        `, [email]);

        if (res.rows.length === 0) return;
        const { instagram_access_token } = res.rows[0];
        if (!instagram_access_token) return;

        // Try to get the IG Business ID if we only have Page ID
        const fbUrl = `https://graph.facebook.com/v18.0/me/accounts?fields=name,access_token,instagram_business_account&access_token=${instagram_access_token}`;
        const fbRes = await fetch(fbUrl);
        const fbData = await fbRes.json();

        console.log('--- Account Data ---');
        console.log(JSON.stringify(fbData, null, 2));

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
