
import dotenv from 'dotenv';
dotenv.config();

const MINI_EVO_URL = process.env.MINI_EVO_URL || 'http://127.0.0.1:3001';
const instanceId = 'instancia_001';
const token = 'me_8c5261d9efffa31703e1a62295e873742';

async function testFetch() {
    console.log(`Testing fetch to ${MINI_EVO_URL}/instance/connect/${instanceId}`);
    try {
        const response = await fetch(`${MINI_EVO_URL}/instance/connect/${instanceId}`, {
            headers: { 'apikey': token }
        });
        console.log('Status:', response.status);
        const data = await response.json().catch(() => ({}));
        console.log('Data:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Fetch Error:', e.message);
    }
}

testFetch();
