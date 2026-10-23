"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "react-hot-toast";
import { usePopup } from "@/context/PopupContext";
import { Page, PageHeader, Postbox, Notice, Skeleton, formatMoney } from "@/components/admin/ui";
import { Eye, X, ExternalLink, FileText, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { paginate } from "@/lib/admin-products-utils";
import { joinReasons } from "@/app/api/admin/affiliates/list/trash-utils";
import ThemedSelect from "@/components/ui/ThemedSelect";

const AFFILIATE_TABS = ["overview", "requests", "list", "links", "orders", "conversions", "commissions", "payouts", "analytics", "settings"];

export default function AffiliatesManagerClient() {
  const { showConfirm, showAlert } = usePopup();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // The active tab lives in ?view= (same URLs the sidebar links to); no view = overview.
  const viewParam = searchParams.get("view");
  const activeTab = AFFILIATE_TABS.includes(viewParam) ? viewParam : "overview";
  const setActiveTab = (tab) => {
    if (tab === activeTab) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", tab);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };
  const [loading, setLoading] = useState(true);

  // States
  const [applications, setApplications] = useState([]);
  const [affiliates, setAffiliates] = useState([]);
  const [trashedAffiliates, setTrashedAffiliates] = useState([]);
  const [listPage, setListPage] = useState(1);
  const [appPage, setAppPage] = useState(1);
  const [payouts, setPayouts] = useState([]);
  const [settings, setSettings] = useState({
    defaultCommissionRate: 5,
    cookieDurationDays: 30,
    minimumPayoutAmount: 50,
    autoApproveApplications: false,
    supportEmail: "support@pairolifestyle.com"
  });

  // Action / Edit Modal States
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);
  const [selectedPayout, setSelectedPayout] = useState(null);
  // Affiliate / application id with a request in flight (disables its row actions)
  const [busyId, setBusyId] = useState(null);
  // Review Application inputs
  const [reviewAction, setReviewAction] = useState("Approve");
  const [rejectionReason, setRejectionReason] = useState("");
  const [notes, setNotes] = useState("");
  const [customCommissionRate, setCustomCommissionRate] = useState(5);
  const [commissionType, setCommissionType] = useState("Percentage");
  const [reviewDiscountType, setReviewDiscountType] = useState("None");
  const [reviewDiscountValue, setReviewDiscountValue] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Edit Affiliate inputs
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    commissionRate: 5,
    commissionType: "Percentage",
    customerDiscountType: "None",
    customerDiscountValue: 0,
    status: "Active",
    couponCode: "",
    password: "",
    createdAt: ""
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Payout inputs
  const [payoutAction, setPayoutAction] = useState("Approve");
  const [payoutTxId, setPayoutTxId] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [submittingPayout, setSubmittingPayout] = useState(false);

  // Save Settings state
  const [savingSettings, setSavingSettings] = useState(false);

  // Document Modal Viewer
  const [viewingDocUrl, setViewingDocUrl] = useState(null);

  // Viewing Application Details Modal
  const [viewingApplication, setViewingApplication] = useState(null);

  // Applications filter
  const [appStatusFilter, setAppStatusFilter] = useState("All");
  const [appSearchQuery, setAppSearchQuery] = useState("");

  // List filter states
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [listStatusFilter, setListStatusFilter] = useState("All");

  // Payout filter states
  const [payoutStatusFilter, setPayoutStatusFilter] = useState("All");
  const [payoutSearchQuery, setPayoutSearchQuery] = useState("");

  // Other search states
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [clickSearchQuery, setClickSearchQuery] = useState("");
  const [commissionStatusFilter, setCommissionStatusFilter] = useState("All");
  const [commissionSearchQuery, setCommissionSearchQuery] = useState("");

  // Referral Code states for review/edit modals
  const [reviewReferralCode, setReviewReferralCode] = useState("");
  const [editReferralCode, setEditReferralCode] = useState("");
  const [referralCodeError, setReferralCodeError] = useState("");

  // Overview stats & activity
  const [overviewStats, setOverviewStats] = useState(null);
  const [activityData, setActivityData] = useState({ clicks: [], commissions: [], referredOrders: [] });
  const [autoPromos, setAutoPromos] = useState([]);
  const [disablingPromos, setDisablingPromos] = useState(false);

  const loadData = async ({ initial = false } = {}) => {
    if (!initial) setLoading(true);
    try {
      const [reqsRes, affsRes, paysRes, settsRes, ovRes, actRes, promoRes] = await Promise.all([
        fetch("/api/admin/affiliates/requests").then(r => r.json()),
        fetch("/api/admin/affiliates/list?includeTrashed=1").then(r => r.json()),
        fetch("/api/admin/affiliates/payouts").then(r => r.json()),
        fetch("/api/admin/affiliates/settings").then(r => r.json()),
        fetch("/api/admin/affiliates/overview").then(r => r.json()).catch(() => ({})),
        fetch("/api/admin/affiliates/activity").then(r => r.json()).catch(() => ({})),
        fetch("/api/admin/promotions?status=Active").then(r => r.json()).catch(() => ([]))
      ]);

      if (reqsRes.success) setApplications(reqsRes.applications);
      if (affsRes.success) {
        setAffiliates(affsRes.affiliates);
        setTrashedAffiliates(affsRes.trashed || []);
      }
      if (paysRes.success) setPayouts(paysRes.payouts);
      if (settsRes.success) setSettings(settsRes.settings);
      if (ovRes.success) setOverviewStats(ovRes);
      if (actRes.success) setActivityData(actRes);
      // Filter only automatic active promotions
      const promos = Array.isArray(promoRes) ? promoRes : [];
      setAutoPromos(promos.filter(p => p.isAutomatic));
    } catch (e) {
      toast.error("Failed to load administration database records.");
    } finally {
      setLoading(false);
    }
  };

  // Load once on mount; actions call loadData() explicitly afterwards. Switching tabs
  // only changes ?view= and must not refetch everything.
  useEffect(() => {
    // initial: true skips the synchronous setLoading(true) (loading already starts true);
    // state is only set after the fetches resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData({ initial: true });
  }, []);

  const resetReviewForm = (app = null) => {
    setReviewAction("Approve");
    setRejectionReason("");
    setNotes("");
    setCustomCommissionRate(settings.defaultCommissionRate || 5);
    setCommissionType("Percentage");
    setReviewDiscountType("None");
    setReviewDiscountValue("");
    setReviewReferralCode(app?.referralCode || "");
    setReferralCodeError("");
  };

  const closeReviewApplication = () => {
    setSelectedApplication(null);
    resetReviewForm();
  };

  const openPayout = (pay, txId) => {
    setSelectedPayout(pay);
    setPayoutAction("Approve");
    setPayoutTxId(txId);
    setPayoutNotes("");
  };

  const closePayout = () => {
    setSelectedPayout(null);
    setPayoutAction("Approve");
    setPayoutTxId("");
    setPayoutNotes("");
  };

  const handleApplicationReview = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      const res = await fetch("/api/admin/affiliates/requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: selectedApplication._id,
          action: reviewAction,
          notes,
          rejectionReason,
          customCommissionRate,
          commissionType,
          customerDiscountType: reviewAction === "Approve" ? reviewDiscountType : undefined,
          customerDiscountValue: reviewAction === "Approve" ? Number(reviewDiscountValue) || 0 : undefined,
          referralCode: reviewReferralCode || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process review.");

      toast.success(reviewAction === "Approve" ? "Application approved!" : "Application rejected.");
      closeReviewApplication();
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleAffiliateEditSubmit = async (e) => {
    e.preventDefault();
    setSubmittingEdit(true);
    try {
      // Find current affiliate version to enforce Optimistic Concurrency Control (OCC)
      const currentAff = affiliates.find(a => a._id === selectedAffiliate._id);
      const res = await fetch("/api/admin/affiliates/list", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliateId: selectedAffiliate._id,
          __v: currentAff?.__v,
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone,
          dob: editForm.dob || undefined,
          commissionRate: editForm.commissionRate,
          commissionType: editForm.commissionType,
          customerDiscountType: editForm.customerDiscountType,
          customerDiscountValue: Number(editForm.customerDiscountValue) || 0,
          status: editForm.status,
          couponCode: editForm.couponCode,
          password: editForm.password,
          referralCode: editReferralCode || undefined,
          companyName: editForm.companyName,
          website: editForm.website,
          address: {
            street: editForm.street,
            city: editForm.city,
            state: editForm.state,
            zipCode: editForm.zipCode,
            country: editForm.country,
          },
          bankingInfo: {
            accountHolder: editForm.accountHolder,
            bankName: editForm.bankName,
            accountNumber: editForm.accountNumber,
            iban: editForm.iban,
            swiftCode: editForm.swiftCode,
            routingNumber: editForm.routingNumber,
            paypalEmail: editForm.paypalEmail,
          },
          createdAt: editForm.createdAt ? new Date(editForm.createdAt).toISOString() : undefined,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save affiliate settings.");

      toast.success("Affiliate settings saved.");
      setSelectedAffiliate(null);
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingEdit(false);    }
  };
  // Runs one row request; returns true on success. Errors are toasted.
  const runRowRequest = async (id, request, successMsg) => {
    setBusyId(id);
    try {
      const res = await request();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Request failed.");
      toast.success(data.message || successMsg);
      await loadData();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleAffiliateStatus = async (aff) => {
    const next = aff.status === "Active" ? "Suspended" : "Active";
    if (next === "Suspended" && !(await showConfirm(
      `Suspend ${aff.name}? They are signed out, can't log in, and their referral links and coupon stop earning until you activate them again.`,
      "Suspend affiliate",
      { confirmText: "Suspend", danger: true }
    ))) return;
    await runRowRequest(aff._id, () => fetch("/api/admin/affiliates/list", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ affiliateId: aff._id, __v: aff.__v, status: next })
    }), next === "Active" ? "Affiliate activated." : "Affiliate suspended.");
  };

  const handleTrashAffiliate = async (aff) => {
    if (!(await showConfirm(
      `Move ${aff.name} to the Trash? The account is suspended (no login, no new commissions). Commissions, payouts and history are kept, and you can restore it later.`,
      "Move to Trash",
      { confirmText: "Move to Trash" }
    ))) return;
    await runRowRequest(aff._id, () => fetch(`/api/admin/affiliates/list?id=${aff._id}`, { method: "DELETE" }), "Affiliate moved to Trash.");
  };

  const handleRestoreAffiliate = (aff) =>
    runRowRequest(aff._id, () => fetch("/api/admin/affiliates/list", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ affiliateId: aff._id, action: "restore" })
    }), "Affiliate restored.");

  const handleDeleteAffiliatePermanently = async (aff) => {
    if (aff.deleteBlockers?.length) {
      await showAlert(
        `${aff.name} has ${joinReasons(aff.deleteBlockers)}. That financial history must be kept, so this affiliate stays in the Trash (suspended) instead of being deleted.`,
        "Can't delete permanently"
      );
      return;
    }
    if (!(await showConfirm(
      `Permanently delete ${aff.name}? This cannot be undone.`,
      "Delete permanently",
      { confirmText: "Delete permanently", danger: true }
    ))) return;
    await runRowRequest(aff._id, () => fetch(`/api/admin/affiliates/list?id=${aff._id}&permanent=1`, { method: "DELETE" }), "Affiliate deleted permanently.");
  };

  const handleDeleteApplication = async (app) => {
    if (!(await showConfirm(
      `Delete the application from ${app.name}? This cannot be undone.${app.status === "Approved" ? " Their affiliate account is not affected." : ""}`,
      "Delete application",
      { confirmText: "Delete", danger: true }
    ))) return;
    const ok = await runRowRequest(app._id, () => fetch(`/api/admin/affiliates/requests?id=${app._id}`, { method: "DELETE" }), "Application deleted.");
    if (ok && viewingApplication?._id === app._id) setViewingApplication(null);
  };

  const handlePayoutProcess = async (e) => {
    e.preventDefault();
    setSubmittingPayout(true);
    try {
      const res = await fetch("/api/admin/affiliates/payouts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payoutId: selectedPayout._id,
          action: payoutAction,
          transactionId: payoutTxId,
          notes: payoutNotes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process payout.");

      toast.success(payoutAction === "Approve" ? "Payout marked as Paid!" : "Payout request rejected and refunded.");
      closePayout();
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingPayout(false);
    }
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/affiliates/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update configurations.");

      toast.success("Global configurations updated.");
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const getDocumentUrl = (doc) => {
    if (!doc) return "";
    if (doc.startsWith("http") || doc.startsWith("/") || doc.startsWith("blob:")) return doc;
    return `/api/admin/affiliates/requests/document?file=${encodeURIComponent(doc)}`;
  };

  if (loading) {
    return (
      <Page>
        <PageHeader title="Affiliates" />
        <div className="wp-postbox">
          <div className="wp-inside space-y-3">
            <span className="sr-only">Loading affiliate records…</span>
            <Skeleton height={20} width="40%" />
            <Skeleton height={14} />
            <Skeleton height={14} />
            <Skeleton height={14} width="80%" />
          </div>
        </div>
      </Page>
    );
  }

  const openEditAffiliate = (aff) => {
    setSelectedAffiliate(aff);
    setEditReferralCode(aff.referralCode || "");
    setEditForm({
      name: aff.name || "",
      email: aff.email || "",
      phone: aff.phone || "",
      dob: aff.dob ? new Date(aff.dob).toISOString().split('T')[0] : "",
      commissionRate: aff.commissionRate ?? 5,
      commissionType: aff.commissionType || "Percentage",
      customerDiscountType: aff.customerDiscountType || "None",
      customerDiscountValue: aff.customerDiscountValue || 0,
      status: aff.status || "Active",
      couponCode: aff.couponCode || "",
      password: "",
      // Address
      street: aff.address?.street || "",
      city: aff.address?.city || "",
      state: aff.address?.state || "",
      zipCode: aff.address?.zipCode || "",
      country: aff.address?.country || "",
      // Banking
      accountHolder: aff.bankingInfo?.accountHolder || "",
      bankName: aff.bankingInfo?.bankName || "",
      accountNumber: aff.bankingInfo?.accountNumber || "",
      iban: aff.bankingInfo?.iban || "",
      swiftCode: aff.bankingInfo?.swiftCode || "",
      routingNumber: aff.bankingInfo?.routingNumber || "",
      paypalEmail: aff.bankingInfo?.paypalEmail || "",
      // Business
      companyName: aff.businessInfo?.companyName || "",
      website: aff.businessInfo?.website || "",
      createdAt: aff.createdAt ? new Date(aff.createdAt).toISOString().slice(0, 16) : "",
    });
  };

  // Every way of opening the review dialog initialises all review fields from this application.
  const openReviewApplication = (app, action = "Approve") => {
    resetReviewForm(app);
    setReviewAction(action);
    setSelectedApplication(app);
  };

  return (
    <Page>
      <PageHeader title="Affiliates" />

      {/* View switcher */}
      <div className="wp-tabs" role="tablist" aria-label="Affiliate sections">
        {[
          { id: "overview", label: "Overview", count: null },
          { id: "requests", label: "Applications", count: applications.filter(a => a.status === 'Pending').length },
          { id: "list", label: "Affiliates", count: affiliates.length },
          { id: "links", label: "Referral Links", count: null },
          { id: "orders", label: "Referred Orders", count: activityData.referredOrders?.length ?? null },
          { id: "conversions", label: "Conversions", count: null },
          { id: "commissions", label: "Commissions", count: activityData.commissions?.length ?? null },
          { id: "payouts", label: "Payout Requests", count: payouts.filter(p => p.status === 'Requested').length },
          { id: "analytics", label: "Analytics", count: null },
          { id: "settings", label: "Global Settings", count: null }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="wp-tab min-h-10"
          >
            {tab.label}
            {tab.count !== null && <span className="wp-muted" style={{ fontWeight: 400 }}> ({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* Summary strip (shown for all tabs except Overview) */}
      {activeTab !== "overview" && (
        <div className="wp-stats">
          {[
            { id: "list", label: "Active partners", value: affiliates.filter(a => a.status === "Active").length },
            { id: "requests", label: "Pending reviews", value: applications.filter(a => a.status === 'Pending').length },
            { id: "payouts", label: "Pending payouts", value: payouts.filter(p => p.status === 'Requested').length },
            { id: "settings", label: "Default commission", value: `${settings.defaultCommissionRate}%` }
          ].map(card => (
            <StatButton key={card.id} label={card.label} value={card.value} onClick={() => setActiveTab(card.id)} />
          ))}
        </div>
      )}

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div>
          {[
            [
              { label: "Total affiliates", value: overviewStats?.stats?.totalAffiliates ?? affiliates.length, tab: "list" },
              { label: "Total clicks", value: overviewStats?.stats?.totalClicks ?? 0, tab: "conversions" },
              { label: "Referred orders", value: overviewStats?.stats?.totalReferralOrders ?? 0, tab: "orders" },
              { label: "Conversion rate", value: `${overviewStats?.stats?.conversionRate ?? 0}%`, tab: "conversions" },
            ],
            [
              { label: "Total revenue", value: formatMoney(overviewStats?.stats?.totalRevenue ?? 0), tab: "analytics" },
              { label: "Commission paid", value: formatMoney(overviewStats?.stats?.totalCommissionPaid ?? 0), tab: "commissions" },
              { label: "Pending commission", value: formatMoney(overviewStats?.stats?.pendingCommission ?? 0), tab: "commissions" },
              { label: "Total paid out", value: formatMoney(overviewStats?.stats?.totalPaid ?? 0), tab: "payouts" },
            ],
          ].map((strip, i) => (
            <div key={i} className="wp-stats">
              {strip.map(({ label, value, tab }) => (
                <StatButton key={label} label={label} value={value} onClick={() => setActiveTab(tab)} />
              ))}
            </div>
          ))}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-5">
            <Postbox id="aff-top" title="Top performing partners" aside="Lifetime" flush>
              {overviewStats?.topAffiliates?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="wp-list-table">
                    <thead>
                      <tr>
                        <th scope="col">Affiliate</th>
                        <th scope="col">Code</th>
                        <th scope="col" className="wp-num">Earnings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overviewStats.topAffiliates.map(a => (
                        <tr key={a._id}>
                          <td>
                            <div className="flex items-center gap-2">
                              <span className="wp-avatar" style={{ width: 28, height: 28, fontSize: 12 }} aria-hidden="true">{a.name?.charAt(0)}</span>
                              <span className="wp-strong">{a.name}</span>
                            </div>
                          </td>
                          <td className="font-mono">{a.referralCode}</td>
                          <td className="wp-num wp-strong">{formatMoney(a.lifetimeEarnings ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="wp-empty" style={{ padding: "14px 12px" }}>No partner performance records found.</p>
              )}
            </Postbox>

            <Postbox id="aff-recent" title="Recent referred orders" aside="Latest" flush>
              {overviewStats?.recentOrders?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="wp-list-table">
                    <thead>
                      <tr>
                        <th scope="col">Order</th>
                        <th scope="col" className="wp-hide-sm">Ref code</th>
                        <th scope="col" className="wp-num">Total</th>
                        <th scope="col" className="wp-num wp-hide-sm">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overviewStats.recentOrders.map(o => (
                        <tr key={o._id}>
                          <td>
                            <span className="wp-strong font-mono">{o.orderNumber}</span>
                            <div className="wp-mobile-meta">{o.affiliateReferralCode} · {new Date(o.createdAt).toLocaleDateString()}</div>
                          </td>
                          <td className="wp-hide-sm font-mono">{o.affiliateReferralCode}</td>
                          <td className="wp-num wp-strong">{formatMoney(o.financials?.total ?? 0)}</td>
                          <td className="wp-num wp-muted wp-hide-sm">{new Date(o.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="wp-empty" style={{ padding: "14px 12px" }}>No referred orders tracked yet.</p>
              )}
            </Postbox>
          </div>

          {!overviewStats && (
            <Notice type="info">No overview data available yet. Stats will appear once affiliates generate activity.</Notice>
          )}
        </div>
      )}

      {/* Tab: Referral Links */}
      {activeTab === "links" && (
        <div className="wp-table-box">
          <table className="wp-list-table">
            <thead>
              <tr>
                <th scope="col">Affiliate</th>
                <th scope="col">Code</th>
                <th scope="col" className="wp-hide-sm">Customer discount</th>
                <th scope="col" className="wp-hide-sm">Referral link</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {affiliates.length === 0 ? (
                <tr><td colSpan="5" className="wp-muted">No active affiliates registered.</td></tr>
              ) : affiliates.map(aff => {
                const link = typeof window !== 'undefined' ? `${window.location.origin}/?ref=${aff.referralCode}` : `https://pairolifestyle.com/?ref=${aff.referralCode}`;
                const discountLabel = aff.customerDiscountType === 'None' || !aff.customerDiscountValue ? 'None' :
                  aff.customerDiscountType === 'Percentage' ? `${aff.customerDiscountValue}% Off` : `$${aff.customerDiscountValue} Off`;
                return (
                  <tr key={aff._id}>
                    <td style={{ wordBreak: "break-word" }}>
                      <span className="wp-strong">{aff.name}</span>
                      <div className="wp-muted wp-small">{aff.email}</div>
                      <div className="wp-mobile-meta">Discount: {discountLabel}</div>
                    </td>
                    <td className="font-mono wp-strong">{aff.referralCode}</td>
                    <td className="wp-hide-sm">
                      <span className={`wp-pill wp-pill-sm ${discountLabel === 'None' ? '' : 'wp-st-paid'}`}>{discountLabel}</span>
                    </td>
                    <td className="wp-hide-sm font-mono wp-muted wp-small truncate" style={{ maxWidth: 320 }}>{link}</td>
                    <td className="wp-num">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(link);
                            toast.success("Link copied!");
                          } catch {
                            toast.error("Couldn't copy the link. Copy it manually.");
                          }
                        }}
                        className="wp-btn"
                        aria-label={`Copy referral link for ${aff.name}`}
                      >
                        Copy link
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Referred Orders */}
      {activeTab === "orders" && (() => {
        const filteredOrds = (activityData.referredOrders || []).filter(o => {
          const q = orderSearchQuery.trim().toLowerCase();
          return !q ||
            o.orderNumber?.toLowerCase().includes(q) ||
            o.affiliateReferralCode?.toLowerCase().includes(q) ||
            o.customer?.email?.toLowerCase().includes(q);
        });
        return (
          <div>
            <div className="wp-toolbar">
              <span className="wp-spacer" />
              <SearchBox
                id="aff-orders-search"
                label="Search referred orders"
                value={orderSearchQuery}
                onChange={setOrderSearchQuery}
                placeholder="Order number, code, customer email…"
              />
            </div>
            <div className="wp-table-box">
              <table className="wp-list-table">
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col" className="wp-hide-sm">Date</th>
                    <th scope="col" className="wp-hide-sm">Customer</th>
                    <th scope="col" className="wp-hide-sm">Ref code</th>
                    <th scope="col" className="wp-num wp-hide-sm">Subtotal</th>
                    <th scope="col" className="wp-num wp-hide-sm">Ref discount</th>
                    <th scope="col" className="wp-num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrds.length === 0 ? (
                    <tr><td colSpan="7" className="wp-muted">No referred orders match search.</td></tr>
                  ) : filteredOrds.map(o => (
                    <tr key={o._id}>
                      <td style={{ wordBreak: "break-word" }}>
                        <span className="wp-strong font-mono">{o.orderNumber}</span>
                        <div className="wp-mobile-meta">
                          {new Date(o.createdAt).toLocaleDateString()} · {o.affiliateReferralCode}
                          {o.customer?.email ? ` · ${o.customer.email}` : ""}
                        </div>
                      </td>
                      <td className="wp-hide-sm wp-muted">{new Date(o.createdAt).toLocaleDateString()}</td>
                      <td className="wp-hide-sm">{o.customer?.email || '—'}</td>
                      <td className="wp-hide-sm font-mono">{o.affiliateReferralCode}</td>
                      <td className="wp-num wp-hide-sm">{formatMoney(o.financials?.subtotal ?? 0)}</td>
                      <td className="wp-num wp-hide-sm" style={{ color: "#2f6f1a" }}>
                        {o.financials?.affiliateDiscountAmount > 0 ? `-${formatMoney(o.financials.affiliateDiscountAmount)}` : '—'}
                      </td>
                      <td className="wp-num wp-strong">{formatMoney(o.financials?.total ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Tab: Conversions */}
      {activeTab === "conversions" && (() => {
        const filteredClks = (activityData.clicks || []).filter(c => {
          const q = clickSearchQuery.trim().toLowerCase();
          return !q ||
            c.affiliateId?.name?.toLowerCase().includes(q) ||
            c.affiliateId?.referralCode?.toLowerCase().includes(q) ||
            c.referralCode?.toLowerCase().includes(q) ||
            c.ip?.toLowerCase().includes(q);
        });
        return (
          <div>
            <div className="wp-stats">
              <div className="wp-stat">
                <div className="wp-stat-label">Total clicks</div>
                <div className="wp-stat-value">{activityData.clicks?.length ?? 0}</div>
              </div>
              <div className="wp-stat">
                <div className="wp-stat-label">Referred orders</div>
                <div className="wp-stat-value">{activityData.referredOrders?.length ?? 0}</div>
              </div>
              <div className="wp-stat">
                <div className="wp-stat-label">Conversion rate</div>
                <div className="wp-stat-value">
                  {activityData.clicks?.length > 0
                    ? `${((activityData.referredOrders?.length / activityData.clicks?.length) * 100).toFixed(1)}%`
                    : '0%'}
                </div>
              </div>
            </div>
            <div className="wp-toolbar">
              <span className="wp-spacer" />
              <SearchBox
                id="aff-clicks-search"
                label="Search clicks"
                value={clickSearchQuery}
                onChange={setClickSearchQuery}
                placeholder="Code, name, IP…"
              />
            </div>
            <Postbox id="aff-clicks" title="Recent clicks" flush>
              <div className="overflow-x-auto">
                <table className="wp-list-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Affiliate</th>
                      <th scope="col" className="wp-hide-sm">Ref code</th>
                      <th scope="col" className="wp-hide-sm">IP / source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClks.length === 0 ? (
                      <tr><td colSpan="4" className="wp-muted">No clicks match filter.</td></tr>
                    ) : filteredClks.slice(0, 50).map((c, i) => (
                      <tr key={c._id || i}>
                        <td className="wp-muted">{new Date(c.createdAt).toLocaleString()}</td>
                        <td>
                          <span className="wp-strong">{c.affiliateId?.name || '—'}</span>
                          <div className="wp-mobile-meta">
                            {c.affiliateId?.referralCode || c.referralCode || '—'} · {c.ip || '—'}
                          </div>
                        </td>
                        <td className="wp-hide-sm font-mono">{c.affiliateId?.referralCode || c.referralCode || '—'}</td>
                        <td className="wp-hide-sm font-mono wp-muted wp-small">{c.ip || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Postbox>
          </div>
        );
      })()}

      {/* Tab: Commissions */}
      {activeTab === "commissions" && (() => {
        const filteredComms = (activityData.commissions || []).filter(c => {
          const matchesStatus = commissionStatusFilter === "All" || c.status === commissionStatusFilter;
          const q = commissionSearchQuery.trim().toLowerCase();
          return matchesStatus && (!q ||
            c.affiliateId?.name?.toLowerCase().includes(q) ||
            c.affiliateId?.referralCode?.toLowerCase().includes(q) ||
            c.orderNumber?.toLowerCase().includes(q));
        });
        return (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FilterLinks
                label="Filter commissions by status"
                options={["All", "Pending", "Approved", "Rejected"]}
                value={commissionStatusFilter}
                onChange={setCommissionStatusFilter}
              />
              <SearchBox
                id="aff-commissions-search"
                label="Search commissions"
                value={commissionSearchQuery}
                onChange={setCommissionSearchQuery}
                placeholder="Search commissions…"
              />
            </div>
            <div className="wp-table-box mt-2">
              <table className="wp-list-table">
                <thead>
                  <tr>
                    <th scope="col">Affiliate</th>
                    <th scope="col" className="wp-hide-sm">Order</th>
                    <th scope="col" className="wp-hide-sm">Rate</th>
                    <th scope="col" className="wp-num">Amount</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="wp-hide-sm">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredComms.length === 0 ? (
                    <tr><td colSpan="6" className="wp-muted">No commissions match filter.</td></tr>
                  ) : filteredComms.map(c => (
                    <tr key={c._id}>
                      <td style={{ wordBreak: "break-word" }}>
                        <span className="wp-strong">{c.affiliateId?.name || 'Unknown'}</span>
                        <div className="wp-muted wp-small font-mono">{c.affiliateId?.referralCode}</div>
                        <div className="wp-mobile-meta">
                          {c.orderNumber || '—'} · {new Date(c.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="wp-hide-sm font-mono">{c.orderNumber || '—'}</td>
                      <td className="wp-hide-sm">{(c.snapshot?.commissionType || c.commissionType) === 'Fixed' ? `$${c.snapshot?.commissionRate ?? c.commissionRate ?? 0}` : `${c.snapshot?.commissionRate ?? c.commissionRate ?? 0}%`}</td>
                      <td className="wp-num wp-strong">{formatMoney(c.commissionAmount ?? 0)}</td>
                      <td><AffPill status={c.status} /></td>
                      <td className="wp-hide-sm wp-muted">{new Date(c.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Tab: Analytics */}
      {activeTab === "analytics" && (
        <div>
          <div className="wp-stats">
            {[
              { label: "Conversion rate", value: overviewStats?.stats?.conversionRate != null ? `${overviewStats.stats.conversionRate}%` : `${activityData.clicks?.length > 0 ? ((activityData.referredOrders?.length / activityData.clicks?.length) * 100).toFixed(1) : 0}%` },
              { label: "Total clicks", value: overviewStats?.stats?.totalClicks ?? activityData.clicks?.length ?? 0 },
              { label: "Total orders", value: overviewStats?.stats?.totalReferralOrders ?? activityData.referredOrders?.length ?? 0 },
              { label: "Total revenue", value: formatMoney(overviewStats?.stats?.totalRevenue ?? 0) },
            ].map(({ label, value }) => (
              <div key={label} className="wp-stat">
                <div className="wp-stat-label">{label}</div>
                <div className="wp-stat-value">{value}</div>
              </div>
            ))}
          </div>

          {overviewStats?.chartData?.length > 0 && (() => {
            const maxClicks = Math.max(1, ...overviewStats.chartData.map(row => row.clicks || 0));
            return (
              <Postbox id="aff-trend" title="Monthly click & order trend" aside="Bars show clicks">
                <div aria-hidden="true">
                  <div className="wp-chart">
                    {overviewStats.chartData.map(row => (
                      <div key={row.month} className="wp-bar-col">
                        <span className="wp-bar-tip">{row.month}: {row.clicks} clicks, {row.orders} orders</span>
                        <div
                          className={`wp-bar ${row.clicks ? "" : "is-empty"}`}
                          style={{ height: `${((row.clicks || 0) / maxClicks) * 100}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="wp-chart-x">
                    {overviewStats.chartData.map(row => <span key={row.month}>{row.month}</span>)}
                  </div>
                </div>
                <div className="overflow-x-auto mt-4">
                  <table className="wp-list-table">
                    <thead>
                      <tr>
                        <th scope="col">Month</th>
                        <th scope="col" className="wp-num">Clicks</th>
                        <th scope="col" className="wp-num">Orders</th>
                        <th scope="col" className="wp-num">Conv. rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overviewStats.chartData.map(row => (
                        <tr key={row.month}>
                          <td className="wp-strong">{row.month}</td>
                          <td className="wp-num">{row.clicks}</td>
                          <td className="wp-num">{row.orders}</td>
                          <td className="wp-num">{row.clicks > 0 ? `${((row.orders / row.clicks) * 100).toFixed(1)}%` : '0%'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Postbox>
            );
          })()}
          {!overviewStats && (
            <Notice type="info">Analytics data will appear once affiliates generate clicks and orders.</Notice>
          )}
        </div>
      )}

      {/* Tab: Applications */}
      {activeTab === "requests" && (() => {
        const filteredApps = applications.filter(app => {
          const matchesStatus = appStatusFilter === "All" || app.status === appStatusFilter;
          const q = appSearchQuery.trim().toLowerCase();
          const matchesSearch = !q ||
            app.name?.toLowerCase().includes(q) ||
            app.email?.toLowerCase().includes(q) ||
            app.phone?.toLowerCase().includes(q) ||
            app.address?.country?.toLowerCase().includes(q);
          return matchesStatus && matchesSearch;
        });
        const { items: pageApps, page: appCurrentPage, totalPages: appTotalPages } = paginate(filteredApps, appPage);
        const counts = {
          All: applications.length,
          Pending: applications.filter(a => a.status === "Pending").length,
          Approved: applications.filter(a => a.status === "Approved").length,
          Rejected: applications.filter(a => a.status === "Rejected").length,
        };
        return (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FilterLinks
                label="Filter applications by status"
                options={["All", "Pending", "Approved", "Rejected"]}
                value={appStatusFilter}
                onChange={(v) => { setAppStatusFilter(v); setAppPage(1); }}
                counts={counts}
              />
              <SearchBox
                id="aff-apps-search"
                label="Search applications"
                value={appSearchQuery}
                onChange={(v) => { setAppSearchQuery(v); setAppPage(1); }}
                placeholder="Name, email, phone, country…"
              />
            </div>
            <Pager total={filteredApps.length} page={appCurrentPage} totalPages={appTotalPages} onPage={setAppPage} />
            <div className="wp-table-box mt-2">
              <table className="wp-list-table">
                <thead>
                  <tr>
                    <th scope="col">Applicant</th>
                    <th scope="col" className="wp-hide-sm">Contact details</th>
                    <th scope="col" className="wp-hide-sm">Country</th>
                    <th scope="col" className="wp-hide-sm">Verification docs</th>
                    <th scope="col" className="wp-hide-sm">Strategy &amp; reach</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApps.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="wp-muted">
                        {appSearchQuery || appStatusFilter !== "All" ? "No applications match your filter." : "No applications found in database records."}
                      </td>
                    </tr>
                  ) : (
                    pageApps.map(app => (
                      <tr key={app._id}>
                        <td style={{ wordBreak: "break-word" }}>
                          <button type="button" className="wp-row-title text-left" onClick={() => setViewingApplication(app)}>
                            {app.name}
                          </button>
                          <div className="wp-muted wp-small">Applied: {new Date(app.createdAt).toLocaleDateString()}</div>
                          <div className="wp-mobile-meta">
                            {app.email}{app.address?.country ? ` · ${app.address.country}` : ""}
                          </div>
                          <div className="wp-row-actions">
                            <span><button type="button" className="max-[782px]:min-h-10" onClick={() => setViewingApplication(app)}>View details</button></span>
                            {app.status === 'Pending' && (
                              <>
                                <span><button type="button" className="max-[782px]:min-h-10" onClick={() => openReviewApplication(app, "Approve")}>Approve</button></span>
                                <span><button type="button" className="max-[782px]:min-h-10" onClick={() => openReviewApplication(app, "Reject")}>Reject</button></span>
                              </>
                            )}
                            <span><button type="button" className="is-danger max-[782px]:min-h-10" disabled={busyId === app._id} onClick={() => handleDeleteApplication(app)}>Delete</button></span>
                          </div>
                        </td>
                        <td className="wp-hide-sm" style={{ wordBreak: "break-all" }}>
                          <div>{app.email}</div>
                          <div className="wp-muted wp-small">{app.phone}</div>
                        </td>
                        <td className="wp-hide-sm">{app.address?.country}</td>
                        <td className="wp-hide-sm">
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {app.identityDocuments?.map((filename, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setViewingDocUrl(getDocumentUrl(filename))}
                                className="wp-link inline-flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" aria-hidden="true" /> Doc #{idx + 1}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="wp-hide-sm" style={{ maxWidth: 260 }}>
                          <div className="truncate">{app.marketingAnswers?.promotionStrategy}</div>
                          <div className="wp-muted wp-small">Reach: {app.marketingAnswers?.audienceSize}</div>
                        </td>
                        <td><AffPill status={app.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Tab: Affiliates List */}
      {activeTab === "list" && (() => {
        const isTrashView = listStatusFilter === "Trash";
        const q = listSearchQuery.trim().toLowerCase();
        const filteredAffs = (isTrashView ? trashedAffiliates : affiliates).filter(aff => {
          const matchesStatus = isTrashView || listStatusFilter === "All" || aff.status === listStatusFilter;
          return matchesStatus && (!q ||
            aff.name?.toLowerCase().includes(q) ||
            aff.email?.toLowerCase().includes(q) ||
            aff.referralCode?.toLowerCase().includes(q) ||
            aff.couponCode?.toLowerCase().includes(q));
        });
        const { items: pageAffs, page: listCurrentPage, totalPages: listTotalPages } = paginate(filteredAffs, listPage);
        const rateLabel = (aff) => aff.commissionType === "Fixed" ? `$${aff.commissionRate ?? 0} (Fixed)` : `${aff.commissionRate ?? 0}%`;
        return (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FilterLinks
                label="Filter affiliates by status"
                options={["All", "Active", "Suspended", "Trash"]}
                counts={{
                  All: affiliates.length,
                  Active: affiliates.filter(a => a.status === "Active").length,
                  Suspended: affiliates.filter(a => a.status === "Suspended").length,
                  Trash: trashedAffiliates.length,
                }}
                value={listStatusFilter}
                onChange={(v) => { setListStatusFilter(v); setListPage(1); }}
              />
              <SearchBox
                id="aff-list-search"
                label="Search affiliates"
                value={listSearchQuery}
                onChange={(v) => { setListSearchQuery(v); setListPage(1); }}
                placeholder="Search affiliates…"
              />
            </div>
            {isTrashView && trashedAffiliates.length > 0 && (
              <p className="wp-desc" style={{ margin: "8px 0 0" }}>
                Trashed affiliates are suspended: they can&rsquo;t log in and their links and coupons don&rsquo;t earn. An affiliate with commissions, payouts or referred orders is kept here for your records and can&rsquo;t be deleted permanently.
              </p>
            )}
            <Pager total={filteredAffs.length} page={listCurrentPage} totalPages={listTotalPages} onPage={setListPage} />
            <div className="wp-table-box">
              <table className="wp-list-table">
                <thead>
                  <tr>
                    <th scope="col">Affiliate</th>
                    <th scope="col" className="wp-hide-sm">Referral code</th>
                    <th scope="col" className="wp-hide-sm">Direct coupon</th>
                    <th scope="col" className="wp-hide-sm">Commission rate</th>
                    <th scope="col" className="wp-num">Available balance</th>
                    <th scope="col" className="wp-num wp-hide-sm">Lifetime earnings</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageAffs.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="wp-muted">
                        {q ? "No affiliates match your search."
                          : isTrashView ? "Trash is empty."
                          : listStatusFilter === "All" ? "No affiliates yet. Approve an application to add one."
                          : "No affiliates in this view."}
                      </td>
                    </tr>
                  ) : (
                    pageAffs.map(aff => {
                      const busy = busyId === aff._id;
                      return (
                        <tr key={aff._id}>
                          <td style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                            {isTrashView ? (
                              <span className="wp-row-title">{aff.name}</span>
                            ) : (
                              <button type="button" className="wp-row-title text-left" onClick={() => openEditAffiliate(aff)}>
                                {aff.name}
                              </button>
                            )}
                            <div className="wp-muted wp-small">{aff.email}</div>
                            <div className="wp-mobile-meta">
                              {aff.referralCode} · {rateLabel(aff)}
                            </div>
                            <div className="wp-row-actions">
                              {isTrashView ? (
                                <>
                                  <span><button type="button" className="max-[782px]:min-h-10" disabled={busy} onClick={() => handleRestoreAffiliate(aff)}>Restore</button></span>
                                  {aff.deleteBlockers?.length ? (
                                    <span><button type="button" className="max-[782px]:min-h-10" onClick={() => handleDeleteAffiliatePermanently(aff)} title={`Kept: ${aff.deleteBlockers.join(", ")}`}>Why can&rsquo;t I delete?</button></span>
                                  ) : (
                                    <span><button type="button" className="is-danger max-[782px]:min-h-10" disabled={busy} onClick={() => handleDeleteAffiliatePermanently(aff)}>Delete permanently</button></span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span><button type="button" className="max-[782px]:min-h-10" onClick={() => openEditAffiliate(aff)}>Edit</button></span>
                                  <span>
                                    <button type="button" className="max-[782px]:min-h-10" disabled={busy} onClick={() => handleToggleAffiliateStatus(aff)}>
                                      {aff.status === "Active" ? "Suspend" : "Activate"}
                                    </button>
                                  </span>
                                  <span><button type="button" className="is-danger max-[782px]:min-h-10" disabled={busy} onClick={() => handleTrashAffiliate(aff)}>Trash</button></span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="wp-hide-sm font-mono wp-strong" style={{ wordBreak: "break-all" }}>{aff.referralCode}</td>
                          <td className="wp-hide-sm font-mono wp-muted" style={{ wordBreak: "break-all" }}>{aff.couponCode || "—"}</td>
                          <td className="wp-hide-sm">{rateLabel(aff)}</td>
                          <td className="wp-num wp-strong">{formatMoney(aff.balance ?? 0)}</td>
                          <td className="wp-num wp-hide-sm wp-muted">{formatMoney(aff.lifetimeEarnings ?? 0)}</td>
                          <td><AffPill status={isTrashView ? "Trashed" : aff.status} /></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Tab: Payouts */}
      {activeTab === "payouts" && (() => {
        const filteredPays = payouts.filter(pay => {
          const matchesStatus = payoutStatusFilter === "All" || pay.status === payoutStatusFilter;
          const q = payoutSearchQuery.trim().toLowerCase();
          return matchesStatus && (!q ||
            pay.affiliateId?.name?.toLowerCase().includes(q) ||
            pay.affiliateId?.email?.toLowerCase().includes(q) ||
            pay.affiliateId?.referralCode?.toLowerCase().includes(q) ||
            pay.transactionId?.toLowerCase().includes(q));
        });
        return (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FilterLinks
                label="Filter payouts by status"
                options={["All", "Requested", "Paid", "Rejected"]}
                value={payoutStatusFilter}
                onChange={setPayoutStatusFilter}
              />
              <SearchBox
                id="aff-payouts-search"
                label="Search payouts"
                value={payoutSearchQuery}
                onChange={setPayoutSearchQuery}
                placeholder="Search payouts…"
              />
            </div>
            <div className="wp-table-box mt-2">
              <table className="wp-list-table">
                <thead>
                  <tr>
                    <th scope="col">Affiliate</th>
                    <th scope="col" className="wp-num">Amount</th>
                    <th scope="col" className="wp-hide-sm">Method</th>
                    <th scope="col" className="wp-hide-sm">Date</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="wp-hide-sm">Reference ID</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPays.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="wp-muted">No payout requests match filter.</td>
                    </tr>
                  ) : (
                    filteredPays.map(pay => (
                      <tr key={pay._id}>
                        <td style={{ wordBreak: "break-word" }}>
                          {pay.status === 'Requested' ? (
                            <button
                              type="button"
                              className="wp-row-title text-left"
                              onClick={() => openPayout(pay, `TX-${Date.now()}`)}
                            >
                              {pay.affiliateId?.name || "Deleted Affiliate"}
                            </button>
                          ) : (
                            <span className="wp-strong">{pay.affiliateId?.name || "Deleted Affiliate"}</span>
                          )}
                          <div className="wp-muted wp-small">Code: {pay.affiliateId?.referralCode || "—"}</div>
                          <div className="wp-mobile-meta">
                            {pay.paymentMethod} · {new Date(pay.createdAt).toLocaleDateString()}
                          </div>
                          {pay.status === 'Requested' && (
                            <div className="wp-row-actions">
                              <span>
                                <button
                                  type="button"
                                  onClick={() => openPayout(pay, `TX-${Date.now()}`)}
                                >
                                  Process payout
                                </button>
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="wp-num wp-strong">{formatMoney(pay.amount)}</td>
                        <td className="wp-hide-sm font-mono wp-muted">{pay.paymentMethod}</td>
                        <td className="wp-hide-sm wp-muted">{new Date(pay.createdAt).toLocaleDateString()}</td>
                        <td><AffPill status={pay.status} /></td>
                        <td className="wp-hide-sm font-mono wp-muted wp-small" style={{ wordBreak: "break-all" }}>{pay.transactionId || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Tab: Settings */}
      {activeTab === "settings" && (
        <form onSubmit={handleSettingsSubmit} style={{ maxWidth: 860 }}>
          <Postbox
            id="aff-settings"
            title="Global settings"
            footer={
              <button type="submit" disabled={savingSettings} className="wp-btn wp-btn-primary">
                {savingSettings ? "Saving settings…" : "Save settings"}
              </button>
            }
          >
            <div className="wp-frow">
              <label htmlFor="aff-set-rate" className="wp-flabel">Default commission rate (%)</label>
              <input
                id="aff-set-rate"
                type="number"
                min="0"
                max="100"
                value={settings.defaultCommissionRate}
                onChange={(e) => setSettings({ ...settings, defaultCommissionRate: Number(e.target.value) })}
                required
                className="wp-input"
              />
              <p className="wp-hint">Default percentage credited to partners per checkout conversion.</p>
            </div>

            <div className="wp-frow">
              <label htmlFor="aff-set-cookie" className="wp-flabel">Cookie window (days)</label>
              <input
                id="aff-set-cookie"
                type="number"
                min="1"
                value={settings.cookieDurationDays}
                onChange={(e) => setSettings({ ...settings, cookieDurationDays: Number(e.target.value) })}
                required
                className="wp-input"
              />
              <p className="wp-hint">Number of days tracking referrals remain valid after link visits.</p>
            </div>

            <div className="wp-frow">
              <label htmlFor="aff-set-min" className="wp-flabel">Minimum withdrawal ($)</label>
              <input
                id="aff-set-min"
                type="number"
                min="1"
                value={settings.minimumPayoutAmount}
                onChange={(e) => setSettings({ ...settings, minimumPayoutAmount: Number(e.target.value) })}
                required
                className="wp-input"
              />
              <p className="wp-hint">Minimum available balance required to request cash withdrawals.</p>
            </div>

            <div className="wp-frow">
              <label htmlFor="aff-set-email" className="wp-flabel">Support contact email</label>
              <input
                id="aff-set-email"
                type="email"
                value={settings.supportEmail}
                onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                required
                className="wp-input"
              />
              <p className="wp-hint">Recipient of new partner signup notifications.</p>
            </div>

            <div className="wp-frow">
              <span className="wp-flabel">Auto-approve signups</span>
              <label className="wp-check">
                <input
                  type="checkbox"
                  checked={settings.autoApproveApplications}
                  onChange={(e) => setSettings({ ...settings, autoApproveApplications: e.target.checked })}
                />
                <span>Automatically approve applications</span>
              </label>
              <p className="wp-hint">If enabled, registrations automatically bypass staff review and generate partner accounts immediately.</p>
            </div>
          </Postbox>

          {/* Danger zone: automatic promotions */}
          <Postbox id="aff-promos" title="Automatic promotions diagnostic">
            <div className="wp-notice wp-notice-warning" style={{ boxShadow: "none" }}>
              <p>
                If orders are showing an unexpected promo discount, it is caused by an active automatic promotion in your database.
                {autoPromos.length > 0
                  ? ` Found ${autoPromos.length} active automatic promotion(s) below:`
                  : " No active automatic promotions found in database."}
              </p>
            </div>
            {autoPromos.length > 0 && (
              <div>
                {autoPromos.map(p => (
                  <div key={p._id} className="wp-kv flex-wrap">
                    <div className="wp-kv-k">
                      <span className="wp-strong">{p.title || p.name}</span>
                      <span className="wp-muted wp-small font-mono ml-2">isAutomatic: true</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!(await showConfirm(`Deactivate "${p.title || p.name}"?`, "Deactivate promotion", { confirmText: "Deactivate", danger: true }))) return;
                        const r = await fetch("/api/admin/promotions", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ promotionId: p._id, adminStatus: "Draft" })
                        });
                        if (r.ok) { toast.success("Promotion deactivated."); loadData(); }
                        else toast.error("Failed to deactivate.");
                      }}
                      className="wp-btn"
                      style={DANGER_OUTLINE}
                      aria-label={`Deactivate ${p.title || p.name}`}
                    >
                      Deactivate
                    </button>
                  </div>
                ))}
                <div className="pt-3">
                  <button
                    type="button"
                    disabled={disablingPromos}
                    onClick={async () => {
                      if (!(await showConfirm("Deactivate ALL automatic promotions? This will stop all surprise discounts.", "Deactivate all", { confirmText: "Deactivate all", danger: true }))) return;
                      setDisablingPromos(true);
                      try {
                        const r = await fetch("/api/admin/promotions", { method: "DELETE" });
                        const d = await r.json().catch(() => ({}));
                        if (!r.ok) throw new Error(d.error || "Failed to deactivate automatic promotions.");
                        toast.success(d.message || "Automatic promotions deactivated.");
                        loadData();
                      } catch (err) {
                        toast.error(err.message || "Failed to deactivate automatic promotions.");
                      } finally {
                        setDisablingPromos(false);
                      }
                    }}
                    className="wp-btn"
                    style={DANGER_SOLID}
                  >
                    {disablingPromos ? "Deactivating…" : "Deactivate all automatic promotions"}
                  </button>
                </div>
              </div>
            )}
          </Postbox>
        </form>
      )}

      {/* Modal: View Application Details */}
      {viewingApplication && (
        <div className="wp-modal-backdrop">
          <div className="wp-modal" role="dialog" aria-modal="true" aria-labelledby="aff-app-title" style={{ maxWidth: 760 }}>
            <div className="wp-modal-head">
              <h2 id="aff-app-title">Application: {viewingApplication.name}</h2>
              <CloseButton onClick={() => setViewingApplication(null)} />
            </div>

            <div className="wp-modal-body space-y-5">
              <section>
                <SectionTitle>General contact profile</SectionTitle>
                {viewingApplication.profilePhoto && (
                  <div className="flex items-center gap-3 pb-2">
                    <img
                      src={getDocumentUrl(viewingApplication.profilePhoto)}
                      alt="Profile avatar"
                      className="w-16 h-16 rounded-full object-cover border border-[#c3c4c7] bg-[#f0f0f1]"
                    />
                    <button
                      type="button"
                      onClick={() => setViewingDocUrl(getDocumentUrl(viewingApplication.profilePhoto))}
                      className="wp-link"
                    >
                      View full photo
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <KV label="Full legal name">{viewingApplication.name}</KV>
                  <KV label="Email address">{viewingApplication.email}</KV>
                  <KV label="Phone number">{viewingApplication.phone}</KV>
                  <KV label="Date of birth">{viewingApplication.dob ? new Date(viewingApplication.dob).toLocaleDateString() : "—"}</KV>
                  <KV label="Submission date">{new Date(viewingApplication.createdAt).toLocaleString()}</KV>
                  <KV label="Preferred referral code">
                    {viewingApplication.referralCode
                      ? <code className="font-mono">{viewingApplication.referralCode}</code>
                      : <span className="wp-muted" style={{ fontWeight: 400 }}>Will be auto-generated</span>
                    }
                  </KV>
                  <KV label="Status"><AffPill status={viewingApplication.status} /></KV>
                </div>
              </section>

              <section>
                <SectionTitle>Postal address</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <KV label="Street">{viewingApplication.address?.street || "—"}</KV>
                  <KV label="City">{viewingApplication.address?.city || "—"}</KV>
                  <KV label="State / province">{viewingApplication.address?.state || "—"}</KV>
                  <KV label="Zip / postal code">{viewingApplication.address?.zipCode || "—"}</KV>
                  <KV label="Country">{viewingApplication.address?.country || "—"}</KV>
                </div>
              </section>

              <section>
                <SectionTitle>Banking &amp; payout profile</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <KV label="Account holder name">{viewingApplication.bankingInfo?.accountHolder || "—"}</KV>
                  <KV label="Bank name">{viewingApplication.bankingInfo?.bankName || "—"}</KV>
                  <KV label="Account / IBAN"><span className="font-mono">{viewingApplication.bankingInfo?.accountNumber || "—"}</span></KV>
                  <KV label="SWIFT / BIC code"><span className="font-mono">{viewingApplication.bankingInfo?.swiftCode || "—"}</span></KV>
                  <KV label="Routing number"><span className="font-mono">{viewingApplication.bankingInfo?.routingNumber || "—"}</span></KV>
                  <KV label="PayPal email">{viewingApplication.bankingInfo?.paypalEmail || "—"}</KV>
                </div>
              </section>

              <section>
                <SectionTitle>Marketing strategy &amp; reach</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <KV label="Company name">{viewingApplication.businessInfo?.companyName || viewingApplication.companyName || "—"}</KV>
                  <KV label="Website">
                    {(viewingApplication.businessInfo?.website || viewingApplication.website) ? (
                      <a href={viewingApplication.businessInfo?.website || viewingApplication.website} target="_blank" rel="noreferrer" className="wp-link inline-flex items-center gap-1" style={{ fontWeight: 400 }}>
                        {viewingApplication.businessInfo?.website || viewingApplication.website} <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    ) : "—"}
                  </KV>
                  <KV label="Social media channels">{(Array.isArray(viewingApplication.businessInfo?.socialLinks) ? viewingApplication.businessInfo.socialLinks.filter(Boolean).join(", ") : viewingApplication.socialLinks) || "—"}</KV>
                  <KV label="Monthly reach / traffic">{viewingApplication.marketingAnswers?.audienceSize || "—"}</KV>
                  <KV label="Affiliate experience">{viewingApplication.marketingAnswers?.experience || "—"}</KV>
                </div>
                <div className="mt-3">
                  <div className="wp-label">Promotion methodology</div>
                  <p className="whitespace-pre-line m-0 p-2.5 border border-[#dcdcde] bg-[#f6f7f7]" style={{ lineHeight: 1.6 }}>
                    {viewingApplication.marketingAnswers?.promotionStrategy || "—"}
                  </p>
                </div>
              </section>

              <section>
                <SectionTitle>Identity &amp; verification comparison</SectionTitle>
                <VerificationThumbs record={viewingApplication} getUrl={getDocumentUrl} onOpen={setViewingDocUrl} />
              </section>

              <section>
                <SectionTitle>KYC / identity &amp; bank verification documents</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {viewingApplication.identityDocuments && viewingApplication.identityDocuments.length > 0 && (
                    viewingApplication.identityDocuments.map((filename, idx) => (
                      <DocRow key={`id-${idx}`} filename={filename} url={getDocumentUrl(filename)} onPreview={() => setViewingDocUrl(getDocumentUrl(filename))} />
                    ))
                  )}
                  {viewingApplication.bankVerificationDocument && (
                    <DocRow
                      filename={viewingApplication.bankVerificationDocument}
                      url={getDocumentUrl(viewingApplication.bankVerificationDocument)}
                      onPreview={() => setViewingDocUrl(getDocumentUrl(viewingApplication.bankVerificationDocument))}
                      note="Bank document"
                    />
                  )}
                  {(!viewingApplication.identityDocuments || viewingApplication.identityDocuments.length === 0) && !viewingApplication.bankVerificationDocument && (
                    <p className="wp-empty" style={{ margin: 0 }}>No document attachments present.</p>
                  )}
                </div>
              </section>
            </div>

            <div className="wp-modal-foot flex-wrap">
              <button type="button" onClick={() => setViewingApplication(null)} className="wp-btn">
                Close
              </button>
              {viewingApplication.status === "Pending" && (
                <button
                  type="button"
                  onClick={() => {
                    openReviewApplication(viewingApplication);
                    setViewingApplication(null);
                  }}
                  className="wp-btn wp-btn-primary"
                >
                  Proceed to review
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Review Application */}
      {selectedApplication && (
        <div className="wp-modal-backdrop">
          <div className="wp-modal" role="dialog" aria-modal="true" aria-labelledby="aff-review-title" style={{ maxWidth: 520 }}>
            <div className="wp-modal-head">
              <h2 id="aff-review-title">Review: {selectedApplication.name}</h2>
              <CloseButton onClick={closeReviewApplication} />
            </div>

            <form onSubmit={handleApplicationReview}>
              <div className="wp-modal-body">
                <div className="wp-field">
                  <label htmlFor="aff-rv-action" className="wp-label">Action *</label>
                  <ThemedSelect
                    id="aff-rv-action"
                    value={reviewAction}
                    onChange={(e) => setReviewAction(e.target.value)}
                    className="wp-select wp-full"
                  >
                    <option value="Approve">Approve and Register Account</option>
                    <option value="Reject">Reject Application</option>
                  </ThemedSelect>
                </div>

                {reviewAction === "Approve" ? (
                  <>
                    <div className="wp-field">
                      <label htmlFor="aff-rv-ctype" className="wp-label">Commission type *</label>
                      <ThemedSelect
                        id="aff-rv-ctype"
                        value={commissionType}
                        onChange={(e) => {
                          setCommissionType(e.target.value);
                          setCustomCommissionRate(e.target.value === "Percentage" ? 5 : 10);
                        }}
                        className="wp-select wp-full"
                      >
                        <option value="Percentage">Percentage Commission (%)</option>
                        <option value="Fixed">Fixed Commission ($)</option>
                      </ThemedSelect>
                    </div>

                    <div className="wp-field">
                      <label htmlFor="aff-rv-rate" className="wp-label">
                        {commissionType === "Percentage" ? "Commission rate (%) *" : "Fixed commission amount ($) *"}
                      </label>
                      <input
                        id="aff-rv-rate"
                        type="number"
                        min="0"
                        max={commissionType === "Percentage" ? 100 : 10000}
                        value={customCommissionRate}
                        onChange={(e) => setCustomCommissionRate(Number(e.target.value))}
                        required
                        className="wp-input wp-full"
                      />
                    </div>

                    {/* Customer Discount — independent from commission */}
                    <fieldset className="border-t border-[#dcdcde] pt-3 mb-3.5">
                      <legend className="wp-strong pr-2">Customer discount (optional)</legend>
                      <div className="wp-field">
                        <label htmlFor="aff-rv-dtype" className="wp-label">Discount type</label>
                        <ThemedSelect
                          id="aff-rv-dtype"
                          value={reviewDiscountType}
                          onChange={(e) => {
                            setReviewDiscountType(e.target.value);
                            setReviewDiscountValue("");
                          }}
                          className="wp-select wp-full"
                        >
                          <option value="None">None — No customer discount</option>
                          <option value="Percentage">Percentage Discount (%)</option>
                          <option value="Fixed">Fixed Amount Discount ($)</option>
                        </ThemedSelect>
                      </div>
                      {reviewDiscountType !== "None" && (
                        <div className="wp-field">
                          <label htmlFor="aff-rv-dval" className="wp-label">
                            {reviewDiscountType === "Percentage" ? "Discount rate (%)" : "Discount amount ($)"}
                          </label>
                          <input
                            id="aff-rv-dval"
                            type="number"
                            min="0"
                            max={reviewDiscountType === "Percentage" ? 100 : 10000}
                            value={reviewDiscountValue}
                            onChange={(e) => setReviewDiscountValue(e.target.value)}
                            placeholder={reviewDiscountType === "Percentage" ? "Enter percentage (e.g. 10)" : "Enter fixed amount (e.g. 5)"}
                            className="wp-input wp-full"
                          />
                          <p className="wp-desc">Customers using this referral link will receive this discount on their order.</p>
                        </div>
                      )}
                    </fieldset>

                    <div className="wp-field">
                      <label htmlFor="aff-rv-code" className="wp-label">Referral code *</label>
                      <div className="flex gap-2">
                        <input
                          id="aff-rv-code"
                          type="text"
                          value={reviewReferralCode}
                          onChange={e => setReviewReferralCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                          placeholder="Auto-generated from name if empty"
                          className="wp-input flex-1 min-w-0 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                            setReviewReferralCode(Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
                          }}
                          className="wp-btn shrink-0"
                          title="Generate a random referral code"
                        >
                          Generate
                        </button>
                      </div>
                      {selectedApplication?.referralCode && (
                        <p className="wp-desc">Applicant requested: <code className="font-mono wp-strong">{selectedApplication.referralCode}</code></p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="wp-field">
                    <label htmlFor="aff-rv-reason" className="wp-label">Rejection reason *</label>
                    <textarea
                      id="aff-rv-reason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      required
                      rows="3"
                      placeholder="Reason for rejecting the request..."
                      className="wp-textarea"
                    />
                  </div>
                )}

                <div className="wp-field" style={{ marginBottom: 0 }}>
                  <label htmlFor="aff-rv-notes" className="wp-label">Internal audit notes</label>
                  <textarea
                    id="aff-rv-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows="2"
                    placeholder="Comments visible to staff only..."
                    className="wp-textarea"
                  />
                </div>
              </div>

              <div className="wp-modal-foot">
                <button type="button" onClick={closeReviewApplication} className="wp-btn">
                  Cancel
                </button>
                <button type="submit" disabled={submittingReview} className="wp-btn wp-btn-primary">
                  {submittingReview ? "Processing…" : "Confirm review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Affiliate */}
      {selectedAffiliate && (
        <div className="wp-modal-backdrop">
          <div className="wp-modal" role="dialog" aria-modal="true" aria-labelledby="aff-edit-title" style={{ maxWidth: 760 }}>
            <div className="wp-modal-head">
              <h2 id="aff-edit-title">Edit affiliate: {selectedAffiliate.name}</h2>
              <CloseButton onClick={() => setSelectedAffiliate(null)} />
            </div>

            <form onSubmit={handleAffiliateEditSubmit}>
              <div className="wp-modal-body">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 p-3 mb-4 bg-[#f6f7f7] border border-[#dcdcde]">
                  <div className="wp-field">
                    <div className="wp-label">Affiliate ID</div>
                    <div className="font-mono wp-strong" style={{ minHeight: 30, display: "flex", alignItems: "center" }}>{selectedAffiliate.affiliateId || "—"}</div>
                  </div>
                  <div className="wp-field" style={{ marginBottom: 0 }}>
                    <label htmlFor="aff-ed-created" className="wp-label">Account created at</label>
                    <input
                      id="aff-ed-created"
                      type="datetime-local"
                      value={editForm.createdAt}
                      onChange={(e) => setEditForm({ ...editForm, createdAt: e.target.value })}
                      className="wp-input wp-full font-mono"
                    />
                  </div>
                </div>

                <SectionTitle>Account</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  <div className="wp-field">
                    <label htmlFor="aff-ed-name" className="wp-label">Display name</label>
                    <input
                      id="aff-ed-name"
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      required
                      className="wp-input wp-full"
                    />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="aff-ed-email" className="wp-label">Email address</label>
                    <input
                      id="aff-ed-email"
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      required
                      className="wp-input wp-full"
                    />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="aff-ed-phone" className="wp-label">Phone number</label>
                    <input
                      id="aff-ed-phone"
                      type="text"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="wp-input wp-full"
                    />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="aff-ed-dob" className="wp-label">Date of birth</label>
                    <input
                      id="aff-ed-dob"
                      type="date"
                      value={editForm.dob}
                      onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
                      className="wp-input wp-full"
                    />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="aff-ed-status" className="wp-label">Status</label>
                    <ThemedSelect
                      id="aff-ed-status"
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="wp-select wp-full"
                    >
                      <option value="Active">Active</option>
                      <option value="Suspended">Suspended</option>
                    </ThemedSelect>
                  </div>
                  <div className="wp-field">
                    <label htmlFor="aff-ed-pass" className="wp-label">Reset password</label>
                    <input
                      id="aff-ed-pass"
                      type="password"
                      value={editForm.password}
                      onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                      placeholder="Leave empty to keep unchanged"
                      className="wp-input wp-full"
                    />
                  </div>
                </div>

                <SectionTitle>Commission &amp; codes</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  <div className="wp-field">
                    <label htmlFor="aff-ed-ctype" className="wp-label">Commission type</label>
                    <ThemedSelect
                      id="aff-ed-ctype"
                      value={editForm.commissionType}
                      onChange={(e) => setEditForm({ ...editForm, commissionType: e.target.value })}
                      className="wp-select wp-full"
                    >
                      <option value="Percentage">Percentage Commission (%)</option>
                      <option value="Fixed">Fixed Commission ($)</option>
                    </ThemedSelect>
                  </div>
                  <div className="wp-field">
                    <label htmlFor="aff-ed-rate" className="wp-label">
                      {editForm.commissionType === "Percentage" ? "Commission rate (%)" : "Fixed commission amount ($)"}
                    </label>
                    <input
                      id="aff-ed-rate"
                      type="number"
                      min="0"
                      max={editForm.commissionType === "Percentage" ? 100 : 10000}
                      value={editForm.commissionRate}
                      onChange={(e) => setEditForm({ ...editForm, commissionRate: Number(e.target.value) })}
                      required
                      className="wp-input wp-full"
                    />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="aff-ed-coupon" className="wp-label">Assigned coupon code</label>
                    <input
                      id="aff-ed-coupon"
                      type="text"
                      value={editForm.couponCode}
                      onChange={(e) => setEditForm({ ...editForm, couponCode: e.target.value })}
                      placeholder="Leave empty for none"
                      className="wp-input wp-full font-mono"
                    />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="aff-ed-code" className="wp-label">Referral code</label>
                    <div className="flex gap-2">
                      <input
                        id="aff-ed-code"
                        type="text"
                        value={editReferralCode}
                        onChange={e => setEditReferralCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                        placeholder="Unique referral code"
                        className="wp-input flex-1 min-w-0 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                          setEditReferralCode(Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
                        }}
                        className="wp-btn shrink-0"
                        title="Generate a random referral code"
                      >
                        Generate
                      </button>
                    </div>
                    <p className="wp-desc">Current: <code className="font-mono wp-strong">{selectedAffiliate?.referralCode || "N/A"}</code></p>
                  </div>
                </div>

                {/* Customer Discount — independent from commission */}
                <SectionTitle>Customer discount</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  <div className="wp-field">
                    <label htmlFor="aff-ed-dtype" className="wp-label">Discount type</label>
                    <ThemedSelect
                      id="aff-ed-dtype"
                      value={editForm.customerDiscountType}
                      onChange={(e) => setEditForm({ ...editForm, customerDiscountType: e.target.value, customerDiscountValue: "" })}
                      className="wp-select wp-full"
                    >
                      <option value="None">None — No customer discount</option>
                      <option value="Percentage">Percentage Discount (%)</option>
                      <option value="Fixed">Fixed Amount Discount ($)</option>
                    </ThemedSelect>
                  </div>
                  {editForm.customerDiscountType !== "None" && (
                    <div className="wp-field">
                      <label htmlFor="aff-ed-dval" className="wp-label">
                        {editForm.customerDiscountType === "Percentage" ? "Discount rate (%)" : "Discount amount ($)"}
                      </label>
                      <input
                        id="aff-ed-dval"
                        type="number"
                        min="0"
                        max={editForm.customerDiscountType === "Percentage" ? 100 : 10000}
                        value={editForm.customerDiscountValue === 0 ? "" : editForm.customerDiscountValue}
                        onChange={(e) => setEditForm({ ...editForm, customerDiscountValue: e.target.value })}
                        placeholder={editForm.customerDiscountType === "Percentage" ? "Enter percentage (e.g. 10)" : "Enter fixed amount (e.g. 5)"}
                        className="wp-input wp-full"
                      />
                      <p className="wp-desc">Customers using this referral link will receive this discount on their order.</p>
                    </div>
                  )}
                </div>

                {/* Business Info */}
                <SectionTitle>Business info</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  <div className="wp-field">
                    <label htmlFor="aff-ed-company" className="wp-label">Company / brand name</label>
                    <input
                      id="aff-ed-company"
                      type="text"
                      value={editForm.companyName}
                      onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                      className="wp-input wp-full"
                      placeholder="Company name"
                    />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="aff-ed-website" className="wp-label">Website URL</label>
                    <input
                      id="aff-ed-website"
                      type="text"
                      value={editForm.website}
                      onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                      className="wp-input wp-full"
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                {/* Address */}
                <SectionTitle>Address</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  <div className="wp-field sm:col-span-2">
                    <label htmlFor="aff-ed-street" className="wp-label">Street</label>
                    <input id="aff-ed-street" type="text" value={editForm.street} onChange={e => setEditForm({ ...editForm, street: e.target.value })} className="wp-input wp-full" placeholder="Street address" />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="aff-ed-city" className="wp-label">City</label>
                    <input id="aff-ed-city" type="text" value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value })} className="wp-input wp-full" />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="aff-ed-state" className="wp-label">State / province</label>
                    <input id="aff-ed-state" type="text" value={editForm.state} onChange={e => setEditForm({ ...editForm, state: e.target.value })} className="wp-input wp-full" />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="aff-ed-zip" className="wp-label">Zip / postal code</label>
                    <input id="aff-ed-zip" type="text" value={editForm.zipCode} onChange={e => setEditForm({ ...editForm, zipCode: e.target.value })} className="wp-input wp-full" />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="aff-ed-country" className="wp-label">Country</label>
                    <input id="aff-ed-country" type="text" value={editForm.country} onChange={e => setEditForm({ ...editForm, country: e.target.value })} className="wp-input wp-full" />
                  </div>
                </div>

                {/* Banking */}
                <SectionTitle>Banking info</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  <div className="wp-field sm:col-span-2">
                    <label htmlFor="aff-ed-holder" className="wp-label">Account holder name</label>
                    <input id="aff-ed-holder" type="text" value={editForm.accountHolder} onChange={e => setEditForm({ ...editForm, accountHolder: e.target.value })} className="wp-input wp-full" />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="aff-ed-bank" className="wp-label">Bank name</label>
                    <input id="aff-ed-bank" type="text" value={editForm.bankName} onChange={e => setEditForm({ ...editForm, bankName: e.target.value })} className="wp-input wp-full" />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="aff-ed-acct" className="wp-label">Account number</label>
                    <input id="aff-ed-acct" type="text" value={editForm.accountNumber} onChange={e => setEditForm({ ...editForm, accountNumber: e.target.value })} className="wp-input wp-full font-mono" />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="aff-ed-iban" className="wp-label">IBAN</label>
                    <input id="aff-ed-iban" type="text" value={editForm.iban} onChange={e => setEditForm({ ...editForm, iban: e.target.value })} className="wp-input wp-full font-mono" />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="aff-ed-swift" className="wp-label">SWIFT / BIC</label>
                    <input id="aff-ed-swift" type="text" value={editForm.swiftCode} onChange={e => setEditForm({ ...editForm, swiftCode: e.target.value })} className="wp-input wp-full font-mono" />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="aff-ed-routing" className="wp-label">Routing number</label>
                    <input id="aff-ed-routing" type="text" value={editForm.routingNumber} onChange={e => setEditForm({ ...editForm, routingNumber: e.target.value })} className="wp-input wp-full font-mono" />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="aff-ed-paypal" className="wp-label">PayPal email</label>
                    <input id="aff-ed-paypal" type="email" value={editForm.paypalEmail} onChange={e => setEditForm({ ...editForm, paypalEmail: e.target.value })} className="wp-input wp-full" />
                  </div>
                </div>

                <SectionTitle>Identity &amp; verification comparison</SectionTitle>
                <VerificationThumbs record={selectedAffiliate} getUrl={getDocumentUrl} onOpen={setViewingDocUrl} />

                {/* Documents & Photos */}
                {(selectedAffiliate?.profilePhoto || selectedAffiliate?.identityDocuments?.length > 0 || selectedAffiliate?.bankVerificationDocument) && (
                  <div className="mt-4">
                    <SectionTitle>Verification &amp; documents</SectionTitle>

                    {selectedAffiliate?.profilePhoto && (
                      <div className="flex items-center gap-3 mb-3">
                        <img
                          src={getDocumentUrl(selectedAffiliate.profilePhoto)}
                          alt="Profile avatar"
                          className="w-16 h-16 rounded-full object-cover border border-[#c3c4c7] bg-[#f0f0f1]"
                        />
                        <button
                          type="button"
                          onClick={() => setViewingDocUrl(getDocumentUrl(selectedAffiliate.profilePhoto))}
                          className="wp-link"
                        >
                          View full photo
                        </button>
                      </div>
                    )}

                    {selectedAffiliate?.identityDocuments?.length > 0 && (
                      <div className="mb-3">
                        <div className="wp-label">Identity documents</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedAffiliate.identityDocuments.map((filename, idx) => (
                            <DocRow key={`id-doc-${idx}`} filename={filename} url={getDocumentUrl(filename)} onPreview={() => setViewingDocUrl(getDocumentUrl(filename))} />
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedAffiliate?.bankVerificationDocument && (
                      <div>
                        <div className="wp-label">Bank verification statement</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <DocRow
                            filename={selectedAffiliate.bankVerificationDocument}
                            url={getDocumentUrl(selectedAffiliate.bankVerificationDocument)}
                            onPreview={() => setViewingDocUrl(getDocumentUrl(selectedAffiliate.bankVerificationDocument))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="wp-modal-foot">
                <button type="button" onClick={() => setSelectedAffiliate(null)} className="wp-btn">
                  Cancel
                </button>
                <button type="submit" disabled={submittingEdit} className="wp-btn wp-btn-primary">
                  {submittingEdit ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Process Payout */}
      {selectedPayout && (
        <div className="wp-modal-backdrop">
          <div className="wp-modal" role="dialog" aria-modal="true" aria-labelledby="aff-payout-title" style={{ maxWidth: 480 }}>
            <div className="wp-modal-head">
              <h2 id="aff-payout-title">Process payout: {formatMoney(selectedPayout.amount)}</h2>
              <CloseButton onClick={closePayout} />
            </div>

            <form onSubmit={handlePayoutProcess}>
              <div className="wp-modal-body">
                <div className="wp-field">
                  <label htmlFor="aff-po-action" className="wp-label">Action *</label>
                  <ThemedSelect
                    id="aff-po-action"
                    value={payoutAction}
                    onChange={(e) => setPayoutAction(e.target.value)}
                    className="wp-select wp-full"
                  >
                    <option value="Approve">Mark Payout as Paid</option>
                    <option value="Reject">Reject Request (Refund Balance)</option>
                  </ThemedSelect>
                </div>

                {payoutAction === "Approve" && (
                  <div className="wp-field">
                    <label htmlFor="aff-po-tx" className="wp-label">Transaction ID / reference *</label>
                    <input
                      id="aff-po-tx"
                      type="text"
                      value={payoutTxId}
                      onChange={(e) => setPayoutTxId(e.target.value)}
                      required
                      placeholder="e.g. PayPal TxID or bank trace ref"
                      className="wp-input wp-full font-mono"
                    />
                  </div>
                )}

                <div className="wp-field" style={{ marginBottom: 0 }}>
                  <label htmlFor="aff-po-notes" className="wp-label">Feedback notes</label>
                  <textarea
                    id="aff-po-notes"
                    value={payoutNotes}
                    onChange={(e) => setPayoutNotes(e.target.value)}
                    rows="3"
                    placeholder="Sent in notification email to partner..."
                    className="wp-textarea"
                  />
                </div>
              </div>

              <div className="wp-modal-foot">
                <button type="button" onClick={closePayout} className="wp-btn">
                  Cancel
                </button>
                <button type="submit" disabled={submittingPayout} className="wp-btn wp-btn-primary">
                  {submittingPayout ? "Processing…" : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Secure Document Viewer */}
      {viewingDocUrl && (
        <div className="wp-modal-backdrop">
          <div className="wp-modal flex flex-col" role="dialog" aria-modal="true" aria-labelledby="aff-doc-title" style={{ maxWidth: 900 }}>
            <div className="wp-modal-head">
              <h2 id="aff-doc-title">KYC document viewer</h2>
              <CloseButton onClick={() => setViewingDocUrl(null)} />
            </div>

            <div className="flex-1 overflow-auto bg-[#f0f0f1] p-4 flex items-center justify-center min-h-[300px]">
              {viewingDocUrl.toLowerCase().includes("file=") && viewingDocUrl.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={viewingDocUrl}
                  title="Document PDF"
                  className="w-full h-[60vh] border-0 bg-white"
                />
              ) : (
                <img
                  src={viewingDocUrl}
                  alt="KYC Document Preview"
                  className="max-w-full max-h-[60vh] object-contain border border-[#dcdcde] bg-white"
                />
              )}
            </div>

            <div className="wp-modal-foot flex-wrap">
              <button type="button" onClick={() => setViewingDocUrl(null)} className="wp-btn">
                Close
              </button>
              <a href={viewingDocUrl} target="_blank" rel="noreferrer" className="wp-btn wp-btn-primary">
                <ExternalLink className="w-4 h-4" aria-hidden="true" /> Open in new tab
              </a>
            </div>
          </div>
        </div>
      )}

    </Page>
  );
}

/* ---------- presentational helpers (no state, no data access) ---------- */

const DANGER_SOLID = { background: "#b32d2e", borderColor: "#b32d2e", color: "#fff" };
const DANGER_OUTLINE = { borderColor: "#b32d2e", color: "#b32d2e" };

const PILL_CLASS = {
  Pending: "wp-st-unpaid",
  Requested: "wp-st-unpaid",
  Approved: "wp-st-paid",
  Active: "wp-st-paid",
  Paid: "wp-st-paid",
  Rejected: "wp-st-failed",
  Suspended: "wp-st-failed",
  Trashed: "wp-st-draft",
};

function AffPill({ status }) {
  return <span className={`wp-pill wp-pill-sm ${PILL_CLASS[status] || "wp-st-pending"}`}>{status}</span>;
}

function StatButton({ label, value, onClick }) {
  return (
    <button type="button" onClick={onClick} className="wp-stat text-left cursor-pointer hover:bg-[#f6f7f7] focus-visible:bg-[#f6f7f7]">
      <span className="wp-stat-label block">{label}</span>
      <span className="wp-stat-value block">{value}</span>
    </button>
  );
}

function FilterLinks({ label, options, value, onChange, counts }) {
  return (
    <nav className="wp-subsub" aria-label={label}>
      {options.map((opt, i) => (
        <span key={opt} className="inline-flex items-center">
          {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
          <button
            type="button"
            aria-pressed={value === opt}
            className={`max-[782px]:min-h-10 ${value === opt ? "is-current" : ""}`}
            onClick={() => onChange(opt)}
          >
            {opt}
            {counts && <span className="wp-count"> ({counts[opt]})</span>}
          </button>
        </span>
      ))}
    </nav>
  );
}

function SearchBox({ id, label, value, onChange, placeholder }) {
  // Filters live while typing; Enter / Search just keeps the term (no page reload).
  return (
    <form className="wp-search" role="search" onSubmit={(e) => { e.preventDefault(); onChange(value.trim()); }}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="wp-input w-[240px]"
      />
      <button type="submit" className="wp-btn">Search</button>
    </form>
  );
}

function Pager({ total, page, totalPages, onPage }) {
  const go = (n) => onPage(Math.min(Math.max(1, n), totalPages));
  return (
    <div className="wp-toolbar">
      <span className="wp-spacer" />
      <div className="wp-pages">
        <span>{total} {total === 1 ? "item" : "items"}</span>
        <button type="button" className="wp-pager" aria-label="First page" disabled={page <= 1} onClick={() => go(1)}><ChevronsLeft className="w-4 h-4" /></button>
        <button type="button" className="wp-pager" aria-label="Previous page" disabled={page <= 1} onClick={() => go(page - 1)}><ChevronLeft className="w-4 h-4" /></button>
        <span>{page} of {totalPages}</span>
        <button type="button" className="wp-pager" aria-label="Next page" disabled={page >= totalPages} onClick={() => go(page + 1)}><ChevronRight className="w-4 h-4" /></button>
        <button type="button" className="wp-pager" aria-label="Last page" disabled={page >= totalPages} onClick={() => go(totalPages)}><ChevronsRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

function CloseButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close dialog"
      className="inline-flex items-center justify-center w-10 h-10 -mr-2 text-[#646970] hover:text-[#1d2327] cursor-pointer"
    >
      <X className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="wp-strong m-0 mb-1 pb-1.5 border-b border-[#dcdcde]" style={{ fontSize: 14 }}>
      {children}
    </h3>
  );
}

function KV({ label, children }) {
  return (
    <div className="wp-kv items-start">
      <span className="wp-kv-k wp-muted">{label}</span>
      <span className="wp-kv-v text-right min-w-0" style={{ wordBreak: "break-word" }}>{children}</span>
    </div>
  );
}

function DocRow({ filename, url, onPreview, note }) {
  return (
    <div className="flex items-center justify-between gap-3 p-2.5 border border-[#dcdcde] bg-[#f6f7f7] min-w-0">
      <span className="font-mono wp-small truncate min-w-0" title={filename}>
        {note && <span className="wp-muted" style={{ fontFamily: "inherit" }}>{note}: </span>}
        {filename}
      </span>
      <span className="flex gap-3 shrink-0">
        <button type="button" onClick={onPreview} className="wp-link cursor-pointer">Preview</button>
        <a href={url} target="_blank" rel="noreferrer" className="wp-link inline-flex items-center gap-1">
          Download <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </a>
      </span>
    </div>
  );
}

/** Profile photo / live selfie / bank document side by side, each opening the document viewer. */
function VerificationThumbs({ record, getUrl, onOpen }) {
  const tile = "block w-full aspect-square border border-[#c3c4c7] bg-white overflow-hidden cursor-pointer hover:border-[#2271b1] focus-visible:border-[#2271b1]";
  const empty = "flex w-full aspect-square items-center justify-center border border-dashed border-[#c3c4c7] wp-muted wp-small";
  const items = [
    { key: "profilePhoto", label: "Profile photo", missing: "No photo", alt: "Profile" },
    { key: "liveSelfie", label: "Live selfie", missing: "No selfie", alt: "Live Selfie" },
    { key: "bankVerificationDocument", label: "Bank document", missing: "No bank doc", alt: "Bank Verification" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-2">
      {items.map(({ key, label, missing, alt }) => {
        const file = record[key];
        const isPdf = key === "bankVerificationDocument" && file && file.toLowerCase().endsWith(".pdf");
        return (
          <div key={key} className="text-center min-w-0">
            <div className="wp-small wp-muted mb-1">{label}</div>
            {file ? (
              <button type="button" className={tile} onClick={() => onOpen(getUrl(file))} aria-label={`Open ${label.toLowerCase()}`}>
                {isPdf ? (
                  <span className="flex flex-col items-center justify-center h-full p-2">
                    <FileText className="w-8 h-8 text-[#a7aaad] mb-1" aria-hidden="true" />
                    <span className="font-mono wp-small truncate w-full">{file}</span>
                  </span>
                ) : (
                  <img src={getUrl(file)} alt={alt} className="w-full h-full object-cover" />
                )}
              </button>
            ) : (
              <div className={empty}>{missing}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
