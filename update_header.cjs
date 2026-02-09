const fs = require('fs');
const targetPath = 'client/src/pages/Atendimento.tsx';
const headerPath = 'atendimento_header.txt';

try {
    const header = fs.readFileSync(headerPath, 'utf8');
    const content = fs.readFileSync(targetPath, 'utf8');
    const lines = content.split('\n');

    // Encontrar o fim da interface Contact ou o início do highlight helper
    // No arquivo atual, o helper começa por volta da linha 140-150.
    // Vou procurar o final da interface Contact ( } ) antes do uso de HighlightedText.

    const afterHeaderPart = lines.slice(139); // Começa do HighlightedText helper

    const newContent = header + '\n' + afterHeaderPart.join('\n');

    fs.writeFileSync(targetPath, newContent, 'utf8');
    console.log('Successfully updated Atendimento.tsx header.');
} catch (e) {
    console.error('Error:', e);
}
