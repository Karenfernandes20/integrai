
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

async function testLogout() {
    const apiKey = '5A44C72AAB33-42BD-968A-27EB8E14BE6F';
    const instance = 'integrailoja';
    const baseUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, "");
    const url = `${baseUrl}/instance/logout/${instance}`;

    console.log(`Testing DELETE ${url} with key ${apiKey}`);

    try {
        const res = await fetch(url, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "apikey": apiKey
            }
        });

        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Body: ${text}`);
    } catch (e) {
        console.error(e);
    }
}

testLogout();
