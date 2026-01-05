
import "./env";
import { checkAndStartScheduledCampaigns } from "./controllers/campaignController";
import { pool } from "./db";

const test = async () => {
    try {
        console.log("Testing scheduler...");
        await checkAndStartScheduledCampaigns(null);
        console.log("Scheduler Success");
    } catch (e) {
        console.error("Scheduler Failed:", e);
    } finally {
        await pool.end();
    }
};

test();
