const fs = require('fs');
const chatPath = 'c:\\Users\\Usuario\\Desktop\\KAREN\\Pessoal\\Integrai Site\\integrai\\chat_new.txt';
const targetPath = 'c:\\Users\\Usuario\\Desktop\\KAREN\\Pessoal\\Integrai Site\\integrai\\client\\src\\pages\\Atendimento.tsx';

try {
    const newChat = fs.readFileSync(chatPath, 'utf8');
    const targetContent = fs.readFileSync(targetPath, 'utf8');
    const lines = targetContent.split('\n');

    // Remove from 2807 (Line 2808) to 3421 (Line 3422)
    const startIdx = 2807;
    const endIdx = 3422;

    console.log('Replacing Chat Area from line:', startIdx + 1, 'to', endIdx);

    const beforePart = lines.slice(0, startIdx);
    const afterPart = lines.slice(endIdx);

    const newContent = beforePart.join('\n') + '\n' + newChat + '\n' + afterPart.join('\n');

    fs.writeFileSync(targetPath, newContent, 'utf8');
    console.log('Successfully updated Chat Area in Atendimento.tsx');
} catch (e) {
    console.error('Error:', e);
}
