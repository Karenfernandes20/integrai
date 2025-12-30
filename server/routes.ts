import express from 'express';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  clearUsers,
  resetUserPassword,
} from './controllers/userController';
import { getStages, getLeads, updateLeadStage, updateLead, createStage, deleteStage, getCrmDashboardStats } from './controllers/crmController';
import { handleWebhook, getConversations, getMessages } from './controllers/webhookController';
import { getCities, createCity } from './controllers/cityController';
import { login, register } from './controllers/authController';
import { authenticateToken, authorizeRole } from './middleware/authMiddleware';
import { getCompanies, createCompany, updateCompany, deleteCompany, getCompanyUsers, getCompany } from './controllers/companyController';
import { startConversation, closeConversation, updateContactNameWithAudit, deleteConversation } from './controllers/conversationController';

const router = express.Router();

// Auth routes
router.post('/auth/login', login);
router.post('/auth/register', register);

import { upload } from './middleware/uploadMiddleware';

// Company routes
router.get('/companies', authenticateToken, authorizeRole(['SUPERADMIN']), getCompanies);
router.get('/companies/:id', authenticateToken, getCompany);
router.get('/companies/:id/users', authenticateToken, authorizeRole(['SUPERADMIN']), getCompanyUsers);
router.post('/companies', authenticateToken, authorizeRole(['SUPERADMIN']), upload.single('logo'), createCompany);
router.put('/companies/:id', authenticateToken, authorizeRole(['SUPERADMIN']), upload.single('logo'), updateCompany);
router.delete('/companies/:id', authenticateToken, authorizeRole(['SUPERADMIN']), deleteCompany);

// User routes (Protected)
router.get('/users', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN']), getUsers);
router.post('/users', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN']), createUser);
router.put('/users/:id', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN']), updateUser);
router.delete('/users/:id', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN']), deleteUser);
router.post('/users/:id/reset-password', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN']), resetUserPassword);
// router.delete('/users', clearUsers); // Disable dangerous bulk delete without stronger protection or manual only


// Evolution routes
import { getEvolutionQrCode, deleteEvolutionInstance, sendEvolutionMessage, getEvolutionConnectionState, getEvolutionContacts, createEvolutionContact, updateEvolutionContact, deleteEvolutionContact, editEvolutionMessage, syncEvolutionContacts, handleEvolutionWebhook, getEvolutionContactsLive, deleteEvolutionMessage } from './controllers/evolutionController';
router.get('/evolution/qrcode', authenticateToken, getEvolutionQrCode);
router.get('/evolution/status', authenticateToken, getEvolutionConnectionState);
router.get('/evolution/contacts', authenticateToken, getEvolutionContacts);
router.post('/evolution/contacts', authenticateToken, createEvolutionContact);
router.get('/evolution/contacts/live', authenticateToken, getEvolutionContactsLive);
router.post('/evolution/contacts/sync', authenticateToken, syncEvolutionContacts);
router.put('/evolution/contacts/:id', authenticateToken, updateEvolutionContact);
router.delete('/evolution/contacts/:id', authenticateToken, deleteEvolutionContact);
router.delete('/evolution/disconnect', authenticateToken, deleteEvolutionInstance);
router.post('/evolution/messages/send', authenticateToken, sendEvolutionMessage);
router.put('/evolution/messages/:conversationId/:messageId', authenticateToken, editEvolutionMessage);
router.delete('/evolution/messages/:conversationId/:messageId', authenticateToken, deleteEvolutionMessage);
router.post('/evolution/webhook', handleWebhook); // Using unified and robust handler
router.get('/evolution/conversations', authenticateToken, getConversations);
router.get('/evolution/messages/:conversationId', authenticateToken, getMessages);

// CRM Routes
// CRM Routes
router.get('/crm/dashboard', authenticateToken, getCrmDashboardStats);
router.post('/crm/conversations/:id/start', authenticateToken, startConversation);
router.post('/crm/conversations/:id/close', authenticateToken, closeConversation);
router.put('/crm/conversations/:id/name', authenticateToken, updateContactNameWithAudit);
router.delete('/crm/conversations/:id', authenticateToken, deleteConversation);

// Cities routes
router.get('/cities', getCities);
router.post('/cities', createCity);

// CRM routes
router.get('/crm/stages', getStages);
router.post('/crm/stages', createStage);
router.delete('/crm/stages/:id', deleteStage);
router.get('/crm/leads', getLeads);
router.put('/crm/leads/:id', updateLead);
router.put('/crm/leads/:id/move', updateLeadStage);

// Reports routes
import { getDRE, getBreakdown, getFinancialIndicators } from './controllers/reportsController';
router.get('/reports/dre', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN']), getDRE);
router.get('/reports/breakdown', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN']), getBreakdown);
router.get('/reports/indicators', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN']), getFinancialIndicators);

import { getPayables, getReceivablesByCity, getCashFlow, createFinancialTransaction, updateFinancialTransaction, deleteFinancialTransaction, markAsPaid } from './controllers/financialController';
// Financial routes
router.get('/financial/payables', getPayables);
router.get('/financial/receivables-by-city', getReceivablesByCity);
router.get('/financial/cashflow', getCashFlow);
router.post('/financial/transactions', createFinancialTransaction);
router.put('/financial/transactions/:id', updateFinancialTransaction);
router.delete('/financial/transactions/:id', deleteFinancialTransaction);
router.post('/financial/transactions/:id/pay', markAsPaid);

// Placeholder for other routes
router.get('/rides', (req, res) => res.json({ message: 'Rides endpoint' }));
router.get('/whatsapp', (req, res) => res.json({ message: 'WhatsApp endpoint' }));

export default router;
