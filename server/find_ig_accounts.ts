
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

        // 1. Get User Pages
        const url = `https://graph.facebook.com/v18.0/me/accounts?access_token=${instagram_access_token}`;
        const accRes = await fetch(url);
        const accData = await accRes.json();
        console.log('--- FB Pages Accessible ---');
        console.log(JSON.stringify(accData, null, 2));

        // 2. For each page, check linked Instagram Business accounts
        if (accData.data) {
            for (const page of accData.data) {
                console.log(`Checking Instagram for Page: ${page.name} (${page.id})`);
                const igUrl = `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${instagram_access_token}`;
                const igRes = await fetch(igUrl);
                const igData = await igRes.json();
                console.log(JSON.stringify(igData, null, 2));
            }
        }

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
