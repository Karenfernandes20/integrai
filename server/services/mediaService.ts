
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'messages');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export async function downloadMediaFromEvolution(instance: string, message: any, companyId: number): Promise<string | null> {
    try {
        const realM = message.message || message.data?.message || message;
        const msg = realM.imageMessage || realM.videoMessage || realM.audioMessage || realM.documentMessage || realM.stickerMessage;

        if (!msg) {
            console.warn('[MediaService] No media found in message object');
            return null;
        }

        const mediaKey = msg.mediaKey;
        const directPath = msg.directPath;
        const mimetype = msg.mimetype;
        const fileSha256 = msg.fileSha256;

        let mediaType = 'image';
        if (realM.videoMessage) mediaType = 'video';
        else if (realM.audioMessage) mediaType = 'audio';
        else if (realM.documentMessage) mediaType = 'document';
        else if (realM.stickerMessage) mediaType = 'sticker';

        // Get Evolution config
        if (!pool) return null;
        const compRes = await pool.query('SELECT evolution_apikey, evolution_url FROM companies WHERE id = $1', [companyId]);
        if (compRes.rows.length === 0) return null;

        const apikey = compRes.rows[0].evolution_apikey;
        const baseUrl = (compRes.rows[0].evolution_url || process.env.EVOLUTION_API_URL || "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host").replace(/\/$/, "");

        console.log(`[MediaService] Downloading ${mediaType} from instance ${instance}...`);

        const downloadUrl = `${baseUrl}/chat/downloadMedia/${instance}`;

        const response = await fetch(downloadUrl, {
            method: 'POST',
            headers: {
                'apikey': apikey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mediaKey,
                directPath,
                mediaType,
                mimetype,
                fileSha256
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[MediaService] Evolution download failed (${response.status}):`, errText);
            return null;
        }

        const data = await response.json();
        const base64 = data.base64;

        if (!base64) {
            console.error('[MediaService] No base64 data returned from Evolution');
            return null;
        }

        // Save file
        const extension = mimetype.split('/')[1]?.split(';')[0] || 'file';
        const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${extension}`;
        const filePath = path.join(UPLOADS_DIR, fileName);

        const buffer = Buffer.from(base64, 'base64');
        fs.writeFileSync(filePath, buffer);

        const publicUrl = `/uploads/messages/${fileName}`;
        console.log(`[MediaService] File saved: ${publicUrl}`);

        return publicUrl;
    } catch (error) {
        console.error('[MediaService] Error downloading media:', error);
        return null;
    }
}
