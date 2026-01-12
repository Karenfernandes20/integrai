
import { pool } from '../db';
import querystring from 'querystring';

/*
 * Simple Twilio Voice Service using native fetch
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 */

export const makeTwilioCall = async (to: string, fromOverride?: string) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = fromOverride || process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
        throw new Error("Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)");
    }

    const auth = Buffer.from(accountSid + ":" + authToken).toString("base64");
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;

    // TwiML Bin or simple response that bridges the call or just says something
    // For a real softphone, we need a Client setup. For a simple PSTN-to-PSTN call:
    // We can't bridge to browser audio without a specific Client setup.
    // BUT user asked for "Real Call".
    // If we call the User's Phone (Agent) first, and then bridge to Client?
    // Or if we assume this is just for status tracking.

    // Let's assume sending a call to the 'to' number.
    // We need a URL to execute when answered.
    // Defaulting to a demo TwiML or empty.
    const twimlUrl = "http://demo.twilio.com/docs/voice.xml";

    const body = querystring.stringify({
        To: to,
        From: fromNumber,
        Url: twimlUrl
    });

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": "Basic " + auth,
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: body
    });

    if (!response.ok) {
        const err = await response.text();
        console.error("Twilio Error:", err);
        throw new Error("Failed to initiate call via Twilio: " + response.statusText);
    }

    const data = await response.json();
    return data;
};
