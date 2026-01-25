
import { pool } from './index';

export const runRestaurantMigrations = async () => {
    if (!pool) return;
    try {
        console.log("*************************************************");
        console.log("STARTING RESTAURANT MIGRATIONS");
        console.log("*************************************************");

        // 1. Restaurant Tables
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS restaurant_tables (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                    instance_id INTEGER REFERENCES company_instances(id) ON DELETE SET NULL,
                    table_number VARCHAR(50) NOT NULL,
                    capacity INTEGER DEFAULT 4,
                    status VARCHAR(50) DEFAULT 'livre', -- livre, ocupada, conta, reservada
                    qr_code_id VARCHAR(100) UNIQUE, -- For customer ordering
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_rest_tables_company_instance ON restaurant_tables(company_id, instance_id);
            `);
            console.log("Verified table: restaurant_tables");
        } catch (e) { console.error("Error creating restaurant_tables:", e); }

        // 2. Menu Categories
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS restaurant_menu_categories (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                    name VARCHAR(100) NOT NULL,
                    position INTEGER DEFAULT 0,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);
            console.log("Verified table: restaurant_menu_categories");
        } catch (e) { console.error("Error creating restaurant_menu_categories:", e); }

        // 3. Menu Items
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS restaurant_menu_items (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                    category_id INTEGER REFERENCES restaurant_menu_categories(id) ON DELETE CASCADE,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                    photo_url TEXT,
                    ingredients TEXT,
                    estimated_prep_time INTEGER DEFAULT 15, -- em minutos
                    is_available BOOLEAN DEFAULT TRUE,
                    stock_count INTEGER DEFAULT NULL, -- NULL = infinite
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            `);
            console.log("Verified table: restaurant_menu_items");
        } catch (e) { console.error("Error creating restaurant_menu_items:", e); }

        // 4. Restaurant Orders
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS restaurant_orders (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                    instance_id INTEGER REFERENCES company_instances(id) ON DELETE SET NULL,
                    client_id INTEGER REFERENCES crm_leads(id) ON DELETE SET NULL,
                    table_id INTEGER REFERENCES restaurant_tables(id) ON DELETE SET NULL,
                    user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL, -- Waiter/Staff
                    channel VARCHAR(50) DEFAULT 'salao', -- salao, whatsapp, delivery, qrcode
                    status VARCHAR(50) DEFAULT 'novo', -- novo, confirmado, preparo, pronto, entrega, finalizado, cancelado
                    payment_status VARCHAR(20) DEFAULT 'pending', -- pending, paid, partial
                    payment_method VARCHAR(50),
                    total_value DECIMAL(12, 2) DEFAULT 0.00,
                    delivery_fee DECIMAL(10, 2) DEFAULT 0.00,
                    shift VARCHAR(50), -- almoco, jantar, madrugada
                    notes TEXT,
                    started_at TIMESTAMP DEFAULT NOW(),
                    prepared_at TIMESTAMP,
                    finished_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_rest_orders_company_instance ON restaurant_orders(company_id, instance_id);
                CREATE INDEX IF NOT EXISTS idx_rest_orders_status ON restaurant_orders(status);
            `);
            console.log("Verified table: restaurant_orders");
        } catch (e) { console.error("Error creating restaurant_orders:", e); }

        // 5. Order Items
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS restaurant_order_items (
                    id SERIAL PRIMARY KEY,
                    order_id INTEGER REFERENCES restaurant_orders(id) ON DELETE CASCADE,
                    menu_item_id INTEGER REFERENCES restaurant_menu_items(id) ON DELETE SET NULL,
                    quantity INTEGER NOT NULL DEFAULT 1,
                    unit_price DECIMAL(10, 2) NOT NULL,
                    notes TEXT,
                    status VARCHAR(50) DEFAULT 'pendente', -- pendente, preparo, pronto, entregue, cancelado
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);
            console.log("Verified table: restaurant_order_items");
        } catch (e) { console.error("Error creating restaurant_order_items:", e); }

        // 6. Deliveries
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS restaurant_deliveries (
                    id SERIAL PRIMARY KEY,
                    order_id INTEGER REFERENCES restaurant_orders(id) ON DELETE CASCADE,
                    delivery_staff_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                    status VARCHAR(50) DEFAULT 'aguardando', -- aguardando, a_caminho, entregue, falhou
                    estimated_arrival TIMESTAMP,
                    actual_arrival TIMESTAMP,
                    tracking_url TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);
            console.log("Verified table: restaurant_deliveries");
        } catch (e) { console.error("Error creating restaurant_deliveries:", e); }

        console.log("RESTAURANT MIGRATIONS FINISHED.");
    } catch (e) {
        console.error("Restaurant Migration Error:", e);
    }
};
