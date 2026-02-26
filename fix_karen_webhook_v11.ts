
import dotenv from 'dotenv';
dotenv.config();

const EVOLUTION_API_URL = "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host";
const GLOBAL_API_KEY = "5A44C72AAB33-42BD-968A-27EB8E14BE6F";
const INSTANCE_NAME = "karenloja";
const BACKEND_URL = "https://integrai.render.com";

async function fixWebhook() {
    const webhookUrl = `${BACKEND_URL}/api/evolution/webhook`;

    // Formato Global Settings para Evolution v1 (Common)
    const payload = {
        enabled: true,
        url: webhookUrl,
        events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "MESSAGES_DELETE",
            "SEND_MESSAGE",
            "CONNECTION_UPDATE",
            "TYPEING_START",
            "CHATS_UPSERT",
            "CHATS_UPDATE",
            "PRESENCE_UPDATE",
            "MESSAGE_RECEIVED"
        ]
    };

    try {
        console.log("Tentando /webhook/set (Formato v1 Flat)...");
        const response = await fetch(`${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": GLOBAL_API_KEY
            },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        console.log(`Status /webhook/set: ${response.status}`);
        console.log(`Response: ${text}`);

        if (response.status === 400) {
            console.log("Tentando com a URL dentro de 'webhook' mas com events fora...");
            const response2 = await fetch(`${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "apikey": GLOBAL_API_KEY },
                body: JSON.stringify({
                    enabled: true,
                    webhook: webhookUrl,
                    events: payload.events
                })
            });
            console.log(`Status 2: ${response2.status}`);
            console.log(`Response 2: ${await response2.text()}`);
        }

    } catch (e: any) {
        console.error("Erro:", e.message);
    }
}

fixWebhook();
