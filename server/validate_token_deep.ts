
import './env';
import { pool } from './db';

async function check() {
    try {
        const res = await pool.query("SELECT name, instagram_access_token, instagram_page_id FROM companies WHERE name ILIKE '%Leo%'");
        const { instagram_access_token, instagram_page_id } = res.rows[0];

        console.log('Validating Token...');
        const url = `https://graph.facebook.com/v18.0/debug_token?input_token=${instagram_access_token}&access_token=${instagram_access_token}`;
        // Note: debug_token usually needs an APP token, but sometimes owner token works.
        // Let's try /me instead.
        const meUrl = `https://graph.facebook.com/v18.0/me?access_token=${instagram_access_token}`;
        const meRes = await fetch(meUrl);
        const meData = await meRes.json();

        if (!meRes.ok) {
            console.log('Invalid Token Error:', JSON.stringify(meData, null, 2));
        } else {
            console.log('Token is VALID for user:', meData.name);

            // Check Page access
            const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?access_token=${instagram_access_token}`;
            const pRes = await fetch(pagesUrl);
            const pData = await pRes.json();
            console.log('Pages:', JSON.stringify(pData.data?.map((p: any) => ({ name: p.name, id: p.id })), null, 2));
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
