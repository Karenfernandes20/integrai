
import { pool } from '../index';

export const runOperationalProfileMigration = async () => {
    if (!pool) {
        console.error("Pool not initialized");
        return;
    }

    try {
        console.log("------------------------------------------------");
        console.log("STARTING OPERATIONAL PROFILE MIGRATION");
        console.log("------------------------------------------------");

        // 1. Create ENUM type if not exists
        try {
            await pool.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operational_profile_enum') THEN
                        CREATE TYPE operational_profile_enum AS ENUM ('GENERIC', 'LOJA', 'RESTAURANTE', 'LAVAJATO', 'CLINICA', 'TRANSPORTE');
                    END IF;
                END$$;
            `);
            console.log("Created/Verified ENUM: operational_profile_enum");
        } catch (e) {
            console.error("Error creating ENUM:", e);
        }

        // 2. Add column to companies table
        try {
            await pool.query(`
                ALTER TABLE companies 
                ADD COLUMN IF NOT EXISTS operational_profile operational_profile_enum DEFAULT 'GENERIC';
            `);
            console.log("Added operational_profile column to companies");
        } catch (e) {
            console.error("Error adding column:", e);
        }

        // 3. Migrate existing data (Best effort mapping)
        try {
            // Map 'loja' category/type to LOJA profile
            await pool.query(`
                UPDATE companies 
                SET operational_profile = 'LOJA' 
                WHERE (category = 'loja' OR operation_type = 'loja') 
                AND operational_profile = 'GENERIC';
            `);

            // Map 'lavajato'
            await pool.query(`
                UPDATE companies 
                SET operational_profile = 'LAVAJATO' 
                WHERE (category = 'lavajato' OR operation_type = 'lavajato') 
                AND operational_profile = 'GENERIC';
            `);

            // Map 'restaurante'
            await pool.query(`
                UPDATE companies 
                SET operational_profile = 'RESTAURANTE' 
                WHERE (category = 'restaurante' OR operation_type = 'restaurante') 
                AND operational_profile = 'GENERIC';
            `);

            // Map 'motoristas' / 'transporte'?? Assuming TRANSPORT for motoristas if needed, or leave generic.
            // User listed 'TRANSPORTE' in requirements.
            await pool.query(`
                UPDATE companies 
                SET operational_profile = 'TRANSPORTE' 
                WHERE category = 'transporte' OR operation_type = 'motoristas'
                AND operational_profile = 'GENERIC';
            `);

            // Map 'clinica' / 'pacientes'
            await pool.query(`
                UPDATE companies 
                SET operational_profile = 'CLINICA' 
                WHERE category = 'clinica' OR operation_type = 'pacientes'
                AND operational_profile = 'GENERIC';
            `);


            console.log("Migrated existing company profiles");
        } catch (e) {
            console.error("Error migrating data:", e);
        }

        console.log("OPERATIONAL PROFILE MIGRATION COMPLETED.");

    } catch (e) {
        console.error("Migration Fatal Error:", e);
    }
};
