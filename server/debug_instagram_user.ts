
import './env';
import { pool } from './db';

async function check() {
    try {
        const email = 'lojaleo@integrai.com';
        const res = await pool.query(`
            SELECT u.id as user_id, u.email, c.id as company_id, c.name, 
                   c.instagram_page_id, c.instagram_business_id, c.instagram_enabled, c.instagram_status
            FROM app_users u 
            JOIN companies c ON u.company_id = c.id 
            WHERE LOWER(u.email) = LOWER($1)
        `, [email]);

        console.log('User and Company Info:');
        console.log(JSON.stringify(res.rows, null, 2));

        if (res.rows.length === 0) {
            console.log('No user found with that email.');
        } else {
            const companyId = res.rows[0].company_id;
            const convs = await pool.query('SELECT channel, COUNT(*) FROM whatsapp_conversations WHERE company_id = $1 GROUP BY channel', [companyId]);
            console.log('Conversations by channel:');
            console.log(JSON.stringify(convs.rows, null, 2));
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
