
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function simulate() {
    const id = 1226; // From previous check
    const userId = 1; // Assuming a valid user ID
    const companyId = 42; // From previous check

    try {
        const check = await pool.query('SELECT status, user_id, phone, instance, company_id FROM whatsapp_conversations WHERE id = $1', [id]);
        console.log('Conversation:', check.rows[0]);

        const updates = ['status = $1', 'user_id = $2', 'started_at = NOW()', 'opened_at = NOW()', 'opened_by_user_id = $2', 'company_id = COALESCE(company_id, $4)'];
        const values = ['OPEN', userId, id, companyId];

        console.log('Running Update...');
        const result = await pool.query(
            `UPDATE whatsapp_conversations
       SET ${updates.join(', ')}
       WHERE id = $3
       RETURNING id, status`,
            values
        );
        console.log('Success:', result.rows[0]);
    } catch (e) {
        console.error('ERROR DETECTED:', e.message);
        console.error('Error details:', e);
    } finally {
        await pool.end();
    }
}

simulate();
