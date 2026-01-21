import { getAdminDb } from './firebase';
import { logger } from './logger';

/**
 * Audit log event types
 */
export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'user.signup'
  | 'user.password_change'
  | 'profile.create'
  | 'profile.update'
  | 'profile.delete'
  | 'report.generate'
  | 'report.view'
  | 'report.send_whatsapp'
  | 'connector.connect'
  | 'connector.disconnect'
  | 'connector.sync'
  | 'settings.update'
  | 'admin.action';

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  id?: string;
  timestamp: Date;
  action: AuditAction;
  userId: string;
  userEmail?: string;
  resource?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

/**
 * Firestore collection for audit logs
 */
const AUDIT_COLLECTION = 'auditLogs';

/**
 * Log an audit event to Firestore
 *
 * @example
 * ```ts
 * await auditLog({
 *   action: 'report.generate',
 *   userId: 'user123',
 *   resourceId: 'report456',
 *   details: { profileId: 'profile789', dateRange: 'last7days' },
 *   success: true,
 * });
 * ```
 */
export async function auditLog(entry: Omit<AuditLogEntry, 'timestamp' | 'id'>): Promise<void> {
  const fullEntry: AuditLogEntry = {
    ...entry,
    timestamp: new Date(),
  };

  try {
    const db = getAdminDb();
    await db.collection(AUDIT_COLLECTION).add({
      ...fullEntry,
      timestamp: fullEntry.timestamp,
    });

    // Also log to structured logger for immediate visibility
    logger.info('Audit event', {
      action: entry.action,
      userId: entry.userId,
      resource: entry.resource,
      resourceId: entry.resourceId,
      success: entry.success,
    });
  } catch (error) {
    // Don't let audit logging failures break the application
    logger.error('Failed to write audit log', error, {
      action: entry.action,
      userId: entry.userId,
    });
  }
}

/**
 * Create an audit logger bound to a specific user
 */
export function createUserAuditLogger(userId: string, userEmail?: string, ip?: string, userAgent?: string) {
  return {
    log: (
      action: AuditAction,
      options: {
        resource?: string;
        resourceId?: string;
        details?: Record<string, unknown>;
        success?: boolean;
        errorMessage?: string;
      } = {}
    ) => {
      return auditLog({
        action,
        userId,
        userEmail,
        ip,
        userAgent,
        success: options.success ?? true,
        resource: options.resource,
        resourceId: options.resourceId,
        details: options.details,
        errorMessage: options.errorMessage,
      });
    },

    success: (
      action: AuditAction,
      resource?: string,
      resourceId?: string,
      details?: Record<string, unknown>
    ) => {
      return auditLog({
        action,
        userId,
        userEmail,
        ip,
        userAgent,
        success: true,
        resource,
        resourceId,
        details,
      });
    },

    failure: (
      action: AuditAction,
      errorMessage: string,
      resource?: string,
      resourceId?: string,
      details?: Record<string, unknown>
    ) => {
      return auditLog({
        action,
        userId,
        userEmail,
        ip,
        userAgent,
        success: false,
        errorMessage,
        resource,
        resourceId,
        details,
      });
    },
  };
}

/**
 * Query audit logs for a specific user
 */
export async function getAuditLogsForUser(
  userId: string,
  options: {
    limit?: number;
    startAfter?: Date;
    action?: AuditAction;
  } = {}
): Promise<AuditLogEntry[]> {
  const db = getAdminDb();
  let query = db
    .collection(AUDIT_COLLECTION)
    .where('userId', '==', userId)
    .orderBy('timestamp', 'desc');

  if (options.action) {
    query = query.where('action', '==', options.action);
  }

  if (options.startAfter) {
    query = query.startAfter(options.startAfter);
  }

  query = query.limit(options.limit || 50);

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp?.toDate() || new Date(),
  })) as AuditLogEntry[];
}

/**
 * Delete old audit logs (for GDPR compliance or storage management)
 * Only deletes logs older than the specified number of days
 */
export async function cleanupOldAuditLogs(daysToKeep: number = 90): Promise<number> {
  const db = getAdminDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const snapshot = await db
    .collection(AUDIT_COLLECTION)
    .where('timestamp', '<', cutoffDate)
    .limit(500) // Process in batches
    .get();

  if (snapshot.empty) {
    return 0;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  logger.info('Cleaned up old audit logs', {
    count: snapshot.size,
    cutoffDate: cutoffDate.toISOString(),
  });

  return snapshot.size;
}
