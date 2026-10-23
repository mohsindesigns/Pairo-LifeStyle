"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Page, PageHeader, Notice } from "@/components/admin/ui";
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
    <Page>
      <PageHeader title="Edit script" />
      <p className="wp-muted" role="status">Loading script configuration…</p>
    </Page>
  );

  if (!script) return (
    <Page>
      <PageHeader title="Script not found" />
      <Notice type="error">The requested script configuration could not be found.</Notice>
      <Link href="/admin/settings/scripts" className="wp-link">← Back to Scripts</Link>
    </Page>
  );

  return (
    <Page>
      <PageHeader
        title="Edit script"
        actions={<Link href="/admin/settings/scripts/new" className="wp-btn">Add new script</Link>}
      />
      <p style={{ margin: "0 0 14px" }}>
        <Link href="/admin/settings/scripts" className="wp-link">← Back to Scripts</Link>
        <span className="wp-muted" suppressHydrationWarning> · Version {script.version || 1} · Last updated {new Date(script.updatedAt).toLocaleString()}</span>
      </p>
      <ScriptEditor initialData={script} isEdit={true} />
    </Page>
  );
}
