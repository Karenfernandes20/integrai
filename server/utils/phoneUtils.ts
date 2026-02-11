
/**
 * Normalizes a phone number by removing all non-digit characters and ensuring it includes 
 * the Brazilian country code (55) if it looks like a Brazilian number.
 * 
 * Target Format: 55 + DDD + number (e.g. 5511999999999)
 */
export function normalizePhone(phone: string | null | undefined): string {
    if (!phone) return "";

    // 1. Remove all non-digit characters
    let clean = phone.replace(/\D/g, "");

    // 2. Handle empty or too short
    if (clean.length === 0) return "";

    // 3. Brazilian specific normalization
    // If it has 10 or 11 digits (DDD + number), prepend 55
    if (clean.length === 10 || clean.length === 11) {
        clean = "55" + clean;
    }

    // 4. Handle Case: 0 + DDD + number (common in Brazil voice dials)
    if (clean.length === 12 && clean.startsWith("0")) {
        clean = "55" + clean.substring(1);
    }

    // 5. If it's 13 digits and starts with 55, it's likely already correct
    // But wait, some numbers in Brazil have 55 + 2 digits DDD + 9 digits number = 13 digits
    // Some have 55 + 2 digits DDD + 8 digits number = 12 digits

    return clean;
}

/**
 * Checks if a JID represents a WhatsApp Group.
 */
export function isGroupJid(jid: string | null | undefined): boolean {
    if (!jid) return false;
    return jid.endsWith('@g.us');
}

/**
 * Extracts the numeric part from a WhatsApp JID or phone string.
 * Handles:
 * - 5511999999999@s.whatsapp.net -> 5511999999999
 * - 12036302392@g.us -> 12036302392
 */
export function extractPhoneFromJid(jid: string | null | undefined): string {
    if (!jid) return "";

    // Take part before @
    let part = jid.split('@')[0];

    // Take part before : (suffix for multiple devices)
    part = part.split(':')[0];

    // If it's a group JID, we DON'T want to normalize it as a phone number
    // because it might add '55' or strip important non-digits if any exist (though rare in IDs)
    if (isGroupJid(jid)) {
        return part.replace(/\D/g, ""); // Just keep digits if it's a numeric ID
    }

    return normalizePhone(part);
}
