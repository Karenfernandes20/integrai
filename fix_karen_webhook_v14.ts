
import dotenv from 'dotenv';
dotenv.config();

const EVOLUTION_API_URL = "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host";
const GLOBAL_API_KEY = "5A44C72AAB33-42BD-968A-27EB8E14BE6F";
const INSTANCE_NAME = "karenloja";
const BACKEND_URL = "https://integrai.render.com";

async function fixWebhook() {
    const webhookUrl = `${BACKEND_URL}/api/evolution/webhook`;

    // Teste 1: Apenas o campo 'webhook' (URL)
    // Teste 2: Objeto 'webhook' contendo tudo
    const payloads = [
        { webhook: webhookUrl }, // Minimalista v2
        { webhook: { url: webhookUrl, enabled: true } }, // Objeto v2
        { enabled: true, url: webhookUrl }, // Minimalista v1
        { enabled: true, webhook: webhookUrl } // Outra variante
    ];

    for (const [index, payload] of payloads.entries()) {
        try {
            console.log(`\n--- Teste ${index + 1} ---`);
            console.log("Payload:", JSON.stringify(payload));
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
            console.log(`Response: ${text}`);

            if (response.ok) {
                console.log("✅ Sucesso no teste", index + 1);
                break;
            }
        } catch (e: any) {
            console.error("Erro:", e.message);
        }
    }
}

fixWebhook();
