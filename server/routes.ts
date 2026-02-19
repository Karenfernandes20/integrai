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
import { getStages, getLeads, updateLeadStage, updateLead, createStage, deleteStage, getCrmDashboardStats, createLead } from './controllers/crmController';
import { getProfessionals, createProfessional, updateProfessional, deleteProfessional } from './controllers/professionalsController';
import {
  getInsurancePlans, createInsurancePlan, updateInsurancePlan, deleteInsurancePlan,
  getProfessionalInsuranceConfigs, upsertProfessionalInsuranceConfig
} from './controllers/insuranceController';
import { getClinicalBIStats } from './controllers/clinicalBIController';
import {
  handleWebhook,
  getConversations,
  getMessages,
  debugWebhookPayloads,
  verifyInstagramWebhook,
  handleInstagramWebhook,
  verifyWhatsappOfficialWebhook,
  handleWhatsappOfficialWebhook
} from './controllers/webhookController';
import { getCities, createCity } from './controllers/cityController';
import { login, register } from './controllers/authController';
import { authenticateToken, authorizeRole, authorizePermission } from './middleware/authMiddleware';
import { rateLimit } from './middleware/rateLimitMiddleware';
import { PERMISSIONS } from './config/roles';
import { getCompanies, createCompany, updateCompany, deleteCompany, getCompanyUsers, getCompany, getCompanyInstances, updateCompanyInstance } from './controllers/companyController';
import { startConversation, closeConversation, updateContactNameWithAudit, deleteConversation, returnToPending, transferConversationQueue, ensureConversation } from './controllers/conversationController';
import { listQueues, createQueue, updateQueue, deleteQueue } from './controllers/queueController';
import { getQuickAnswers, createQuickAnswer, updateQuickAnswer, deleteQuickAnswer } from './controllers/whaticket/quickAnswerController';
import { getUserQueues, setUserQueues } from './controllers/whaticket/userQueueController';
import { getInternalMessages, sendInternalMessage, getUnreadInternalCount, markInternalAsRead } from './controllers/whaticket/internalChatController';
import { getFollowUps, createFollowUp, updateFollowUp, deleteFollowUp, getFollowUpStats } from './controllers/followUpController';



const router = express.Router();
router.get('/webhooks/instagram', verifyInstagramWebhook);
router.post('/webhooks/instagram', handleInstagramWebhook);

router.get('/webhooks/whatsapp/official/:companyId', verifyWhatsappOfficialWebhook);
router.post('/webhooks/whatsapp/official/:companyId', handleWhatsappOfficialWebhook);




// Auth routes
router.post('/auth/login', login);
router.post('/auth/register', register);
router.get('/auth/me', authenticateToken, (req, res) => {
  res.json((req as any).user);
});

import { upload } from './middleware/uploadMiddleware';

router.put('/auth/profile', authenticateToken, upload.single('logo'), updateProfile);

// Company routes
router.get('/companies', authenticateToken, authorizeRole(['SUPERADMIN']), getCompanies);
router.get('/companies/:id', authenticateToken, getCompany);
router.get('/companies/:id/users', authenticateToken, authorizeRole(['SUPERADMIN']), getCompanyUsers);
router.get('/companies/:id/instances', authenticateToken, getCompanyInstances); // New
router.put('/companies/:id/instances/:instanceId', authenticateToken, updateCompanyInstance); // New
router.post('/companies', authenticateToken, authorizeRole(['SUPERADMIN']), upload.single('logo'), createCompany);
router.put('/companies/:id', authenticateToken, upload.single('logo'), updateCompany);
router.delete('/companies/:id', authenticateToken, authorizeRole(['SUPERADMIN']), deleteCompany);

// User routes (Protected)
router.get('/users', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN']), getUsers);
router.post('/users', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN']), createUser);
router.put('/users/:id', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN']), updateUser);
router.delete('/users/:id', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN']), deleteUser);
router.post('/users/:id/reset-password', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN']), resetUserPassword);
// router.delete('/users', clearUsers); // Disable dangerous bulk delete without stronger protection or manual only


// Evolution routes
import { getEvolutionQrCode, setEvolutionWebhook, getEvolutionWebhook, deleteEvolutionInstance, sendEvolutionMessage, getEvolutionConnectionState, getEvolutionContacts, createEvolutionContact, updateEvolutionContact, deleteEvolutionContact, editEvolutionMessage, syncEvolutionContacts, syncEvolutionGroups, handleEvolutionWebhook, getEvolutionContactsLive, deleteEvolutionMessage, getEvolutionConfig, getEvolutionMedia, getEvolutionProfilePic, syncAllProfilePics, sendEvolutionMedia, refreshConversationMetadata, deleteMessage, searchEverything, sendEvolutionReaction, getSystemWhatsappStatus, updateConversationStatus } from './controllers/evolutionController';

// Contacts routes
import { getContacts, getContact, createContact, updateContact, deleteContact, searchContacts } from './controllers/contactController';

router.get('/evolution/search', authenticateToken, searchEverything);
router.get('/evolution/status', authenticateToken, getEvolutionConnectionState);
router.get('/system/whatsapp/status', authenticateToken, getSystemWhatsappStatus); // New Global Status
router.get('/evolution/media/:messageId', authenticateToken, getEvolutionMedia);
router.get('/evolution/contacts', authenticateToken, getEvolutionContacts);
router.post('/evolution/contacts', authenticateToken, createEvolutionContact);
router.get('/evolution/contacts/live', authenticateToken, getEvolutionContactsLive);
router.post('/evolution/contacts/sync', authenticateToken, syncEvolutionContacts);
router.put('/evolution/contacts/:id', authenticateToken, updateEvolutionContact);
router.delete('/evolution/contacts/:id', authenticateToken, deleteEvolutionContact);
router.delete('/evolution/disconnect', authenticateToken, deleteEvolutionInstance);
router.put('/evolution/instance/:companyId/:instanceKey/api-key', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { companyId, instanceKey } = req.params;
    const { apiKey } = req.body;

    if (!apiKey || apiKey.trim().length < 10) {
      return res.status(400).json({ error: 'API Key must be at least 10 characters' });
    }

    // Update the instance with new API key
    const result = await pool!.query(
      'UPDATE company_instances SET api_key = $1 WHERE instance_key = $2 AND company_id = $3 RETURNING id, name, instance_key',
      [apiKey.trim(), instanceKey, Number(companyId)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Instance "${instanceKey}" not found for company ${companyId}` });
    }

    console.log(`[API KEY UPDATE] Instance ${instanceKey} API key updated successfully`);
    res.json({
      success: true,
      message: `API Key updated for instance "${result.rows[0].name}"`,
      instance: result.rows[0]
    });
  } catch (e: any) {
    console.error('[API KEY UPDATE ERROR]', e);
    res.status(500).json({ error: `Failed to update API key: ${e.message}` });
  }
});
router.post('/evolution/messages/send', authenticateToken, rateLimit({ windowMs: 60000, max: 20 }), sendEvolutionMessage);
router.post('/evolution/messages/media', authenticateToken, sendEvolutionMedia);
router.post('/evolution/messages/react', authenticateToken, sendEvolutionReaction);
router.put('/evolution/messages/:conversationId/:messageId', authenticateToken, editEvolutionMessage);
router.delete('/evolution/messages/:id', authenticateToken, deleteMessage);
router.post('/evolution/messages/delete', authenticateToken, deleteEvolutionMessage);
// router.get('/evolution/webhook/debug', authenticateToken, authorizeRole(['SUPERADMIN']), debugWebhookPayloads);
router.get('/evolution/webhook/debug', debugWebhookPayloads); // Temp public for diagnostic
router.get('/evolution/debug/mapping', async (req, res) => {
  try {
    const result = await pool!.query('SELECT id, name, evolution_instance FROM companies');
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
// Whapi Routes
import { getWhapiQrCodeController, handleWhapiWebhook, connectWhapiInstance } from './controllers/whapiController';
router.post('/whapi/qrcode', authenticateToken, getWhapiQrCodeController);
router.post('/whapi/connect', authenticateToken, connectWhapiInstance);
router.post('/whapi/webhook/:instanceKey', handleWhapiWebhook);

// Instagram routes
import { testInstagramConnection } from './services/instagramService';
import { testWhatsappMetaConnection } from './services/whatsappMetaService';
router.post('/instagram/test-connection', authenticateToken, testInstagramConnection);
router.post('/whatsapp/meta/test-connection', authenticateToken, testWhatsappMetaConnection);

router.get('/evolution/debug/instance/:companyId/:instanceKey', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { companyId, instanceKey } = req.params;

    // Check instance in company_instances table
    const instRes = await pool!.query(
      'SELECT id, name, instance_key, api_key, status, created_at FROM company_instances WHERE instance_key = $1 AND company_id = $2',
      [instanceKey, Number(companyId)]
    );

    if (instRes.rows.length === 0) {
      return res.status(404).json({ error: `Instance "${instanceKey}" not found for company ${companyId}` });
    }

    const instance = instRes.rows[0];

    // Check company evolution_url
    const compRes = await pool!.query('SELECT evolution_url, evolution_instance FROM companies WHERE id = $1', [Number(companyId)]);
    const company = compRes.rows[0];

    res.json({
      instance_found: true,
      instance: {
        id: instance.id,
        name: instance.name,
        instance_key: instance.instance_key,
        api_key_exists: !!instance.api_key,
        api_key_length: instance.api_key?.length || 0,
        api_key_last_4: instance.api_key ? `...${instance.api_key.slice(-4)}` : 'N/A',
        status: instance.status,
        created_at: instance.created_at
      },
      company: {
        evolution_url: company?.evolution_url || 'Default (from env)',
        evolution_instance: company?.evolution_instance || 'N/A',
      },
      diagnostic: {
        has_api_key: instance.api_key && instance.api_key.length > 10,
        api_key_valid: instance.api_key && instance.api_key.length >= 10,
        problem: !instance.api_key || instance.api_key.length < 10 ? 'API Key is missing or invalid' : 'OK'
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/evolution/debug/all', async (req, res) => {
  try {
    const companies = await pool!.query('SELECT id, name, evolution_instance FROM companies');
    const instancesInConvs = await pool!.query('SELECT instance, count(*) as count FROM whatsapp_conversations GROUP BY instance');

    res.json({
      companies: companies.rows,
      instances_in_conversations: instancesInConvs.rows
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/evolution/debug/fix-viamove', async (req, res) => {
  try {
    const result = await pool!.query(`
            UPDATE whatsapp_conversations 
            SET company_id = co.id 
            FROM companies co 
            WHERE whatsapp_conversations.company_id IS NULL 
            AND (
                LOWER(whatsapp_conversations.instance) = LOWER(co.evolution_instance)
                OR (LOWER(whatsapp_conversations.instance) LIKE '%viamove%' AND LOWER(co.name) LIKE '%viamove%')
            )
            RETURNING whatsapp_conversations.id
        `);
    res.json({ fixed_count: result.rows.length, ids: result.rows.map(r => r.id) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
router.get('/evolution/qrcode', authenticateToken, getEvolutionQrCode);
router.get('/evolution/webhook/get', authenticateToken, getEvolutionWebhook);
router.post('/evolution/webhook/set', authenticateToken, setEvolutionWebhook);
router.post('/evolution/webhook/:type', handleEvolutionWebhook);
router.post('/evolution/webhook', handleEvolutionWebhook);
// Alternative webhook routes for compatibility
router.post('/webhooks/whatsapp', handleEvolutionWebhook);
router.post('/webhooks/whatsapp/:type', handleEvolutionWebhook);
router.get('/evolution/webhook-debug', debugWebhookPayloads);
router.get('/evolution/conversations', authenticateToken, getConversations);
router.post('/evolution/groups/sync', authenticateToken, syncEvolutionGroups);
router.post('/evolution/conversations/:conversationId/refresh', authenticateToken, refreshConversationMetadata);
router.post('/evolution/conversations/:conversationId/refresh', authenticateToken, refreshConversationMetadata);
router.put('/evolution/conversations/:id/status', authenticateToken, updateConversationStatus);
router.get('/evolution/messages/:conversationId', authenticateToken, getMessages);
router.get('/evolution/media/:messageId', authenticateToken, getEvolutionMedia);
router.get('/evolution/profile-pic/:phone', authenticateToken, getEvolutionProfilePic);
router.post('/evolution/profile-pic/sync', authenticateToken, syncAllProfilePics);

// CRM Routes
// Call Routes (Integration with Evolution)
import { getCalls, startOutboundCall, getVoiceToken, getVoiceTwiML } from './controllers/callController';
import { getCrmAppointments, createCrmAppointment, updateCrmAppointment, deleteCrmAppointment } from './controllers/appointmentController';

router.get('/crm/calls', authenticateToken, getCalls);
router.post('/crm/calls/start', authenticateToken, startOutboundCall);
router.post('/crm/calls/token', authenticateToken, getVoiceToken);
router.post('/crm/calls/twiml', getVoiceTwiML); // Twilio calls this directly

// CRM Routes
router.get('/crm/dashboard', authenticateToken, getCrmDashboardStats);
router.post('/crm/conversations/ensure', authenticateToken, ensureConversation);
router.post('/crm/conversations/:id/start', authenticateToken, startConversation);
router.post('/crm/conversations/:id/close', authenticateToken, closeConversation);
router.post('/crm/conversations/:id/pending', authenticateToken, returnToPending);
router.put('/crm/conversations/:id/queue', authenticateToken, transferConversationQueue);
router.get('/queues', authenticateToken, listQueues);
router.post('/queues', authenticateToken, authorizeRole(['ADMIN', 'SUPERADMIN']), createQueue);
router.put('/queues/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPERADMIN']), updateQueue);
router.delete('/queues/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPERADMIN']), deleteQueue);

// User-Queue Association
router.get('/whaticket/users/:userId/queues', authenticateToken, getUserQueues);
router.post('/whaticket/users/:userId/queues', authenticateToken, authorizeRole(['ADMIN', 'SUPERADMIN']), setUserQueues);


// Quick Answers Routes
router.get('/whaticket/quick-answers', authenticateToken, getQuickAnswers);
router.post('/whaticket/quick-answers', authenticateToken, createQuickAnswer);
router.put('/whaticket/quick-answers/:id', authenticateToken, updateQuickAnswer);
router.delete('/whaticket/quick-answers/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPERADMIN']), deleteQuickAnswer);

// Internal Chat Routes
router.get('/whaticket/internal-chat/unread', authenticateToken, getUnreadInternalCount);
router.get('/whaticket/internal-chat/:otherUserId', authenticateToken, getInternalMessages);
router.post('/whaticket/internal-chat', authenticateToken, sendInternalMessage);
router.post('/whaticket/internal-chat/:senderId/read', authenticateToken, markInternalAsRead);

router.put('/crm/conversations/:id/name', authenticateToken, updateContactNameWithAudit);
router.delete('/crm/conversations/:id', authenticateToken, deleteConversation);

// Appointments Routes
router.get('/crm/appointments', authenticateToken, getCrmAppointments);
router.post('/crm/appointments', authenticateToken, createCrmAppointment);
router.put('/crm/appointments/:id', authenticateToken, updateCrmAppointment);
router.delete('/crm/appointments/:id', authenticateToken, deleteCrmAppointment);


// Cities routes
router.get('/cities', getCities);
router.post('/cities', createCity);

// CRM Tag Routes
import { getTags, createTag, updateTag, deleteTag, getLeadTags, addLeadTag, removeLeadTag, getConversationTags, addConversationTag, removeConversationTag } from './controllers/tagController';
router.get('/crm/tags', authenticateToken, getTags);
router.post('/crm/tags', authenticateToken, createTag);
router.put('/crm/tags/:id', authenticateToken, updateTag);
router.delete('/crm/tags/:id', authenticateToken, deleteTag);

// Lead Tags
router.get('/crm/leads/:leadId/tags', authenticateToken, getLeadTags);
router.post('/crm/leads/:leadId/tags', authenticateToken, addLeadTag);
router.delete('/crm/leads/:leadId/tags/:tagId', authenticateToken, removeLeadTag);

// Conversation Tags
router.get('/evolution/conversations/:conversationId/tags', authenticateToken, getConversationTags);
router.post('/evolution/conversations/:conversationId/tags', authenticateToken, addConversationTag);
router.delete('/evolution/conversations/:conversationId/tags/:tagId', authenticateToken, removeConversationTag);

// CRM routes
router.get('/crm/stages', authenticateToken, getStages);
router.post('/crm/stages', authenticateToken, createStage);
router.delete('/crm/stages/:id', authenticateToken, deleteStage);
router.get('/crm/leads', authenticateToken, getLeads);
router.put('/crm/leads/:id', authenticateToken, authorizePermission('crm.move_cards'), updateLead);
router.post('/crm/leads', authenticateToken, createLead);
router.put('/crm/leads/:id/move', authenticateToken, authorizePermission('crm.move_cards'), updateLeadStage);
router.get('/crm/contacts', authenticateToken, getContacts);


// Bot Routes (Chatbot V2)
import {
  getChatbots, createChatbot, updateChatbot, deleteChatbot,
  getFlow, saveFlow, publishFlow,
  getInstances, toggleInstance
} from './controllers/chatbotController';

router.get('/bots', authenticateToken, getChatbots);
router.post('/bots', authenticateToken, createChatbot);
router.put('/bots/:id', authenticateToken, updateChatbot);
router.delete('/bots/:id', authenticateToken, deleteChatbot);
router.get('/bots/:id/flow', authenticateToken, getFlow);
router.post('/bots/:id/flow', authenticateToken, saveFlow);
router.post('/bots/:id/publish', authenticateToken, publishFlow);
router.get('/bots/:id/instances', authenticateToken, getInstances);
router.post('/bots/:id/instances', authenticateToken, toggleInstance);

// Chatbot Execution Webhook
import { processChatbotMessage } from './services/chatbotService';
router.post('/webhook/chatbot/:empresaId/:instancia', async (req: Request, res: Response) => {
  res.status(200).json({ status: 'received' });
  const { instancia } = req.params;
  const body = req.body;

  // Extract message data (similar to main webhook)
  const data = body.data || body;
  const messages = data.messages || [data];
  if (messages && messages[0]) {
    const msg = messages[0];
    const remoteJid = msg.key?.remoteJid;
    const isFromMe = msg.key?.fromMe;

    if (remoteJid && !isFromMe && !remoteJid.includes('@g.us')) {
      const phone = remoteJid.split('@')[0];
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
      await processChatbotMessage(instancia, phone, text);
    }
  }
});

// Clinical Finance Routes
import {
  getClinicalDashboard, getClinicalTransactions,
  createClinicalTransaction, updateClinicalTransaction
} from './controllers/clinicalFinanceController';

router.get('/finance/clinical/dashboard', authenticateToken, getClinicalDashboard);
router.get('/finance/clinical/transactions', authenticateToken, getClinicalTransactions);
router.post('/finance/clinical/transactions', authenticateToken, createClinicalTransaction);
router.put('/finance/clinical/transactions/:id', authenticateToken, updateClinicalTransaction);

// Generic Financial Routes (Existing)
router.get('/crm/follow-ups', authenticateToken, getFollowUps);
router.get('/crm/follow-ups/stats', authenticateToken, getFollowUpStats);
router.post('/crm/follow-ups', authenticateToken, createFollowUp);
router.put('/crm/follow-ups/:id', authenticateToken, updateFollowUp);
router.delete('/crm/follow-ups/:id', authenticateToken, deleteFollowUp);

// Contacts Routes (WhatsApp Contacts Management)
router.get('/contacts', authenticateToken, getContacts);
router.get('/contacts/search', authenticateToken, searchContacts);
router.get('/contacts/:id', authenticateToken, getContact);
router.post('/contacts', authenticateToken, createContact);
router.put('/contacts/:id', authenticateToken, updateContact);
router.delete('/contacts/:id', authenticateToken, deleteContact);

// Professionals Routes
router.get('/crm/professionals', authenticateToken, getProfessionals);
router.post('/crm/professionals', authenticateToken, authorizePermission('reg.professionals'), createProfessional);
router.put('/crm/professionals/:id', authenticateToken, authorizePermission('reg.professionals'), updateProfessional);
router.delete('/crm/professionals/:id', authenticateToken, authorizePermission('reg.professionals'), deleteProfessional);

// Insurance Routes
router.get('/crm/insurance-plans', authenticateToken, getInsurancePlans);
router.post('/crm/insurance-plans', authenticateToken, authorizePermission('reg.services'), createInsurancePlan);
router.put('/crm/insurance-plans/:id', authenticateToken, authorizePermission('reg.services'), updateInsurancePlan);
router.delete('/crm/insurance-plans/:id', authenticateToken, authorizePermission('reg.services'), deleteInsurancePlan);

// Professional-Insurance Configs
router.get('/crm/professional-insurance-configs', authenticateToken, getProfessionalInsuranceConfigs);
router.post('/crm/professional-insurance-configs', authenticateToken, authorizePermission('reg.professionals'), upsertProfessionalInsuranceConfig);

// Clinical BI
router.get('/crm/clinical-bi', authenticateToken, getClinicalBIStats);

// Reports routes
// Reports routes
import { getDRE, getBreakdown, getFinancialIndicators, getOperationalReports } from './controllers/reportsController';
import { getConversionStats } from './controllers/analyticsController';

router.get('/reports/dre', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN', 'USUARIO']), getDRE);
router.get('/reports/breakdown', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN', 'USUARIO']), getBreakdown);
router.get('/reports/indicators', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN', 'USUARIO']), getFinancialIndicators);
router.get('/reports/operational', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN', 'USUARIO']), getOperationalReports);
router.get('/reports/conversion', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN', 'USUARIO']), getConversionStats);

// CRM Contacts route (Alias for generic contacts)
router.get('/crm/contacts', authenticateToken, getContacts);


import { getPayables, getReceivables, getReceivablesByCity, getCashFlow, getFinancialStats, createFinancialTransaction, updateFinancialTransaction, deleteFinancialTransaction, reactivateFinancialTransaction, markAsPaid, getCategories, createCategory, deleteCategory } from './controllers/financialController';
// FAQ Routes
import { createFaqQuestion, getFaqQuestions, answerFaqQuestion, deleteFaqQuestion } from './controllers/faqController';

// Financial routes
router.get('/financial/payables', authenticateToken, getPayables);
router.get('/financial/receivables', authenticateToken, getReceivables);
router.get('/financial/receivables-by-city', authenticateToken, getReceivablesByCity);
router.get('/financial/cashflow', authenticateToken, getCashFlow);
router.get('/financial/stats', authenticateToken, getFinancialStats);
router.post('/financial/transactions', authenticateToken, authorizePermission('finance.create'), createFinancialTransaction);
router.put('/financial/transactions/:id', authenticateToken, authorizePermission('finance.edit'), updateFinancialTransaction);
router.delete('/financial/transactions/:id', authenticateToken, authorizePermission('finance.delete'), deleteFinancialTransaction);
router.put('/financial/transactions/:id/reactivate', authenticateToken, reactivateFinancialTransaction);
router.post('/financial/transactions/:id/pay', authenticateToken, markAsPaid);

router.get('/financial/categories', authenticateToken, getCategories);
router.post('/financial/categories', authenticateToken, createCategory);
router.delete('/financial/categories/:id', authenticateToken, deleteCategory);

import { getCostCenters, createCostCenter, deleteCostCenter } from './controllers/costCenterController';
router.get('/financial/cost-centers', authenticateToken, getCostCenters);
router.post('/financial/cost-centers', authenticateToken, createCostCenter);
router.delete('/financial/cost-centers/:id', authenticateToken, deleteCostCenter);

// FAQ
router.get('/faq/questions', authenticateToken, getFaqQuestions);
router.post('/faq/questions', authenticateToken, createFaqQuestion);
router.put('/faq/questions/:id/answer', authenticateToken, authorizeRole(['SUPERADMIN']), answerFaqQuestion);
router.delete('/faq/questions/:id', authenticateToken, deleteFaqQuestion);

// Campaign routes
import {
  createCampaign,
  getCampaigns,
  getCampaignById,
  startCampaign,
  pauseCampaign,
  deleteCampaign,
  updateCampaign
} from './controllers/campaignController';

router.post('/campaigns', authenticateToken, createCampaign);
router.get('/campaigns', authenticateToken, getCampaigns);
router.get('/campaigns/:id', authenticateToken, getCampaignById);
router.post('/campaigns/:id/start', authenticateToken, startCampaign);
router.post('/campaigns/:id/pause', authenticateToken, pauseCampaign);
router.put('/campaigns/:id', authenticateToken, updateCampaign);
router.delete('/campaigns/:id', authenticateToken, deleteCampaign);

// Admin Tasks
import { getTasks, createTask, updateTask, deleteTask, getTaskHistory, getPendingTasksCount } from './controllers/taskController';
router.get('/admin/tasks', authenticateToken, authorizeRole(['SUPERADMIN']), getTasks);
router.get('/admin/tasks/count', authenticateToken, authorizeRole(['SUPERADMIN']), getPendingTasksCount);
router.post('/admin/tasks', authenticateToken, authorizeRole(['SUPERADMIN']), createTask);
router.put('/admin/tasks/:id', authenticateToken, authorizeRole(['SUPERADMIN']), updateTask);
router.delete('/admin/tasks/:id', authenticateToken, authorizeRole(['SUPERADMIN']), deleteTask);
router.get('/admin/tasks/:id/history', authenticateToken, authorizeRole(['SUPERADMIN']), getTaskHistory);

// System Logs
import { getSystemLogs, getLogStats } from './controllers/logController';
router.get('/admin/logs', authenticateToken, authorizeRole(['SUPERADMIN']), getSystemLogs);
router.get('/admin/logs/stats', authenticateToken, authorizeRole(['SUPERADMIN']), getLogStats);

// Admin Alerts
import { getAlerts, markAlertAsRead, markAllAlertsAsRead, deleteAlert, getUnreadAlertsCount } from './controllers/alertController';
router.get('/admin/alerts', authenticateToken, authorizeRole(['SUPERADMIN']), getAlerts);
router.get('/admin/alerts/count', authenticateToken, authorizeRole(['SUPERADMIN']), getUnreadAlertsCount);
router.put('/admin/alerts/read-all', authenticateToken, authorizeRole(['SUPERADMIN']), markAllAlertsAsRead);
router.put('/admin/alerts/:id/read', authenticateToken, authorizeRole(['SUPERADMIN']), markAlertAsRead);
// System Health
import { getSystemHealth, testService } from './controllers/healthController';
router.get('/admin/health', authenticateToken, authorizeRole(['SUPERADMIN']), getSystemHealth);
router.post('/admin/health/test', authenticateToken, authorizeRole(['SUPERADMIN']), testService);

// Entity Links
import { createLink, getLinksForEntity, deleteLink } from './controllers/linksController';
router.post('/admin/links', authenticateToken, createLink);
router.get('/admin/links/:type/:id', authenticateToken, getLinksForEntity);
router.delete('/admin/links/:id', authenticateToken, deleteLink);

// Workflows
import { getWorkflows, createWorkflow, updateWorkflow, deleteWorkflow, getWorkflowHistory } from './controllers/workflowController';
router.get('/admin/workflows', authenticateToken, authorizeRole(['SUPERADMIN']), getWorkflows);
router.post('/admin/workflows', authenticateToken, authorizeRole(['SUPERADMIN']), createWorkflow);
router.put('/admin/workflows/:id', authenticateToken, authorizeRole(['SUPERADMIN']), updateWorkflow);
router.delete('/admin/workflows/:id', authenticateToken, authorizeRole(['SUPERADMIN']), deleteWorkflow);
router.get('/admin/workflows/:id/history', authenticateToken, authorizeRole(['SUPERADMIN']), getWorkflowHistory);

// System Audit
import { getAuditLogs, getAuditStats } from './controllers/auditController';
router.get('/admin/audit/logs', authenticateToken, authorizeRole(['SUPERADMIN']), getAuditLogs);
router.get('/admin/audit/stats', authenticateToken, authorizeRole(['SUPERADMIN']), getAuditStats);

// AI Management
import { getAiAgents, updateAgentStatus, updateAgentPrompt, getAiHistory, testAiAgent } from './controllers/aiController';
router.get('/admin/ai/agents', authenticateToken, authorizeRole(['SUPERADMIN']), getAiAgents);
router.put('/admin/ai/agents/:id/status', authenticateToken, authorizeRole(['SUPERADMIN']), updateAgentStatus);
router.put('/admin/ai/agents/:id/prompt', authenticateToken, authorizeRole(['SUPERADMIN']), updateAgentPrompt);
router.get('/admin/ai/history', authenticateToken, authorizeRole(['SUPERADMIN']), getAiHistory);
router.post('/admin/ai/test', authenticateToken, authorizeRole(['SUPERADMIN']), testAiAgent);

// System Modes
import { getSystemMode, setSystemMode } from './controllers/systemController';
router.get('/admin/system/mode', authenticateToken, getSystemMode);
router.post('/admin/system/mode', authenticateToken, authorizeRole(['SUPERADMIN']), setSystemMode);

// Global Search
import { globalSearch } from './controllers/searchController';
router.get('/global/search', authenticateToken, rateLimit({ windowMs: 60000, max: 30 }), globalSearch);

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
router.get('/debug-messages/:id', authenticateToken, async (req: Request, res: Response) => { // getReceivables is already defined or imported, removing duplicate if present
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

router.get('/debug-query', async (req, res) => {
  try {
    const result = await pool!.query('SELECT content FROM app_debug_logs ORDER BY id DESC LIMIT 1');
    if (result.rows.length > 0) {
      res.type('text/plain').send(result.rows[0].content);
    } else {
      res.type('text/plain').send("No logs in database yet.");
    }
  } catch (e: any) {
    res.status(500).json({ error: 'DB Log Error', details: e.message });
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
// Template Center
import { getTemplates, createTemplate, updateTemplate, deleteTemplate, getTemplateHistory } from './controllers/templateController';
router.get('/config/templates', authenticateToken, getTemplates); // Using /config/ to group under settings if desired, or /templates
router.post('/config/templates', authenticateToken, authorizeRole(['ADMIN', 'SUPERADMIN', 'USUARIO']), createTemplate);
router.put('/config/templates/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPERADMIN']), updateTemplate);
router.delete('/config/templates/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPERADMIN']), deleteTemplate);
router.get('/config/templates/:id/history', authenticateToken, getTemplateHistory);

// Closing Reasons
import {
  listClosingReasons,
  createClosingReason,
  updateClosingReason,
  deleteClosingReason,
  getClosingReasonsAnalytics
} from './controllers/closingReasonController';
router.get('/closing-reasons', authenticateToken, listClosingReasons);
router.get('/closing-reasons/analytics', authenticateToken, getClosingReasonsAnalytics);
router.post('/closing-reasons', authenticateToken, authorizeRole(['ADMIN', 'SUPERADMIN']), createClosingReason);
router.put('/closing-reasons/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPERADMIN']), updateClosingReason);
router.delete('/closing-reasons/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPERADMIN']), deleteClosingReason);

// Quick Messages
import {
  listQuickMessages,
  createQuickMessage,
  updateQuickMessage,
  deleteQuickMessage
} from './controllers/quickMessageController';
router.get('/quick-messages', authenticateToken, listQuickMessages);
router.post('/quick-messages', authenticateToken, authorizeRole(['ADMIN', 'SUPERADMIN']), upload.single('file'), createQuickMessage);
router.put('/quick-messages/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPERADMIN']), upload.single('file'), updateQuickMessage);
router.delete('/quick-messages/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPERADMIN']), deleteQuickMessage);


// Roadmap
import { getRoadmapItems, createRoadmapItem, updateRoadmapItem, deleteRoadmapItem, getRoadmapComments, addRoadmapComment, linkTaskToRoadmap } from './controllers/roadmapController';
router.get('/roadmap', authenticateToken, getRoadmapItems);
router.post('/roadmap', authenticateToken, createRoadmapItem);
router.put('/roadmap/:id', authenticateToken, updateRoadmapItem);
router.delete('/roadmap/:id', authenticateToken, deleteRoadmapItem);
router.get('/roadmap/:id/comments', authenticateToken, getRoadmapComments);
router.post('/roadmap/:id/comments', authenticateToken, addRoadmapComment);
router.post('/roadmap/:id/link-task', authenticateToken, linkTaskToRoadmap);


// Onboarding
import { getOnboardingStatus, updateOnboardingStep, completeOnboarding } from './controllers/onboardingController';
router.get('/onboarding/status', authenticateToken, getOnboardingStatus);
router.post('/onboarding/step', authenticateToken, updateOnboardingStep);
router.post('/onboarding/complete', authenticateToken, completeOnboarding);

// Legal Pages Routes
import { getLegalPage, updateLegalPage } from './controllers/legalController';
router.get('/legal-pages/:type', getLegalPage); // Public
router.put('/legal-pages/:type', authenticateToken, authorizeRole(['SUPERADMIN']), updateLegalPage);

// Plan & Subscription
import { getPlanStatus, getPlans } from './controllers/planController';
import { getSubscription, createSubscription, cancelSubscription, getInvoices } from './controllers/subscriptionController';

router.get('/subscription', authenticateToken, getPlanStatus); // Legacy/Limit check
router.get('/plans', authenticateToken, getPlans);

// Billing Routes
router.get('/billing/subscription', authenticateToken, getSubscription);
router.post('/billing/subscription', authenticateToken, authorizeRole(['ADMIN', 'SUPERADMIN']), createSubscription);
router.post('/billing/cancel', authenticateToken, authorizeRole(['ADMIN', 'SUPERADMIN']), cancelSubscription);
router.get('/billing/invoices', authenticateToken, getInvoices);

// Lavajato Routes
import { getLavajatoStats, getLavajatoFunnel, getVehicles, createVehicle, getAppointments, createAppointment, getServiceOrders, createServiceOrder, getBoxes, getServices } from './controllers/lavajatoController';

router.get('/lavajato/stats', authenticateToken, getLavajatoStats);
router.get('/lavajato/funnel', authenticateToken, getLavajatoFunnel);
router.get('/lavajato/vehicles', authenticateToken, getVehicles);
router.post('/lavajato/vehicles', authenticateToken, createVehicle);
router.get('/lavajato/appointments', authenticateToken, getAppointments);
router.post('/lavajato/appointments', authenticateToken, createAppointment);
router.get('/lavajato/service-orders', authenticateToken, getServiceOrders);
router.post('/lavajato/service-orders', authenticateToken, createServiceOrder);
router.get('/lavajato/boxes', authenticateToken, getBoxes);
router.get('/lavajato/services', authenticateToken, getServices);

// Restaurant Routes
import { getRestaurantStats, getRestaurantFunnel, getTables, getMenu, getOrders, createOrder, getDeliveries } from './controllers/restaurantController';

router.get('/restaurant/stats', authenticateToken, getRestaurantStats);
router.get('/restaurant/funnel', authenticateToken, getRestaurantFunnel);
router.get('/restaurant/tables', authenticateToken, getTables);
router.get('/restaurant/menu', authenticateToken, getMenu);
router.get('/restaurant/orders', authenticateToken, getOrders);
router.post('/restaurant/orders', authenticateToken, createOrder);
router.get('/restaurant/deliveries', authenticateToken, getDeliveries);

router.get('/rides', (req, res) => res.json({ message: 'Rides endpoint' }));
router.get('/whatsapp', (req, res) => res.json({ message: 'WhatsApp endpoint' }));


// Shop Routes
import {
  getShopDashboard,
  getSales,
  createSale,
  updateSaleStatus,
  getInventory,
  createInventoryItem,
  updateInventoryItem,
  getSuppliers,
  createSupplier,
  getPayments,
  getReceivables as getShopReceivables,
  getGoalsOverview,
  createGoal,
  distributeRevenueGoalBySellers,
  getGoalSellers
} from './controllers/shopController';
import { validateCompanyAndInstance } from './middleware/validateCompanyAndInstance';

router.get('/shop/dashboard', authenticateToken, validateCompanyAndInstance, getShopDashboard);
router.get('/shop/sales', authenticateToken, validateCompanyAndInstance, getSales);
router.post('/shop/sales', authenticateToken, validateCompanyAndInstance, createSale);
router.put('/shop/sales/:id/status', authenticateToken, validateCompanyAndInstance, updateSaleStatus);
router.get('/shop/inventory', authenticateToken, validateCompanyAndInstance, getInventory);
router.post('/shop/inventory', authenticateToken, authorizePermission('inventory.create_prod'), validateCompanyAndInstance, createInventoryItem);
router.put('/shop/inventory/:id', authenticateToken, authorizePermission('inventory.edit_prod'), validateCompanyAndInstance, updateInventoryItem);
router.get('/shop/suppliers', authenticateToken, validateCompanyAndInstance, getSuppliers);
router.post('/shop/suppliers', authenticateToken, validateCompanyAndInstance, createSupplier);
router.get('/shop/payments', authenticateToken, validateCompanyAndInstance, getPayments);
router.get('/shop/receivables', authenticateToken, validateCompanyAndInstance, getShopReceivables);
router.get('/shop/goals/overview', authenticateToken, validateCompanyAndInstance, getGoalsOverview);
router.get('/shop/goals/sellers', authenticateToken, validateCompanyAndInstance, getGoalSellers);
router.post('/shop/goals', authenticateToken, validateCompanyAndInstance, createGoal);
router.post('/shop/goals/distribute', authenticateToken, validateCompanyAndInstance, distributeRevenueGoalBySellers);

// DEBUG CHATBOT
router.post('/debug-activate-karen', async (req, res) => {
  try {
    await pool!.query(`
            INSERT INTO chatbot_instances (chatbot_id, instance_key, is_active)
            VALUES (2, 'karenloja', true)
            ON CONFLICT (chatbot_id, instance_key) DO UPDATE SET is_active = true;
        `);
    res.json({ success: true, message: "Activated on karenloja" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/debug-chatbot-status', async (req, res) => {
  try {
    const bots = await pool!.query(`
            SELECT
                c.id as bot_id,
                c.name as bot_name,
                c.status as bot_status,
                ci.instance_key,
                ci.is_active as instance_active,
                comp.name as company_name,
                comp.evolution_instance,
                comp_inst.instance_key as real_instance_key,
                comp_inst.status as real_status
            FROM chatbots c
            LEFT JOIN chatbot_instances ci ON ci.chatbot_id = c.id
            LEFT JOIN companies comp ON comp.id = c.company_id
            LEFT JOIN company_instances comp_inst ON comp_inst.company_id = c.company_id
        `);
    res.json(bots.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
