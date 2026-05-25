import AuditLog from "@/models/AuditLog";

/**
 * Logs an administrative action to the AuditLog collection.
 * 
 * @param {Object} req - The request object (to extract IP/UserAgent)
 * @param {Object} session - The staff session
 * @param {string} action - Action slug (e.g. 'UPDATE_PRODUCT')
 * @param {string} resource - Resource name (e.g. 'products')
 * @param {Object} details - { before, after, message }
 * @param {string} [resourceId=null] - Optional ID of the resource
 */
export async function logAction(req, session, action, resource, details = {}, resourceId = null) {
    try {
        const ip = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
        const userAgent = req.headers.get('user-agent') || 'unknown';

        await AuditLog.create({
            staffId: session.user.id,
            action,
            resource,
            resourceId: resourceId || details?.resourceId || null,
            details,
            ip,
            userAgent
        });
    } catch (error) {
        console.error("Audit Logging Failed:", error);
    }
}
