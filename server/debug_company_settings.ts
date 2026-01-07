
import './env';
import { pool } from './db';

async function checkCompanySettings() {
    if (!pool) { console.log('No pool'); process.exit(1); }
    try {
        const companies = await pool.query('SELECT id, name, evolution_instance, evolution_apikey FROM companies');
        console.log('--- Company Settings ---');
        companies.rows.forEach(c => {
            console.log(`ID: ${c.id}, Name: ${c.name}`);
            console.log(`Instance: ${c.evolution_instance}`);
            // Show first/last chars of key for safety
            const key = c.evolution_apikey || '';
            const maskedKey = key.length > 8 ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : (key ? '***' : 'NULL');
            console.log(`API Key: ${maskedKey}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
checkCompanySettings();
