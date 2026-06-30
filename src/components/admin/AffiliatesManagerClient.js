"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { Users, CheckSquare, Coins, Settings, Eye, X, ExternalLink, RefreshCw, BarChart2, Link2, ShoppingCart, MousePointerClick, DollarSign, CreditCard, TrendingUp, AlertCircle } from "lucide-react";

export default function AffiliatesManagerClient({ userSession }) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("requests");
  const [loading, setLoading] = useState(true);

  // States
  const [applications, setApplications] = useState([]);
  const [affiliates, setAffiliates] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [settings, setSettings] = useState({
    defaultCommissionRate: 5,
    cookieDurationDays: 30,
    minimumPayoutAmount: 50,
    autoApproveApplications: false,
    supportEmail: "affiliates@pairolifestyle.com"
  });

  // Action / Edit Modal States
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);
  const [selectedPayout, setSelectedPayout] = useState(null);

  // Review Application inputs
  const [reviewAction, setReviewAction] = useState("Approve");
  const [rejectionReason, setRejectionReason] = useState("");
  const [notes, setNotes] = useState("");
  const [customCommissionRate, setCustomCommissionRate] = useState(5);
  const [commissionType, setCommissionType] = useState("Percentage");
  const [reviewDiscountType, setReviewDiscountType] = useState("None");
  const [reviewDiscountValue, setReviewDiscountValue] = useState(0);
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
    password: ""
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

  // Referral Code states for review/edit modals
  const [reviewReferralCode, setReviewReferralCode] = useState("");
  const [editReferralCode, setEditReferralCode] = useState("");
  const [referralCodeError, setReferralCodeError] = useState("");

  // Overview stats
  const [overviewStats, setOverviewStats] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqsRes, affsRes, paysRes, settsRes] = await Promise.all([
        fetch("/api/admin/affiliates/requests").then(r => r.json()),
        fetch("/api/admin/affiliates/list").then(r => r.json()),
        fetch("/api/admin/affiliates/payouts").then(r => r.json()),
        fetch("/api/admin/affiliates/settings").then(r => r.json())
      ]);

      if (reqsRes.success) setApplications(reqsRes.applications);
      if (affsRes.success) setAffiliates(affsRes.affiliates);
      if (paysRes.success) setPayouts(paysRes.payouts);
      if (settsRes.success) setSettings(settsRes.settings);
    } catch (e) {
      toast.error("Failed to load administration database records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Sync tab with ?view= URL param
    const view = searchParams.get("view");
    if (view) setActiveTab(view);
    loadData();
  }, [searchParams]);

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
          customerDiscountValue: reviewAction === "Approve" ? reviewDiscountValue : undefined,
          referralCode: reviewReferralCode || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process review.");

      toast.success(reviewAction === "Approve" ? "Application approved!" : "Application rejected.");
      setSelectedApplication(null);
      setNotes("");
      setRejectionReason("");
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
          __v: currentAff?.__v, // Send version key for validation
          ...editForm,
          referralCode: editReferralCode || undefined  // Admin-editable
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
      setSubmittingEdit(false);
    }
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
      setSelectedPayout(null);
      setPayoutTxId("");
      setPayoutNotes("");
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
      <AdminPageLayout title="Affiliates" breadcrumbs={[{ label: "Affiliates" }]}>
        <div className="flex items-center justify-center min-h-[400px] bg-white border border-[#ccd0d4] rounded-[3px] shadow-sm">
          <div className="space-y-4 text-center">
            <span className="animate-spin inline-block h-8 w-8 border-2 border-black/20 border-t-black rounded-full" />
            <p className="text-xs uppercase tracking-widest text-[#646970]">Fetching database registers...</p>
          </div>
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="Affiliate Management"
      breadcrumbs={[{ label: "Affiliates" }]}
    >
      <div className="space-y-6 text-[#2c3338] font-sans">
        
        {/* WP style Stats Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-[#ccd0d4] p-4 flex items-center gap-4 shadow-sm rounded-[3px]">
            <div className="p-3 bg-[#f0f6fb] text-[#2271b1] rounded-full">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#646970] uppercase">Active Partners</p>
              <p className="text-xl font-bold text-[#1d2327]">{affiliates.length}</p>
            </div>
          </div>
          <div className="bg-white border border-[#ccd0d4] p-4 flex items-center gap-4 shadow-sm rounded-[3px]">
            <div className="p-3 bg-amber-50 text-amber-700 rounded-full">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#646970] uppercase">Pending Reviews</p>
              <p className="text-xl font-bold text-[#1d2327]">{applications.filter(a => a.status === 'Pending').length}</p>
            </div>
          </div>
          <div className="bg-white border border-[#ccd0d4] p-4 flex items-center gap-4 shadow-sm rounded-[3px]">
            <div className="p-3 bg-green-50 text-green-700 rounded-full">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#646970] uppercase">Pending Payouts</p>
              <p className="text-xl font-bold text-[#1d2327]">{payouts.filter(p => p.status === 'Requested').length}</p>
            </div>
          </div>
          <div className="bg-white border border-[#ccd0d4] p-4 flex items-center gap-4 shadow-sm rounded-[3px]">
            <div className="p-3 bg-blue-50 text-[#2271b1] rounded-full">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#646970] uppercase">Default Commission</p>
              <p className="text-xl font-bold text-[#1d2327]">{settings.defaultCommissionRate}%</p>
            </div>
          </div>
        </div>

        {/* WP-Style Subsubsub Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#646970] border-b border-[#ccd0d4] pb-2">
          {[
            { id: "requests", label: "Applications", count: applications.filter(a => a.status === 'Pending').length },
            { id: "list", label: "Active Affiliates", count: affiliates.length },
            { id: "payouts", label: "Payout Requests", count: payouts.filter(p => p.status === 'Requested').length },
            { id: "settings", label: "Global Settings", count: null }
          ].map((tab, idx, arr) => (
            <span key={tab.id} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`transition-all focus:outline-none ${
                  activeTab === tab.id
                    ? "text-[#1d2327] font-bold"
                    : "text-[#2271b1] hover:text-[#135e96]"
                }`}
              >
                {tab.label}
              </button>
              {tab.count !== null && <span className="text-[#8c8f94]">({tab.count})</span>}
              {idx < arr.length - 1 && <span className="text-[#ccd0d4]">|</span>}
            </span>
          ))}
        </div>

        {/* Tab 1: Requests */}
        {activeTab === "requests" && (
          <div className="bg-white border border-[#ccd0d4] shadow-sm rounded-[3px] overflow-hidden">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4] text-[#1d2327]">
                  <th className="px-4 py-3 font-bold uppercase text-[11px] w-48">Applicant</th>
                  <th className="px-4 py-3 font-bold uppercase text-[11px] w-64">Contact details</th>
                  <th className="px-4 py-3 font-bold uppercase text-[11px] w-32">Country</th>
                  <th className="px-4 py-3 font-bold uppercase text-[11px]">Verification Docs</th>
                  <th className="px-4 py-3 font-bold uppercase text-[11px] w-64">Strategy & Reach</th>
                  <th className="px-4 py-3 font-bold uppercase text-[11px] w-24">Status</th>
                  <th className="px-4 py-3 w-28 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f1]">
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-gray-400 italic">No applications found in database records.</td>
                  </tr>
                ) : (
                  applications.map(app => (
                    <tr key={app._id} className="hover:bg-[#fbfbfb] transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-bold text-[#1d2327]">{app.name}</span>
                        <div className="text-[11px] text-[#646970] mt-0.5">Applied: {new Date(app.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px]">
                        <div>{app.email}</div>
                        <div className="text-[#646970] mt-0.5 text-[11px]">{app.phone}</div>
                      </td>
                      <td className="px-4 py-3">{app.address?.country}</td>
                      <td className="px-4 py-3 font-mono text-[12px]">
                        {app.identityDocuments?.map((filename, idx) => (
                          <button
                            key={idx}
                            onClick={() => setViewingDocUrl(getDocumentUrl(filename))}
                            className="text-[#2271b1] hover:text-[#135e96] underline mr-3 inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> Doc #{idx + 1}
                          </button>
                        ))}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="truncate text-gray-600">{app.marketingAnswers?.promotionStrategy}</div>
                        <div className="text-[10px] text-[#646970] font-bold uppercase tracking-wide mt-0.5">Reach: {app.marketingAnswers?.audienceSize}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider ${
                          app.status === 'Approved' ? 'bg-[#d5e8d4] text-[#274e13]' :
                          app.status === 'Rejected' ? 'bg-[#f8cecc] text-[#b85450]' : 'bg-[#fff2cc] text-[#d6b656]'
                        }`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => setViewingApplication(app)}
                          className="bg-white border border-[#ccd0d4] text-[#2c3338] px-3 py-1 rounded-[3px] text-[12px] font-bold hover:bg-[#f6f7f7] transition-all shadow-sm"
                        >
                          View Details
                        </button>
                        {app.status === 'Pending' && (
                          <button
                            onClick={() => {
                              setSelectedApplication(app);
                              setCustomCommissionRate(settings.defaultCommissionRate || 5);
                              setReviewReferralCode(app.referralCode || ""); // Pre-fill with applicant's chosen code
                            }}
                            className="bg-[#2271b1] border border-[#2271b1] text-white px-3 py-1 rounded-[3px] text-[12px] font-bold hover:bg-[#135e96] hover:border-[#135e96] transition-all shadow-sm"
                          >
                            Review
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Affiliates List */}
        {activeTab === "list" && (
          <div className="bg-white border border-[#ccd0d4] shadow-sm rounded-[3px] overflow-hidden">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4] text-[#1d2327]">
                  <th className="px-4 py-3 font-bold uppercase text-[11px]">Affiliate</th>
                  <th className="px-4 py-3 font-bold uppercase text-[11px] w-36">Referral Code</th>
                  <th className="px-4 py-3 font-bold uppercase text-[11px] w-36">Direct Coupon</th>
                  <th className="px-4 py-3 font-bold uppercase text-[11px] w-32">Commission Rate</th>
                  <th className="px-4 py-3 font-bold uppercase text-[11px] w-36">Available Balance</th>
                  <th className="px-4 py-3 font-bold uppercase text-[11px] w-36">Lifetime Earnings</th>
                  <th className="px-4 py-3 font-bold uppercase text-[11px] w-24">Status</th>
                  <th className="px-4 py-3 w-28 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f1]">
                {affiliates.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-gray-400 italic">No active affiliates registered.</td>
                  </tr>
                ) : (
                  affiliates.map(aff => (
                    <tr key={aff._id} className="hover:bg-[#fbfbfb] transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-bold text-[#1d2327]">{aff.name}</span>
                        <div className="text-[11px] text-[#646970] mt-0.5">{aff.email}</div>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-black">{aff.referralCode}</td>
                      <td className="px-4 py-3 font-mono text-primary/60">{aff.couponCode || "—"}</td>
                      <td className="px-4 py-3 font-bold text-black">
                        {aff.commissionType === "Fixed" ? `$${aff.commissionRate} (Fixed)` : `${aff.commissionRate}%`}
                      </td>
                      <td className="px-4 py-3 font-bold text-[#1d2327]">${aff.balance?.toFixed(2)}</td>
                      <td className="px-4 py-3 text-[#646970]">${aff.lifetimeEarnings?.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider ${
                          aff.status === 'Active' ? 'bg-[#d5e8d4] text-[#274e13]' : 'bg-[#f8cecc] text-[#b85450]'
                        }`}>
                          {aff.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedAffiliate(aff);
                            setEditReferralCode(aff.referralCode || "");
                            setEditForm({
                              name: aff.name,
                              email: aff.email,
                              commissionRate: aff.commissionRate,
                              commissionType: aff.commissionType || "Percentage",
                              customerDiscountType: aff.customerDiscountType || "None",
                              customerDiscountValue: aff.customerDiscountValue || 0,
                              status: aff.status,
                              couponCode: aff.couponCode || "",
                              password: ""
                            });
                          }}
                          className="bg-white border border-[#ccd0d4] text-[#2c3338] px-3 py-1 rounded-[3px] text-[12px] font-bold hover:bg-[#f6f7f7] transition-all shadow-sm"
                        >
                          Modify
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Payouts */}
        {activeTab === "payouts" && (
          <div className="bg-white border border-[#ccd0d4] shadow-sm rounded-[3px] overflow-hidden">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4] text-[#1d2327]">
                  <th className="px-4 py-3 font-bold uppercase text-[11px]">Affiliate</th>
                  <th className="px-4 py-3 font-bold uppercase text-[11px] w-36">Amount</th>
                  <th className="px-4 py-3 font-bold uppercase text-[11px] w-40">Method</th>
                  <th className="px-4 py-3 font-bold uppercase text-[11px] w-36">Date</th>
                  <th className="px-4 py-3 font-bold uppercase text-[11px] w-28">Status</th>
                  <th className="px-4 py-3 font-bold uppercase text-[11px] w-48">Reference ID</th>
                  <th className="px-4 py-3 w-28 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f1]">
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-gray-400 italic">No payout requests registered.</td>
                  </tr>
                ) : (
                  payouts.map(pay => (
                    <tr key={pay._id} className="hover:bg-[#fbfbfb] transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-bold text-[#1d2327]">{pay.affiliateId?.name || "Deleted Affiliate"}</span>
                        <div className="text-[11px] text-[#646970] mt-0.5">Code: {pay.affiliateId?.referralCode || "—"}</div>
                      </td>
                      <td className="px-4 py-3 font-bold text-[#1d2327]">${pay.amount?.toFixed(2)}</td>
                      <td className="px-4 py-3 font-mono text-[#646970]">{pay.paymentMethod}</td>
                      <td className="px-4 py-3 text-gray-600">{new Date(pay.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider ${
                          pay.status === 'Paid' ? 'bg-[#d5e8d4] text-[#274e13]' :
                          pay.status === 'Rejected' ? 'bg-[#f8cecc] text-[#b85450]' : 'bg-[#fff2cc] text-[#d6b656]'
                        }`}>
                          {pay.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-500">{pay.transactionId || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {pay.status === 'Requested' && (
                          <button
                            onClick={() => {
                              setSelectedPayout(pay);
                              setPayoutTxId(`TX-${Date.now()}`);
                            }}
                            className="bg-white border border-[#2271b1] text-[#2271b1] px-3 py-1 rounded-[3px] text-[12px] font-bold hover:bg-[#f0f6fb] transition-all shadow-sm"
                          >
                            Process
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Settings (WordPress form layout) */}
        {activeTab === "settings" && (
          <form onSubmit={handleSettingsSubmit} className="bg-white border border-[#ccd0d4] shadow-sm rounded-[3px] p-6 max-w-3xl space-y-6">
            <h3 className="text-[15px] font-bold text-[#1d2327] border-b border-[#ccd0d4] pb-2">Global Settings Options</h3>
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4 py-2 border-b border-[#f0f0f1]">
                <label className="text-[13px] font-bold text-[#1d2327] md:w-56">Default Commission Rate (%)</label>
                <div className="flex-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.defaultCommissionRate}
                    onChange={(e) => setSettings({ ...settings, defaultCommissionRate: Number(e.target.value) })}
                    required
                    className="border border-[#8c8f94] rounded-[3px] px-3 py-1.5 focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] outline-none text-[13px] w-full max-w-[200px]"
                  />
                  <p className="text-[12px] text-[#646970] mt-1">Default percentage credited to partners per checkout conversion.</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-4 py-2 border-b border-[#f0f0f1]">
                <label className="text-[13px] font-bold text-[#1d2327] md:w-56">Cookie Window (Days)</label>
                <div className="flex-1">
                  <input
                    type="number"
                    min="1"
                    value={settings.cookieDurationDays}
                    onChange={(e) => setSettings({ ...settings, cookieDurationDays: Number(e.target.value) })}
                    required
                    className="border border-[#8c8f94] rounded-[3px] px-3 py-1.5 focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] outline-none text-[13px] w-full max-w-[200px]"
                  />
                  <p className="text-[12px] text-[#646970] mt-1">Number of days tracking referrals remain valid after link visits.</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-4 py-2 border-b border-[#f0f0f1]">
                <label className="text-[13px] font-bold text-[#1d2327] md:w-56">Minimum Withdrawal ($)</label>
                <div className="flex-1">
                  <input
                    type="number"
                    min="1"
                    value={settings.minimumPayoutAmount}
                    onChange={(e) => setSettings({ ...settings, minimumPayoutAmount: Number(e.target.value) })}
                    required
                    className="border border-[#8c8f94] rounded-[3px] px-3 py-1.5 focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] outline-none text-[13px] w-full max-w-[200px]"
                  />
                  <p className="text-[12px] text-[#646970] mt-1">Minimum available balance required to request cash withdrawals.</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-4 py-2 border-b border-[#f0f0f1]">
                <label className="text-[13px] font-bold text-[#1d2327] md:w-56">Support Contact Email</label>
                <div className="flex-1">
                  <input
                    type="email"
                    value={settings.supportEmail}
                    onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                    required
                    className="border border-[#8c8f94] rounded-[3px] px-3 py-1.5 focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] outline-none text-[13px] w-full max-w-[400px]"
                  />
                  <p className="text-[12px] text-[#646970] mt-1">Recipient of new partner signup notifications.</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-start gap-4 py-2">
                <label className="text-[13px] font-bold text-[#1d2327] md:w-56">Auto-Approve Signups</label>
                <div className="flex-1">
                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={settings.autoApproveApplications}
                      onChange={(e) => setSettings({ ...settings, autoApproveApplications: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-[#2271b1] focus:ring-[#2271b1]"
                    />
                    <span className="text-[13px] text-[#1d2327]">Automatically approve applications</span>
                  </label>
                  <p className="text-[12px] text-[#646970] mt-1">If enabled, registrations automatically bypass staff review and generate partner accounts immediately.</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#ccd0d4]">
              <button
                type="submit"
                disabled={savingSettings}
                className="bg-[#2271b1] border border-[#2271b1] hover:bg-[#135e96] hover:border-[#135e96] text-white px-4 py-2 text-[13px] font-medium rounded-[3px] disabled:opacity-50 cursor-pointer shadow-sm font-bold uppercase tracking-wider"
              >
                {savingSettings ? "Saving Settings..." : "Save Settings"}
              </button>
            </div>
          </form>
        )}

        {/* Modal 0: View Application Details */}
        {viewingApplication && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3px] border border-[#ccd0d4] shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-[#ccd0d4] bg-[#f6f7f7] flex items-center justify-between flex-shrink-0">
                <h3 className="text-[14px] font-bold text-[#1d2327]">Application Details: {viewingApplication.name}</h3>
                <button
                  type="button"
                  onClick={() => setViewingApplication(null)}
                  className="text-gray-400 hover:text-black focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 text-[13px] text-gray-700">
                {/* 1. General Profile */}
                <div className="space-y-2">
                  <h4 className="font-bold text-[12px] uppercase tracking-wider text-[#1d2327] border-b border-[#ccd0d4] pb-1">General Contact Profile</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    <div><span className="text-[#646970] font-semibold">Full Legal Name:</span> <span className="text-[#1d2327] font-medium">{viewingApplication.name}</span></div>
                    <div><span className="text-[#646970] font-semibold">Email Address:</span> <span className="text-[#2271b1]">{viewingApplication.email}</span></div>
                    <div><span className="text-[#646970] font-semibold">Phone Number:</span> <span className="text-[#1d2327]">{viewingApplication.phone}</span></div>
                    <div><span className="text-[#646970] font-semibold">Date of Birth:</span> <span className="text-[#1d2327]">{viewingApplication.dob ? new Date(viewingApplication.dob).toLocaleDateString() : "—"}</span></div>
                    <div><span className="text-[#646970] font-semibold">Submission Date:</span> <span className="text-[#1d2327]">{new Date(viewingApplication.createdAt).toLocaleString()}</span></div>
                    <div>
                      <span className="text-[#646970] font-semibold">Preferred Referral Code:</span>{" "}
                      {viewingApplication.referralCode
                        ? <code className="bg-[#fff2cc] border border-[#d6b656] text-[#634f00] px-2 py-0.5 rounded text-[12px] font-mono font-bold">{viewingApplication.referralCode}</code>
                        : <span className="text-[#646970] italic">Will be auto-generated</span>
                      }
                    </div>
                    <div>
                      <span className="text-[#646970] font-semibold">Status:</span>{" "}
                      <span className={`px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider ${
                        viewingApplication.status === 'Approved' ? 'bg-[#d5e8d4] text-[#274e13]' :
                        viewingApplication.status === 'Rejected' ? 'bg-[#f8cecc] text-[#b85450]' : 'bg-[#fff2cc] text-[#d6b656]'
                      }`}>
                        {viewingApplication.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Postal Address */}
                <div className="space-y-2">
                  <h4 className="font-bold text-[12px] uppercase tracking-wider text-[#1d2327] border-b border-[#ccd0d4] pb-1">Postal Address</h4>
                  <div className="space-y-1">
                    <div><span className="text-[#646970] font-semibold">Street:</span> <span className="text-[#1d2327]">{viewingApplication.address?.street || "—"}</span></div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div><span className="text-[#646970] font-semibold">City:</span> <span className="text-[#1d2327]">{viewingApplication.address?.city || "—"}</span></div>
                      <div><span className="text-[#646970] font-semibold">State/Province:</span> <span className="text-[#1d2327]">{viewingApplication.address?.state || "—"}</span></div>
                      <div><span className="text-[#646970] font-semibold">Zip/Postal Code:</span> <span className="text-[#1d2327]">{viewingApplication.address?.zipCode || "—"}</span></div>
                    </div>
                    <div><span className="text-[#646970] font-semibold">Country:</span> <span className="text-[#1d2327]">{viewingApplication.address?.country || "—"}</span></div>
                  </div>
                </div>

                {/* 3. Payout & Banking Info */}
                <div className="space-y-2">
                  <h4 className="font-bold text-[12px] uppercase tracking-wider text-[#1d2327] border-b border-[#ccd0d4] pb-1">Banking & Payout Profile</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 bg-[#f6f7f7] p-3 border border-[#ccd0d4] rounded-[3px]">
                    <div className="sm:col-span-2"><span className="text-[#646970] font-semibold">Account Holder Name:</span> <span className="text-[#1d2327] font-bold">{viewingApplication.bankingInfo?.accountHolder || "—"}</span></div>
                    <div><span className="text-[#646970] font-semibold">Bank Name:</span> <span className="text-[#1d2327]">{viewingApplication.bankingInfo?.bankName || "—"}</span></div>
                    <div><span className="text-[#646970] font-semibold">Account / IBAN:</span> <span className="text-[#1d2327] font-mono">{viewingApplication.bankingInfo?.accountNumber || "—"}</span></div>
                    <div><span className="text-[#646970] font-semibold">SWIFT/BIC Code:</span> <span className="text-[#1d2327] font-mono">{viewingApplication.bankingInfo?.swiftCode || "—"}</span></div>
                    <div><span className="text-[#646970] font-semibold">Routing Number:</span> <span className="text-[#1d2327] font-mono">{viewingApplication.bankingInfo?.routingNumber || "—"}</span></div>
                    <div className="sm:col-span-2"><span className="text-[#646970] font-semibold">PayPal Email Address:</span> <span className="text-[#1d2327]">{viewingApplication.bankingInfo?.paypalEmail || "—"}</span></div>
                  </div>
                </div>

                {/* 4. Business & Strategy */}
                <div className="space-y-2">
                  <h4 className="font-bold text-[12px] uppercase tracking-wider text-[#1d2327] border-b border-[#ccd0d4] pb-1">Marketing Strategy & Reach</h4>
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div><span className="text-[#646970] font-semibold">Company Name:</span> <span className="text-[#1d2327]">{viewingApplication.companyName || "—"}</span></div>
                      <div>
                        <span className="text-[#646970] font-semibold">Website:</span>{" "}
                        {viewingApplication.website ? (
                          <a href={viewingApplication.website} target="_blank" rel="noreferrer" className="text-[#2271b1] hover:underline inline-flex items-center gap-1">
                            {viewingApplication.website} <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : "—"}
                      </div>
                    </div>
                    <div>
                      <span className="text-[#646970] font-semibold">Social Media Channels:</span>{" "}
                      <span className="text-[#1d2327]">{viewingApplication.socialLinks || "—"}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div><span className="text-[#646970] font-semibold">Monthly Reach / Traffic:</span> <span className="text-[#1d2327] font-medium">{viewingApplication.marketingAnswers?.audienceSize || "—"}</span></div>
                      <div><span className="text-[#646970] font-semibold">Affiliate Experience:</span> <span className="text-[#1d2327] font-medium">{viewingApplication.marketingAnswers?.experience || "—"}</span></div>
                    </div>
                    <div>
                      <span className="text-[#646970] font-semibold block mb-0.5">Promotion Methodology:</span>
                      <p className="bg-[#f6f7f7] p-2.5 border border-[#ccd0d4] rounded-[2px] text-gray-600 text-[12px] whitespace-pre-line leading-relaxed">
                        {viewingApplication.marketingAnswers?.promotionStrategy || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 5. Documents */}
                <div className="space-y-2">
                  <h4 className="font-bold text-[12px] uppercase tracking-wider text-[#1d2327] border-b border-[#ccd0d4] pb-1">KYC / Identity Verification Documents</h4>
                  <div className="flex flex-wrap gap-3">
                    {viewingApplication.identityDocuments && viewingApplication.identityDocuments.length > 0 ? (
                      viewingApplication.identityDocuments.map((filename, idx) => (
                        <div key={idx} className="border border-[#ccd0d4] p-3 rounded-[3px] bg-[#f6f7f7] flex items-center justify-between gap-4 w-full sm:w-[48%]">
                          <span className="font-mono text-[11px] truncate max-w-[150px]">{filename}</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setViewingDocUrl(getDocumentUrl(filename))}
                              className="text-[#2271b1] hover:text-[#135e96] hover:underline font-bold text-[11px] uppercase cursor-pointer"
                            >
                              Preview
                            </button>
                            <a
                              href={getDocumentUrl(filename)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-gray-600 hover:text-black hover:underline font-bold text-[11px] uppercase inline-flex items-center gap-0.5"
                            >
                              Download <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 italic text-[12px]">No document attachments present.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-[#ccd0d4] bg-[#f6f7f7] flex justify-end gap-2 flex-shrink-0">
                {viewingApplication.status === "Pending" && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedApplication(viewingApplication);
                      setCustomCommissionRate(settings.defaultCommissionRate || 5);
                      setViewingApplication(null);
                    }}
                    className="bg-[#2271b1] border border-[#2271b1] text-white hover:bg-[#135e96] hover:border-[#135e96] px-4 py-2 text-[12px] font-bold rounded-[3px] shadow-sm uppercase tracking-wider cursor-pointer"
                  >
                    Proceed to Review
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingApplication(null)}
                  className="border border-[#ccd0d4] bg-white text-gray-700 hover:bg-[#f6f7f7] px-4 py-2 text-[12px] font-bold rounded-[3px] shadow-sm uppercase tracking-wider cursor-pointer"
                >
                  Close Detail
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 1: Review Application */}
        {selectedApplication && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3px] border border-[#ccd0d4] shadow-2xl max-w-md w-full overflow-hidden">
              <div className="p-4 border-b border-[#ccd0d4] bg-[#f6f7f7] flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-[#1d2327]">Review: {selectedApplication.name}</h3>
                <button
                  type="button"
                  onClick={() => setSelectedApplication(null)}
                  className="text-gray-400 hover:text-black focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleApplicationReview} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-[#1d2327]">Action *</label>
                  <select
                    value={reviewAction}
                    onChange={(e) => setReviewAction(e.target.value)}
                    className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px]"
                  >
                    <option value="Approve">Approve and Register Account</option>
                    <option value="Reject">Reject Application</option>
                  </select>
                </div>

                {reviewAction === "Approve" ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-[12px] font-bold text-[#1d2327]">Commission Type *</label>
                      <select
                        value={commissionType}
                        onChange={(e) => {
                          setCommissionType(e.target.value);
                          setCustomCommissionRate(e.target.value === "Percentage" ? 5 : 10);
                        }}
                        className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px]"
                      >
                        <option value="Percentage">Percentage Commission (%)</option>
                        <option value="Fixed">Fixed Commission ($)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[12px] font-bold text-[#1d2327]">
                        {commissionType === "Percentage" ? "Commission Rate (%) *" : "Fixed Commission Amount ($) *"}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={commissionType === "Percentage" ? 100 : 10000}
                        value={customCommissionRate}
                        onChange={(e) => setCustomCommissionRate(Number(e.target.value))}
                        required
                        className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px]"
                      />
                    </div>

                    {/* Customer Discount — independent from commission */}
                    <div className="border-t border-[#eee] pt-4 space-y-3">
                      <p className="text-[11px] font-bold text-[#646970] uppercase tracking-widest">Customer Discount (optional)</p>
                      <div className="space-y-1">
                        <label className="text-[12px] font-bold text-[#1d2327]">Discount Type</label>
                        <select
                          value={reviewDiscountType}
                          onChange={(e) => {
                            setReviewDiscountType(e.target.value);
                            setReviewDiscountValue(0);
                          }}
                          className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px]"
                        >
                          <option value="None">None — No customer discount</option>
                          <option value="Percentage">Percentage Discount (%)</option>
                          <option value="Fixed">Fixed Amount Discount ($)</option>
                        </select>
                      </div>
                      {reviewDiscountType !== "None" && (
                        <div className="space-y-1">
                          <label className="text-[12px] font-bold text-[#1d2327]">
                            {reviewDiscountType === "Percentage" ? "Discount Rate (%)" : "Discount Amount ($)"}
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={reviewDiscountType === "Percentage" ? 100 : 10000}
                            value={reviewDiscountValue}
                            onChange={(e) => setReviewDiscountValue(Number(e.target.value))}
                            placeholder={reviewDiscountType === "Percentage" ? "e.g. 10" : "e.g. 5"}
                            className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px]"
                          />
                          <p className="text-[11px] text-[#646970]">
                            Customers using this referral link will receive this discount on their order.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[12px] font-bold text-[#1d2327]">Referral Code *</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={reviewReferralCode}
                          onChange={e => setReviewReferralCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                          placeholder="Auto-generated from name if empty"
                          className="flex-1 border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px] font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                            setReviewReferralCode(Array.from({length: 8}, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
                          }}
                          className="shrink-0 bg-[#f6f7f7] border border-[#ccd0d4] text-[#2c3338] hover:bg-[#e0e0e0] px-3 py-1.5 rounded-[3px] text-[12px] font-bold transition-all"
                          title="Generate a random referral code"
                        >
                          Generate
                        </button>
                      </div>
                      {selectedApplication?.referralCode && (
                        <p className="text-[11px] text-[#646970]">Applicant requested: <code className="font-mono font-bold text-amber-700">{selectedApplication.referralCode}</code></p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-1">
                    <label className="text-[12px] font-bold text-[#1d2327]">Rejection Reason *</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      required
                      rows="3"
                      placeholder="Reason for rejecting the request..."
                      className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px] resize-none"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-[#1d2327]">Internal Audit Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows="2"
                    placeholder="Comments visible to staff only..."
                    className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px] resize-none"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-2 border-t border-[#ccd0d4]">
                  <button
                    type="button"
                    onClick={() => setSelectedApplication(null)}
                    className="border border-[#ccd0d4] bg-white text-[#2c3338] hover:bg-[#f6f7f7] px-4 py-2 text-[13px] font-medium rounded-[3px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="bg-[#2271b1] border border-[#2271b1] hover:bg-[#135e96] hover:border-[#135e96] text-white px-4 py-2 text-[13px] font-medium rounded-[3px] disabled:opacity-50"
                  >
                    {submittingReview ? "Processing..." : "Confirm Review"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Modify Affiliate */}
        {selectedAffiliate && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3px] border border-[#ccd0d4] shadow-2xl max-w-md w-full overflow-hidden">
              <div className="p-4 border-b border-[#ccd0d4] bg-[#f6f7f7] flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-[#1d2327]">Edit Affiliate: {selectedAffiliate.name}</h3>
                <button
                  type="button"
                  onClick={() => setSelectedAffiliate(null)}
                  className="text-gray-400 hover:text-black focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAffiliateEditSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-[#1d2327]">Display Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                    className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-[#1d2327]">Email Address</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    required
                    className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-[#1d2327]">Commission Type</label>
                  <select
                    value={editForm.commissionType}
                    onChange={(e) => setEditForm({ ...editForm, commissionType: e.target.value })}
                    className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px]"
                  >
                    <option value="Percentage">Percentage Commission (%)</option>
                    <option value="Fixed">Fixed Commission ($)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-[#1d2327]">
                    {editForm.commissionType === "Percentage" ? "Commission Rate (%)" : "Fixed Commission Amount ($)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={editForm.commissionType === "Percentage" ? 100 : 10000}
                    value={editForm.commissionRate}
                    onChange={(e) => setEditForm({ ...editForm, commissionRate: Number(e.target.value) })}
                    required
                    className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px]"
                  />
                </div>

                {/* Customer Discount — independent from commission */}
                <div className="border-t border-[#eee] pt-4 space-y-3">
                  <p className="text-[11px] font-bold text-[#646970] uppercase tracking-widest">Customer Discount</p>
                  <div className="space-y-1">
                    <label className="text-[12px] font-bold text-[#1d2327]">Discount Type</label>
                    <select
                      value={editForm.customerDiscountType}
                      onChange={(e) => setEditForm({ ...editForm, customerDiscountType: e.target.value, customerDiscountValue: 0 })}
                      className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px]"
                    >
                      <option value="None">None — No customer discount</option>
                      <option value="Percentage">Percentage Discount (%)</option>
                      <option value="Fixed">Fixed Amount Discount ($)</option>
                    </select>
                  </div>
                  {editForm.customerDiscountType !== "None" && (
                    <div className="space-y-1">
                      <label className="text-[12px] font-bold text-[#1d2327]">
                        {editForm.customerDiscountType === "Percentage" ? "Discount Rate (%)" : "Discount Amount ($)"}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={editForm.customerDiscountType === "Percentage" ? 100 : 10000}
                        value={editForm.customerDiscountValue}
                        onChange={(e) => setEditForm({ ...editForm, customerDiscountValue: Number(e.target.value) })}
                        placeholder={editForm.customerDiscountType === "Percentage" ? "e.g. 10" : "e.g. 5"}
                        className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px]"
                      />
                      <p className="text-[11px] text-[#646970]">
                        Customers using this referral link will receive this discount on their order.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-[#1d2327]">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px]"
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended / Suspended</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-[#1d2327]">Assigned Coupon Code</label>
                  <input
                    type="text"
                    value={editForm.couponCode}
                    onChange={(e) => setEditForm({ ...editForm, couponCode: e.target.value })}
                    placeholder="Leave empty for none"
                    className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px] font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-[#1d2327]">Referral Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editReferralCode}
                      onChange={e => setEditReferralCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                      placeholder="Unique referral code"
                      className="flex-1 border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                        setEditReferralCode(Array.from({length: 8}, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
                      }}
                      className="shrink-0 bg-[#f6f7f7] border border-[#ccd0d4] text-[#2c3338] hover:bg-[#e0e0e0] px-3 py-1.5 rounded-[3px] text-[12px] font-bold"
                      title="Generate a random referral code"
                    >
                      Generate
                    </button>
                  </div>
                  <p className="text-[11px] text-[#646970]">Current: <code className="font-mono font-bold">{selectedAffiliate?.referralCode || "N/A"}</code></p>
                </div>

                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-[#1d2327]">Reset Password</label>
                  <input
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="Leave empty to keep unchanged"
                    className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px]"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-2 border-t border-[#ccd0d4]">
                  <button
                    type="button"
                    onClick={() => setSelectedAffiliate(null)}
                    className="border border-[#ccd0d4] bg-white text-[#2c3338] hover:bg-[#f6f7f7] px-4 py-2 text-[13px] font-medium rounded-[3px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingEdit}
                    className="bg-[#2271b1] border border-[#2271b1] hover:bg-[#135e96] hover:border-[#135e96] text-white px-4 py-2 text-[13px] font-medium rounded-[3px] disabled:opacity-50"
                  >
                    {submittingEdit ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 3: Process Payout */}
        {selectedPayout && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3px] border border-[#ccd0d4] shadow-2xl max-w-md w-full overflow-hidden">
              <div className="p-4 border-b border-[#ccd0d4] bg-[#f6f7f7] flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-[#1d2327]">Process Payout: ${selectedPayout.amount?.toFixed(2)}</h3>
                <button
                  type="button"
                  onClick={() => setSelectedPayout(null)}
                  className="text-gray-400 hover:text-black focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handlePayoutProcess} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-[#1d2327]">Action *</label>
                  <select
                    value={payoutAction}
                    onChange={(e) => setPayoutAction(e.target.value)}
                    className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px]"
                  >
                    <option value="Approve">Mark Payout as Paid</option>
                    <option value="Reject">Reject Request (Refund Balance)</option>
                  </select>
                </div>

                {payoutAction === "Approve" && (
                  <div className="space-y-1">
                    <label className="text-[12px] font-bold text-[#1d2327]">Transaction ID / Reference *</label>
                    <input
                      type="text"
                      value={payoutTxId}
                      onChange={(e) => setPayoutTxId(e.target.value)}
                      required
                      placeholder="e.g. PayPal TxID or bank trace ref"
                      className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px] font-mono"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-[#1d2327]">Feedback Notes</label>
                  <textarea
                    value={payoutNotes}
                    onChange={(e) => setPayoutNotes(e.target.value)}
                    rows="3"
                    placeholder="Sent in notification email to partner..."
                    className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-1.5 outline-none text-[13px] resize-none"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-2 border-t border-[#ccd0d4]">
                  <button
                    type="button"
                    onClick={() => setSelectedPayout(null)}
                    className="border border-[#ccd0d4] bg-white text-[#2c3338] hover:bg-[#f6f7f7] px-4 py-2 text-[13px] font-medium rounded-[3px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayout}
                    className="bg-[#2271b1] border border-[#2271b1] hover:bg-[#135e96] hover:border-[#135e96] text-white px-4 py-2 text-[13px] font-medium rounded-[3px] disabled:opacity-50"
                  >
                    {submittingPayout ? "Processing..." : "Confirm"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 4: Secure Document Viewer */}
        {viewingDocUrl && (
          <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3px] border border-[#ccd0d4] shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-[#ccd0d4] bg-[#f6f7f7] flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-[#1d2327]">KYC Document Viewer</h3>
                <button
                  type="button"
                  onClick={() => setViewingDocUrl(null)}
                  className="text-gray-400 hover:text-black focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
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
                    className="max-h-[60vh] object-contain border shadow-sm bg-white"
                  />
                )}
              </div>

              <div className="p-4 border-t border-[#ccd0d4] flex justify-end gap-2 bg-[#f6f7f7]">
                <a
                  href={viewingDocUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-[#2271b1] border border-[#2271b1] hover:bg-[#135e96] hover:border-[#135e96] text-white px-4 py-2 text-[13px] font-medium rounded-[3px] text-center inline-flex items-center gap-1.5 font-bold uppercase tracking-wider"
                >
                  <ExternalLink className="w-4 h-4" /> Open in New Tab
                </a>
                <button
                  onClick={() => setViewingDocUrl(null)}
                  className="border border-[#ccd0d4] bg-white text-[#2c3338] hover:bg-[#f6f7f7] px-4 py-2 text-[13px] font-medium rounded-[3px]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminPageLayout>
  );
}
