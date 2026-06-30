"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { toast } from "react-hot-toast";
import { 
  LayoutDashboard, 
  Package, 
  RefreshCw, 
  Landmark, 
  FileText, 
  Settings2, 
  LogOut, 
  Copy, 
  QrCode, 
  MessageSquare, 
  AlertCircle, 
  Loader2, 
  ChevronRight, 
  TrendingUp, 
  ExternalLink,
  Twitter,
  DollarSign
} from "lucide-react";

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
          <Loader2 className="animate-spin h-8 w-8 text-black mx-auto" />
          <p className="text-[11px] uppercase tracking-widest text-neutral-400 font-bold">Synchronizing Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row bg-[#FAF9F6] text-black font-sans min-h-screen md:h-screen md:overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 border-r border-neutral-200 bg-neutral-900 text-neutral-300 p-6 md:p-8 space-y-8 flex-shrink-0 flex flex-col justify-between md:h-screen md:sticky md:top-0 md:overflow-y-auto">
        <div className="space-y-8">
          <div className="space-y-2 pb-6 border-b border-neutral-800">
            <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-[0.25em]">Pairo Partners</p>
            <p className="text-md font-bold tracking-tight text-white uppercase truncate">{profile?.name}</p>
            <div className="inline-flex px-2 py-0.5 rounded-[3px] bg-neutral-800 text-[9px] font-mono text-neutral-300 uppercase">
              ID: {profile?.referralCode}
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { id: "overview", label: "Performance Overview", icon: LayoutDashboard },
              { id: "products", label: "Product Explorer", icon: Package },
              { id: "conversions", label: "Referral & Conversions", icon: RefreshCw },
              { id: "payouts", label: "Payouts & Withdrawals", icon: Landmark },
              { id: "assets", label: "Marketing Assets", icon: FileText },
              { id: "settings", label: "Profile & Bank Details", icon: Settings2 },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-[3px] text-left text-xs uppercase tracking-wider font-bold transition-all ${
                    activeTab === tab.id
                      ? "bg-white text-black font-bold"
                      : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-8 border-t border-neutral-800">
          <button
            onClick={() => signOut({ callbackUrl: "/affiliate-login" })}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[3px] border border-neutral-800 hover:border-neutral-500 hover:bg-neutral-800 text-xs font-bold uppercase tracking-wider text-center transition-all duration-300"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 space-y-10 overflow-x-hidden md:h-screen md:overflow-y-auto">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-neutral-200 gap-4">
          <div>
            <h2 className="text-xl font-normal tracking-tight uppercase text-black">
              {activeTab === "overview" && "Performance Dashboard"}
              {activeTab === "products" && "Product Catalog & Links"}
              {activeTab === "conversions" && "Referral Acquisition Logs"}
              {activeTab === "payouts" && "Payouts & Balances"}
              {activeTab === "assets" && "Editorial & Brand Assets"}
              {activeTab === "settings" && "Account & Banking Details"}
            </h2>
            <p className="text-[10px] text-neutral-400 uppercase tracking-widest mt-1">
              Affiliate Referral Code: <span className="font-mono font-bold text-black">{profile?.referralCode}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleCopyLink(`${window.location.origin}?ref=${profile?.referralCode}`)}
              className="bg-white border border-neutral-300 hover:border-black text-black px-4 py-2 rounded-[3px] text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Shop Link
            </button>
          </div>
        </div>

        {/* Tab contents */}

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-10">
            {/* Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { title: "Available Balance", value: `$${profile?.balance?.toFixed(2)}`, desc: "Available for withdrawal", highlight: true },
                { title: "Pending Commissions", value: `$${metrics?.pendingCommissions?.toFixed(2)}`, desc: "Awaiting order delivery confirmation" },
                { title: "Lifetime Earnings", value: `$${profile?.lifetimeEarnings?.toFixed(2)}`, desc: "Total approved payouts" },
                { title: "Conversion Ratio", value: `${metrics?.conversionRate}%`, desc: `${metrics?.conversions || 0} conversions / ${metrics?.clicks || 0} traffic clicks` }
              ].map((card, idx) => (
                <div 
                  key={idx} 
                  className={`p-6 border rounded-[3px] shadow-sm space-y-3 flex flex-col justify-between ${
                    card.highlight 
                      ? "bg-black text-white border-black" 
                      : "bg-white text-black border-neutral-200"
                  }`}
                >
                  <p className={`text-[10px] uppercase tracking-widest font-bold ${card.highlight ? "text-neutral-400" : "text-neutral-400"}`}>{card.title}</p>
                  <p className="text-3xl font-medium tracking-tight font-mono">{card.value}</p>
                  <p className={`text-[10px] ${card.highlight ? "text-neutral-400" : "text-neutral-500"}`}>{card.desc}</p>
                </div>
              ))}
            </div>

            {/* Performance Chart Trend */}
            <div className="bg-white border border-neutral-200 rounded-[3px] p-6 space-y-6 shadow-sm">
              <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-neutral-400" /> Click Traffic vs Sales Trend
                </p>
              </div>

              {chartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-neutral-400 italic">
                  No monthly analytics logs recorded.
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="h-64 flex items-end justify-between gap-4 pt-6 border-b border-neutral-200 font-mono text-[9px] relative">
                    {/* Gridlines */}
                    <div className="absolute inset-x-0 top-1/4 border-t border-neutral-100 pointer-events-none" />
                    <div className="absolute inset-x-0 top-2/4 border-t border-neutral-100 pointer-events-none" />
                    <div className="absolute inset-x-0 top-3/4 border-t border-neutral-100 pointer-events-none" />

                    {chartData.map((data, idx) => {
                      const maxVal = Math.max(...chartData.map(c => Math.max(c.clicks || 0, c.conversions || 0)), 1);
                      const clickHeight = ((data.clicks || 0) / maxVal) * 200;
                      const convHeight = ((data.conversions || 0) / maxVal) * 200;

                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2 z-10">
                          <div className="w-full flex items-end justify-center gap-1.5 h-[200px]">
                            {/* Clicks bar */}
                            <div 
                              className="w-4 bg-neutral-200 rounded-t-sm relative group hover:bg-neutral-300 transition-all cursor-pointer"
                              style={{ height: `${clickHeight}px` }}
                            >
                              <span className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white px-2 py-1 text-[9px] font-bold rounded-[3px] transition-all whitespace-nowrap shadow-md">
                                {data.clicks} Clicks
                              </span>
                            </div>
                            {/* Conversions bar */}
                            <div 
                              className="w-4 bg-black rounded-t-sm relative group hover:bg-neutral-800 transition-all cursor-pointer"
                              style={{ height: `${convHeight}px` }}
                            >
                              <span className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white px-2 py-1 text-[9px] font-bold rounded-[3px] transition-all whitespace-nowrap shadow-md">
                                {data.conversions} Sales
                              </span>
                            </div>
                          </div>
                          <span className="text-neutral-400 mt-1 uppercase text-[9px] font-bold tracking-wider">{data.month}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-6 text-[10px] text-neutral-400 justify-center font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-neutral-200 rounded-sm" />
                      <span>Monthly Traffic Clicks</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-black rounded-sm" />
                      <span>Referred Sales</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Product Explorer (Redesigned completely) */}
        {activeTab === "products" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.length === 0 ? (
              <div className="col-span-3 py-16 text-center border border-neutral-200 bg-white rounded-[3px] shadow-sm flex flex-col items-center justify-center space-y-2">
                <AlertCircle className="w-8 h-8 text-neutral-300" />
                <p className="text-xs text-neutral-400 italic">No products available in affiliate catalogue.</p>
              </div>
            ) : (
              products.map((product) => (
                <div key={product._id} className="bg-white border border-neutral-200 rounded-[3px] overflow-hidden flex flex-col group hover:border-black transition-colors duration-300 shadow-sm">
                  {/* Image container */}
                  <div className="aspect-[4/5] bg-neutral-50 relative overflow-hidden border-b border-neutral-100">
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute bottom-4 left-4 bg-black text-white px-3 py-1 text-[11px] font-bold font-mono uppercase tracking-widest shadow-sm">
                      ${product.price}
                    </div>
                  </div>
                  {/* Details section */}
                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-black">{product.name}</p>
                      <p className="text-[12px] text-neutral-500 font-light line-clamp-2 leading-relaxed">
                        {product.description?.replace(/<[^>]*>/g, '') || "Premium handcrafted shearling jacket designed for modern utility and warmth."}
                      </p>
                    </div>

                    <div className="space-y-4 pt-2 border-t border-neutral-100">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCopyLink(product.referralUrl)}
                          className="flex-1 py-2.5 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-[3px] hover:bg-neutral-800 transition-all flex items-center justify-center gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copy Referral
                        </button>
                        <a
                          href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(product.referralUrl)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-2.5 border border-neutral-300 rounded-[3px] flex items-center justify-center hover:border-black transition-colors"
                          title="Generate QR code"
                        >
                          <QrCode className="w-4 h-4 text-neutral-600" />
                        </a>
                      </div>
                      
                      {/* Social Shares */}
                      <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-neutral-400 font-bold pt-1">
                        <span>Direct Share:</span>
                        <div className="flex gap-3">
                          <a 
                            href={`https://api.whatsapp.com/send?text=${encodeURIComponent("Check this out: " + product.referralUrl)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-neutral-500 hover:text-black transition-colors"
                          >
                            WhatsApp
                          </a>
                          <a 
                            href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(product.referralUrl)}&text=${encodeURIComponent(product.name)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-neutral-500 hover:text-black transition-colors"
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
          <div className="bg-white border border-neutral-200 rounded-[3px] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#f6f7f7] border-b border-neutral-200 text-[10px] uppercase tracking-wider font-bold text-black">
                    <th className="p-4">Order ID</th>
                    <th className="p-4">Acquisition Date</th>
                    <th className="p-4">Sale subtotal</th>
                    <th className="p-4">Calculated Commission</th>
                    <th className="p-4">Order Status</th>
                    <th className="p-4">Payout Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-16 text-center text-xs text-neutral-400 italic">
                        No conversion sales or referrals logged to this account yet.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order._id} className="hover:bg-neutral-50 transition-colors">
                        <td className="p-4 font-bold font-mono text-black">#{order.orderNumber}</td>
                        <td className="p-4 text-neutral-500">{new Date(order.date).toLocaleDateString()}</td>
                        <td className="p-4 text-black font-semibold font-mono">${order.subtotal?.toFixed(2)}</td>
                        <td className="p-4 text-black font-bold font-mono">${order.commissionAmount?.toFixed(2)}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider ${
                            order.status === "Delivered" ? "bg-green-100 text-green-800" :
                            order.status === "Cancelled" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider ${
                            order.commissionStatus === "Approved" ? "bg-green-100 text-green-800" :
                            order.commissionStatus === "Pending" ? "bg-amber-100 text-amber-800" : "bg-neutral-100 text-neutral-800"
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
            <div className="lg:col-span-5 bg-white border border-neutral-200 rounded-[3px] p-6 space-y-6 shadow-sm">
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-400">Available Balance</p>
                <p className="text-4xl font-normal font-mono text-black">${profile?.balance?.toFixed(2)}</p>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Withdrawal threshold limits: <span className="font-semibold text-black">$50.00 Minimum</span>.
                </p>
              </div>

              <form onSubmit={handlePayoutSubmit} className="space-y-4 border-t border-neutral-100 pt-5">
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Withdrawal Amount ($) *</label>
                  <input 
                    type="number" 
                    name="amount"
                    min="50"
                    step="0.01"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    required
                    placeholder="Min $50.00"
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Payment Method *</label>
                  <select
                    value={payoutMethod}
                    onChange={(e) => setPayoutMethod(e.target.value)}
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px]"
                  >
                    <option value="Bank Transfer">Bank Transfer (Swift/Routing)</option>
                    <option value="IBAN">IBAN Account Transfer</option>
                    <option value="PayPal">PayPal Account</option>
                    <option value="Wise">Wise Direct Transfer</option>
                  </select>
                </div>

                <button 
                  type="submit" 
                  disabled={submittingPayout || profile?.balance < 50}
                  className="w-full py-3.5 bg-black text-white text-[11px] uppercase tracking-widest font-bold rounded-[3px] hover:bg-neutral-900 transition-all disabled:opacity-40"
                >
                  {submittingPayout ? "Processing..." : "Submit Withdrawal Request"}
                </button>
              </form>
            </div>

            {/* Payout History Logs */}
            <div className="lg:col-span-7 bg-white border border-neutral-200 rounded-[3px] overflow-hidden shadow-sm">
              <div className="p-5 border-b border-neutral-200">
                <p className="text-xs font-bold uppercase tracking-wider text-black">Withdrawal Logs</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[#f6f7f7] border-b border-neutral-200 text-[10px] uppercase tracking-wider font-bold text-black">
                      <th className="p-4">Requested</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Method</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Reference/TxID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {payouts.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-xs text-neutral-400 italic">No payout requests found.</td>
                      </tr>
                    ) : (
                      payouts.map((pay) => (
                        <tr key={pay._id} className="hover:bg-neutral-50 transition-colors">
                          <td className="p-4 text-neutral-500">{new Date(pay.createdAt).toLocaleDateString()}</td>
                          <td className="p-4 font-bold font-mono text-black">${pay.amount?.toFixed(2)}</td>
                          <td className="p-4 text-neutral-500 font-mono">{pay.paymentMethod}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider ${
                              pay.status === "Paid" ? "bg-green-100 text-green-800" :
                              pay.status === "Rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                            }`}>
                              {pay.status}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-[11px] text-neutral-400">{pay.transactionId || "—"}</td>
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
              <div className="col-span-3 py-16 text-center border border-neutral-200 bg-white rounded-[3px] shadow-sm flex flex-col items-center justify-center space-y-2">
                <AlertCircle className="w-8 h-8 text-neutral-300" />
                <p className="text-xs text-neutral-400 italic">No marketing assets available.</p>
              </div>
            ) : (
              assets.map((asset) => (
                <div key={asset._id} className="bg-white border border-neutral-200 rounded-[3px] p-6 space-y-4 flex flex-col justify-between hover:border-black transition-colors shadow-sm">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="px-2 py-0.5 rounded-[3px] bg-neutral-100 text-[9px] font-mono font-bold text-neutral-500 uppercase">
                        {asset.type}
                      </span>
                      {asset.dimensions && (
                        <span className="text-[9px] font-mono text-neutral-400 font-bold">{asset.dimensions}</span>
                      )}
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-black">{asset.title}</p>
                  </div>

                  <div className="pt-2 border-t border-neutral-100">
                    <a
                      href={asset.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block w-full py-2 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-[3px] hover:bg-neutral-900 transition-all text-center"
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
          <form onSubmit={handleSettingsSubmit} className="space-y-8 bg-white border border-neutral-200 rounded-[3px] p-6 md:p-8 shadow-sm">
            {/* Address */}
            <div className="space-y-4">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-black border-b border-neutral-100 pb-2">
                Address Profile Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1 md:col-span-3">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Street Address</label>
                  <input 
                    type="text" 
                    value={settingsForm.street} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, street: e.target.value })}
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">City</label>
                  <input 
                    type="text" 
                    value={settingsForm.city} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, city: e.target.value })}
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">State/Province</label>
                  <input 
                    type="text" 
                    value={settingsForm.state} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, state: e.target.value })}
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Zip/Postal Code</label>
                  <input 
                    type="text" 
                    value={settingsForm.zipCode} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, zipCode: e.target.value })}
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Country</label>
                  <input 
                    type="text" 
                    value={settingsForm.country} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, country: e.target.value })}
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Banking */}
            <div className="space-y-4 border-t border-neutral-100 pt-6">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-black border-b border-neutral-100 pb-2">
                Banking & Payout Profile
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Bank Account Holder</label>
                  <input 
                    type="text" 
                    value={settingsForm.accountHolder} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, accountHolder: e.target.value })}
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Bank Name</label>
                  <input 
                    type="text" 
                    value={settingsForm.bankName} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, bankName: e.target.value })}
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Account Number / IBAN</label>
                  <input 
                    type="text" 
                    value={settingsForm.accountNumber} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, accountNumber: e.target.value })}
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Swift / BIC Code</label>
                  <input 
                    type="text" 
                    value={settingsForm.swiftCode} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, swiftCode: e.target.value })}
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Routing / ABA Number</label>
                  <input 
                    type="text" 
                    value={settingsForm.routingNumber} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, routingNumber: e.target.value })}
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">PayPal Email Address</label>
                  <input 
                    type="email" 
                    value={settingsForm.paypalEmail} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, paypalEmail: e.target.value })}
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={updatingSettings}
              className="px-6 py-3 bg-black text-white text-[11px] uppercase tracking-widest font-bold rounded-[3px] hover:bg-neutral-900 transition-all disabled:opacity-40"
            >
              {updatingSettings ? "Saving Settings..." : "Save Settings"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
