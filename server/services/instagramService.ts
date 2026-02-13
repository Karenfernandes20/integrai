
import { pool } from '../db';

export const sendInstagramMessage = async (companyId: number, recipientId: string, text: string) => {
    try {
        const companyRes = await pool!.query(
            'SELECT instagram_access_token, instagram_page_id FROM companies WHERE id = $1',
            [companyId]
        );

        if (companyRes.rows.length === 0) {
            throw new Error('Empresa não encontrada');
        }

        const { instagram_access_token, instagram_page_id } = companyRes.rows[0];

        if (!instagram_access_token) {
            throw new Error('Token do Instagram não configurado');
        }

        const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${instagram_access_token}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: recipientId },
                message: { text: text }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[Instagram Send Error]', data);
            throw new Error(data.error?.message || 'Falha ao enviar mensagem no Instagram');
        }

        return data;
    } catch (e: any) {
        console.error('[Instagram Service Error]', e);
        throw e;
    }
};

export const validateInstagramCredentials = async (accessToken: string, pageId?: string) => {
    try {
        // Test token validity
        const meUrl = `https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${accessToken}`;
        const meRes = await fetch(meUrl);
        const meData = await meRes.json();

        if (!meRes.ok) {
            throw new Error(meData.error?.message || 'Token inválido ou expirado');
        }

        // If pageId is provided, verify accessibility
        if (pageId) {
            const pageUrl = `https://graph.facebook.com/v18.0/${pageId}?fields=id,name&access_token=${accessToken}`;
            const pageRes = await fetch(pageUrl);
            const pageData = await pageRes.json();

            if (!pageRes.ok) {
                throw new Error(pageData.error?.message || 'ID da Página inválido ou sem acesso');
            }
        }

        return { success: true, data: meData };
    } catch (e: any) {
        console.error('[Instagram Validation Error]', e);
        throw e;
    }
};

export const testInstagramConnection = async (req: any, res: any) => {
    try {
        const { accessToken, pageId } = req.body;
        if (!accessToken) return res.status(400).json({ error: 'Access token is required' });

        const result = await validateInstagramCredentials(accessToken, pageId);
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
};
