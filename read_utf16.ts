
import fs from 'fs';
const content = fs.readFileSync('files_with_footer.txt', 'utf16le');
console.log(content);
