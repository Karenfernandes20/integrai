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
import {
  handleWebhook,
  getConversations,
  getMessages,
  debugWebhookPayloads,
  verifyInstagramWebhook,
  handleInstagramWebhook
} from './controllers/webhookController';
import { getCities, createCity } from './controllers/cityController';
import { login, register } from './controllers/authController';
import { authenticateToken, authorizeRole, authorizePermission } from './middleware/authMiddleware';
import { rateLimit } from './middleware/rateLimitMiddleware';
import { MODULES, ACTIONS } from './config/roles';
import { getCompanies, createCompany, updateCompany, deleteCompany, getCompanyUsers, getCompany, getCompanyInstances, updateCompanyInstance } from './controllers/companyController';
import { startConversation, closeConversation, updateContactNameWithAudit, deleteConversation, returnToPending } from './controllers/conversationController';
import { getFollowUps, createFollowUp, updateFollowUp, deleteFollowUp, getFollowUpStats } from './controllers/followUpController';

import { handleN8nWebhook } from './controllers/n8nWebhookController';
const router = express.Router();
router.get('/webhooks/instagram', verifyInstagramWebhook);
router.post('/webhooks/instagram', handleInstagramWebhook);
router.post('/webhooks/n8n/workflows', handleN8nWebhook);


// Auth routes
router.post('/auth/login', login);
router.post('/auth/register', register);

import { upload } from './middleware/uploadMiddleware';

router.put('/auth/profile', authenticateToken, upload.single('logo'), updateProfile);

// Company routes
router.get('/companies', authenticateToken, authorizeRole(['SUPERADMIN']), getCompanies);
router.get('/companies/:id', authenticateToken, getCompany);
router.get('/companies/:id/users', authenticateToken, authorizeRole(['SUPERADMIN']), getCompanyUsers);
router.get('/companies/:id/instances', authenticateToken, getCompanyInstances); // New
router.put('/companies/:id/instances/:instanceId', authenticateToken, updateCompanyInstance); // New
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
import { getEvolutionQrCode, setEvolutionWebhook, getEvolutionWebhook, deleteEvolutionInstance, sendEvolutionMessage, getEvolutionConnectionState, getEvolutionContacts, createEvolutionContact, updateEvolutionContact, deleteEvolutionContact, editEvolutionMessage, syncEvolutionContacts, handleEvolutionWebhook, getEvolutionContactsLive, deleteEvolutionMessage, getEvolutionConfig, getEvolutionMedia, getEvolutionProfilePic, syncAllProfilePics, sendEvolutionMedia, refreshConversationMetadata, deleteMessage, searchEverything, sendEvolutionReaction } from './controllers/evolutionController';
router.get('/evolution/search', authenticateToken, searchEverything);
router.get('/evolution/status', authenticateToken, getEvolutionConnectionState);
router.get('/evolution/contacts', authenticateToken, getEvolutionContacts);
router.post('/evolution/contacts', authenticateToken, createEvolutionContact);
router.get('/evolution/contacts/live', authenticateToken, getEvolutionContactsLive);
router.post('/evolution/contacts/sync', authenticateToken, syncEvolutionContacts);
router.put('/evolution/contacts/:id', authenticateToken, updateEvolutionContact);
router.delete('/evolution/contacts/:id', authenticateToken, deleteEvolutionContact);
router.delete('/evolution/disconnect', authenticateToken, deleteEvolutionInstance);
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
router.post('/evolution/webhook/:type', handleWebhook);
router.post('/evolution/webhook', handleWebhook);
router.get('/evolution/webhook-debug', debugWebhookPayloads);
router.get('/evolution/conversations', authenticateToken, getConversations);
router.post('/evolution/conversations/:conversationId/refresh', authenticateToken, refreshConversationMetadata);
router.get('/evolution/messages/:conversationId', authenticateToken, getMessages);
router.get('/evolution/media/:messageId', authenticateToken, getEvolutionMedia);
router.get('/evolution/profile-pic/:phone', authenticateToken, getEvolutionProfilePic);
router.post('/evolution/profile-pic/sync', authenticateToken, syncAllProfilePics);

// CRM Routes
// Call Routes (Integration with Evolution)
import { getCalls, startOutboundCall, getVoiceToken, getVoiceTwiML } from './controllers/callController';
router.get('/crm/calls', authenticateToken, getCalls);
router.post('/crm/calls/start', authenticateToken, startOutboundCall);
router.post('/crm/calls/token', authenticateToken, getVoiceToken);
router.post('/crm/calls/twiml', getVoiceTwiML); // Twilio calls this directly

// CRM Routes
router.get('/crm/dashboard', authenticateToken, getCrmDashboardStats);
router.post('/crm/conversations/:id/start', authenticateToken, startConversation);
router.post('/crm/conversations/:id/close', authenticateToken, closeConversation);
router.post('/crm/conversations/:id/pending', authenticateToken, returnToPending);
router.put('/crm/conversations/:id/name', authenticateToken, updateContactNameWithAudit);
router.delete('/crm/conversations/:id', authenticateToken, deleteConversation);

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
router.put('/crm/leads/:id', authenticateToken, authorizePermission(MODULES.CRM, ACTIONS.WRITE), updateLead);
router.put('/crm/leads/:id/move', authenticateToken, authorizePermission(MODULES.CRM, ACTIONS.WRITE), updateLeadStage);

// Follow-up Routes
router.get('/crm/follow-ups', authenticateToken, getFollowUps);
router.get('/crm/follow-ups/stats', authenticateToken, getFollowUpStats);
router.post('/crm/follow-ups', authenticateToken, createFollowUp);
router.put('/crm/follow-ups/:id', authenticateToken, updateFollowUp);
router.delete('/crm/follow-ups/:id', authenticateToken, deleteFollowUp);

// Reports routes
// Reports routes
import { getDRE, getBreakdown, getFinancialIndicators, getOperationalReports } from './controllers/reportsController';
import { getConversionStats } from './controllers/analyticsController';

router.get('/reports/dre', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN']), getDRE);
router.get('/reports/breakdown', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN']), getBreakdown);
router.get('/reports/indicators', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN']), getFinancialIndicators);
router.get('/reports/operational', authenticateToken, authorizeRole(['SUPERADMIN', 'ADMIN']), getOperationalReports);
router.get('/reports/conversion', authenticateToken, authorizeRole(['SUPERADMIN']), getConversionStats);


import { getPayables, getReceivables, getReceivablesByCity, getCashFlow, getFinancialStats, createFinancialTransaction, updateFinancialTransaction, deleteFinancialTransaction, reactivateFinancialTransaction, markAsPaid, getCategories, createCategory, deleteCategory } from './controllers/financialController';
// FAQ Routes
import { createFaqQuestion, getFaqQuestions, answerFaqQuestion, deleteFaqQuestion } from './controllers/faqController';

// Financial routes
router.get('/financial/payables', authenticateToken, getPayables);
router.get('/financial/receivables', authenticateToken, getReceivables);
router.get('/financial/receivables-by-city', authenticateToken, getReceivablesByCity);
router.get('/financial/cashflow', authenticateToken, getCashFlow);
router.get('/financial/stats', authenticateToken, getFinancialStats);
router.post('/financial/transactions', authenticateToken, authorizePermission(MODULES.FINANCIAL, ACTIONS.WRITE), createFinancialTransaction);
router.put('/financial/transactions/:id', authenticateToken, authorizePermission(MODULES.FINANCIAL, ACTIONS.WRITE), updateFinancialTransaction);
router.delete('/financial/transactions/:id', authenticateToken, authorizePermission(MODULES.FINANCIAL, ACTIONS.DELETE), deleteFinancialTransaction);
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
// Template Center
import { getTemplates, createTemplate, updateTemplate, deleteTemplate, getTemplateHistory } from './controllers/templateController';
router.get('/config/templates', authenticateToken, getTemplates); // Using /config/ to group under settings if desired, or /templates
router.post('/config/templates', authenticateToken, authorizeRole(['ADMIN', 'SUPERADMIN', 'USUARIO']), createTemplate);
router.put('/config/templates/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPERADMIN']), updateTemplate);
router.delete('/config/templates/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPERADMIN']), deleteTemplate);
router.get('/config/templates/:id/history', authenticateToken, getTemplateHistory);


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

router.get('/rides', (req, res) => res.json({ message: 'Rides endpoint' }));
router.get('/whatsapp', (req, res) => res.json({ message: 'WhatsApp endpoint' }));

export default router;
