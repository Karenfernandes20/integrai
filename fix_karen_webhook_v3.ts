
import dotenv from 'dotenv';
dotenv.config();

const EVOLUTION_API_URL = "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host";
const GLOBAL_API_KEY = "5A44C72AAB33-42BD-968A-27EB8E14BE6F";
const INSTANCE_NAME = "karenloja";
const BACKEND_URL = "https://integrai.render.com";

async function fixWebhook() {
    console.log(`--- Configurando Webhook (Formato Global) para: ${INSTANCE_NAME} ---`);

    const webhookUrl = `${BACKEND_URL}/api/evolution/webhook`;

    // Formato que costuma funcionar em versões mais recentes da Evolution
    const payload = {
        enabled: true,
        url: webhookUrl,
        webhookUrl: webhookUrl,
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
        console.log("Tentando /webhook/set...");
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
            console.log("Tentando formato minimalista...");
            const responseMin = await fetch(`${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "apikey": GLOBAL_API_KEY },
                body: JSON.stringify({ enabled: true, url: webhookUrl })
            });
            console.log(`Status Minimalista: ${responseMin.status}`);
            console.log(`Response Minimalista: ${await responseMin.text()}`);
        }

    } catch (e: any) {
        console.error("Erro:", e.message);
    }
}

fixWebhook();
