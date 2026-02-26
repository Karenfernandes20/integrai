import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const EVOLUTION_API_URL = "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host";
const GLOBAL_API_KEY = "5A44C72AAB33-42BD-968A-27EB8E14BE6F";
const INSTANCE_NAME = "karenloja";
const BACKEND_URL = "https://integrai.render.com";

async function fixWebhook() {
    const webhookUrl = `${BACKEND_URL}/api/evolution/webhook`;

    // Objeto aninhado Webhook
    const payload = {
        webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            events: [
                "MESSAGES_SET",
                "MESSAGES_UPSERT",
                "MESSAGES_UPDATE",
                "MESSAGES_DELETE",
                "SEND_MESSAGE",
                "CONNECTION_UPDATE",
                "CHATS_SET",
                "CHATS_UPSERT",
                "CHATS_UPDATE",
                "PRESENCE_UPDATE"
            ]
        }
    };

    try {
        console.log("Tentando /webhook/set (com objeto 'webhook')...");
        const response = await fetch(`${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": GLOBAL_API_KEY
            },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        console.log(`Status: ${response.status}`);
        if (!response.ok) {
            fs.writeFileSync('err17.json', text);
            console.log("Erro gravado em err17.json");
        } else {
            console.log("Webhook configurado com sucesso!!!");
            console.log("Response:", text);
        }
    } catch (e: any) {
        console.error("Erro:", e.message);
    }
}

fixWebhook();
