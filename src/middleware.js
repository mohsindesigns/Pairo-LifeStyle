import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

export async function middleware(req) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const path = req.nextUrl.pathname;

    // 1. API Admin Protection
    if (path.startsWith("/api/admin")) {
        if (!token || !token?.isStaff) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.next();
    }

    // 2. UI Admin Protection
    if (path.startsWith("/admin")) {
        console.log(`[Middleware] Accessing ${path}`);
        console.log(`[Middleware] Token:`, token);
        
        // If not logged in at all, send to admin login page
        if (!token) {
            console.log(`[Middleware] No token found, redirecting to /admin-login`);
            return NextResponse.redirect(new URL("/admin-login?callbackUrl=" + encodeURIComponent(req.url), req.url));
        }
        // Must be staff to access any /admin route
        if (!token?.isStaff) {
            console.log(`[Middleware] Token found but isStaff is false, redirecting to /admin-login`);
            return NextResponse.redirect(new URL("/admin-login?error=Unauthorized", req.url));
        }

        // 3. Module-Specific Protection (Optional high-level check)
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
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*"
  ],
};
