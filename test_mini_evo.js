
import axios from 'axios';

const MINI_EVO_URL = 'http://127.0.0.1:3001';
const INSTANCE_KEY = 'instancia_002';
const TOKEN = 'me_d7a116b69d704572ff4112a4466fe022';

async function testConnect() {
    try {
        console.log(`Testing connect for ${INSTANCE_KEY}...`);
        const res = await axios.get(`${MINI_EVO_URL}/instance/connect/${INSTANCE_KEY}`, {
            headers: { 'apikey': TOKEN }
        });
        console.log('Response:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        if (err.response) {
            console.error(`Error ${err.response.status}:`, JSON.stringify(err.response.data, null, 2));
        } else {
            console.error('Error:', err.message);
        }
    }
}

testConnect();
