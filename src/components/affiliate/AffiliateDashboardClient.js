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
  DollarSign,
  Menu,
  X
} from "lucide-react";
import ThemedSelect from "@/components/ui/ThemedSelect";

export default function AffiliateDashboardClient({ userSession }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
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
    name: "",
    email: "",
    phone: "",
    dob: "",
    profilePhoto: "",
    companyName: "",
    website: "",
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
    paypalEmail: "",
    socialLinks: ""
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [bankDocFile, setBankDocFile] = useState(null);
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
          name: data.profile.name || "",
          email: data.profile.email || "",
          phone: data.profile.phone || "",
          dob: data.profile.dob ? new Date(data.profile.dob).toISOString().split('T')[0] : "",
          profilePhoto: data.profile.profilePhoto || "",
          companyName: data.profile.businessInfo?.companyName || "",
          website: data.profile.businessInfo?.website || "",
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
          paypalEmail: data.profile.bankingInfo?.paypalEmail || "",
          socialLinks: data.profile.businessInfo?.socialLinks ? data.profile.businessInfo.socialLinks.join(", ") : ""
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
      const formData = new FormData();
      // Append all text settings form fields
      Object.keys(settingsForm).forEach(key => {
        formData.append(key, settingsForm[key]);
      });
      // Append files if selected
      if (avatarFile) {
        formData.append("profilePhoto", avatarFile);
      }
      if (bankDocFile) {
        formData.append("bankVerificationDocument", bankDocFile);
      }

      const res = await fetch("/api/affiliate/profile", {
        method: "PUT",
        body: formData // Let the browser set Content-Type header with boundaries automatically
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile details.");

      toast.success("Profile saved successfully.");
      setAvatarFile(null);
      setBankDocFile(null);
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
    <div className="flex flex-col md:flex-row bg-[#f0f0f1] text-[#1d2327] font-sans min-h-screen md:h-screen md:overflow-hidden">
      
      {/* Mobile Header Bar */}
      <header className="flex md:hidden items-center justify-between px-5 py-4 bg-[#1d2327] text-white border-b border-neutral-800 select-none z-50 sticky top-0 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs uppercase tracking-[0.2em] text-[#72aee6]">Pairo Portal</span>
          <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-mono font-bold">ID: {profile?.referralCode}</span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 rounded hover:bg-neutral-800 text-neutral-300 focus:outline-none transition-colors"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside className={`w-full md:w-60 border-r border-[#dcdcde] bg-[#1d2327] text-neutral-300 p-4 md:p-5 flex-shrink-0 flex flex-col justify-between md:h-screen md:sticky md:top-0 md:overflow-y-auto select-none transition-all duration-300 ${
        mobileMenuOpen ? "flex animate-fade-in" : "hidden md:flex"
      }`}>
        <div className="space-y-6">
          {/* Header Profile info */}
          <div className="space-y-1 pb-5 border-b border-neutral-700/60">
            <p className="text-[9px] font-bold text-[#72aee6] uppercase tracking-[0.3em]">Pairo Partner</p>
            <h3 className="text-sm font-bold tracking-tight text-white uppercase truncate">{profile?.name}</h3>
            <div className="inline-flex px-1.5 py-0.5 rounded bg-neutral-800 text-[9px] font-mono text-neutral-400 uppercase font-bold">
              ID: {profile?.referralCode}
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {[
              { id: "overview", label: "Performance Overview", icon: LayoutDashboard },
              { id: "products", label: "Product Explorer", icon: Package },
              { id: "conversions", label: "Referral Logs", icon: RefreshCw },
              { id: "payouts", label: "Payouts & Balances", icon: Landmark },
              { id: "assets", label: "Marketing Assets", icon: FileText },
              { id: "settings", label: "Account & Banking", icon: Settings2 },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-xs uppercase tracking-wider font-semibold border-l-4 transition-all duration-200 ${
                    isActive
                      ? "bg-[#2c3338] text-white border-l-[#2271b1] font-bold"
                      : "text-neutral-400 border-l-transparent hover:bg-[#2c3338] hover:text-[#72aee6]"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-[#72aee6]" : "text-neutral-500"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Logout Button */}
        <div className="pt-5 border-t border-neutral-700/60 mt-6 md:mt-0">
          <button
            onClick={() => signOut({ callbackUrl: "/affiliate-login" })}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded border border-neutral-700 hover:border-neutral-500 hover:bg-[#2c3338] text-xs font-semibold uppercase tracking-wider text-center text-neutral-400 hover:text-white transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 p-6 md:p-8 space-y-8 overflow-x-hidden md:h-screen md:overflow-y-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#dcdcde] gap-4">
          <h1 className="sr-only">Affiliate Dashboard</h1>
          <div>
            <span className="text-[9px] bg-[#2271b1] text-white px-2 py-0.5 rounded font-bold uppercase tracking-widest">Affiliate Portal</span>
            <h2 className="text-2xl font-bold tracking-tight text-[#1d2327] mt-2">
              {activeTab === "overview" && "Performance Overview"}
              {activeTab === "products" && "Product Catalog & Links"}
              {activeTab === "conversions" && "Referral Acquisition Logs"}
              {activeTab === "payouts" && "Payouts & Balances"}
              {activeTab === "assets" && "Editorial & Brand Assets"}
              {activeTab === "settings" && "Account & Banking Details"}
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              Your Referral Code: <span className="font-mono font-bold text-[#1d2327] bg-[#dcdcde]/80 px-2 py-0.5 rounded select-all ml-1">{profile?.referralCode}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleCopyLink(`${window.location.origin}?ref=${profile?.referralCode}`)}
              className="bg-[#2271b1] hover:bg-[#135e96] text-white px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Shop Link
            </button>
          </div>
        </div>

        {/* Tab contents */}

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { 
                  title: "Available Balance", 
                  value: `$${profile?.balance?.toFixed(2)}`, 
                  desc: "Available for withdrawal", 
                  targetTab: "payouts",
                  highlight: true 
                },
                { 
                  title: "Pending Commissions", 
                  value: `$${metrics?.pendingCommissions?.toFixed(2)}`, 
                  desc: "Awaiting delivery confirmation", 
                  targetTab: "conversions" 
                },
                { 
                  title: "Lifetime Earnings", 
                  value: `$${profile?.lifetimeEarnings?.toFixed(2)}`, 
                  desc: "Total approved payouts", 
                  targetTab: "payouts" 
                },
                { 
                  title: "Conversion Ratio", 
                  value: `${metrics?.conversionRate}%`, 
                  desc: `${metrics?.conversions || 0} sales / ${metrics?.clicks || 0} clicks`, 
                  targetTab: "conversions" 
                }
              ].map((card, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveTab(card.targetTab)}
                  className={`group text-left p-6 border rounded-lg shadow-sm flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2271b1] focus:ring-offset-2 ${
                    card.highlight 
                      ? "bg-[#2271b1] text-white border-[#135e96]" 
                      : "bg-white text-[#1d2327] border-[#dcdcde] hover:border-[#2271b1]"
                  }`}
                >
                  <div className="w-full">
                    <p className={`text-[10px] uppercase tracking-widest font-bold ${card.highlight ? "text-blue-100" : "text-neutral-500 group-hover:text-[#2271b1]"}`}>{card.title}</p>
                    <p className="text-3xl font-bold tracking-tight font-mono mt-2">{card.value}</p>
                  </div>
                  <div className="w-full mt-4 pt-3 border-t border-current/10 flex items-center justify-between text-[10px] uppercase font-bold tracking-wider">
                    <span className={card.highlight ? "text-blue-100" : "text-neutral-500"}>{card.desc}</span>
                    <span className={`inline-flex items-center gap-1 transition-all group-hover:translate-x-1 ${card.highlight ? "text-white" : "text-[#2271b1]"}`}>
                      View Log <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Performance Chart Trend */}
            <div className="bg-white border border-[#dcdcde] rounded-lg p-6 space-y-6 shadow-sm">
              <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#1d2327] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#2271b1]" /> Click Traffic vs Sales Trend
                </p>
              </div>

              {chartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-neutral-400 italic">
                  No monthly analytics logs recorded.
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="overflow-x-auto pb-2">
                    <div className="h-64 flex items-end justify-between gap-4 pt-6 border-b border-neutral-200 font-mono text-[9px] relative min-w-[500px]">
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
                                <span className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white px-2 py-1 text-[9px] font-bold rounded-[3px] transition-all whitespace-nowrap shadow-md z-20">
                                  {data.clicks} Clicks
                                </span>
                              </div>
                              {/* Conversions bar */}
                              <div 
                                className="w-4 bg-[#2271b1] rounded-t-sm relative group hover:bg-[#135e96] transition-all cursor-pointer"
                                style={{ height: `${convHeight}px` }}
                              >
                                <span className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white px-2 py-1 text-[9px] font-bold rounded-[3px] transition-all whitespace-nowrap shadow-md z-20">
                                  {data.conversions} Sales
                                </span>
                              </div>
                            </div>
                            <span className="text-neutral-400 mt-1 uppercase text-[9px] font-bold tracking-wider">{data.month}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-6 text-[10px] text-neutral-400 justify-center font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-neutral-200 rounded-sm" />
                      <span>Monthly Traffic Clicks</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[#2271b1] rounded-sm" />
                      <span>Referred Sales</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Product Explorer */}
        {activeTab === "products" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.length === 0 ? (
              <div className="col-span-3 py-16 text-center border border-[#dcdcde] bg-white rounded-lg shadow-sm flex flex-col items-center justify-center space-y-2">
                <AlertCircle className="w-8 h-8 text-neutral-300" />
                <p className="text-xs text-neutral-400 italic">No products available in affiliate catalogue.</p>
              </div>
            ) : (
              products.map((product) => {
                // Calculate estimated commission
                let estCommission = "";
                if (profile) {
                  if (profile.commissionType === "Fixed") {
                    estCommission = `$${profile.commissionRate.toFixed(2)}`;
                  } else {
                    const rate = profile.commissionRate || 5;
                    estCommission = `$${((product.price * rate) / 100).toFixed(2)} (${rate}%)`;
                  }
                }

                return (
                  <div 
                    key={product._id} 
                    onClick={() => window.open(product.referralUrl, "_blank")}
                    className="bg-white border border-[#dcdcde] rounded-lg overflow-hidden flex flex-col group hover:border-[#2271b1] hover:shadow-md transition-all duration-300 cursor-pointer select-none"
                  >
                    {/* Image container */}
                    <div className="aspect-square bg-neutral-50 relative overflow-hidden border-b border-[#dcdcde]">
                      <img 
                        src={product.image} 
                        alt={product.name} 
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-3 right-3 bg-[#2271b1] text-white px-2.5 py-1 text-xs font-bold font-mono rounded shadow-sm">
                        ${product.price}
                      </div>
                    </div>
                    {/* Details section */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2.5">
                        <h4 className="text-sm font-bold text-[#1d2327] group-hover:text-[#2271b1] transition-colors leading-tight">{product.name}</h4>
                        {estCommission && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 border border-emerald-100 text-[10px] font-bold uppercase tracking-wider text-emerald-800 font-mono">
                            <DollarSign className="w-3.5 h-3.5" />
                            Commission: {estCommission}
                          </div>
                        )}
                        <p className="text-[12px] text-neutral-500 font-light line-clamp-3 leading-relaxed pt-1">
                          {product.description?.replace(/<[^>]*>/g, '') || "Premium quality product designed for modern utility."}
                        </p>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-neutral-100">
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyLink(product.referralUrl);
                            }}
                            className="flex-1 py-2.5 bg-[#2271b1] hover:bg-[#135e96] text-white text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copy Referral
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(product.referralUrl)}`, "_blank");
                            }}
                            className="px-3 py-2.5 border border-[#dcdcde] rounded-lg flex items-center justify-center hover:border-[#1d2327] hover:bg-neutral-50 transition-all text-neutral-600 cursor-pointer"
                            title="Generate QR code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* Social Shares */}
                        <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-neutral-400 font-bold pt-1">
                          <span>Direct Share:</span>
                          <div className="flex gap-3">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent("Check this out: " + product.referralUrl)}`, "_blank");
                              }}
                              className="text-neutral-500 hover:text-[#2271b1] transition-colors text-[10px] font-bold cursor-pointer"
                            >
                              WhatsApp
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(product.referralUrl)}&text=${encodeURIComponent(product.name)}`, "_blank");
                              }}
                              className="text-neutral-500 hover:text-[#2271b1] transition-colors text-[10px] font-bold cursor-pointer"
                            >
                              Twitter/X
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 3: Conversions & Orders */}
        {activeTab === "conversions" && (
          <div className="bg-white border border-[#dcdcde] rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#f6f7f7] border-b border-[#dcdcde] text-[10px] uppercase tracking-wider font-bold text-[#1d2327]">
                    <th className="p-4 whitespace-nowrap">Order ID</th>
                    <th className="p-4 whitespace-nowrap">Acquisition Date</th>
                    <th className="p-4 whitespace-nowrap">Sale Subtotal</th>
                    <th className="p-4 whitespace-nowrap">Calculated Commission</th>
                    <th className="p-4 whitespace-nowrap">Order Status</th>
                    <th className="p-4 whitespace-nowrap">Payout Status</th>
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
                      <tr key={order._id} className="hover:bg-[#f6f7f7]/60 transition-colors">
                        <td className="p-4 font-bold font-mono text-[#1d2327] whitespace-nowrap">#{order.orderNumber}</td>
                        <td className="p-4 text-neutral-500 whitespace-nowrap">{new Date(order.date).toLocaleDateString()}</td>
                        <td className="p-4 text-[#1d2327] font-semibold font-mono whitespace-nowrap">${order.subtotal?.toFixed(2)}</td>
                        <td className="p-4 text-[#2271b1] font-bold font-mono whitespace-nowrap">${order.commissionAmount?.toFixed(2)}</td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            order.status === "Delivered" ? "bg-emerald-50 border border-emerald-100 text-emerald-800" :
                            order.status === "Cancelled" ? "bg-rose-50 border border-rose-100 text-rose-800" : "bg-blue-50 border border-blue-100 text-blue-800"
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            order.commissionStatus === "Approved" ? "bg-emerald-50 border border-emerald-100 text-emerald-800" :
                            order.commissionStatus === "Pending" ? "bg-amber-50 border border-amber-100 text-amber-800" : "bg-neutral-50 border border-neutral-100 text-neutral-800"
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

        {/* Tab 4: Payouts & Balances */}
        {activeTab === "payouts" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Request Withdrawal Form */}
            <div className="lg:col-span-5 bg-white border border-[#dcdcde] rounded-lg p-6 space-y-6 shadow-sm">
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-500">Available Balance</p>
                <p className="text-4xl font-bold font-mono text-[#2271b1]">${profile?.balance?.toFixed(2)}</p>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Withdrawal threshold limits: <span className="font-bold text-[#1d2327]">$50.00 Minimum</span>.
                </p>
              </div>

              <form onSubmit={handlePayoutSubmit} className="space-y-4 border-t border-neutral-100 pt-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Withdrawal Amount ($) *</label>
                  <input 
                    type="number" 
                    name="amount"
                    min="50"
                    step="0.01"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    required
                    placeholder="Min $50.00"
                    className="w-full px-4 py-3 rounded-lg border border-[#8c8f94] bg-white focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] focus:outline-none text-[13px] transition-all font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Payment Method *</label>
                  <ThemedSelect
                    value={payoutMethod}
                    onChange={(e) => setPayoutMethod(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-[#8c8f94] bg-white focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] focus:outline-none text-[13px] transition-all font-semibold cursor-pointer"
                  >
                    <option value="Bank Transfer">Bank Transfer (Swift/Routing)</option>
                    <option value="IBAN">IBAN Account Transfer</option>
                    <option value="PayPal">PayPal Account</option>
                    <option value="Wise">Wise Direct Transfer</option>
                  </ThemedSelect>
                </div>

                <button 
                  type="submit" 
                  disabled={submittingPayout || profile?.balance < 50}
                  className="w-full py-3.5 bg-[#2271b1] hover:bg-[#135e96] text-white text-[11px] uppercase tracking-widest font-bold rounded-lg transition-all disabled:opacity-40 shadow-sm cursor-pointer"
                >
                  {submittingPayout ? "Processing..." : "Submit Withdrawal Request"}
                </button>
              </form>
            </div>

            {/* Payout History Logs */}
            <div className="lg:col-span-7 bg-white border border-[#dcdcde] rounded-lg overflow-hidden shadow-sm">
              <div className="p-5 border-b border-[#dcdcde]">
                <p className="text-xs font-bold uppercase tracking-wider text-[#1d2327]">Withdrawal Logs</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[#f6f7f7] border-b border-[#dcdcde] text-[10px] uppercase tracking-wider font-bold text-[#1d2327]">
                      <th className="p-4 whitespace-nowrap">Requested</th>
                      <th className="p-4 whitespace-nowrap">Amount</th>
                      <th className="p-4 whitespace-nowrap">Method</th>
                      <th className="p-4 whitespace-nowrap">Status</th>
                      <th className="p-4 whitespace-nowrap">Reference/TxID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {payouts.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-xs text-neutral-400 italic">No payout requests found.</td>
                      </tr>
                    ) : (
                      payouts.map((pay) => (
                        <tr key={pay._id} className="hover:bg-[#f6f7f7]/60 transition-colors">
                          <td className="p-4 text-neutral-500 whitespace-nowrap">{new Date(pay.createdAt).toLocaleDateString()}</td>
                          <td className="p-4 font-bold font-mono text-[#1d2327] whitespace-nowrap">${pay.amount?.toFixed(2)}</td>
                          <td className="p-4 text-neutral-500 font-mono whitespace-nowrap">{pay.paymentMethod}</td>
                          <td className="p-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              pay.status === "Paid" ? "bg-emerald-50 border border-emerald-100 text-emerald-800" :
                              pay.status === "Rejected" ? "bg-rose-50 border border-rose-100 text-rose-800" : "bg-amber-50 border border-amber-100 text-amber-800"
                            }`}>
                              {pay.status}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-[11px] text-neutral-400 whitespace-nowrap">{pay.transactionId || "—"}</td>
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
              <div className="col-span-3 py-16 text-center border border-[#dcdcde] bg-white rounded-lg shadow-sm flex flex-col items-center justify-center space-y-2">
                <AlertCircle className="w-8 h-8 text-neutral-300" />
                <p className="text-xs text-neutral-400 italic">No marketing assets available.</p>
              </div>
            ) : (
              assets.map((asset) => (
                <div 
                  key={asset._id} 
                  onClick={() => window.open(asset.fileUrl, "_blank")}
                  className="bg-white border border-[#dcdcde] rounded-lg p-6 space-y-4 flex flex-col justify-between hover:border-[#2271b1] hover:shadow-md transition-all duration-300 cursor-pointer shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="px-2 py-0.5 rounded bg-neutral-100 text-[9px] font-mono font-bold text-neutral-500 uppercase">
                        {asset.type}
                      </span>
                      {asset.dimensions && (
                        <span className="text-[9px] font-mono text-neutral-400 font-bold">{asset.dimensions}</span>
                      )}
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#1d2327]">{asset.title}</p>
                  </div>

                  <div className="pt-3 border-t border-neutral-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(asset.fileUrl, "_blank");
                      }}
                      className="block w-full py-2 bg-[#2271b1] hover:bg-[#135e96] text-white text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all text-center shadow-sm cursor-pointer"
                    >
                      Download Asset
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}        {/* Tab 6: Profile & Bank Details */}
        {activeTab === "settings" && (
          <form onSubmit={handleSettingsSubmit} className="space-y-8 bg-white border border-[#dcdcde] rounded-lg p-6 md:p-8 shadow-sm max-w-4xl">
            
            {/* 1. Profile Photo */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1d2327] border-b border-neutral-200 pb-2">
                Profile Photo
              </h3>
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <div className="shrink-0">
                  {avatarFile ? (
                    <img
                      src={URL.createObjectURL(avatarFile)}
                      alt="Avatar Preview"
                      className="w-20 h-20 rounded-full object-cover border-2 border-[#2271b1] shadow-sm bg-neutral-50"
                    />
                  ) : profile?.profilePhoto ? (
                    <img
                      src={profile.profilePhoto.startsWith("http") || profile.profilePhoto.startsWith("/") ? profile.profilePhoto : `/api/admin/affiliates/requests/document?file=${encodeURIComponent(profile.profilePhoto)}`}
                      alt="Avatar"
                      className="w-20 h-20 rounded-full object-cover border border-[#dcdcde] shadow-sm bg-neutral-50"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-[#1d2327] text-white font-bold text-lg flex items-center justify-center border border-neutral-750">
                      {profile?.name?.charAt(0).toUpperCase() || "P"}
                    </div>
                  )}
                </div>
                <div className="space-y-2 flex-1 w-full">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Upload New Profile Photo</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    onChange={(e) => setAvatarFile(e.target.files[0] || null)}
                    className="w-full text-xs text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-[#2271b1] file:text-xs file:font-semibold file:bg-white file:text-[#2271b1] hover:file:bg-blue-50 cursor-pointer"
                  />
                  {avatarFile && (
                    <p className="text-[11px] font-semibold text-emerald-600">Selected: {avatarFile.name} (Ready to upload)</p>
                  )}
                  <p className="text-[10px] text-gray-400">Accepted formats: JPG, PNG, WEBP. Max size: 3MB.</p>
                </div>
              </div>
            </div>

            {/* 2. Personal Information */}
            <div className="space-y-4 border-t border-neutral-100 pt-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1d2327] border-b border-neutral-200 pb-2">
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    value={settingsForm.name}
                    onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-[#8c8f94] bg-white focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] focus:outline-none text-[13px] transition-all font-semibold text-[#1d2327]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Email Address (Read-only)</label>
                  <input
                    type="email"
                    disabled
                    value={settingsForm.email}
                    className="w-full px-4 py-3 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-500 text-[13px] font-mono select-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Phone Number</label>
                  <input
                    type="tel"
                    value={settingsForm.phone}
                    onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-[#8c8f94] bg-white focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] focus:outline-none text-[13px] transition-all text-[#1d2327] font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Date of Birth</label>
                  <input
                    type="date"
                    value={settingsForm.dob}
                    onChange={(e) => setSettingsForm({ ...settingsForm, dob: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-[#8c8f94] bg-white focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] focus:outline-none text-[13px] transition-all text-[#1d2327] font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* 3. Business Information */}
            <div className="space-y-4 border-t border-neutral-100 pt-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1d2327] border-b border-neutral-200 pb-2">
                Business & Marketing Reach
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Company / Brand Name</label>
                  <input
                    type="text"
                    value={settingsForm.companyName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, companyName: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-[#8c8f94] bg-white focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] focus:outline-none text-[13px] transition-all text-[#1d2327] font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Website URL</label>
                  <input
                    type="url"
                    value={settingsForm.website}
                    onChange={(e) => setSettingsForm({ ...settingsForm, website: e.target.value })}
                    placeholder="https://example.com"
                    className="w-full px-4 py-3 rounded-lg border border-[#8c8f94] bg-white focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] focus:outline-none text-[13px] transition-all text-[#1d2327] font-semibold"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Social Media Profile Links (Comma separated)</label>
                  <textarea
                    value={settingsForm.socialLinks}
                    onChange={(e) => setSettingsForm({ ...settingsForm, socialLinks: e.target.value })}
                    placeholder="instagram.com/profile, youtube.com/channel"
                    rows={2}
                    className="w-full px-4 py-3 rounded-lg border border-[#8c8f94] bg-white focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] focus:outline-none text-[13px] transition-all resize-none text-[#1d2327] font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* 4. Referral Code & Rates (Read-Only) */}
            <div className="space-y-4 border-t border-neutral-100 pt-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1d2327] border-b border-neutral-200 pb-2">
                Referral & Commission Rates (Read-only)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-[#f6f7f7] p-4 rounded-lg border border-[#dcdcde]">
                <div>
                  <p className="text-[10px] uppercase font-bold text-neutral-500">Referral Code</p>
                  <p className="text-sm font-bold text-[#1d2327] font-mono mt-0.5">{profile?.referralCode || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-neutral-500">Direct Coupon</p>
                  <p className="text-sm font-bold text-[#1d2327] font-mono mt-0.5">{profile?.couponCode || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-neutral-500">Commission Rate</p>
                  <p className="text-sm font-bold text-[#2271b1] mt-0.5 font-mono">
                    {profile?.commissionType === "Fixed" ? `$${profile?.commissionRate}` : `${profile?.commissionRate || 5}%`}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-neutral-500">Customer Discount</p>
                  <p className="text-sm font-bold text-emerald-700 mt-0.5">
                    {profile?.customerDiscountType === "None" || !profile?.customerDiscountValue
                      ? "None"
                      : profile?.customerDiscountType === "Percentage"
                      ? `${profile.customerDiscountValue}% Off`
                      : `$${profile.customerDiscountValue} Off`}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-neutral-500">Account Created</p>
                  <p className="text-sm font-bold text-[#1d2327] font-mono mt-0.5">
                    {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* 5. Address */}
            <div className="space-y-4 border-t border-neutral-100 pt-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1d2327] border-b border-neutral-200 pb-2">
                Address Profile Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 md:col-span-3">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Street Address</label>
                  <input 
                    type="text" 
                    value={settingsForm.street} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, street: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-[#8c8f94] bg-white focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] focus:outline-none text-[13px] transition-all text-[#1d2327] font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">City</label>
                  <input 
                    type="text" 
                    value={settingsForm.city} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, city: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-[#8c8f94] bg-white focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] focus:outline-none text-[13px] transition-all text-[#1d2327] font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">State/Province</label>
                  <input 
                    type="text" 
                    value={settingsForm.state} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, state: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-[#8c8f94] bg-white focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] focus:outline-none text-[13px] transition-all text-[#1d2327] font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Zip/Postal Code</label>
                  <input 
                    type="text" 
                    value={settingsForm.zipCode} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, zipCode: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-[#8c8f94] bg-white focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] focus:outline-none text-[13px] transition-all text-[#1d2327] font-semibold font-mono"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-3">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Country</label>
                  <input 
                    type="text" 
                    value={settingsForm.country} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, country: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-[#8c8f94] bg-white focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] focus:outline-none text-[13px] transition-all text-[#1d2327] font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* 6. Banking */}
            <div className="space-y-4 border-t border-neutral-100 pt-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1d2327] border-b border-neutral-200 pb-2">
                Banking & Payout Profile
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Bank Account Holder</label>
                  <input 
                    type="text" 
                    value={settingsForm.accountHolder} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, accountHolder: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-[#8c8f94] bg-white focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] focus:outline-none text-[13px] transition-all text-[#1d2327] font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Bank Name</label>
                  <input 
                    type="text" 
                    value={settingsForm.bankName} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, bankName: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-[#8c8f94] bg-white focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] focus:outline-none text-[13px] transition-all text-[#1d2327] font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Account Number / IBAN</label>
                  <input 
                    type="text" 
                    value={settingsForm.accountNumber} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, accountNumber: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-[#8c8f94] bg-white focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] focus:outline-none text-[13px] transition-all text-[#1d2327] font-semibold font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Swift / BIC Code</label>
                  <input 
                    type="text" 
                    value={settingsForm.swiftCode} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, swiftCode: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-[#8c8f94] bg-white focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] focus:outline-none text-[13px] transition-all text-[#1d2327] font-semibold font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Routing / ABA Number</label>
                  <input 
                    type="text" 
                    value={settingsForm.routingNumber} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, routingNumber: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-[#8c8f94] bg-white focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] focus:outline-none text-[13px] transition-all text-[#1d2327] font-semibold font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">PayPal Email Address</label>
                  <input 
                    type="email" 
                    value={settingsForm.paypalEmail} 
                    onChange={(e) => setSettingsForm({ ...settingsForm, paypalEmail: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-[#8c8f94] bg-white focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] focus:outline-none text-[13px] transition-all text-[#1d2327] font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* 7. Verification Documents */}
            <div className="space-y-4 border-t border-neutral-100 pt-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1d2327] border-b border-neutral-200 pb-2">
                Verification Documents
              </h3>
              <div className="space-y-2">
                {profile?.identityDocuments?.length > 0 ? (
                  profile.identityDocuments.map((filename, idx) => (
                    <a
                      key={idx}
                      href={`/api/admin/affiliates/requests/document?file=${encodeURIComponent(filename)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between bg-neutral-50 px-4 py-3 rounded-lg border border-[#dcdcde] text-xs hover:border-[#2271b1] hover:bg-blue-50/10 transition-colors"
                    >
                      <span className="font-mono text-neutral-600 truncate max-w-[200px]" title={filename}>{filename}</span>
                      <span className="text-[10px] font-bold uppercase text-[#2271b1]">Identity Document (Click to View)</span>
                    </a>
                  ))
                ) : null}
                {profile?.bankVerificationDocument ? (
                  <a
                    href={`/api/admin/affiliates/requests/document?file=${encodeURIComponent(profile.bankVerificationDocument)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between bg-neutral-50 px-4 py-3 rounded-lg border border-[#dcdcde] text-xs hover:border-[#2271b1] hover:bg-blue-50/10 transition-colors"
                  >
                    <span className="font-mono text-neutral-600 truncate max-w-[200px]" title={profile.bankVerificationDocument}>{profile.bankVerificationDocument}</span>
                    <span className="text-[10px] font-bold uppercase text-[#2271b1]">Bank Verification (Click to View)</span>
                  </a>
                ) : null}
                {(!profile?.identityDocuments || profile.identityDocuments.length === 0) && !profile?.bankVerificationDocument && (
                  <p className="text-xs text-neutral-400 italic">No KYC verification documents uploaded yet.</p>
                )}

                <div className="space-y-2 mt-4 pt-4 border-t border-neutral-100/50">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Upload New Bank Statement / Certification Document</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={(e) => setBankDocFile(e.target.files[0] || null)}
                    className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-[#2271b1] file:text-xs file:font-semibold file:bg-white file:text-[#2271b1] hover:file:bg-blue-50 cursor-pointer"
                  />
                  {bankDocFile && (
                    <p className="text-[11px] font-semibold text-emerald-600">Selected: {bankDocFile.name} (Ready to upload)</p>
                  )}
                  <p className="text-[10px] text-gray-400">Supported formats: PDF, PNG, JPG. Max size: 5MB.</p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-neutral-100 flex justify-end">
              <button 
                type="submit" 
                disabled={updatingSettings}
                className="px-6 py-3 bg-[#2271b1] hover:bg-[#135e96] text-white text-xs uppercase tracking-widest font-bold rounded-lg transition-all disabled:opacity-40 shadow-md cursor-pointer"
              >
                {updatingSettings ? "Saving Settings..." : "Save Settings"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
