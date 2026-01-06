import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../.env");
console.log("Env path:", envPath);
console.log("Exists:", fs.existsSync(envPath));

dotenv.config({ path: envPath });
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Defined" : "Undefined");
