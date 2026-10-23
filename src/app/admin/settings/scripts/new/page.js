import Link from "next/link";
import { Page, PageHeader } from "@/components/admin/ui";
import ScriptEditor from "@/components/admin/ScriptEditor";

export default function NewScriptPage() {
  return (
    <Page>
      <PageHeader title="Add new script" />
      <p style={{ margin: "0 0 14px" }}>
        <Link href="/admin/settings/scripts" className="wp-link">← Back to Scripts</Link>
        <span className="wp-muted"> · Create a new tracking pixel or custom code injection.</span>
      </p>
      <ScriptEditor />
    </Page>
  );
}
