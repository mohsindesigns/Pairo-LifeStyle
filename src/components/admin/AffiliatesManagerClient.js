"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

export default function AffiliatesManagerClient() {
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
  const [submittingReview, setSubmittingReview] = useState(false);

  // Edit Affiliate inputs
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    commissionRate: 5,
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
    loadData();
  }, []);

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
          customCommissionRate
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
      const res = await fetch("/api/admin/affiliates/list", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliateId: selectedAffiliate._id,
          ...editForm
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="space-y-4 text-center">
          <span className="animate-spin inline-block h-8 w-8 border-2 border-black/20 border-t-black rounded-full" />
          <p className="text-xs uppercase tracking-widest text-primary/60">Fetching database registers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex justify-between items-center pb-6 border-b border-black/5">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium heading-font tracking-tight uppercase">Affiliate Management</h1>
          <p className="text-xs text-primary/50 uppercase tracking-wider mt-1">Review applications, configure commissions, and process withdrawals.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-black/5 pb-2 text-xs font-semibold uppercase tracking-wider">
        {[
          { id: "requests", label: `Applications (${applications.filter(a => a.status === 'Pending').length})` },
          { id: "list", label: "Active Affiliates" },
          { id: "payouts", label: `Payout Requests (${payouts.filter(p => p.status === 'Requested').length})` },
          { id: "settings", label: "Global Settings" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 border-b-2 transition-all ${
              activeTab === tab.id
                ? "border-black text-black"
                : "border-transparent text-primary/55 hover:text-black"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Requests */}
      {activeTab === "requests" && (
        <div className="bg-white border border-black/5 rounded-[24px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-black/[0.02] border-b border-black/5 text-[9px] uppercase tracking-wider font-semibold text-primary/50 font-mono">
                  <th className="p-5">Applicant</th>
                  <th className="p-5">Email & Phone</th>
                  <th className="p-5">Country</th>
                  <th className="p-5">Verification Docs</th>
                  <th className="p-5">Strategy & Reach</th>
                  <th className="p-5">Status</th>
                  <th className="p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.03]">
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-12 text-center text-primary/50">No applications registered in this queue.</td>
                  </tr>
                ) : (
                  applications.map(app => (
                    <tr key={app._id} className="hover:bg-black/[0.01]">
                      <td className="p-5">
                        <p className="font-semibold text-black">{app.name}</p>
                        <p className="text-[10px] text-primary/50 mt-0.5">Applied: {new Date(app.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="p-5 font-mono">
                        <p>{app.email}</p>
                        <p className="text-primary/50 mt-0.5">{app.phone}</p>
                      </td>
                      <td className="p-5 font-medium">{app.address?.country}</td>
                      <td className="p-5 font-mono">
                        {app.identityDocuments?.map((url, idx) => (
                          <button
                            key={idx}
                            onClick={() => setViewingDocUrl(url)}
                            className="text-black underline mr-2 hover:text-primary/70 inline-block py-0.5"
                          >
                            Doc #{idx + 1}
                          </button>
                        ))}
                      </td>
                      <td className="p-5 max-w-xs">
                        <p className="line-clamp-2 text-primary/70">{app.marketingAnswers?.promotionStrategy}</p>
                        <p className="text-[10px] text-primary/50 font-semibold mt-0.5 uppercase tracking-wide">
                          Reach: {app.marketingAnswers?.audienceSize}
                        </p>
                      </td>
                      <td className="p-5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono ${
                          app.status === 'Approved' ? 'bg-green-50 text-green-700' :
                          app.status === 'Rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="p-5 text-right">
                        {app.status === 'Pending' && (
                          <button
                            onClick={() => {
                              setSelectedApplication(app);
                              setCustomCommissionRate(settings.defaultCommissionRate || 5);
                            }}
                            className="px-3.5 py-1.5 bg-black text-white text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-black/90 transition-all"
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
        </div>
      )}

      {/* Tab 2: Affiliates List */}
      {activeTab === "list" && (
        <div className="bg-white border border-black/5 rounded-[24px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-black/[0.02] border-b border-black/5 text-[9px] uppercase tracking-wider font-semibold text-primary/50 font-mono">
                  <th className="p-5">Affiliate</th>
                  <th className="p-5">Referral Code</th>
                  <th className="p-5">Direct Coupon</th>
                  <th className="p-5">Base Commission</th>
                  <th className="p-5">Available Balance</th>
                  <th className="p-5">Lifetime Earnings</th>
                  <th className="p-5">Status</th>
                  <th className="p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.03]">
                {affiliates.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-12 text-center text-primary/50">No active affiliate accounts found.</td>
                  </tr>
                ) : (
                  affiliates.map(aff => (
                    <tr key={aff._id} className="hover:bg-black/[0.01]">
                      <td className="p-5">
                        <p className="font-semibold text-black">{aff.name}</p>
                        <p className="text-[10px] text-primary/50 mt-0.5">{aff.email}</p>
                      </td>
                      <td className="p-5 font-mono font-semibold text-black">{aff.referralCode}</td>
                      <td className="p-5 font-mono text-primary/60">{aff.couponCode || "—"}</td>
                      <td className="p-5 font-semibold">{aff.commissionRate}%</td>
                      <td className="p-5 font-semibold">${aff.balance?.toFixed(2)}</td>
                      <td className="p-5 font-medium text-primary/80">${aff.lifetimeEarnings?.toFixed(2)}</td>
                      <td className="p-5">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono ${
                          aff.status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {aff.status}
                        </span>
                      </td>
                      <td className="p-5 text-right">
                        <button
                          onClick={() => {
                            setSelectedAffiliate(aff);
                            setEditForm({
                              name: aff.name,
                              email: aff.email,
                              commissionRate: aff.commissionRate,
                              status: aff.status,
                              couponCode: aff.couponCode || "",
                              password: ""
                            });
                          }}
                          className="px-3 py-1.5 border border-black/10 text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-black hover:text-white transition-all duration-300"
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
        </div>
      )}

      {/* Tab 3: Payouts */}
      {activeTab === "payouts" && (
        <div className="bg-white border border-black/5 rounded-[24px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-black/[0.02] border-b border-black/5 text-[9px] uppercase tracking-wider font-semibold text-primary/50 font-mono">
                  <th className="p-5">Affiliate</th>
                  <th className="p-5">Amount</th>
                  <th className="p-5">Method</th>
                  <th className="p-5">Date Requested</th>
                  <th className="p-5">Status</th>
                  <th className="p-5">Reference ID</th>
                  <th className="p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.03]">
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-12 text-center text-primary/50">No payout requests in the queue.</td>
                  </tr>
                ) : (
                  payouts.map(pay => (
                    <tr key={pay._id} className="hover:bg-black/[0.01]">
                      <td className="p-5">
                        <p className="font-semibold text-black">{pay.affiliateId?.name || "Deleted Affiliate"}</p>
                        <p className="text-[10px] text-primary/50 mt-0.5">Code: {pay.affiliateId?.referralCode || "—"}</p>
                      </td>
                      <td className="p-5 font-bold text-black">${pay.amount?.toFixed(2)}</td>
                      <td className="p-5 font-mono text-primary/80">{pay.paymentMethod}</td>
                      <td className="p-5 text-primary/70">{new Date(pay.createdAt).toLocaleDateString()}</td>
                      <td className="p-5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono ${
                          pay.status === 'Paid' ? 'bg-green-50 text-green-700' :
                          pay.status === 'Rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {pay.status}
                        </span>
                      </td>
                      <td className="p-5 font-mono text-[10px] text-primary/60">{pay.transactionId || "—"}</td>
                      <td className="p-5 text-right">
                        {pay.status === 'Requested' && (
                          <button
                            onClick={() => {
                              setSelectedPayout(pay);
                              setPayoutTxId(`TX-${Date.now()}`);
                            }}
                            className="px-3.5 py-1.5 bg-black text-white text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-black/90 transition-all"
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
        </div>
      )}

      {/* Tab 4: Settings */}
      {activeTab === "settings" && (
        <form onSubmit={handleSettingsSubmit} className="space-y-6 bg-white border border-black/5 rounded-[24px] p-6 md:p-8 max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Default Commission Rate (%) *</label>
              <input 
                type="number"
                min="0"
                max="100"
                value={settings.defaultCommissionRate}
                onChange={(e) => setSettings({ ...settings, defaultCommissionRate: Number(e.target.value) })}
                required
                className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Cookie Window (Days) *</label>
              <input 
                type="number"
                min="1"
                value={settings.cookieDurationDays}
                onChange={(e) => setSettings({ ...settings, cookieDurationDays: Number(e.target.value) })}
                required
                className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Minimum Payout ($) *</label>
              <input 
                type="number"
                min="1"
                value={settings.minimumPayoutAmount}
                onChange={(e) => setSettings({ ...settings, minimumPayoutAmount: Number(e.target.value) })}
                required
                className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Support Contact Email *</label>
              <input 
                type="email"
                value={settings.supportEmail}
                onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                required
                className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
              />
            </div>
            <div className="space-y-2 md:col-span-2 pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={settings.autoApproveApplications}
                  onChange={(e) => setSettings({ ...settings, autoApproveApplications: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                />
                <span className="text-xs text-primary/80 font-medium select-none">
                  Automatically approve applications (Bypass manual reviews)
                </span>
              </label>
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit" 
              disabled={savingSettings}
              className="px-6 py-2.5 bg-black text-white text-[11px] uppercase tracking-wider font-bold rounded-xl hover:bg-black/95 transition-all disabled:opacity-40"
            >
              {savingSettings ? "Saving Settings..." : "Save Settings"}
            </button>
          </div>
        </form>
      )}

      {/* Modal 1: Review Application */}
      {selectedApplication && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] border border-black/5 shadow-xl max-w-md w-full p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setSelectedApplication(null)}
              className="absolute top-6 right-6 text-primary/50 hover:text-black text-xl"
            >
              ✕
            </button>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-primary/50">Application Review</p>
              <p className="text-lg font-medium tracking-tight uppercase text-black">{selectedApplication.name}</p>
            </div>

            <form onSubmit={handleApplicationReview} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Action *</label>
                <select
                  value={reviewAction}
                  onChange={(e) => setReviewAction(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs bg-white"
                >
                  <option value="Approve">Approve Application</option>
                  <option value="Reject">Reject Application</option>
                </select>
              </div>

              {reviewAction === "Approve" ? (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Base Commission Rate (%) *</label>
                  <input 
                    type="number"
                    min="0"
                    max="100"
                    value={customCommissionRate}
                    onChange={(e) => setCustomCommissionRate(Number(e.target.value))}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Rejection Reason *</label>
                  <textarea 
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    required
                    rows="3"
                    placeholder="Provide detailed feedback for the applicant..."
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs resize-none"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Internal Audit Notes</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows="2"
                  placeholder="Notes visible only to admin staff..."
                  className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs resize-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedApplication(null)}
                  className="flex-1 py-3 border border-black/15 text-[11px] uppercase tracking-wider font-semibold rounded-xl hover:bg-black/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="flex-1 py-3 bg-black text-white text-[11px] uppercase tracking-wider font-bold rounded-xl hover:bg-black/90 transition-all flex justify-center items-center gap-2"
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] border border-black/5 shadow-xl max-w-md w-full p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setSelectedAffiliate(null)}
              className="absolute top-6 right-6 text-primary/50 hover:text-black text-xl"
            >
              ✕
            </button>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-primary/50">Edit Affiliate Profile</p>
              <p className="text-lg font-medium tracking-tight uppercase text-black">{selectedAffiliate.name}</p>
            </div>

            <form onSubmit={handleAffiliateEditSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Display Name</label>
                <input 
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Email Address</label>
                <input 
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Commission Rate (%)</label>
                <input 
                  type="number"
                  min="0"
                  max="100"
                  value={editForm.commissionRate}
                  onChange={(e) => setEditForm({ ...editForm, commissionRate: Number(e.target.value) })}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs bg-white"
                >
                  <option value="Active">Active / Approved</option>
                  <option value="Suspended">Suspended / Deactivated</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Assigned Custom Coupon Code</label>
                <input 
                  type="text"
                  value={editForm.couponCode}
                  onChange={(e) => setEditForm({ ...editForm, couponCode: e.target.value })}
                  placeholder="e.g. MOHSIN10"
                  className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Reset Password</label>
                <input 
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="Leave empty to keep unchanged"
                  className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedAffiliate(null)}
                  className="flex-1 py-3 border border-black/15 text-[11px] uppercase tracking-wider font-semibold rounded-xl hover:bg-black/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="flex-1 py-3 bg-black text-white text-[11px] uppercase tracking-wider font-bold rounded-xl hover:bg-black/90 transition-all flex justify-center items-center gap-2"
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] border border-black/5 shadow-xl max-w-md w-full p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setSelectedPayout(null)}
              className="absolute top-6 right-6 text-primary/50 hover:text-black text-xl"
            >
              ✕
            </button>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-primary/50">Process Withdrawal Request</p>
              <p className="text-lg font-medium tracking-tight uppercase text-black">
                Payout: ${selectedPayout.amount?.toFixed(2)}
              </p>
              <p className="text-[10px] text-primary/60 uppercase tracking-widest font-mono">
                Method: {selectedPayout.paymentMethod}
              </p>
            </div>

            <form onSubmit={handlePayoutProcess} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Action *</label>
                <select
                  value={payoutAction}
                  onChange={(e) => setPayoutAction(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs bg-white"
                >
                  <option value="Approve">Mark Payout as Completed / Paid</option>
                  <option value="Reject">Reject Request (Refund Balance)</option>
                </select>
              </div>

              {payoutAction === "Approve" && (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Transaction ID / Reference Number</label>
                  <input 
                    type="text"
                    value={payoutTxId}
                    onChange={(e) => setPayoutTxId(e.target.value)}
                    required
                    placeholder="e.g. PayPal TxID or Swift Ref"
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs font-mono"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Processor Notes / Feedback</label>
                <textarea 
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  rows="3"
                  placeholder="Notes sent in email to affiliate..."
                  className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs resize-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPayout(null)}
                  className="flex-1 py-3 border border-black/15 text-[11px] uppercase tracking-wider font-semibold rounded-xl hover:bg-black/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayout}
                  className="flex-1 py-3 bg-black text-white text-[11px] uppercase tracking-wider font-bold rounded-xl hover:bg-black/90 transition-all flex justify-center items-center gap-2"
                >
                  {submittingPayout ? "Processing..." : "Confirm Payout"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Secure Document Viewer */}
      {viewingDocUrl && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] border border-black/5 shadow-2xl max-w-4xl w-full p-6 space-y-4 relative max-h-[95vh] flex flex-col justify-between">
            <button 
              onClick={() => setViewingDocUrl(null)}
              className="absolute top-6 right-6 text-primary/50 hover:text-black text-2xl z-10"
            >
              ✕
            </button>
            <div className="space-y-1 pb-2 border-b border-black/5">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-primary/50">KYC Secure Document Viewer</p>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100 rounded-xl p-4 flex items-center justify-center min-h-[300px]">
              {viewingDocUrl.toLowerCase().endsWith(".pdf") ? (
                <iframe 
                  src={viewingDocUrl} 
                  title="Document PDF"
                  className="w-full h-[60vh] border-0"
                />
              ) : (
                <img 
                  src={viewingDocUrl} 
                  alt="KYC Document Preview" 
                  className="max-h-[60vh] object-contain rounded-lg border shadow-sm"
                />
              )}
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <a
                href={viewingDocUrl}
                target="_blank"
                rel="noreferrer"
                className="px-6 py-2.5 bg-black text-white text-[10px] font-bold uppercase tracking-wider rounded-xl hover:bg-black/90 transition-all text-center"
              >
                Open in new window
              </a>
              <button
                onClick={() => setViewingDocUrl(null)}
                className="px-6 py-2.5 border border-black/15 text-[10px] font-bold uppercase tracking-wider rounded-xl hover:bg-black/5 transition-all"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
