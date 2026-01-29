
import { pool } from './index';

export const runShopMigrations = async () => {
    if (!pool) return;
    try {
        console.log("*************************************************");
        console.log("STARTING SHOP (LOJA) MIGRATIONS");
        console.log("*************************************************");

        // 1. Update Companies Table - Operation Type
        try {
            await pool.query(`
                DO $$ 
                BEGIN 
                    -- Drop old constraint if exists (name might vary, so we try generic approach or catching error)
                    -- Getting constraint name
                    DECLARE 
                        cons_name TEXT;
                    BEGIN 
                        SELECT conname INTO cons_name 
                        FROM pg_constraint 
                        WHERE conrelid = 'companies'::regclass AND contype = 'c' AND conname LIKE '%operation_type%';
                        
                        IF cons_name IS NOT NULL THEN
                            EXECUTE 'ALTER TABLE companies DROP CONSTRAINT ' || cons_name;
                        END IF;
                    EXCEPTION WHEN OTHERS THEN 
                        NULL;
                    END;
                END $$;
            `);

            // Add new constraint including 'loja'
            await pool.query(`
                ALTER TABLE companies 
                ADD CONSTRAINT companies_operation_type_check 
                CHECK (operation_type IN ('motoristas', 'clientes', 'pacientes', 'loja'));
            `);
            console.log("Updated operation_type constraint in companies");
        } catch (e) { console.error("Error updating operation_type constraint:", e); }

        // 2. Suppliers
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS suppliers (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                    instance_id INTEGER REFERENCES company_instances(id) ON DELETE SET NULL,
                    name VARCHAR(255) NOT NULL,
                    contact_name VARCHAR(255),
                    phone VARCHAR(50),
                    email VARCHAR(255),
                    cnpj VARCHAR(50),
                    address TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_suppliers_company_instance ON suppliers(company_id, instance_id);
            `);
            console.log("Verified table: suppliers");
        } catch (e) { console.error("Error creating suppliers:", e); }

        // 3. Inventory
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS inventory (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                    instance_id INTEGER REFERENCES company_instances(id) ON DELETE SET NULL,
                    name VARCHAR(255) NOT NULL,
                    sku VARCHAR(100),
                    barcode VARCHAR(100),
                    category VARCHAR(100),
                    description TEXT,
                    cost_price DECIMAL(12, 2) DEFAULT 0.00,
                    sale_price DECIMAL(12, 2) DEFAULT 0.00,
                    quantity DECIMAL(12, 3) DEFAULT 0.000,
                    min_quantity DECIMAL(12, 3) DEFAULT 0.000,
                    unit VARCHAR(20) DEFAULT 'un',
                    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
                    image_url TEXT,
                    status VARCHAR(20) DEFAULT 'active', -- active, inactive
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_inventory_company_instance ON inventory(company_id, instance_id);
                CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
            `);
            console.log("Verified table: inventory");
        } catch (e) { console.error("Error creating inventory:", e); }

        // 4. Inventory Movements
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS inventory_movements (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                    instance_id INTEGER REFERENCES company_instances(id) ON DELETE SET NULL,
                    inventory_id INTEGER REFERENCES inventory(id) ON DELETE CASCADE,
                    type VARCHAR(20) NOT NULL CHECK (type IN ('in', 'out', 'adjustment')),
                    quantity DECIMAL(12, 3) NOT NULL,
                    reason VARCHAR(255),
                    user_id INTEGER REFERENCES app_users(id),
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_inventory_movements_inventory ON inventory_movements(inventory_id);
                CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON inventory_movements(created_at);
            `);
            console.log("Verified table: inventory_movements");
        } catch (e) { console.error("Error creating inventory_movements:", e); }

        // 5. Sales
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS sales (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                    instance_id INTEGER REFERENCES company_instances(id) ON DELETE SET NULL,
                    client_id INTEGER REFERENCES crm_leads(id) ON DELETE SET NULL, -- Linking to CRM leads directly as 'Clientes'
                    user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL, -- Seller
                    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                    discount DECIMAL(12, 2) DEFAULT 0.00,
                    final_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                    payment_method VARCHAR(50),
                    status VARCHAR(20) DEFAULT 'completed', -- pending, completed, cancelled
                    channel VARCHAR(50) DEFAULT 'loja_fisica', -- loja_fisica, whatsapp, instagram, site
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_sales_company_instance ON sales(company_id, instance_id);
                CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);
                CREATE INDEX IF NOT EXISTS idx_sales_client ON sales(client_id);
            `);
            console.log("Verified table: sales");
        } catch (e) { console.error("Error creating sales:", e); }

        // 6. Sale Items
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS sale_items (
                    id SERIAL PRIMARY KEY,
                    sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
                    inventory_id INTEGER REFERENCES inventory(id) ON DELETE SET NULL,
                    quantity DECIMAL(12, 3) NOT NULL,
                    unit_price DECIMAL(12, 2) NOT NULL,
                    total_price DECIMAL(12, 2) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
            `);
            console.log("Verified table: sale_items");
        } catch (e) { console.error("Error creating sale_items:", e); }

        // 7. Receivables (Contas a Receber linked to Sales)
        // Note: Often integrated with financial_transactions, but creating separate as requested for strict adherence
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS receivables (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                    instance_id INTEGER REFERENCES company_instances(id) ON DELETE SET NULL,
                    sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
                    client_id INTEGER REFERENCES crm_leads(id),
                    description VARCHAR(255),
                    amount DECIMAL(12, 2) NOT NULL,
                    due_date DATE,
                    paid_at TIMESTAMP,
                    status VARCHAR(20) DEFAULT 'pending', -- pending, paid, overdue, cancelled
                    payment_method VARCHAR(50),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_receivables_company_instance_status ON receivables(company_id, instance_id, status);
                CREATE INDEX IF NOT EXISTS idx_receivables_due_date ON receivables(due_date);
            `);
            console.log("Verified table: receivables");
        } catch (e) { console.error("Error creating receivables:", e); }

        // 8. Payments (Contas a Pagar linked to Suppliers/Inventory)
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS payments (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                    instance_id INTEGER REFERENCES company_instances(id) ON DELETE SET NULL,
                    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
                    description VARCHAR(255),
                    amount DECIMAL(12, 2) NOT NULL,
                    due_date DATE,
                    paid_at TIMESTAMP,
                    status VARCHAR(20) DEFAULT 'pending', -- pending, paid, overdue, cancelled
                    category VARCHAR(100),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_payments_company_instance_status ON payments(company_id, instance_id, status);
                CREATE INDEX IF NOT EXISTS idx_payments_due_date ON payments(due_date);
            `);
            console.log("Verified table: payments");
        } catch (e) { console.error("Error creating payments:", e); }

        // 9. Goals
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS goals (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                    instance_id INTEGER REFERENCES company_instances(id) ON DELETE SET NULL,
                    type VARCHAR(20) NOT NULL CHECK (type IN ('daily', 'weekly', 'monthly')),
                    target_value DECIMAL(12, 2) NOT NULL,
                    current_value DECIMAL(12, 2) DEFAULT 0.00,
                    start_date DATE,
                    end_date DATE,
                    user_id INTEGER REFERENCES app_users(id), -- Optional: goal per user
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_goals_company_instance ON goals(company_id, instance_id);
            `);
            console.log("Verified table: goals");
        } catch (e) { console.error("Error creating goals:", e); }

        console.log("SHOP MIGRATIONS FINISHED.");
    } catch (e) {
        console.error("Shop Migration Error:", e);
    }
};
