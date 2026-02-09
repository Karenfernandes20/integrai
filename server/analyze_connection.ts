
import "./env";
import { URL } from 'url';

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    console.log("DATABASE_URL is missing");
} else {
    try {
        const url = new URL(dbUrl);
        console.log("Host:", url.hostname);
        console.log("Protocol:", url.protocol);
        console.log("Port:", url.port);
        console.log("Path:", url.pathname);

        if (!url.hostname.includes('.')) {
            console.log("WARNING: Hostname has no dots. This might be an INTERNAL URL (e.g., Render Internal). You must use the EXTERNAL URL for local development.");
        } else {
            console.log("Hostname looks externally routable (contains dots).");
        }

    } catch (e) {
        console.log("Could not parse DATABASE_URL:", e.message);
    }
}
