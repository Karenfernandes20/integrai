
import dotenv from 'dotenv';
dotenv.config();

const EVOLUTION_API_URL = "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host";
const GLOBAL_API_KEY = "5A44C72AAB33-42BD-968A-27EB8E14BE6F";
const INSTANCE_NAME = "karenloja";
const BACKEND_URL = "https://integrai.render.com";

async function fixWebhook() {
    const webhookUrl = `${BACKEND_URL}/api/evolution/webhook`;

    // Formato Ultra-Simples (apenas URL)
    try {
        console.log("Tentando /webhook/set (Apenas URL)...");
        const response = await fetch(`${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": GLOBAL_API_KEY
            },
            body: JSON.stringify({
                url: webhookUrl
            })
        });

        const text = await response.text();
        console.log(`Status /webhook/set: ${response.status}`);
        console.log(`Response: ${text}`);

        console.log("\nTentando com enabled separado...");
        const response2 = await fetch(`${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "apikey": GLOBAL_API_KEY },
            body: JSON.stringify({
                enabled: true
            })
        });
        console.log(`Status ENABLED: ${response2.status}`);

    } catch (e: any) {
        console.error("Erro:", e.message);
    }
}

fixWebhook();
