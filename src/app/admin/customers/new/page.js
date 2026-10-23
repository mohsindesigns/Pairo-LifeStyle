"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { Page, PageHeader, Postbox, Notice } from "@/components/admin/ui";
import { toast } from "react-hot-toast";
import RequirePermission from "@/components/admin/RequirePermission";

function generatePassword(length = 16) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

export default function NewCustomer() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field) => (e) => setFormData({ ...formData, [field]: e.target.value });

  const handleGenerate = () => {
    setFormData({ ...formData, password: generatePassword() });
    setShowPassword(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data._id) {
        toast.success("Customer created successfully!");
        router.push(`/admin/customers/${data._id}`);
        return;
      }
      setError(data.error || "Failed to create customer.");
    } catch (err) {
      console.error(err);
      setError("Failed to create customer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RequirePermission permission="customers.edit">
    <Page>
      <PageHeader title="Add new customer" />
      <p className="wp-muted" style={{ margin: "0 0 14px" }}>
        Create a brand new customer account. <Link href="/admin/customers" className="wp-link">Back to Customers</Link>
      </p>

      {error && <Notice type="error" onDismiss={() => setError("")}>{error}</Notice>}

      <form onSubmit={handleSubmit} className="wp-cols">
        <div className="wp-col-main">
          <Postbox id="new-customer-account" title="Account details">
            <div className="grid gap-x-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              <div className="wp-field">
                <label htmlFor="new-customer-first" className="wp-label">First name</label>
                <input id="new-customer-first" type="text" className="wp-input wp-full" autoComplete="off" value={formData.firstName} onChange={set("firstName")} />
              </div>
              <div className="wp-field">
                <label htmlFor="new-customer-last" className="wp-label">Last name</label>
                <input id="new-customer-last" type="text" className="wp-input wp-full" autoComplete="off" value={formData.lastName} onChange={set("lastName")} />
              </div>
              <div className="wp-field">
                <label htmlFor="new-customer-email" className="wp-label">Email <span className="wp-muted" style={{ fontWeight: 400 }}>(required)</span></label>
                <input id="new-customer-email" type="email" required className="wp-input wp-full" autoComplete="off" value={formData.email} onChange={set("email")} />
              </div>
              <div className="wp-field">
                <label htmlFor="new-customer-phone" className="wp-label">Phone</label>
                <input id="new-customer-phone" type="tel" className="wp-input wp-full" autoComplete="off" value={formData.phone} onChange={set("phone")} />
              </div>
            </div>
            <div className="wp-field" style={{ marginBottom: 0 }}>
              <label htmlFor="new-customer-password" className="wp-label">Password <span className="wp-muted" style={{ fontWeight: 400 }}>(required)</span></label>
              <div className="flex flex-wrap gap-2">
                <input
                  id="new-customer-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  className="wp-input"
                  style={{ flex: "1 1 200px", minWidth: 0 }}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={set("password")}
                />
                <button type="button" className="wp-btn" onClick={handleGenerate}>Generate</button>
                <button
                  type="button"
                  className="wp-btn"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <p className="wp-desc">At least 8 characters. Share it with the customer securely; the account can sign in right away.</p>
            </div>
          </Postbox>
        </div>

        <div className="wp-col-side">
          <Postbox
            id="new-customer-publish"
            title="Publish"
            flush
            footer={
              <>
                <Link href="/admin/customers" className="wp-link" style={{ color: "var(--wp-danger)" }}>Cancel</Link>
                <span className="wp-spacer" />
                <button type="submit" disabled={saving} className="wp-btn wp-btn-primary">
                  {saving ? "Adding…" : "Add new customer"}
                </button>
              </>
            }
          >
            <div className="wp-misc">
              <div className="wp-misc-row"><span>Role:</span><span className="wp-strong">Customer</span></div>
              <div className="wp-misc-row"><span>Email verified:</span><span className="wp-strong">Yes (created by staff)</span></div>
            </div>
          </Postbox>
        </div>
      </form>
    </Page>
    </RequirePermission>
  );
}
