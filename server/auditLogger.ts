import { pool } from './db';

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'version_update';
export type ResourceType = 'user' | 'task' | 'document' | 'setting' | 'company' | 'campaign' | 'ai_agent' | 'template' | 'system';

interface AuditData {
    userId: number;
    companyId?: number;
    action: AuditAction;
    resourceType: ResourceType;
    resourceId?: string | number;
    oldValues?: any;
    newValues?: any;
    details?: string;
    ipAddress?: string;
}

export const logAudit = async (data: AuditData) => {
    try {
        if (!pool) return;

        const {
            userId,
            companyId,
            action,
            resourceType,
            resourceId,
            oldValues,
            newValues,
            details,
            ipAddress
        } = data;

        await pool.query(
            `INSERT INTO audit_logs 
             (user_id, company_id, action, resource_type, resource_id, old_values, new_values, details, ip_address) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                userId,
                companyId || null,
                action,
                resourceType,
                resourceId?.toString() || null,
                oldValues || {},
                newValues || {},
                details || null,
                ipAddress || null
            ]
        );

        console.log(`[AUDIT] ${action.toUpperCase()} ${resourceType} by user ${userId}`);
    } catch (error) {
        console.error('[AuditLogger] Failed to save audit log:', error);
    }
};

export default logAudit;
