
import fs from 'fs';
const content = fs.readFileSync('output_supabase_keys.txt', 'utf8'); // or 'utf16le' if needed
console.log(content);
