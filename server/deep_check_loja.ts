
import './env';
import { pool } from './db';

async function check() {
    try {
        const email = 'lojaleo@integrai.com';
        const res = await pool.query(`
            SELECT id, name, instagram_access_token, instagram_page_id, instagram_business_id, instagram_status 
            FROM companies 
            WHERE id = (SELECT company_id FROM app_users WHERE LOWER(email) = LOWER($1))
        `, [email]);

        if (res.rows.length === 0) {
            console.log('Company not found');
            return;
        }

        const company = res.rows[0];
        console.log('--- Company Status ---');
        console.log('Name:', company.name);
        console.log('Status:', company.instagram_status);
        console.log('Page ID:', company.instagram_page_id);
        console.log('IG Business ID:', company.instagram_business_id);
        console.log('Token Length:', company.instagram_access_token ? company.instagram_access_token.length : 0);

        if (company.instagram_access_token) {
            const url = `https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${company.instagram_access_token}`;
            const meRes = await fetch(url);
            const meData = await meRes.json();
            console.log('Me API Result:', JSON.stringify(meData, null, 2));

            const permUrl = `https://graph.facebook.com/v18.0/me/permissions?access_token=${company.instagram_access_token}`;
            const permRes = await fetch(permUrl);
            const permData = await permRes.json();
            console.log('Permissions:', JSON.stringify(permData.data?.filter((p: any) => p.status === 'granted').map((p: any) => p.permission), null, 2));
        }

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
