import dotenv from 'dotenv';
dotenv.config();

const EVOLUTION_API_URL = "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host";
const GLOBAL_API_KEY = "5A44C72AAB33-42BD-968A-27EB8E14BE6F";
const INSTANCE_NAME = "karenloja";

async function checkWebhook() {
    console.log(`--- Verificando Webhook (FIND) para: ${INSTANCE_NAME} ---`);
    try {
        const response = await fetch(`${EVOLUTION_API_URL}/webhook/find/${INSTANCE_NAME}`, {
            headers: { "apikey": GLOBAL_API_KEY }
        });

        const text = await response.text();
        console.log(`Status /webhook/find: ${response.status}`);
        if (response.ok) {
            console.log(JSON.stringify(JSON.parse(text), null, 2));
        } else {
            console.log(`Response: ${text}`);
        }
    } catch (e: any) {
        console.error("Erro:", e.message);
    }
}

checkWebhook();
