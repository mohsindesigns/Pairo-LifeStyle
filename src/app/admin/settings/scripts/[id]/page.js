"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import ScriptEditor from "@/components/admin/ScriptEditor";
import { toast } from "react-hot-toast";

export default function EditScriptPage() {
  const { id } = useParams();
  const [script, setScript] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScript = async () => {
      try {
        const res = await fetch(`/api/admin/scripts/${id}`);
        const data = await res.json();
        if (res.ok) {
          setScript(data);
        } else {
          toast.error(data.error || "Failed to load script");
        }
      } catch (err) {
        toast.error("Network error");
      } finally {
        setLoading(false);
      }
    };
    fetchScript();
  }, [id]);

  if (loading) return (
     <AdminPageLayout title="Edit Script" breadcrumbs={[]}>
        <div className="p-6 md:p-20 text-center italic text-gray-400">Loading script configuration...</div>
     </AdminPageLayout>
  );

  if (!script) return (
     <AdminPageLayout title="Script Not Found" breadcrumbs={[]}>
        <div className="p-6 md:p-20 text-center text-red-500">The requested script configuration could not be found.</div>
     </AdminPageLayout>
  );

  return (
    <AdminPageLayout 
      title={`Edit: ${script.name}`} 
      subtitle={`Version ${script.version || 1} • Last updated ${new Date(script.updatedAt).toLocaleString()}`}
      breadcrumbs={[
        { label: "Settings", href: "/admin/settings" },
        { label: "Scripts", href: "/admin/settings/scripts" },
        { label: "Edit Script" }
      ]}
    >
      <ScriptEditor initialData={script} isEdit={true} />
    </AdminPageLayout>
  );
}
