const fs = require('fs');
const content = fs.readFileSync('client/src/pages/Atendimento.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('bg-[#efeae2]')) {
        console.log(`Found at line ${index + 1}: ${line.trim().substring(0, 50)}`);
    }
});
