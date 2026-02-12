
import { createSale } from './server/controllers/shopController';
import { Request, Response } from 'express';

// Mock Request/Response
const req: any = {
    user: { company_id: 32, id: 40 },
    instanceId: 38,
    body: {
        instance_id: 38,
        client_id: null, // Balcao
        items: [
            {
                inventory_id: 3, // Camisa
                quantity: 1,
                unit_price: 20.00
            }
        ],
        payment_method: 'pix',
        discount: 0,
        status: 'completed'
    }
};

const res: any = {
    status: (code: number) => {
        console.log(`Response Status: ${code}`);
        return res;
    },
    json: (data: any) => {
        console.log(`Response Body:`, JSON.stringify(data, null, 2));
        return res;
    }
};

async function runTest() {
    console.log("Running createSale test...");
    try {
        await createSale(req, res);
    } catch (e: any) {
        console.error("Test caught error:", e);
    }
}

runTest();
