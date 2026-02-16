import { pool } from '../db/index.js';

interface InstagramProfile {
    username?: string;
    name?: string;
    profile_pic?: string;
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
        if (!senderId || !pageAccessToken || !pool) {
            return { username: senderId };
        }

        // 1. Verificar cache no banco (Tabela contacts é a principal para omnichannel)
        const cacheCheck = await pool.query(
            `SELECT username, name, profile_picture, updated_at 
             FROM contacts 
             WHERE external_id = $1 AND company_id = $2 AND channel = 'instagram'
             LIMIT 1`,
            [senderId, companyId]
        );

        if (cacheCheck.rows.length > 0) {
            const cached = cacheCheck.rows[0];
            const lastUpdate = cached.updated_at;
            const isRecent = lastUpdate && (Date.now() - new Date(lastUpdate).getTime() < 24 * 60 * 60 * 1000);

            // Só retorna cache se tiver um username real (não o ID numérico) e for recente
            if (cached.username && cached.username !== senderId && isRecent) {
                console.log(`[Instagram Profile] Cache hit for ${senderId}: @${cached.username}`);
                return {
                    username: cached.username,
                    name: cached.name || undefined,
                    profilePic: cached.profile_picture || undefined
                };
            }
        }

        // 2. Buscar na Graph API da Meta
        console.log(`[Instagram Profile] Fetching from Meta Graph API for ${senderId}...`);
        const url = `https://graph.facebook.com/v18.0/${senderId}?fields=username,name,profile_pic&access_token=${pageAccessToken}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            if (data.error) {
                const { message, type, code, error_subcode } = data.error;
                console.error(`[Instagram Profile] Meta API Error: ${message} (Code: ${code}, Subcode: ${error_subcode}, Type: ${type})`);

                if (code === 190) {
                    console.error('[Instagram Profile] 🚨 TOKEN INVÁLIDO OU EXPIRADO. Reautentique a conta.');
                } else if (code === 10 || code === 200 || code === 400) {
                    console.error('[Instagram Profile] 🚨 ERRO DE PERMISSÃO. Verifique se o token tem: instagram_basic, instagram_manage_messages, pages_read_engagement.');
                }
            } else {
                console.warn(`[Instagram Profile] Graph API failed with status ${response.status}`);
            }
            return { username: senderId };
        }

        const profile: InstagramProfile = data;
        const username = profile.username || senderId;
        const name = profile.name || null;
        const profilePic = profile.profile_pic || null;

        console.log(`[Instagram Profile] Successfully resolved: @${username} (${name || 'No name'})`);

        return {
            username,
            name: name || undefined,
            profilePic: profilePic || undefined
        };

    } catch (error) {
        console.error(`[Instagram Profile] Unexpected error fetching profile for ${senderId}:`, error);
        return { username: senderId };
    }
}

/**
 * Formata o username do Instagram para exibição
 */
export function formatInstagramUsername(username: string): string {
    if (!username) return 'Instagram User';

    // Se for apenas números, é o ID técnico, ocultamos
    if (/^\d+$/.test(username)) {
        return 'Instagram User';
    }

    return username.startsWith('@') ? username : `@${username}`;
}
