import AuditLog from "@/models/AuditLog";

// Keys whose values must never be written to (or shown from) the audit log: password hashes, reset / verification
// tokens, API keys and secrets. The log is readable by every role that can open Settings > Audit Log, so a hash stored
// here would be as good as published. The key stays in the entry, with the value replaced, so a diff still shows that
// the field changed.
const SECRET_KEY = /password$|passwd$|passwordhash$|token|secret|api[_-]?key|^authorization$|^bankinginfo$/i;
export const REDACTED = "[redacted]";

const isPlainObject = (value) => {
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
};

/** Deep copy of `value` with every secret-looking key's value replaced. Dates, ObjectIds and other non-plain values are kept as they are. */
export function redactSecrets(value, depth = 0) {
    if (value === null || typeof value !== "object" || depth > 10) return value;
    if (typeof value.toObject === "function") value = value.toObject(); // a Mongoose document
    if (Array.isArray(value)) return value.map((item) => redactSecrets(item, depth + 1));
    if (!isPlainObject(value)) return value;
    const out = {};
    for (const [key, item] of Object.entries(value)) {
        out[key] = SECRET_KEY.test(key) && item !== undefined && item !== null && item !== "" ? REDACTED : redactSecrets(item, depth + 1);
    }
    return out;
}

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
            details: redactSecrets(details),
            ip,
            userAgent
        });
    } catch (error) {
        console.error("Audit Logging Failed:", error);
    }
}
