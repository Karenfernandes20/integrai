const fs = require('fs');
const targetPath = 'client/src/pages/Atendimento.tsx';

try {
    const content = fs.readFileSync(targetPath, 'utf8');
    const lines = content.split('\n');

    // Identificamos que entre 2484 e 2516 temos um return duplicado
    // Vamos remover essas linhas (índice 2483 a 2515)
    const beforePart = lines.slice(0, 2483);
    const afterPart = lines.slice(2516);

    const newContent = beforePart.join('\n') + '\n' + afterPart.join('\n');

    fs.writeFileSync(targetPath, newContent, 'utf8');
    console.log('Successfully removed duplicated return block.');
} catch (e) {
    console.error('Error:', e);
}
