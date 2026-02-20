
import fs from 'fs';
import path from 'path';

const baseDir = 'c:\\Users\\Usuario\\Desktop\\KAREN\\Pessoal\\Integrai Site\\integrai';
const dir = path.join(baseDir, 'client', 'src', 'pages');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

console.log(`Found ${files.length} files`);

for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    if (content.includes('DialogFooter')) {
        const importRegex = /import\s+{[^}]*DialogFooter[^}]*}\s+from\s+['"].*\/dialog['"]/;
        const hasImport = importRegex.test(content);
        console.log(`Checking ${file}: ${hasImport ? 'OK' : 'MISSING'}`);
    }
}
