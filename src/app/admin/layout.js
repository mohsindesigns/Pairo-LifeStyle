"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import AdminSidebar from "@/components/admin/Sidebar";
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
      <AdminSidebar />
      <div className="pl-[200px] flex flex-col min-h-screen">
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

