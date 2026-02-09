const fs = require('fs');
const targetPath = 'client/src/pages/Atendimento.tsx';

try {
    let content = fs.readFileSync(targetPath, 'utf8');

    // Find: onClick={() => handleSendReaction(msg.external_id || msg.id, '❤️')}
    // Replace: onClick={() => handleSendReaction(msg, '❤️')}

    const oldStr = "onClick={() => handleSendReaction(msg.external_id || msg.id, '❤️')}";
    const newStr = "onClick={() => handleSendReaction(msg, '❤️')}";

    if (content.includes(oldStr)) {
        content = content.replace(oldStr, newStr);
        fs.writeFileSync(targetPath, content, 'utf8');
        console.log('Successfully fixed handleSendReaction argument.');
    } else {
        console.log('Target string not found. Checking for variations...');
        // Try regex if direct match fails
        const regex = /handleSendReaction\(msg\.external_id\s*\|\|\s*msg\.id,\s*'❤️'\)/g;
        if (regex.test(content)) {
            content = content.replace(regex, "handleSendReaction(msg, '❤️')");
            fs.writeFileSync(targetPath, content, 'utf8');
            console.log('Successfully fixed handleSendReaction argument using regex.');
        } else {
            console.log('Regex also failed. Printing file around expected area...');
        }
    }
} catch (e) {
    console.error('Error:', e);
}
