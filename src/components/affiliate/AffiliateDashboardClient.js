"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { toast } from "react-hot-toast";

export default function AffiliateDashboardClient({ userSession }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  
  // Dashboard state
  const [profile, setProfile] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [chartData, setChartData] = useState([]);
  
  // Tabs detail state
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [assets, setAssets] = useState([]);
  
  // Payout request inputs
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("Bank Transfer");
  const [submittingPayout, setSubmittingPayout] = useState(false);

  // Settings / Bank update inputs
  const [settingsForm, setSettingsForm] = useState({
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    accountHolder: "",
    bankName: "",
    accountNumber: "",
    iban: "",
    swiftCode: "",
    routingNumber: "",
    paypalEmail: ""
  });
  const [updatingSettings, setUpdatingSettings] = useState(false);

  // Fetch metrics & profile details
  const fetchDashboardData = async () => {
    try {
      const res = await fetch("/api/affiliate/dashboard");
      const data = await res.json();
      if (res.ok && data.success) {
        setProfile(data.profile);
        setMetrics(data.metrics);
        setChartData(data.chartData || []);
        
        // Sync settings form
        setSettingsForm({
          street: data.profile.address?.street || "",
          city: data.profile.address?.city || "",
          state: data.profile.address?.state || "",
          zipCode: data.profile.address?.zipCode || "",
          country: data.profile.address?.country || "",
          accountHolder: data.profile.bankingInfo?.accountHolder || "",
          bankName: data.profile.bankingInfo?.bankName || "",
          accountNumber: data.profile.bankingInfo?.accountNumber || "",
          iban: data.profile.bankingInfo?.iban || "",
          swiftCode: data.profile.bankingInfo?.swiftCode || "",
          routingNumber: data.profile.bankingInfo?.routingNumber || "",
          paypalEmail: data.profile.bankingInfo?.paypalEmail || ""
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load dashboard statistics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Fetch other tabs data
  useEffect(() => {
    if (activeTab === "products") {
      fetch("/api/affiliate/products")
        .then(res => res.json())
        .then(data => data.success && setProducts(data.products));
    } else if (activeTab === "conversions") {
      fetch("/api/affiliate/orders")
        .then(res => res.json())
        .then(data => data.success && setOrders(data.orders));
    } else if (activeTab === "payouts") {
      fetch("/api/affiliate/payouts")
        .then(res => res.json())
        .then(data => data.success && setPayouts(data.payouts));
    } else if (activeTab === "assets") {
      fetch("/api/affiliate/assets")
        .then(res => res.json())
        .then(data => data.success && setAssets(data.assets));
    }
  }, [activeTab]);

  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url);
    toast.success("Referral link copied!");
  };

  const handlePayoutSubmit = async (e) => {
    e.preventDefault();
    if (!payoutAmount || Number(payoutAmount) <= 0) {
      toast.error("Enter a valid withdrawal amount.");
      return;
    }

    setSubmittingPayout(true);
    try {
      const res = await fetch("/api/affiliate/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(payoutAmount),
          paymentMethod: payoutMethod
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request.");

      toast.success("Withdrawal request submitted.");
      setPayoutAmount("");
      // Refresh dashboard & payout logs
      fetchDashboardData();
      // Reload payouts table
      fetch("/api/affiliate/payouts")
        .then(res => res.json())
        .then(data => data.success && setPayouts(data.payouts));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingPayout(false);
    }
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setUpdatingSettings(true);
    try {
      const res = await fetch("/api/affiliate/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile details.");

      toast.success("Profile saved successfully.");
      fetchDashboardData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdatingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <div className="space-y-4 text-center">
          <span className="animate-spin inline-block h-8 w-8 border-2 border-black/20 border-t-black rounded-full" />
          <p className="text-xs uppercase tracking-widest text-primary/60 font-medium">Synchronizing Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 border-r border-black/5 bg-white p-6 md:p-8 space-y-8 flex-shrink-0">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-primary/50 uppercase tracking-[0.2em]">Pairo Partner</p>
          <p className="text-lg font-medium tracking-tight uppercase truncate">{profile?.name}</p>
          <div className="inline-flex px-2 py-0.5 rounded-full bg-black/5 text-[9px] font-mono text-black/60 uppercase">
            Code: {profile?.referralCode}
          </div>
        </div>

        <nav className="space-y-1.5">
          {[
            { id: "overview", label: "Overview", icon: "📊" },
            { id: "products", label: "Product Explorer", icon: "🔍" },
            { id: "conversions", label: "Conversions & Orders", icon: "💸" },
            { id: "payouts", label: "Payouts & Request", icon: "💰" },
            { id: "assets", label: "Marketing Assets", icon: "📁" },
            { id: "settings", label: "Profile & Bank Details", icon: "⚙️" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-xs transition-all ${
                activeTab === tab.id
                  ? "bg-black text-white font-medium"
                  : "text-primary/70 hover:bg-black/5"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="pt-8 border-t border-black/5">
          <button
            onClick={() => signOut({ callbackUrl: "/affiliate-login" })}
            className="w-full px-4 py-3 rounded-xl border border-black/10 text-xs font-semibold uppercase tracking-wider text-center hover:bg-black hover:text-white transition-all duration-300"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 space-y-10 overflow-x-hidden">
        {/* Top Header */}
        <div className="flex justify-between items-center pb-6 border-b border-black/5">
          <div>
            <h2 className="text-[20px] font-medium tracking-tight uppercase">
              {activeTab === "overview" && "Performance Dashboard"}
              {activeTab === "products" && "Product Catalog & Links"}
              {activeTab === "conversions" && "Referral Conversion Logs"}
              {activeTab === "payouts" && "Payouts & Earnings Management"}
              {activeTab === "assets" && "Brand Marketing Assets"}
              {activeTab === "settings" && "Account & Bank Information"}
            </h2>
            <p className="text-[10px] text-primary/50 uppercase tracking-widest mt-1">
              Affiliate ID: {profile?.referralCode ? `AFF-${profile.referralCode}` : ""}
            </p>
          </div>
        </div>

        {/* Tab contents */}

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-10">
            {/* Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { title: "Available Balance", value: `$${profile?.balance?.toFixed(2)}`, desc: "Available for withdrawal", color: "bg-black text-white" },
                { title: "Pending Commissions", value: `$${metrics?.pendingCommissions?.toFixed(2)}`, desc: "Awaiting order deliveries" },
                { title: "Lifetime Earnings", value: `$${profile?.lifetimeEarnings?.toFixed(2)}`, desc: "Total approved commissions" },
                { title: "Conversion Rate", value: `${metrics?.conversionRate}%`, desc: `${metrics?.conversions} sales / ${metrics?.clicks} clicks` }
              ].map((card, idx) => (
                <div key={idx} className={`p-6 rounded-[24px] border border-black/5 shadow-sm space-y-2 ${card.color || "bg-white"}`}>
                  <p className={`text-[10px] uppercase tracking-wider font-semibold ${card.color ? "text-white/60" : "text-primary/50"}`}>{card.title}</p>
                  <p className="text-3xl font-medium tracking-tight heading-font">{card.value}</p>
                  <p className={`text-[10px] ${card.color ? "text-white/70" : "text-primary/50"}`}>{card.desc}</p>
                </div>
              ))}
            </div>

            {/* Performance Chart Trend */}
            <div className="bg-white border border-black/5 rounded-[24px] p-6 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Traffic & Conversion Trend</p>
              <div className="h-64 flex items-end justify-between gap-2 pt-6 border-b border-black/10 font-mono text-[9px]">
                {chartData.map((data, idx) => {
                  const maxClicks = Math.max(...chartData.map(c => c.clicks), 1);
                  const clickHeight = (data.clicks / maxClicks) * 180;
                  const convHeight = (data.conversions / maxClicks) * 180;

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full flex items-end justify-center gap-1.5 h-[180px]">
                        {/* Clicks bar */}
                        <div 
                          className="w-4 bg-black/10 rounded-t-sm relative group hover:bg-black/20 transition-all cursor-pointer"
                          style={{ height: `${clickHeight}px` }}
                        >
                          <span className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 bg-black text-white px-1.5 py-0.5 rounded text-[8px] transition-all whitespace-nowrap">
                            {data.clicks} clicks
                          </span>
                        </div>
                        {/* Conversions bar */}
                        <div 
                          className="w-4 bg-black rounded-t-sm relative group hover:opacity-90 transition-all cursor-pointer"
                          style={{ height: `${convHeight}px` }}
                        >
                          <span className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 bg-black text-white px-1.5 py-0.5 rounded text-[8px] transition-all whitespace-nowrap">
                            {data.conversions} sales
                          </span>
                        </div>
                      </div>
                      <span className="text-primary/60 mt-1">{data.month}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-6 text-[10px] text-primary/50 justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-black/10 rounded-sm" />
                  <span>Click Traffic</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-black rounded-sm" />
                  <span>Sales Conversions</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Product Explorer */}
        {activeTab === "products" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.length === 0 ? (
              <p className="text-xs text-primary/50 col-span-3 text-center py-12">No active products found in catalogue.</p>
            ) : (
              products.map((product) => (
                <div key={product._id} className="bg-white border border-black/5 rounded-[24px] overflow-hidden flex flex-col hover:shadow-md transition-all duration-300">
                  <div className="aspect-[4/5] bg-slate-100 relative">
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="object-cover w-full h-full"
                    />
                    <div className="absolute top-4 right-4 bg-white/95 backdrop-blur px-3 py-1 rounded-full text-[10px] font-semibold">
                      ${product.price}
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold uppercase tracking-wider text-primary">{product.name}</p>
                      <p className="text-[10px] text-primary/60 font-light line-clamp-2 leading-relaxed">{product.description?.replace(/<[^>]*>/g, '')}</p>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCopyLink(product.referralUrl)}
                          className="flex-1 py-2.5 bg-black text-white text-[10px] font-bold uppercase tracking-wider rounded-xl hover:bg-black/90 transition-all"
                        >
                          Copy link
                        </button>
                        <a
                          href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(product.referralUrl)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-2.5 border border-black/10 rounded-xl flex items-center justify-center hover:bg-black/5"
                          title="View QR Code"
                        >
                          📱
                        </a>
                      </div>
                      
                      {/* Social Shares */}
                      <div className="flex justify-between items-center px-1 text-[9px] uppercase tracking-wider text-primary/50 border-t border-black/[0.03] pt-2">
                        <span>Share:</span>
                        <div className="flex gap-2.5">
                          <a 
                            href={`https://api.whatsapp.com/send?text=${encodeURIComponent("Check this out: " + product.referralUrl)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-black font-semibold"
                          >
                            WhatsApp
                          </a>
                          <a 
                            href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(product.referralUrl)}&text=${encodeURIComponent(product.name)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-black font-semibold"
                          >
                            Twitter/X
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Conversions & Orders */}
        {activeTab === "conversions" && (
          <div className="bg-white border border-black/5 rounded-[24px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-black/[0.02] border-b border-black/5 text-[9px] uppercase tracking-wider font-semibold text-primary/50 font-mono">
                    <th className="p-5">Order ID</th>
                    <th className="p-5">Date</th>
                    <th className="p-5">Order Total</th>
                    <th className="p-5">Commission</th>
                    <th className="p-5">Order Status</th>
                    <th className="p-5">Commission Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.03]">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-12 text-center text-xs text-primary/50">No referral sales conversions registered yet.</td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order._id} className="hover:bg-black/[0.01]">
                        <td className="p-5 font-semibold font-mono text-black">{order.orderNumber}</td>
                        <td className="p-5 text-primary/70">{new Date(order.date).toLocaleDateString()}</td>
                        <td className="p-5 text-primary/80 font-medium">${order.subtotal?.toFixed(2)}</td>
                        <td className="p-5 text-black font-semibold">${order.commissionAmount?.toFixed(2)}</td>
                        <td className="p-5">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono ${
                            order.status === "Delivered" ? "bg-green-50 text-green-700" :
                            order.status === "Cancelled" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="p-5">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono ${
                            order.commissionStatus === "Approved" ? "bg-green-50 text-green-700" :
                            order.commissionStatus === "Pending" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                          }`}>
                            {order.commissionStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Payouts withdrawal Request */}
        {activeTab === "payouts" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Request Withdrawal Form */}
            <div className="lg:col-span-5 bg-white border border-black/5 rounded-[24px] p-6 space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-primary/50">Available Balance</p>
                <p className="text-4xl font-medium heading-font text-black">${profile?.balance?.toFixed(2)}</p>
                <p className="text-[10px] text-primary/60 font-light">
                  Minimum withdrawal threshold: <span className="font-semibold">$50.00</span>
                </p>
              </div>

              <form onSubmit={handlePayoutSubmit} className="space-y-4 border-t border-black/5 pt-5">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Withdrawal Amount ($) *</label>
                  <input 
                    type="number" 
                    name="amount"
                    min="50"
                    step="0.01"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    required
                    placeholder="Enter amount (min $50)"
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Payment Method *</label>
                  <select
                    value={payoutMethod}
                    onChange={(e) => setPayoutMethod(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs bg-white"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="IBAN">Direct IBAN Account</option>
                    <option value="PayPal">PayPal</option>
                    <option value="Wise">Wise Direct Transfer</option>
                  </select>
                </div>

                <button 
                  type="submit" 
                  disabled={submittingPayout || profile?.balance < 50}
                  className="w-full py-3 bg-black text-white text-[10px] uppercase tracking-wider font-bold rounded-xl hover:bg-black/90 transition-all disabled:opacity-40"
                >
                  {submittingPayout ? "Requesting..." : "Submit Withdrawal"}
                </button>
              </form>
            </div>

            {/* Payout History Logs */}
            <div className="lg:col-span-7 bg-white border border-black/5 rounded-[24px] overflow-hidden">
              <div className="p-5 border-b border-black/5">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Withdrawal Logs</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-black/[0.02] border-b border-black/5 text-[9px] uppercase tracking-wider font-semibold text-primary/50 font-mono">
                      <th className="p-4">Requested</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Method</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Ref/TxID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.03]">
                    {payouts.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-xs text-primary/50">No payouts requested yet.</td>
                      </tr>
                    ) : (
                      payouts.map((pay) => (
                        <tr key={pay._id} className="hover:bg-black/[0.01]">
                          <td className="p-4 text-primary/70">{new Date(pay.createdAt).toLocaleDateString()}</td>
                          <td className="p-4 font-semibold text-black">${pay.amount?.toFixed(2)}</td>
                          <td className="p-4 text-primary/80 font-mono">{pay.paymentMethod}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono ${
                              pay.status === "Paid" ? "bg-green-50 text-green-700" :
                              pay.status === "Rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                            }`}>
                              {pay.status}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-[10px] text-primary/60">{pay.transactionId || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Marketing Assets */}
        {activeTab === "assets" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assets.length === 0 ? (
              <p className="text-xs text-primary/50 col-span-3 text-center py-12">No active marketing assets shared by Admin.</p>
            ) : (
              assets.map((asset) => (
                <div key={asset._id} className="bg-white border border-black/5 rounded-[24px] p-6 space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="px-2 py-0.5 rounded bg-black/5 text-[9px] font-mono text-primary/60 uppercase">
                        {asset.type}
                      </span>
                      {asset.dimensions && (
                        <span className="text-[9px] font-mono text-primary/40">{asset.dimensions}</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold uppercase tracking-wider text-primary">{asset.title}</p>
                  </div>

                  <div className="pt-2">
                    <a
                      href={asset.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block w-full py-2.5 border border-black/15 text-center text-[10px] font-bold uppercase tracking-wider rounded-xl hover:bg-black hover:text-white transition-all duration-300"
                    >
                      Download Asset
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 6: Profile & Bank Details */}
        {activeTab === "settings" && (
          <form onSubmit={handleSettingsSubmit} className="space-y-8 bg-white border border-black/5 rounded-[24px] p-6 md:p-8">
            {/* Address */}
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary border-b border-black/5 pb-2">Address Profile</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1 md:col-span-3">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Street Address</label>
                  <input 
                    type="text" 
                    value={settingsForm.street} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, street: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">City</label>
                  <input 
                    type="text" 
                    value={settingsForm.city} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, city: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">State/Province</label>
                  <input 
                    type="text" 
                    value={settingsForm.state} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, state: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Zip/Postal Code</label>
                  <input 
                    type="text" 
                    value={settingsForm.zipCode} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, zipCode: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Country</label>
                  <input 
                    type="text" 
                    value={settingsForm.country} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, country: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Banking */}
            <div className="space-y-4 border-t border-black/5 pt-6">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary border-b border-black/5 pb-2">Banking & Payout Profile</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Bank Account Holder</label>
                  <input 
                    type="text" 
                    value={settingsForm.accountHolder} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, accountHolder: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Bank Name</label>
                  <input 
                    type="text" 
                    value={settingsForm.bankName} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, bankName: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Account Number / IBAN</label>
                  <input 
                    type="text" 
                    value={settingsForm.accountNumber} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, accountNumber: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Swift / BIC Code</label>
                  <input 
                    type="text" 
                    value={settingsForm.swiftCode} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, swiftCode: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Routing / ABA Number</label>
                  <input 
                    type="text" 
                    value={settingsForm.routingNumber} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, routingNumber: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">PayPal Email Address</label>
                  <input 
                    type="email" 
                    value={settingsForm.paypalEmail} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, paypalEmail: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={updatingSettings}
              className="px-6 py-2.5 bg-black text-white text-[11px] uppercase tracking-wider font-bold rounded-xl hover:bg-black/95 transition-all disabled:opacity-40"
            >
              {updatingSettings ? "Saving Changes..." : "Save Settings"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
