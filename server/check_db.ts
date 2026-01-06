import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const checkDb = async () => {
    // Dynamic import to allow dotenv to load first
    const { pool } = await import('./db');

    try {
        if (!pool) {
            console.log('No pool');
            return;
        }
        const resConvs = await pool.query('SELECT * FROM whatsapp_conversations');
        const resMsgs = await pool.query('SELECT * FROM whatsapp_messages');

        console.log('Conversations count:', resConvs.rowCount);
        console.log('Conversations rows:', resConvs.rows);
        console.log('Messages count:', resMsgs.rowCount);

    } catch (e) {
        console.error(e);
    } finally {
        if (pool) await pool.end();
    }
};

checkDb();
