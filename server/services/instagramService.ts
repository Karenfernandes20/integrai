
import axios from 'axios';

export async function validateInstagramCredentials(accessToken: string, pageId: string) {
    try {
        console.log(`[Instagram Service] Validating credentials for Page ID: ${pageId}`);

        // 1. Verify Token & Page Access
        const pageUrl = `https://graph.facebook.com/v19.0/${pageId}?access_token=${accessToken}&fields=id,name,username`;
        const pageRes = await fetch(pageUrl);

        if (!pageRes.ok) {
            const err = await pageRes.json();
            throw new Error(err.error?.message || "Page ID mismatch or access denied.");
        }

        const pageData = await pageRes.json();

        if (pageData.id !== pageId) {
            throw new Error("Page ID mismatch.");
        }

        const pageName = pageData.name;
        console.log(`[Instagram Service] Page verified: ${pageName} (${pageData.username})`);

        // 2. Subscribe App to Webhooks (Messages)
        const subscribeUrl = `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?access_token=${accessToken}`;
        const subscribeRes = await fetch(subscribeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subscribed_fields: ['messages', 'messaging_postbacks', 'messaging_optins', 'message_deliveries', 'message_reads', 'message_echoes']
            })
        });

        const subscribeData = await subscribeRes.json();

        if (!subscribeRes.ok || !subscribeData.success) {
            console.warn('[Instagram Service] Subscription warning:', subscribeData);
        } else {
            console.log('[Instagram Service] Webhooks subscribed successfully.');
        }

        return {
            valid: true,
            pageName: pageName,
            pageUsername: pageData.username
        };

    } catch (error: any) {
        console.error('[Instagram Service] Validation failed:', error.message);
        throw new Error(error.message);
    }
}
