import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (server/../.env) for local dev
// On Render, env vars are set in dashboard, so file might not exist.
// dotenv.config won't crash if file is missing, but let's be safe.
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

