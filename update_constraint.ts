
import { pool } from './server/db';
async function main() {
    if (!pool) return;
    try {
        console.log('Updating companies_operation_type_check constraint...');
        await pool.query('ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_operation_type_check');
        await pool.query(`
            ALTER TABLE companies 
            ADD CONSTRAINT companies_operation_type_check 
            CHECK (operation_type::text = ANY (ARRAY[
                'motoristas'::text, 
                'clientes'::text, 
                'pacientes'::text, 
                'loja'::text, 
                'clinica'::text, 
                'lavajato'::text, 
                'restaurante'::text
            ]))
        `);
        console.log('Constraint updated successfully.');
    } catch (e) {
        console.error('Failed to update constraint:', e);
    } finally {
        process.exit();
    }
}
main();
