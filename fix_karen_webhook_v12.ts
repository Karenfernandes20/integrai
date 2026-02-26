
import dotenv from 'dotenv';
dotenv.config();

const EVOLUTION_API_URL = "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host";
const GLOBAL_API_KEY = "5A44C72AAB33-42BD-968A-27EB8E14BE6F";
const INSTANCE_NAME = "karenloja";
const BACKEND_URL = "https://integrai.render.com";

async function fixWebhook() {
    const webhookUrl = `${BACKEND_URL}/api/evolution/webhook`;

    // Formato Global Settings para Evolution v2 corrigido (mais uma variação)
    const payload = {
        webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            base64: false,
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
        }
    };

    try {
        console.log("Tentando /webhook/instance/{instance} (Formato v2 Real)...");
        // Algumas versões usam /webhook/instance/:instance
        const response = await fetch(`${EVOLUTION_API_URL}/webhook/instance/${INSTANCE_NAME}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": GLOBAL_API_KEY
            },
            body: JSON.stringify(payload.webhook)
        });

        const text = await response.text();
        console.log(`Status /webhook/instance: ${response.status}`);
        console.log(`Response: ${text}`);

        if (response.status === 404) {
            console.log("Tentando /webhook/update/:instance...");
            const response2 = await fetch(`${EVOLUTION_API_URL}/webhook/update/${INSTANCE_NAME}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "apikey": GLOBAL_API_KEY },
                body: JSON.stringify(payload.webhook)
            });
            console.log(`Status /webhook/update: ${response2.status}`);
            console.log(`Response 2: ${await response2.text()}`);
        }

    } catch (e: any) {
        console.error("Erro:", e.message);
    }
}

fixWebhook();
