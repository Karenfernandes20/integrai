
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
            console.log('No company found.');
            process.exit(0);
        }

        const company = res.rows[0];
        console.log(`Validating for: ${company.name}`);

        try {
            const result = await validateInstagramCredentials(company.instagram_access_token, company.instagram_page_id);
            console.log('Validation SUCCESS');
        } catch (err: any) {
            console.log('Validation FAILED');
            console.log('Error:', err.message);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
