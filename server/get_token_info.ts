
import './env';
import { pool } from './db';

async function check() {
    try {
        const res = await pool.query("SELECT instagram_access_token FROM companies WHERE name ILIKE '%Leo%'");
        const token = res.rows[0]?.instagram_access_token;
        if (!token) return;

        const url = `https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${token}`;
        const meRes = await fetch(url);
        const meData = await meRes.json();
        console.log('Token belongs to:', meData);

        const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?fields=name,instagram_business_account&access_token=${token}`;
        const pagesRes = await fetch(pagesUrl);
        const pagesData = await pagesRes.json();
        console.log('Pages:', JSON.stringify(pagesData, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
