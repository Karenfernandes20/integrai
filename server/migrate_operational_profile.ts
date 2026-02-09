
import 'dotenv/config';
import { pool } from './db';

const addOperationalProfileColumn = async () => {
    if (!pool) {
        console.error("No DB Pool");
        return;
    }
    try {
        console.log("Checking and adding operational_profile column to companies table...");

        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='operational_profile') THEN
                    ALTER TABLE companies ADD COLUMN operational_profile VARCHAR(50);
                END IF;
            END $$;
        `);

        // Update existing companies based on their operation_type and category
        await pool.query(`
            UPDATE companies 
            SET operational_profile = CASE 
                WHEN operation_type = 'pacientes' OR category = 'clinica' THEN 'CLINICA'
                WHEN operation_type = 'loja' OR category = 'loja' THEN 'LOJA'
                WHEN category = 'restaurante' THEN 'RESTAURANTE'
                WHEN category = 'lavajato' THEN 'LAVAJATO'
                WHEN operation_type = 'motoristas' OR category = 'transporte' THEN 'TRANSPORTE'
                ELSE 'GENERIC'
            END
            WHERE operational_profile IS NULL;
        `);

        console.log("Migration complete: operational_profile column added and populated.");
    } catch (error) {
        console.error("Error adding operational_profile column:", error);
    } finally {
        pool.end();
    }
};

addOperationalProfileColumn();
