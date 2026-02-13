
import './env';
import { pool } from './db';
import { validateInstagramCredentials } from './services/instagramService';

async function check() {
    try {
        const email = 'lojaleo@integrai.com';
        const res = await pool.query(`
            SELECT id, instagram_access_token, instagram_page_id, name
            FROM companies 
            WHERE id = (SELECT company_id FROM app_users WHERE LOWER(email) = LOWER($1))
        `, [email]);

        if (res.rows.length === 0) {
            process.exit(0);
        }

        const company = res.rows[0];

        try {
            await validateInstagramCredentials(company.instagram_access_token, company.instagram_page_id);
            console.log('RESULT:SUCCESS');
        } catch (err: any) {
            console.log('RESULT:ERROR:' + err.message);
        }

        process.exit(0);
    } catch (e) {
        process.exit(1);
    }
}

check();
