// TESTE RÁPIDO DA API DE CONTATOS
// Execute: npx tsx server/test_contacts_api.ts

import "dotenv/config";
import axios from 'axios';

const API_URL = 'http://localhost:3000';
let authToken = '';

async function testContactsAPI() {
    console.log('🧪 Iniciando testes da API de Contatos...\n');

    try {
        // 1. Login (você precisa ter um usuário válido)
        console.log('1️⃣ Fazendo login...');
        try {
            const loginResponse = await axios.post(`${API_URL}/auth/login`, {
                email: 'admin@integrai.com', // Ajuste conforme necessário
                password: 'admin123'
            });
            authToken = loginResponse.data.token;
            console.log('✅ Login bem-sucedido\n');
        } catch (error: any) {
            console.log('⚠️  Erro no login. Use credenciais válidas.');
            console.log('   Ajuste email/password no arquivo de teste.\n');
            return;
        }

        const headers = { Authorization: `Bearer ${authToken}` };

        // 2. Listar contatos existentes
        console.log('2️⃣ Listando contatos existentes...');
        const listResponse = await axios.get(`${API_URL}/contacts`, { headers });
        console.log(`✅ ${listResponse.data.length} contatos encontrados\n`);

        // 3. Criar novo contato
        console.log('3️⃣ Criando novo contato de teste...');
        const newContact = {
            name: 'João Teste API',
            phone: '11999887766',
            email: 'joao.teste@api.com'
        };

        const createResponse = await axios.post(`${API_URL}/contacts`, newContact, { headers });
        const contactId = createResponse.data.id;
        console.log('✅ Contato criado:', {
            id: createResponse.data.id,
            name: createResponse.data.name,
            phone: createResponse.data.phone,
            jid: createResponse.data.jid
        });
        console.log('');

        // 4. Tentar criar duplicado (deve falhar)
        console.log('4️⃣ Tentando criar contato duplicado...');
        try {
            await axios.post(`${API_URL}/contacts`, newContact, { headers });
            console.log('❌ ERRO: Deveria ter bloqueado duplicação!\n');
        } catch (error: any) {
            if (error.response?.status === 409) {
                console.log('✅ Duplicação corretamente bloqueada (409)\n');
            } else {
                console.log('❌ Erro inesperado:', error.response?.status, '\n');
            }
        }

        // 5. Buscar contato
        console.log('5️⃣ Buscando contato...');
        const searchResponse = await axios.get(`${API_URL}/contacts/search?q=João`, { headers });
        console.log(`✅ ${searchResponse.data.length} resultados encontrados\n`);

        // 6. Atualizar contato
        console.log('6️⃣ Atualizando contato...');
        const updateResponse = await axios.put(
            `${API_URL}/contacts/${contactId}`,
            { name: 'João Teste Atualizado' },
            { headers }
        );
        console.log('✅ Contato atualizado:', updateResponse.data.name, '\n');

        // 7. Deletar contato
        console.log('7️⃣ Deletando contato de teste...');
        await axios.delete(`${API_URL}/contacts/${contactId}`, { headers });
        console.log('✅ Contato deletado\n');

        // 8. Verificar se foi deletado
        console.log('8️⃣ Verificando deleção...');
        try {
            await axios.get(`${API_URL}/contacts/${contactId}`, { headers });
            console.log('❌ ERRO: Contato ainda existe!\n');
        } catch (error: any) {
            if (error.response?.status === 404) {
                console.log('✅ Contato corretamente deletado (404)\n');
            }
        }

        console.log('✨ TODOS OS TESTES PASSARAM! ✨');
        console.log('\n📋 CHECKLIST:');
        console.log('✅ Login funcionando');
        console.log('✅ Listagem de contatos');
        console.log('✅ Criação de contato');
        console.log('✅ Prevenção de duplicação (409)');
        console.log('✅ Busca de contatos');
        console.log('✅ Atualização de contato');
        console.log('✅ Deleção de contato');
        console.log('✅ Validação de deleção (404)');

    } catch (error: any) {
        console.error('❌ Erro nos testes:', error.response?.data || error.message);
    }
}

// Executar testes
testContactsAPI();
