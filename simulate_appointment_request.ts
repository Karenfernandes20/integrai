
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';

async function test() {
    // 1. Generate Token
    const userPayload = {
        id: 38,
        email: "karen@agenda.com",
        role: "ADMIN",
        company_id: 30,
        full_name: "Karen Agenda"
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '1h' });
    console.log("Token Generated (Prefix):", token.substring(0, 10));

    // 2. Make Request
    const start = "2026-02-09T03:00:00.000Z";
    const end = "2026-02-10T02:59:59.999Z";

    const params = new URLSearchParams({
        start: start,
        end: end
    });

    const url = `http://localhost:5000/api/crm/appointments?${params.toString()}`;
    console.log("Fetching URL:", url);

    try {
        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) {
            console.error("Request Failed:", res.status, res.statusText);
            const text = await res.text();
            console.error("Body:", text);
            return;
        }

        const data = await res.json();
        console.log("Success! Events received:", Array.isArray(data) ? data.length : data);
        if (Array.isArray(data) && data.length > 0) {
            console.log("Sample ID:", data[0].id);
        } else {
            console.log("No events found.");
        }

    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

test();
