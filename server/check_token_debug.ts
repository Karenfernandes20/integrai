
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

        if (res.rows.length === 0) {
            console.log('No company found.');
            process.exit(0);
        }

        const { instagram_access_token, instagram_page_id } = res.rows[0];
        console.log('Token:', instagram_access_token ? 'PRESENT' : 'MISSING');

        if (instagram_access_token) {
            // Check permissions
            const url = `https://graph.facebook.com/debug_token?input_token=${instagram_access_token}&access_token=${instagram_access_token}`;
            // Wait, for debug_token we need an App Access Token or the User Access Token itself sometimes works if it's the owner
            const resDet = await fetch(url);
            const dataDet = await resDet.json();
            console.log('Token Debug Information:');
            console.log(JSON.stringify(dataDet, null, 2));

            // Check permissions via /me/permissions
            const permUrl = `https://graph.facebook.com/v18.0/me/permissions?access_token=${instagram_access_token}`;
            const resPerm = await fetch(permUrl);
            const dataPerm = await resPerm.json();
            console.log('Token Permissions:');
            console.log(JSON.stringify(dataPerm, null, 2));
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

check();
