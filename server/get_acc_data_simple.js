
require('dotenv').config();
const { Pool } = require('pg');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function check() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const email = 'lojaleo@integrai.com';
        const res = await pool.query(`
            SELECT instagram_access_token FROM companies 
            WHERE id = (SELECT company_id FROM app_users WHERE LOWER(email) = LOWER($1))
        `, [email]);

        const token = res.rows[0]?.instagram_access_token;
        if (!token) {
            console.log('Token missing');
            return;
        }

        const fbUrl = `https://graph.facebook.com/v18.0/me/accounts?fields=name,access_token,instagram_business_account&access_token=${token}`;
        const fbRes = await fetch(fbUrl);
        const fbData = await fbRes.json();

        console.log('LOG_START');
        console.log(JSON.stringify(fbData, null, 2));
        console.log('LOG_END');

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
