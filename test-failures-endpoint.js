// SCRIPT DE TESTE - Relatório de Falhas
// Execute: node test-failures-endpoint.js <CAMPAIGN_ID> <AUTH_TOKEN>

const http = require('http');

const campaignId = process.argv[2] || '1';
const token = process.argv[3] || '';

if (!token) {
    console.log('❌ Token de autenticação necessário!');
    console.log('Uso: node test-failures-endpoint.js <CAMPAIGN_ID> <AUTH_TOKEN>');
    process.exit(1);
}

const options = {
    hostname: 'localhost',
    port: 3001,
    path: `/api/campaigns/${campaignId}/failures`,
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${token}`
    }
};

console.log('🧪 Testando endpoint:', options.path);
console.log('');

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('📊 Status Code:', res.statusCode);
        console.log('📋 Headers:', JSON.stringify(res.headers, null, 2));
        console.log('');
        console.log('📦 Response Body:');

        try {
            const parsed = JSON.parse(data);
            console.log(JSON.stringify(parsed, null, 2));

            // Validações
            console.log('');
            console.log('✅ VALIDAÇÕES:');
            console.log('  - É objeto?', typeof parsed === 'object' ? '✅' : '❌');
            console.log('  - Tem campo "failures"?', Array.isArray(parsed.failures) ? '✅' : '❌');
            console.log('  - Tem campo "hasError"?', typeof parsed.hasError === 'boolean' ? '✅' : '❌');
            console.log('  - Quantidade de falhas:', parsed.failures?.length || 0);

            if (parsed.failures && parsed.failures.length > 0) {
                console.log('');
                console.log('📝 Primeira falha:');
                const firstFailure = parsed.failures[0];
                console.log('  - phone:', firstFailure.phone);
                console.log('  - error_message:', firstFailure.error_message);
                console.log('  - created_at:', firstFailure.created_at);
            }

            if (res.statusCode === 200) {
                console.log('');
                console.log('🎉 TESTE PASSOU! Endpoint retornou 200 com formato correto.');
            }
        } catch (e) {
            console.log('❌ Erro ao fazer parse do JSON:', e.message);
            console.log('Raw data:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Erro na requisição:', error.message);
});

req.end();
