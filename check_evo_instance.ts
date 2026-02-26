
import fetch from 'node-fetch';

const EVOLUTION_API_URL = "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host";
const GLOBAL_API_KEY = "5A44C72AAB33-42BD-968A-27EB8E14BE6F";
const INSTANCE = "karenloja";

async function checkInstance() {
    const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/instance/connectionState/${INSTANCE}`;
    console.log(`Checking instance state at ${url}`);

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                apikey: GLOBAL_API_KEY
            }
        });

        if (!response.ok) {
            console.error(`Error: ${response.status} ${await response.text()}`);
            return;
        }

        const data = await response.json();
        console.log('Instance State:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

checkInstance();
