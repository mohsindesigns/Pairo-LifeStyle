import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // 1. Basic Admin Area Protection
    if (path.startsWith("/admin")) {
        // Must be staff to access any /admin route
        if (!token?.isStaff) {
            return NextResponse.redirect(new URL("/login?error=Unauthorized", req.url));
        }

        // 2. Module-Specific Protection (Optional high-level check)
        // For more granular control, we use can() inside the pages/APIs.
        // But we can block entire sections here if needed.
        const permissions = token.role?.permissions || {};
        const isSuperAdmin = token.role?.slug === 'super-admin';
        
        if (path.startsWith("/admin/customers") && !isSuperAdmin && !permissions.customers?.includes("view")) {
            return NextResponse.redirect(new URL("/admin?error=NoPermission", req.url));
        }
        
        if (path.startsWith("/admin/settings/team") && !isSuperAdmin && !permissions.staff?.includes("view")) {
            return NextResponse.redirect(new URL("/admin?error=NoPermission", req.url));
        }
        
        if (path.startsWith("/admin/settings/roles") && !isSuperAdmin && !permissions.staff?.includes("manage_roles")) {
            return NextResponse.redirect(new URL("/admin?error=NoPermission", req.url));
        }

        // Inject custom headers to allow layout server components to identify admin area
        const requestHeaders = new Headers(req.headers);
        requestHeaders.set("x-is-admin", "true");
        requestHeaders.set("x-pathname", path);

        return NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*"
  ],
};
