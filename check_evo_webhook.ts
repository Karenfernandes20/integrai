
import fetch from 'node-fetch';

const EVOLUTION_API_URL = "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host";
const EVOLUTION_API_KEY = "0007A57DADB2-46A9-832D-C843FF910263"; // Assuming this is correct or use global if fails
const INSTANCE = "karenloja";

async function checkWebhook() {
    const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/webhook/find/${INSTANCE}`;
    console.log(`Checking webhook at ${url}`);

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                apikey: EVOLUTION_API_KEY
            }
        });

        if (!response.ok) {
            console.error(`Error: ${response.status} ${await response.text()}`);
            return;
        }

        const data = await response.json();
        console.log('Webhook Data:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

checkWebhook();
