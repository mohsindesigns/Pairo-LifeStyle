import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

export async function middleware(req) {
    // 1. Try default getToken (infers from req.url / NEXTAUTH_URL)
    let token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    
    // 2. Fallback: Force secure cookie check (Vercel production)
    if (!token) {
        token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, secureCookie: true });
    }
    
    // 3. Fallback: Force non-secure cookie check (misconfigured environments)
    if (!token) {
        token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, secureCookie: false });
    }

    const path = req.nextUrl.pathname;

    // 1. API Admin Protection
    if (path.startsWith("/api/admin")) {
        // Allow affiliates to view/download their own verification files through the requests document API route
        if (path === "/api/admin/affiliates/requests/document") {
            if (!token || (!token?.isStaff && !token?.isAffiliate)) {
                const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
                res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
                return res;
            }
        } else if (!token || !token?.isStaff) {
            const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
            return res;
        }
        const res = NextResponse.next();
        res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
        return res;
    }

    // 2. Admin Login Route — never index, disable tracking
    if (path === "/admin-login") {
        const requestHeaders = new Headers(req.headers);
        requestHeaders.set("x-is-admin", "true");
        requestHeaders.set("x-pathname", path);
        const res = NextResponse.next({
            request: { headers: requestHeaders }
        });
        res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
        return res;
    }

    // 3. UI Admin Protection
    if (path.startsWith("/admin")) {
        console.log(`[Middleware] Accessing ${path}`);
        
        // If not logged in at all, send to admin login page
        if (!token) {
            console.log(`[Middleware] No token found, redirecting to /admin-login`);
            const redirectRes = NextResponse.redirect(new URL("/admin-login?callbackUrl=" + encodeURIComponent(req.url), req.url));
            redirectRes.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
            return redirectRes;
        }
        // Must be staff to access any /admin route
        if (!token?.isStaff) {
            console.log(`[Middleware] Token found but isStaff is false, redirecting to /admin-login`);
            const redirectRes = NextResponse.redirect(new URL("/admin-login?error=Unauthorized", req.url));
            redirectRes.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
            return redirectRes;
        }

        // Module-Specific Protection
        const permissions = token.role?.permissions || {};
        const isSuperAdmin = token.role?.slug === 'super-admin';
        
        if (path.startsWith("/admin/customers") && !isSuperAdmin && !permissions.customers?.includes("view")) {
            const redirectRes = NextResponse.redirect(new URL("/admin?error=NoPermission", req.url));
            redirectRes.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
            return redirectRes;
        }
        
        if (path.startsWith("/admin/settings/team") && !isSuperAdmin && !permissions.staff?.includes("view")) {
            const redirectRes = NextResponse.redirect(new URL("/admin?error=NoPermission", req.url));
            redirectRes.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
            return redirectRes;
        }
        
        if (path.startsWith("/admin/settings/roles") && !isSuperAdmin && !permissions.staff?.includes("manage_roles")) {
            const redirectRes = NextResponse.redirect(new URL("/admin?error=NoPermission", req.url));
            redirectRes.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
            return redirectRes;
        }

        // Inject custom headers to allow layout server components to identify admin area
        const requestHeaders = new Headers(req.headers);
        requestHeaders.set("x-is-admin", "true");
        requestHeaders.set("x-pathname", path);

        const res = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });
        res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
        return res;
    }

    return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/admin-login",
    "/api/admin/:path*"
  ],
};
