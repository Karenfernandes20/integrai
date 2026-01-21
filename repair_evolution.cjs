const fs = require('fs');
const path = 'server/controllers/evolutionController.ts';

try {
    const content = fs.readFileSync(path);
    // Remove null bytes
    const cleanContent = content.toString().replace(/\0/g, '');
    fs.writeFileSync(path, cleanContent);
    console.log('Successfully cleaned null bytes from evolutionController.ts');
} catch (err) {
    console.error('Error cleaning file:', err);
}
