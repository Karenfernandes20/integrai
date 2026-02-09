const fs = require('fs');
const content = fs.readFileSync('client/src/pages/Atendimento.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('<FollowUpModal')) {
        console.log(`FollowUpModal at line ${index + 1}`);
    }
    if (line.includes('{/* Call UI Components */}')) {
        console.log(`Call UI at line ${index + 1}`);
    }
});
