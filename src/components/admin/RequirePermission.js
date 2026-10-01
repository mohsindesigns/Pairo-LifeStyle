"use client";

import { useSession } from "next-auth/react";
import { can } from "@/lib/rbac";

/**
 * Page-level permission gate for admin pages. Middleware only confirms the visitor is SOME
 * staff member — it doesn't know which role-specific permission a given page needs, so
 * without this, any staff account could open the full UI (forms, tables, buttons) of a page
 * their role was never granted access to, and only discover they're blocked when the
 * underlying API call 403s on save. This renders a clear "no permission" message instead,
 * matching what the sidebar already hides.
 *
 * `permission` accepts either a single "module.action" string, or an array of them — pass an
 * array for a page backed by more than one permission module (any one being true is enough).
 */
export default function RequirePermission({ permission, children }) {
  const { data: session, status } = useSession();

  if (status === "loading") return null;

  const permissions = Array.isArray(permission) ? permission : [permission];
  const allowed = permissions.some((p) => can(session?.user, p));

  if (!allowed) {
    return (
      <div className="bg-white border border-[#ccd0d4] p-6 text-[13px] text-[#646970] m-4 rounded-[3px]">
        You don&apos;t have permission to view this page.
      </div>
    );
  }

  return children;
}
