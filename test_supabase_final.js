import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
    connectionString: 'postgresql://postgres:Klpf1212!!!@@db.hdwubhvmzfggsrtgkdlv.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
});

client.connect()
    .then(() => {
        console.log('✅ CONECTOU ao Supabase!');
        return client.query('SELECT COUNT(*) FROM companies');
    })
    .then(res => {
        console.log('Empresas encontradas:', res.rows[0].count);
        return client.query("SELECT email, role FROM app_users WHERE email = 'dev.karenfernandes@gmail.com'");
    })
    .then(res => {
        if (res.rows.length > 0) {
            console.log('✅ Usuário Superadmin encontrado!');
            console.log('   Email:', res.rows[0].email);
            console.log('   Role:', res.rows[0].role);
        } else {
            console.log('⚠️ Usuário Superadmin NÃO encontrado');
        }
        client.end();
    })
    .catch(e => {
        console.error('❌ Erro:', e.message);
        client.end();
    });
