import express from 'express';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  clearUsers,
} from './controllers/userController';
import { getStages, getLeads, updateLeadStage } from './controllers/crmController';
import { getEvolutionQrCode, deleteEvolutionInstance } from './controllers/evolutionController';
import { handleWebhook, getConversations, getMessages } from './controllers/webhookController';
import { getCities, createCity } from './controllers/cityController';
import { getPayables, getReceivablesByCity, getCashFlow, createExpense } from './controllers/financialController';

const router = express.Router();

// User routes
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.delete('/users', clearUsers);

// Evolution routes
router.get('/evolution/qrcode', getEvolutionQrCode);
router.delete('/evolution/disconnect', deleteEvolutionInstance);
router.post('/evolution/webhook', handleWebhook);
router.get('/evolution/conversations', getConversations);
router.get('/evolution/messages/:conversationId', getMessages);

// Cities routes
router.get('/cities', getCities);
router.post('/cities', createCity);

// CRM routes
router.get('/crm/stages', getStages);
router.get('/crm/leads', getLeads);
router.put('/crm/leads/:id/move', updateLeadStage);

// Financial routes
router.get('/financial/payables', getPayables);
router.get('/financial/receivables-by-city', getReceivablesByCity);
router.get('/financial/cashflow', getCashFlow);
router.post('/financial/expenses', createExpense);

// Placeholder for other routes
router.get('/rides', (req, res) => res.json({ message: 'Rides endpoint' }));
router.get('/whatsapp', (req, res) => res.json({ message: 'WhatsApp endpoint' }));

export default router;

