import express from 'express';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  clearUsers,
  resetUserPassword,
  updateProfile,
} from './controllers/userController';
import { getStages, getLeads, updateLeadStage, updateLead, createStage, deleteStage, getCrmDashboardStats } from './controllers/crmController';
import { handleWebhook, getConversations, getMessages, debugWebhookPayloads } from './controllers/webhookController';
import { getCities, createCity } from './controllers/cityController';
import { login, register } from './controllers/authController';
import { authenticateToken, authorizeRole } from './middleware/authMiddleware';
import { getCompanies, createCompany, updateCompany, deleteCompany, getCompanyUsers, getCompany } from './controllers/companyController';
import { startConversation, closeConversation, updateContactNameWithAudit, deleteConversation } from './controllers/conversationController';
import { getFollowUps, createFollowUp, updateFollowUp, deleteFollowUp, getFollowUpStats } from './controllers/followUpController';

const router = express.Router();

// Auth routes
router.post('/auth/login', login);
router.post('/auth/register', register);
router.put('/auth/profile', authenticateToken, updateProfile);

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
import { getEvolutionQrCode, setEvolutionWebhook, deleteEvolutionInstance, sendEvolutionMessage, getEvolutionConnectionState, getEvolutionContacts, createEvolutionContact, updateEvolutionContact, deleteEvolutionContact, editEvolutionMessage, syncEvolutionContacts, handleEvolutionWebhook, getEvolutionContactsLive, deleteEvolutionMessage, getEvolutionConfig, getEvolutionMedia, getEvolutionProfilePic, syncAllProfilePics, sendEvolutionMedia, refreshConversationMetadata, deleteMessage } from './controllers/evolutionController';
router.get('/evolution/qrcode', authenticateToken, getEvolutionQrCode);
router.post('/evolution/webhook/set', authenticateToken, setEvolutionWebhook);
router.get('/evolution/status', authenticateToken, getEvolutionConnectionState);
router.get('/evolution/contacts', authenticateToken, getEvolutionContacts);
router.post('/evolution/contacts', authenticateToken, createEvolutionContact);
router.get('/evolution/contacts/live', authenticateToken, getEvolutionContactsLive);
router.post('/evolution/contacts/sync', authenticateToken, syncEvolutionContacts);
router.put('/evolution/contacts/:id', authenticateToken, updateEvolutionContact);
router.delete('/evolution/contacts/:id', authenticateToken, deleteEvolutionContact);
router.delete('/evolution/disconnect', authenticateToken, deleteEvolutionInstance);
router.post('/evolution/messages/send', authenticateToken, sendEvolutionMessage);
router.post('/evolution/messages/media', authenticateToken, sendEvolutionMedia);
router.put('/evolution/messages/:conversationId/:messageId', authenticateToken, editEvolutionMessage);
router.delete('/evolution/messages/:conversationId/:messageId', authenticateToken, deleteEvolutionMessage);
router.post('/evolution/messages/delete-global', authenticateToken, deleteMessage);
// router.get('/evolution/webhook/debug', authenticateToken, authorizeRole(['SUPERADMIN']), debugWebhookPayloads);
router.get('/evolution/webhook/debug', debugWebhookPayloads); // Temp public for diagnostic
// router.post('/evolution/webhook/*', handleWebhook); // REMOVED: Wildcard not supported in Express 5 string paths
router.post('/evolution/webhook/:type', handleWebhook); // Catch /webhook/messages-upsert etc.
router.post('/evolution/webhook', handleWebhook); // Catch base /webhook
router.get('/evolution/conversations', authenticateToken, getConversations);
router.post('/evolution/conversations/:conversationId/refresh', authenticateToken, refreshConversationMetadata);
router.get('/evolution/messages/:conversationId', authenticateToken, getMessages);
router.get('/evolution/media/:messageId', authenticateToken, getEvolutionMedia);
router.get('/evolution/profile-pic/:phone', authenticateToken, getEvolutionProfilePic);
router.post('/evolution/profile-pic/sync', authenticateToken, syncAllProfilePics);

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
router.get('/crm/stages', authenticateToken, getStages);
router.post('/crm/stages', authenticateToken, createStage);
router.delete('/crm/stages/:id', authenticateToken, deleteStage);
router.get('/crm/leads', authenticateToken, getLeads);
router.put('/crm/leads/:id', authenticateToken, updateLead);
router.put('/crm/leads/:id/move', authenticateToken, updateLeadStage);

// Follow-up Routes
router.get('/crm/follow-ups', authenticateToken, getFollowUps);
router.get('/crm/follow-ups/stats', authenticateToken, getFollowUpStats);
router.post('/crm/follow-ups', authenticateToken, createFollowUp);
router.put('/crm/follow-ups/:id', authenticateToken, updateFollowUp);
router.delete('/crm/follow-ups/:id', authenticateToken, deleteFollowUp);

// Reports routes
import { getDRE, getBreakdown, getFinancialIndicators } from './controllers/reportsController';
router.get('/reports/dre', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN']), getDRE);
router.get('/reports/breakdown', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN']), getBreakdown);
router.get('/reports/indicators', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN']), getFinancialIndicators);

import { getPayables, getReceivables, getReceivablesByCity, getCashFlow, getFinancialStats, createFinancialTransaction, updateFinancialTransaction, deleteFinancialTransaction, reactivateFinancialTransaction, markAsPaid } from './controllers/financialController';
// Financial routes
router.get('/financial/payables', authenticateToken, getPayables);
router.get('/financial/receivables', authenticateToken, getReceivables);
router.get('/financial/receivables-by-city', authenticateToken, getReceivablesByCity);
router.get('/financial/cashflow', authenticateToken, getCashFlow);
router.get('/financial/stats', authenticateToken, getFinancialStats);
router.post('/financial/transactions', authenticateToken, createFinancialTransaction);
router.put('/financial/transactions/:id', authenticateToken, updateFinancialTransaction);
router.delete('/financial/transactions/:id', authenticateToken, deleteFinancialTransaction);
router.put('/financial/transactions/:id/reactivate', authenticateToken, reactivateFinancialTransaction);
router.post('/financial/transactions/:id/pay', authenticateToken, markAsPaid);

// Campaign routes
import {
  createCampaign,
  getCampaigns,
  getCampaignById,
  startCampaign,
  pauseCampaign,
  deleteCampaign,
  updateCampaign,
  getCampaignFailures
} from './controllers/campaignController';

router.post('/campaigns', authenticateToken, createCampaign);
router.get('/campaigns', authenticateToken, getCampaigns);
router.get('/campaigns/:id', authenticateToken, getCampaignById);
router.get('/campaigns/:id/failures', authenticateToken, getCampaignFailures);
router.put('/campaigns/:id', authenticateToken, updateCampaign);
router.post('/campaigns/:id/start', authenticateToken, startCampaign);
router.post('/campaigns/:id/pause', authenticateToken, pauseCampaign);
router.delete('/campaigns/:id', authenticateToken, deleteCampaign);
router.post('/campaigns/upload', authenticateToken, upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({
    url: fileUrl,
    filename: req.file.filename,
    mimetype: req.file.mimetype
  });
});

router.get('/evolution-debug', authenticateToken, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user.role !== 'SUPERADMIN') return res.status(403).json({ error: 'Unauthorized' });

  const config = await getEvolutionConfig(user, 'debug_route');
  res.json({
    instance: config.instance,
    url: config.url,
    hasApiKey: !!config.apikey,
    apiKeyLast4: config.apikey?.slice(-4)
  });
});

// DEBUG ROUTE FOR MESSAGES
router.get('/debug-messages/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const conv = await pool!.query('SELECT * FROM whatsapp_conversations WHERE id = $1', [id]);
    const msgs = await pool!.query('SELECT count(*) as count FROM whatsapp_messages WHERE conversation_id = $1', [id]);
    const lastMsgs = await pool!.query('SELECT id, content, sent_at FROM whatsapp_messages WHERE conversation_id = $1 ORDER BY sent_at DESC LIMIT 5', [id]);

    res.json({
      conversation: conv.rows[0],
      message_count: msgs.rows[0].count,
      last_5_messages: lastMsgs.rows,
      user_company: (req as any).user.company_id
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Temporary route to update Evolution API Key
import { pool } from './db';
import { Request, Response } from 'express';
router.get('/update-evolution', async (req: Request, res: Response) => {
  try {
    const { apikey, instance } = req.query;
    if (!apikey) {
      return res.status(400).json({ error: 'API Key required' });
    }

    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const instanceName = (instance as string) || 'integrai';

    // Try to update company with specific instance
    let result = await pool.query(
      `UPDATE companies SET evolution_apikey = $1, evolution_instance = $2 WHERE evolution_instance = $2 RETURNING *`,
      [apikey, instanceName]
    );

    // If no company found, update the first company (SuperAdmin setup)
    if (result.rows.length === 0) {
      result = await pool.query(
        `UPDATE companies SET evolution_apikey = $1, evolution_instance = $2 WHERE id = (SELECT MIN(id) FROM companies) RETURNING *`,
        [apikey, instanceName]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No company found in database' });
    }

    res.json({
      success: true,
      message: 'Evolution API Key updated!',
      company: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        evolution_instance: result.rows[0].evolution_instance,
        evolution_apikey: '***' + (result.rows[0].evolution_apikey || '').slice(-4)
      }
    });
  } catch (error) {
    console.error('Error updating Evolution API Key:', error);
    res.status(500).json({ error: 'Failed to update API Key' });
  }
});

// Placeholder for other routes
router.get('/rides', (req, res) => res.json({ message: 'Rides endpoint' }));
router.get('/whatsapp', (req, res) => res.json({ message: 'WhatsApp endpoint' }));

export default router;
