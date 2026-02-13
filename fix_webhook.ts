
import './server/env';
import axios from 'axios';
import fs from 'fs';

const logFile = 'webhook_debug.log';
// Clear log
fs.writeFileSync(logFile, '');

const log = (msg: string) => {
    console.log(msg);
    try { fs.appendFileSync(logFile, msg + '\n'); } catch (e) { }
};

async function fix() {
    log("Checking Ngrok...");
    try {
        const tunnelRes = await axios.get("http://127.0.0.1:4040/api/tunnels");
        const tunnels = tunnelRes.data.tunnels;
        const tunnel = tunnels.find((t: any) => t.public_url.startsWith("https"));

        if (!tunnel) {
            log("No HTTPS tunnel found.");
            return;
        }

        const publicUrl = tunnel.public_url;
        const webhookUrl = `${publicUrl}/evolution/webhook`;
        const evolutionUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
        const evolutionKey = process.env.EVOLUTION_API_KEY;
        const targetInstance = 'integrai';

        log(`Connecting to Evolution API at ${evolutionUrl}...`);

        try {
            const listRes = await axios.get(`${evolutionUrl}/instance/fetchInstances`, {
                headers: { 'apikey': evolutionKey }
            });

            log(`Raw Instances: ${JSON.stringify(listRes.data)}`);

            const found = listRes.data.find((i: any) => (i.instance?.instanceName === targetInstance) || (i.name === targetInstance) || (i.instance?.instanceKey === targetInstance));

            if (!found) {
                log(`Instance '${targetInstance}' NOT FOUND.`);
                // Create Logic: call POST /instance/create
                log(`Creating instance '${targetInstance}'...`);
                try {
                    const createRes = await axios.post(`${evolutionUrl}/instance/create`, {
                        instanceName: targetInstance,
                        qrcode: true,
                        integration: "WHATSAPP-BAILEYS"
                    }, { headers: { apikey: evolutionKey } });
                    log(`Created: ${JSON.stringify(createRes.data)}`);
                } catch (ce: any) {
                    log(`Creation Error: ${JSON.stringify(ce.response?.data || ce.message)}`);
                }
            } else {
                log(`Instance '${targetInstance}' found.`);
            }

        } catch (e: any) {
            log(`List Error: ${JSON.stringify(e.response?.data || e.message)}`);
        }

        log(`Setting webhook for '${targetInstance}' to ${webhookUrl}...`);

        try {
            // Using correct field names for Evolution API
            const setRes = await axios.post(`${evolutionUrl}/webhook/set/${targetInstance}`, {
                webhook: webhookUrl,
                enabled: true,
                webhook_by_events: true,
                events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "MESSAGE_UPDATE", "SEND_MESSAGE", "CONNECTION_UPDATE"]
            }, { headers: { 'apikey': evolutionKey } });

            log(`Success: ${JSON.stringify(setRes.data)}`);

            // Try verify get
            try {
                const getRes = await axios.get(`${evolutionUrl}/webhook/find/${targetInstance}`, { headers: { 'apikey': evolutionKey } });
                log(`Verify Webhook: ${JSON.stringify(getRes.data)}`);
            } catch (ignored) { }

        } catch (e: any) {
            log(`Webhook Error: ${JSON.stringify(e.response?.data || e.message)}`);
        }

    } catch (e: any) {
        log(`General Error: ${e.message}`);
    }
}

fix();
