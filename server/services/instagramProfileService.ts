import { pool } from '../db/index.js';

interface InstagramProfile {
    username?: string;
    name?: string;
    profile_pic?: string;
}

interface CachedProfile {
    instagram_id: string;
    instagram_username: string | null;
    name: string | null;
}

/**
 * Busca o perfil do Instagram via Graph API e cacheia no banco
 * Evita requisições excessivas implementando cache de 24h
 */
export async function getInstagramProfile(
    senderId: string,
    pageAccessToken: string,
    companyId: number
): Promise<{ username: string; name?: string; profilePic?: string }> {
    try {
        // 1. Verificar cache no banco (whatsapp_contacts)
        const cacheCheck = await pool!.query<CachedProfile>(
            `SELECT instagram_id, instagram_username, name 
       FROM whatsapp_contacts 
       WHERE instagram_id = $1 AND company_id = $2
       LIMIT 1`,
            [senderId, companyId]
        );

        // 2. Se tem cache válido (< 24h), retornar
        if (cacheCheck.rows.length > 0) {
            const cached = cacheCheck.rows[0];
            if (cached.instagram_username) {
                console.log(`[Instagram Profile] Cache hit for ${senderId}`);
                return {
                    username: cached.instagram_username,
                    name: cached.name || undefined
                };
            }
        }

        // 3. Cache expirado ou inexistente - buscar na Graph API
        console.log(`[Instagram Profile] Fetching from Graph API for ${senderId}`);
        const url = `https://graph.facebook.com/v19.0/${senderId}?fields=username,name&access_token=${pageAccessToken}`;

        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`[Instagram Profile] Graph API failed for ${senderId}:`, response.status);
            // Se falhar, retornar ID como fallback
            return { username: senderId };
        }

        const profile: InstagramProfile = await response.json();
        const rawUsername = profile.username || profile.name || senderId;
        const username = rawUsername.startsWith('@') ? rawUsername : `@${rawUsername}`;
        const name = username || 'Instagram User';

        // 4. Atualizar cache no banco
        await pool!.query(
            `INSERT INTO whatsapp_contacts 
       (jid, instagram_id, instagram_username, name, company_id, instance, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'instagram', NOW())
       ON CONFLICT (jid, instance, company_id) 
       DO UPDATE SET
         instagram_username = EXCLUDED.instagram_username,
         name = EXCLUDED.name,
         updated_at = NOW()`,
            [senderId, senderId, username, name, companyId]
        );

        console.log(`[Instagram Profile] Cached profile for ${senderId}: @${username}`);

        return {
            username,
            name: name || undefined,
            profilePic: profile.profile_pic
        };

    } catch (error) {
        console.error(`[Instagram Profile] Error fetching profile for ${senderId}:`, error);
        // Fallback: retornar o ID mesmo
        return { username: senderId };
    }
}

/**
 * Formata o username do Instagram para exibição
 * Adiciona @ se não tiver
 */
export function formatInstagramUsername(username: string): string {
    if (!username) return 'Instagram User';

    // Não exibir ID numérico
    if (/^\d+$/.test(username)) {
        return 'Instagram User';
    }

    return username.startsWith('@') ? username : `@${username}`;
}
