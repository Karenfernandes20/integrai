import express from 'express';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  clearUsers,
} from './controllers/userController';
import { getEvolutionQrCode, deleteEvolutionInstance } from './controllers/evolutionController';
import { handleWebhook, getConversations, getMessages } from './controllers/webhookController';

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

// Placeholder for other routes
router.get('/cities', (req, res) => res.json({ message: 'Cities endpoint' }));
router.get('/rides', (req, res) => res.json({ message: 'Rides endpoint' }));
router.get('/crm', (req, res) => res.json({ message: 'CRM endpoint' }));
router.get('/financial', (req, res) => res.json({ message: 'Financial endpoint' }));
router.get('/whatsapp', (req, res) => res.json({ message: 'WhatsApp endpoint' }));

export default router;

