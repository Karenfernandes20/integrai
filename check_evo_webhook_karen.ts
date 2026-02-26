
import dotenv from 'dotenv';
dotenv.config();

const EVOLUTION_API_URL = "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host";
const GLOBAL_API_KEY = "5A44C72AAB33-42BD-968A-27EB8E14BE6F";
const INSTANCE_NAME = "karenloja";

async function checkWebhook() {
    console.log(`--- Verificando Webhook para: ${INSTANCE_NAME} ---`);

    try {
        const url = `${EVOLUTION_API_URL}/webhook/find/${INSTANCE_NAME}`;
        const response = await fetch(url, {
            headers: { "apikey": GLOBAL_API_KEY }
        });

        const text = await response.text();
        console.log(`Status: ${response.status}`);
        console.log(`Raw Body: ${text}`);

        if (response.ok && text.length > 2) {
            const data = JSON.parse(text);
            console.log("Config (JSON):", JSON.stringify(data, null, 2));
        }
    } catch (e: any) {
        console.error("Erro:", e.message);
    }
}

checkWebhook();
