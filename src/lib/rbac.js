/**
 * Centralized Permission Resolver for Pairo Enterprise RBAC
 */

export const PERMISSION_MODULES = {
    PRODUCTS: 'products',
    ORDERS: 'orders',
    CUSTOMERS: 'customers',
    BLOGS: 'blogs',
    STAFF: 'staff',
    SETTINGS: 'settings',
    ANALYTICS: 'analytics',
    MEDIA: 'media',
    PROMOTIONS: 'promotions',
    SEO: 'seo',
    SCRIPTS: 'scripts',
    PAGES: 'pages',
    SUBMISSIONS: 'submissions',
    REVIEWS: 'reviews'
};

export const ACTIONS = {
    VIEW: 'view',
    CREATE: 'create',
    EDIT: 'edit',
    DELETE: 'delete',
    PUBLISH: 'publish',
    REFUND: 'refund',
    UPDATE: 'update',
    MANAGE: 'manage',
    MANAGE_ROLES: 'manage_roles'
};

/**
 * Checks if a staff member has permission to perform an action on a module.
 * 
 * @param {Object} staff - The staff object from the session (must include role and permissions)
 * @param {string} permissionKey - Format: "module.action" (e.g., "products.create")
 * @returns {boolean}
 */
export function can(staff, permissionKey) {
    if (!staff) return false;
    
    // Normalize role location (NextAuth session might store it as role or roleId)
    const role = staff.role || staff.roleId;
    if (!role) return false;

    // Super Admin Bypass
    if (role.slug === 'super-admin') return true;

    if (!permissionKey.includes('.')) {
        console.warn(`Invalid permission key format: ${permissionKey}. Expected "module.action"`);
        return false;
    }

    const [module, action] = permissionKey.split('.');
    
    // Check if the role has this specific action for the module
    const rolePermissions = role.permissions || {};
    const moduleActions = rolePermissions[module] || [];

    return moduleActions.includes(action);
}

/**
 * Utility to group permissions for the UI Matrix
 */
export const ALL_PERMISSIONS = {
    [PERMISSION_MODULES.PRODUCTS]: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE],
    [PERMISSION_MODULES.ORDERS]: [ACTIONS.VIEW, ACTIONS.UPDATE, ACTIONS.REFUND],
    [PERMISSION_MODULES.CUSTOMERS]: [ACTIONS.VIEW, ACTIONS.EDIT, ACTIONS.DELETE],
    [PERMISSION_MODULES.BLOGS]: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.PUBLISH, ACTIONS.DELETE],
    [PERMISSION_MODULES.STAFF]: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE, ACTIONS.MANAGE_ROLES],
    [PERMISSION_MODULES.SCRIPTS]: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE, ACTIONS.PUBLISH],
    [PERMISSION_MODULES.PROMOTIONS]: [ACTIONS.VIEW, ACTIONS.MANAGE],
    [PERMISSION_MODULES.SEO]: [ACTIONS.VIEW, ACTIONS.EDIT, 'sitemap', 'schema'],
    [PERMISSION_MODULES.SETTINGS]: [ACTIONS.VIEW, ACTIONS.EDIT, ACTIONS.MANAGE],
    [PERMISSION_MODULES.ANALYTICS]: [ACTIONS.VIEW],
    [PERMISSION_MODULES.MEDIA]: [ACTIONS.MANAGE],
    [PERMISSION_MODULES.PAGES]: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE, ACTIONS.PUBLISH],
    [PERMISSION_MODULES.SUBMISSIONS]: [ACTIONS.VIEW, 'reply', 'assign', ACTIONS.DELETE, 'export', 'manage_spam'],
    [PERMISSION_MODULES.REVIEWS]: [ACTIONS.VIEW, ACTIONS.EDIT, ACTIONS.DELETE, 'moderate']
};
