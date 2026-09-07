"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import AdminSidebar from "@/components/admin/Sidebar";
import AdminTopbar from "@/components/admin/Topbar";
import AuthProvider from "@/components/providers/AuthProvider";
import { toast } from "react-hot-toast";

function PermissionErrorToast() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "NoPermission") {
      toast.error("You do not have permission to access that section.", {
        id: "no-permission-error",
      });
      // Clean up the URL parameter cleanly
      const params = new URLSearchParams(window.location.search);
      params.delete("error");
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [searchParams]);

  return null;
}

function AdminGuard({ children }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Lock the page behind the mobile drawer while it is open
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("admin-drawer-open", sidebarOpen);
    return () => document.body.classList.remove("admin-drawer-open");
  }, [sidebarOpen]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin-login");
    } else if (status === "authenticated" && !session?.user?.isStaff) {
      router.push("/");
    }
  }, [status, session, router]);

  if (status === "loading" || (status === "authenticated" && !session?.user?.isStaff)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f0f1] font-sans selection:bg-[#2271b1] selection:text-white admin-dashboard-container">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="pl-0 md:pl-[160px] flex flex-col min-h-screen admin-content-column">
        <AdminTopbar onMenuToggle={() => setSidebarOpen((v) => !v)} menuOpen={sidebarOpen} />
        <main className="flex-1 bg-[#f0f2f1]">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }) {
  return (
    <AuthProvider>
      <AdminGuard>
        <Suspense fallback={null}>
          <PermissionErrorToast />
        </Suspense>
        {children}
      </AdminGuard>
    </AuthProvider>
  );
}

