
import twilio from 'twilio';

const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

/**
 * Generate Access Token for Browser-based (WebRTC) calling
 */
export const generateVoiceToken = (identity: string) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKey = process.env.TWILIO_API_KEY_SID; // API Key is preferred for Tokens
    const apiSecret = process.env.TWILIO_API_KEY_SECRET;
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID; // Required for Browser Calls

    if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
        throw new Error("Missing Twilio credentials for Voice Token (SID, API KEY, SECRET, APP SID)");
    }

    const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: twimlAppSid,
        incomingAllow: true, // Allow incoming calls to this client?
    });

    const token = new AccessToken(accountSid, apiKey, apiSecret, { identity: identity });
    token.addGrant(voiceGrant);

    return token.toJwt();
};

/**
 * Generate TwiML to bridge Browser Call to Real Phone Number
 */
export const generateOutboundTwiML = (to: string, callerId?: string) => {
    const response = new twilio.twiml.VoiceResponse();
    const dial = response.dial({
        callerId: callerId || process.env.TWILIO_PHONE_NUMBER,
        answerOnBridge: true
    });
    // Ensure clean number format
    dial.number(to);
    return response.toString();
};

/**
 * Server-Side Call Initiation (Legacy / Click-To-Device)
 * Uses official SDK now.
 */
export const makeTwilioCall = async (to: string, fromOverride?: string) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = fromOverride || process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
        throw new Error("Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)");
    }

    const client = twilio(accountSid, authToken);

    const call = await client.calls.create({
        url: 'http://demo.twilio.com/docs/voice.xml', // Replace with your TwiML Bin URL
        to: to,
        from: fromNumber
    });

    return call;
};
