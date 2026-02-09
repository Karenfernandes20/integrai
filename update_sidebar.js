const fs = require('fs');
const sidebarPath = 'c:\\Users\\Usuario\\Desktop\\KAREN\\Pessoal\\Integrai Site\\integrai\\sidebar_new.txt';
const targetPath = 'c:\\Users\\Usuario\\Desktop\\KAREN\\Pessoal\\Integrai Site\\integrai\\client\\src\\pages\\Atendimento.tsx';

try {
    const newSidebar = fs.readFileSync(sidebarPath, 'utf8');
    const targetContent = fs.readFileSync(targetPath, 'utf8');
    const lines = targetContent.split('\n');

    // Indices 0-based
    // Remove from 2516 (Line 2517) to 2868 (Line 2869)
    const startIdx = 2516;
    const endIdx = 2869; // Slice start for afterPart (keeps line 2870+)

    console.log('Cutting from line:', startIdx + 1);
    console.log('First removed line content:', lines[startIdx].trim().substring(0, 50));
    console.log('Last removed line content:', lines[endIdx - 1].trim().substring(0, 50));
    console.log('Resuming at line:', endIdx + 1);
    console.log('First kept line after cut:', lines[endIdx].trim().substring(0, 50));

    const beforePart = lines.slice(0, startIdx);
    const afterPart = lines.slice(endIdx);

    const newContent = beforePart.join('\n') + '\n' + newSidebar + '\n' + afterPart.join('\n');

    fs.writeFileSync(targetPath, newContent, 'utf8');
    console.log('Successfully updated Atendimento.tsx');
} catch (e) {
    console.error('Error:', e);
}
