
import https from 'https';

const url = 'https://freelasdekaren-evolution-api.nhvvzr.easypanel.host/instance/connect/integrai';
const keys = [
    '5A44C72AAB33-42BD-968A-27EB8E14BE6F', // User provided key (Instance?)
    '429683C4C977415CAAFCCE10F7D57E11' // Global key
];

keys.forEach(key => {
    const options = { method: 'GET', headers: { 'apikey': key, 'Content-Type': 'application/json' } };
    const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log(`KEY: ...${key.slice(-5)} | STATUS: ${res.statusCode}`);
        });
    });
    req.on('error', (e) => console.error(e.message));
    req.end();
});
