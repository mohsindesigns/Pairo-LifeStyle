"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Trash2, ShoppingBag, ChevronDown, ChevronUp, Star, LogOut, MapPin, User, Search, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingInfo, setEditingInfo] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);

  const [infoForm, setInfoForm] = useState({ name: "", email: "" });
  const [addressForm, setAddressForm] = useState({ fullName: "", street: "", city: "", state: "", zipCode: "", country: "Pakistan" });

  const [activeTab, setActiveTab] = useState("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [expandedTimelineId, setExpandedTimelineId] = useState(null);

  const [activeReviewId, setActiveReviewId] = useState(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccessMessage, setReviewSuccessMessage] = useState("");
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    title: "",
    comment: "",
    customerName: "",
    recommend: true
  });

  // Per-order timeline data cache
  const [orderTimelines, setOrderTimelines] = useState({});
  const [loadingTimeline, setLoadingTimeline] = useState(null);

  // Product rating hover state per order
  const [orderHoverRatings, setOrderHoverRatings] = useState({});

  // User notification/feedback state
  const [feedback, setFeedback] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const router = useRouter();

  const handleReviewSubmit = async (e, productId, orderNumber) => {
    e.preventDefault();
    setSubmittingReview(true);
    setReviewSuccessMessage("");
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: reviewForm.rating,
          title: reviewForm.title,
          comment: reviewForm.comment,
          customerName: reviewForm.customerName || userData?.name || session?.user?.name || "Customer",
          recommend: reviewForm.recommend,
          orderNumber: orderNumber
        })
      });
      const data = await res.json();
      if (res.ok) {
        setReviewSuccessMessage("Thank you! Your verified review has been submitted.");
        setReviewForm({ rating: 5, title: "", comment: "", customerName: "", recommend: true });
        setTimeout(() => {
          setActiveReviewId(null);
          setReviewSuccessMessage("");
        }, 3000);
      } else {
        alert(data.error || "Failed to submit review.");
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const fetchOrderTimeline = async (orderId) => {
    if (orderTimelines[orderId]) {
      // Toggle: if already showing this timeline, hide it
      setExpandedTimelineId(prev => prev === orderId ? null : orderId);
      return;
    }
    setLoadingTimeline(orderId);
    try {
      const res = await fetch(`/api/profile/orders/${orderId}`);
      const data = await res.json();
      if (data.success && data.order) {
        setOrderTimelines(prev => ({ ...prev, [orderId]: data.order }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTimeline(null);
      setExpandedTimelineId(prev => prev === orderId ? null : orderId);
    }
  };

  const fetchUserData = useCallback(async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setUserData(data);
        setInfoForm({ name: data.name, email: data.email });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      if (status === "unauthenticated") {
        router.push("/login");
      } else if (status === "authenticated") {
        fetchUserData();
      }
    });
  }, [status, router, fetchUserData]);

  useEffect(() => {
    if (userData && userData.orderHistory && userData.orderHistory.length > 0) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("action") === "write-review") {
        // Find the latest order and the first item in it to review
        const latestOrder = userData.orderHistory[0];
        const latestItem = latestOrder.items?.[0];
        if (latestItem) {
          const reviewId = `${latestOrder.id}-${latestItem.productId}`;
          setExpandedOrderId(latestOrder.id);
          setActiveReviewId(reviewId);
          // Gently scroll to the order
          setTimeout(() => {
            const el = document.getElementById(`order-row-${latestOrder.id}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }, 300);
        }
      }
    }
  }, [userData]);

  const handleAction = async (action, data) => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data })
      });
      const resData = await res.json();
      if (res.ok) {
        await fetchUserData();
        setEditingInfo(false);
        setShowAddressForm(false);
        if (resData.message) {
          setFeedback({ type: "success", message: resData.message });
        }
      } else {
        setFeedback({ type: "error", message: resData.message || "Failed to complete action." });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "An unexpected error occurred. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session || !userData) return null;

  const inputClass = "w-full bg-white border border-black/10 rounded-[4px] px-4 py-3 text-sm font-medium focus:border-black outline-none transition-all text-black";

  const getInitials = (name) => {
    if (!name) return "PA";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };
  const initials = getInitials(userData.name);

  const resolveImageUrl = (img) => {
    if (!img) return "";
    if (img.startsWith("http://") || img.startsWith("https://") || img.startsWith("data:")) return img;
    if (img.startsWith("/")) return img;
    return `/${img}`;
  };

  const formatCurrency = (currency) => {
    if (!currency) return "$";
    const curUpper = currency.toUpperCase();
    if (curUpper === "USD" || curUpper === "US") return "$";
    if (curUpper === "PKR" || curUpper === "RS" || curUpper === "RS.") return "Rs.";
    return "$"; // default to $ for safety as requested
  };

  const pendingCount = (userData.orderHistory || []).filter(o => o.status === 'Pending').length || 0;
  const confirmedCount = (userData.orderHistory || []).filter(o => o.status === 'Confirmed').length || 0;
  const dispatchedCount = (userData.orderHistory || []).filter(o => ['Processing', 'Packed', 'Shipped', 'Out for Delivery'].includes(o.status)).length || 0;
  const deliveredCount = (userData.orderHistory || []).filter(o => o.status === 'Delivered').length || 0;

  const filteredOrders = (userData.orderHistory || []).filter(order => {
    const isCompleted = ['Delivered', 'Cancelled', 'Refunded'].includes(order.status);
    const matchesTab = activeTab === 'previous' ? isCompleted : !isCompleted;
    const matchesQuery = searchQuery === "" ||
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.items || []).some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesQuery;
  });

  const formatOrderDate = (dateString) => {
    const d = new Date(dateString);
    const pad = (n) => n.toString().padStart(2, '0');
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = pad(d.getMinutes());
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${day}-${month}-${year} ${pad(hours)}:${minutes} ${ampm}`;
  };

  const getStatusColor = (status) => {
    if (status === 'Delivered' || status === 'Completed') {
      return 'bg-black text-white';
    }
    if (status === 'Cancelled' || status === 'Refunded') {
      return 'bg-neutral-50 text-neutral-400 border border-neutral-200/60 line-through';
    }
    return 'bg-neutral-100 text-black border border-black/5';
  };

  const timelineSteps = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered'];

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-black font-sans selection:bg-black selection:text-white pt-2 pb-12">
      <h1 className="sr-only">My Account</h1>
      <div className="container mx-auto px-2 sm:px-4 md:px-8">
        <div className="w-full mx-auto">
          {/* Main Dashboard Content Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Left Column: Sidebar (3 cols) */}
            <div className="lg:col-span-3 space-y-6">

              {/* Feedback alert */}
              {feedback && (
                <div className={`p-3.5 rounded-[4px] border text-xs font-medium text-center ${
                  feedback.type === 'success'
                    ? 'bg-green-50 text-green-700 border-green-100'
                    : 'bg-red-50 text-red-600 border-red-100'
                }`}>
                  {feedback.message}
                </div>
              )}

              {/* User Profile Card */}
              <div className="bg-white border border-neutral-100 p-6 rounded-[4px]">
                <div className="flex flex-col items-center text-center gap-3 pb-5">
                  {/* Initials Avatar */}
                  <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center text-sm font-semibold shrink-0">
                    {initials}
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-black">{userData.name}</h2>
                    {userData.addresses?.[0]?.phone && (
                      <p className="text-sm text-neutral-400 mt-0.5">{userData.addresses[0].phone}</p>
                    )}
                    <p className="text-sm text-neutral-400 mt-0.5">{userData.email}</p>
                    {userData.pendingEmail && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-[4px] text-[8px] font-bold uppercase tracking-wider leading-relaxed shadow-sm">
                        Verification pending for:<br/>
                        <span className="font-mono lowercase text-[9px] block mt-0.5 font-bold text-amber-800">{userData.pendingEmail}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-100">
                  {editingInfo ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-sm text-neutral-500">Full Name</label>
                        <input
                          className={inputClass}
                          value={infoForm.name}
                          onChange={(e) => setInfoForm({ ...infoForm, name: e.target.value })}
                          placeholder="Full Name"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm text-neutral-500">Email Address</label>
                        <input
                          className={inputClass}
                          value={infoForm.email}
                          onChange={(e) => setInfoForm({ ...infoForm, email: e.target.value })}
                          placeholder="Email"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction("updateInfo", infoForm)}
                          className="flex-1 bg-black text-white py-2.5 rounded-[4px] text-sm font-medium hover:bg-neutral-800 transition-all cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingInfo(false)}
                          className="flex-1 border border-neutral-200 text-neutral-600 hover:bg-neutral-50 py-2.5 rounded-[4px] text-sm font-medium transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setEditingInfo(true)}
                        className="w-full border border-neutral-200 text-black hover:bg-neutral-50 py-2.5 rounded-[4px] text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <User className="w-4 h-4" /> Edit Profile
                      </button>
                      <button
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="w-full bg-black text-white hover:bg-neutral-800 py-2.5 rounded-[4px] text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Statistics Block (2x2 Grid) */}
              <div className="bg-white border border-neutral-100 rounded-[4px] overflow-hidden">
                <div className="grid grid-cols-2 divide-x divide-y divide-neutral-100 text-center">
                  <div className="p-4 space-y-1">
                    <p className="text-2xl font-semibold text-black">{pendingCount}</p>
                    <p className="text-xs text-neutral-400">Pending</p>
                  </div>
                  <div className="p-4 space-y-1">
                    <p className="text-2xl font-semibold text-black">{confirmedCount}</p>
                    <p className="text-xs text-neutral-400">Confirmed</p>
                  </div>
                  <div className="p-4 space-y-1">
                    <p className="text-2xl font-semibold text-black">{dispatchedCount}</p>
                    <p className="text-xs text-neutral-400">Dispatched</p>
                  </div>
                  <div className="p-4 space-y-1">
                    <p className="text-2xl font-semibold text-black">{deliveredCount}</p>
                    <p className="text-xs text-neutral-400">Delivered</p>
                  </div>
                </div>
              </div>

              {/* Saved Locations Block */}
              <div className="space-y-4 bg-white border border-neutral-100 p-6 rounded-[4px]">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-black flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Saved Addresses</h2>
                  <button
                    onClick={() => setShowAddressForm(!showAddressForm)}
                    className="text-sm text-neutral-400 hover:text-black transition-colors cursor-pointer"
                  >
                    {showAddressForm ? "Cancel" : "+ Add"}
                  </button>
                </div>

                <AnimatePresence>
                  {showAddressForm && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 bg-neutral-50 rounded-[4px] border border-neutral-100 space-y-3">
                        <div className="space-y-1">
                          <label className="text-sm text-neutral-500">Recipient Name</label>
                          <input placeholder="Full Name" className={inputClass} value={addressForm.fullName} onChange={e => setAddressForm({ ...addressForm, fullName: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm text-neutral-500">Street Address</label>
                          <input placeholder="Street" className={inputClass} value={addressForm.street} onChange={e => setAddressForm({ ...addressForm, street: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-sm text-neutral-500">City</label>
                            <input placeholder="City" className={inputClass} value={addressForm.city} onChange={e => setAddressForm({ ...addressForm, city: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm text-neutral-500">Zip Code</label>
                            <input placeholder="Zip Code" className={inputClass} value={addressForm.zipCode} onChange={e => setAddressForm({ ...addressForm, zipCode: e.target.value })} />
                          </div>
                        </div>
                        <button
                          onClick={() => handleAction("addAddress", addressForm)}
                          className="w-full bg-black text-white py-2.5 rounded-[4px] text-sm font-medium hover:bg-neutral-800 transition-all cursor-pointer"
                        >
                          Save Address
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-2">
                  {!userData.addresses?.length ? (
                    <p className="text-sm text-neutral-400 text-center py-4">
                      No addresses saved yet.
                    </p>
                  ) : (
                    (userData.addresses || []).map((addr) => (
                      <div key={addr._id} className="p-3.5 bg-neutral-50 border border-neutral-100 rounded-[4px] flex justify-between items-start">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-black truncate">{addr.fullName}</p>
                          <p className="text-sm text-neutral-400 leading-relaxed mt-0.5 truncate">
                            {addr.street}, {addr.city}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAction("deleteAddress", { id: addr._id })}
                          className="text-neutral-300 hover:text-red-500 transition-colors p-1 cursor-pointer shrink-0"
                          aria-label="Delete address"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

             {/* Right Column: Main Content (9 cols) */}
            <div className="lg:col-span-9 space-y-4">

              {/* Header Navigation Tab + Search Bar */}
              <div className="bg-white p-3 rounded-[4px] border border-neutral-100 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                <div className="flex gap-1 p-1 bg-neutral-50 rounded-[4px]">
                  <button
                    onClick={() => setActiveTab("active")}
                    className={`px-4 py-2 text-sm font-medium rounded-[3px] transition-all cursor-pointer ${
                      activeTab === "active"
                        ? "bg-black text-white"
                        : "text-neutral-400 hover:text-black"
                    }`}
                  >
                    Active Orders
                  </button>
                  <button
                    onClick={() => setActiveTab("previous")}
                    className={`px-4 py-2 text-sm font-medium rounded-[3px] transition-all cursor-pointer ${
                      activeTab === "previous"
                        ? "bg-black text-white"
                        : "text-neutral-400 hover:text-black"
                    }`}
                  >
                    Previous Orders
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-neutral-300 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search orders..."
                    className="w-full bg-neutral-50 border border-neutral-100 rounded-[4px] pl-9 pr-4 py-2 text-sm font-medium placeholder:text-neutral-300 focus:border-neutral-300 outline-none transition-colors text-black"
                  />
                </div>
              </div>

              {/* Order List Rows */}
              <div className="space-y-3">
                {filteredOrders.length === 0 ? (
                  <div className="py-16 text-center border border-dashed border-neutral-100 rounded-[4px] bg-white space-y-3">
                    <ShoppingBag className="w-10 h-10 text-neutral-200 mx-auto" />
                    <p className="text-xs text-neutral-400">No orders matched your criteria.</p>
                  </div>
                ) : (
                  filteredOrders.map((order, i) => {
                    const isExpanded = expandedOrderId === order.id;
                    const isDelivered = order.status === 'Delivered' || order.status === 'Completed' || order.payment?.status === 'Paid';
                    
                     // Stepper status mapping
                     const timelineOrder = orderTimelines[order.id];
                     const stepperSteps = ['Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];
                     
                     let currentStepIndex = stepperSteps.indexOf(order.status);
                     if (currentStepIndex === -1 && order.status === 'Completed') {
                       currentStepIndex = 6;
                     }

                    return (
                      <div
                        key={order.id}
                        id={`order-row-${order.id}`}
                        className={`border rounded-[4px] bg-white transition-all overflow-hidden ${
                          isExpanded ? 'border-neutral-200' : 'border-neutral-100 hover:border-neutral-200'
                        }`}
                      >
                        {/* Summary Header Row */}
                        <div
                          onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                          className="px-5 py-4 grid grid-cols-2 md:grid-cols-12 items-center gap-4 cursor-pointer hover:bg-neutral-50/50 transition-colors select-none text-left"
                        >
                          {/* Col 1: Order Number */}
                          <div className="space-y-0.5 md:col-span-2 min-w-0">
                            <p className="text-xs text-neutral-400">Order</p>
                            <p className="text-sm font-semibold text-black font-mono">#{order.orderNumber}</p>
                          </div>

                          {/* Col 2: Tracking ID */}
                          <div className="space-y-0.5 md:col-span-3 min-w-0">
                            <p className="text-xs text-neutral-400">Tracking</p>
                            <p className="text-sm font-medium text-black font-mono truncate" title={order.trackingId}>{order.trackingId || "—"}</p>
                          </div>

                          {/* Col 3: Creation Date */}
                          <div className="space-y-0.5 md:col-span-3 min-w-0">
                            <p className="text-xs text-neutral-400">Date</p>
                            <p className="text-sm font-medium text-black">{formatOrderDate(order.date)}</p>
                          </div>

                          {/* Col 4: Product Rating */}
                          <div className="space-y-0.5 col-span-2 md:col-span-2 min-w-0">
                            <p className="text-xs text-neutral-400">Rating</p>
                            <div
                              className="flex items-center gap-0.5"
                              onMouseLeave={() => setOrderHoverRatings(prev => ({ ...prev, [order.id]: 0 }))}
                            >
                              {[1, 2, 3, 4, 5].map((star) => {
                                const hoverVal = orderHoverRatings[order.id] || 0;
                                const isFilled = star <= hoverVal;
                                return (
                                  <button
                                    key={star}
                                    type="button"
                                    disabled={!isDelivered}
                                    onMouseEnter={() => {
                                      if (isDelivered) setOrderHoverRatings(prev => ({ ...prev, [order.id]: star }));
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isDelivered) return;
                                      setExpandedOrderId(order.id);
                                      const firstItem = order.items?.[0];
                                      if (firstItem) {
                                        const reviewId = `${order.id}-${firstItem.productId}`;
                                        setActiveReviewId(reviewId);
                                        setReviewForm({
                                          rating: star,
                                          title: '',
                                          comment: '',
                                          customerName: userData.name,
                                          recommend: true
                                        });
                                      }
                                    }}
                                    className={`p-0.5 transition-all ${
                                      isDelivered ? 'cursor-pointer hover:scale-125' : 'cursor-default'
                                    }`}
                                  >
                                    <Star className={`w-3 h-3 transition-colors ${
                                      isFilled ? 'fill-yellow-400 text-yellow-400' : 'fill-none text-black/20'
                                    }`} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Col 5: Status Badge */}
                          <div className="flex md:col-span-1 md:justify-center min-w-0">
                            <span className={`inline-block px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] rounded-[2px] ${getStatusColor(order.status)}`}>
                              {order.status}
                            </span>
                          </div>

                          {/* Col 6: Chevron */}
                          <div className="flex md:col-span-1 justify-end text-black min-w-0">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>

                        {/* Expanded Items & Info Area */}
                        {isExpanded && (
                          <div className="border-t border-neutral-100 bg-neutral-50/50 p-5 grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                            
                            {/* Left Column: ORDER DETAIL */}
                            <div className="space-y-4">
                              <h4 className="text-sm font-semibold text-black border-b border-neutral-100 pb-2">Order Items</h4>
                              
                              {/* Line Items */}
                              <div className="space-y-3">
                                <div className="divide-y divide-neutral-100 bg-white border border-neutral-100 rounded-[4px] p-4 space-y-4">
                                  {(order.items || []).map((item, idx) => {
                                    const reviewId = `${order.id}-${item.productId}`;
                                    const showForm = activeReviewId === reviewId;
                                    return (
                                      <div key={idx} className="pt-4 first:pt-0 space-y-3">
                                        <div className="flex justify-between items-center gap-4">
                                          <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-14 h-14 rounded-[8px] border border-neutral-200 overflow-hidden bg-white shrink-0 flex items-center justify-center p-1">
                                              <img
                                                src={resolveImageUrl(item.image)}
                                                alt={item.name || "Product image"}
                                                className="w-full h-full object-contain"
                                                onError={(e) => {
                                                  e.target.onerror = null;
                                                  e.target.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23cccccc' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='3' width='18' height='18' rx='2' ry='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>";
                                                }}
                                              />
                                            </div>
                                            <div className="min-w-0">
                                              <p className="text-sm font-medium text-black truncate">{item.name}</p>
                                              
                                              {/* Product Variant Details */}
                                              {item.selectedVariant && (
                                                <p className="text-xs text-neutral-400 mt-0.5">
                                                  {item.selectedVariant.title || 
                                                    (item.selectedVariant.options ? Object.entries(item.selectedVariant.options).map(([k, v]) => `${k}: ${v}`).join(' · ') : '')
                                                  }
                                                </p>
                                              )}
                                              {item.sku && (
                                                <p className="text-xs text-neutral-400 mt-0.5">SKU: {item.sku}</p>
                                              )}
                                              
                                              <p className="text-xs text-neutral-400 mt-0.5">Qty {item.quantity}</p>
                                              
                                              {/* Product Star Rating under Title */}
                                              <div className="flex items-center gap-0.5 mt-1">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                  <Star key={star} className={`w-2.5 h-2.5 ${star <= (item.rating || 5) ? 'fill-yellow-400 text-yellow-400' : 'fill-none text-neutral-200'}`} />
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="text-right shrink-0">
                                              <p className="text-sm font-medium text-black">
                                                {formatCurrency(order.financials?.currency)}{((item.priceAtPurchase || 0) * (item.quantity || 0)).toLocaleString()}
                                              </p>
                                             {isDelivered && (
                                               <button
                                                 onClick={() => {
                                                   if (showForm) {
                                                     setActiveReviewId(null);
                                                   } else {
                                                     setActiveReviewId(reviewId);
                                                     setReviewForm({ rating: 5, title: "", comment: "", customerName: userData.name, recommend: true });
                                                   }
                                                 }}
                                                 className="text-xs border border-neutral-200 text-neutral-500 hover:text-black hover:border-neutral-400 px-2 py-1 rounded-[4px] font-medium cursor-pointer transition-colors mt-2 block ml-auto"
                                               >
                                                 {showForm ? "Cancel" : "Review"}
                                               </button>
                                             )}
                                          </div>
                                        </div>

                                        {/* Review Form */}
                                        {showForm && (
                                          <div className="bg-neutral-50 border border-neutral-200 rounded-[12px] p-4 mt-2 space-y-4">
                                            <span className="text-[9px] font-semibold uppercase tracking-wide text-black flex items-center gap-1.5">
                                              <Check className="w-3.5 h-3.5 text-green-600" /> Verified Purchase Review
                                            </span>
                                            {reviewSuccessMessage ? (
                                              <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-[10px] uppercase font-bold tracking-widest text-center rounded-[2px]">
                                                {reviewSuccessMessage}
                                              </div>
                                            ) : (
                                              <form onSubmit={(e) => handleReviewSubmit(e, item.productId, order.orderNumber)} className="space-y-3">
                                                <div className="space-y-1">
                                                  <label className="text-[8px] font-bold uppercase tracking-wider text-black block">Rating</label>
                                                  <div className="flex items-center gap-1">
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                      <button
                                                        key={star}
                                                        type="button"
                                                        onClick={() => setReviewForm(prev => ({ ...prev, rating: star }))}
                                                        className="p-1 cursor-pointer hover:scale-110 transition-transform"
                                                      >
                                                        <Star className={`w-5 h-5 ${star <= reviewForm.rating ? 'fill-yellow-400 text-yellow-400' : 'fill-none text-neutral-200'}`} />
                                                      </button>
                                                    ))}
                                                  </div>
                                                </div>
                                                <div className="space-y-1">
                                                  <label className="text-[8px] font-bold uppercase tracking-wider text-black block">Review Title</label>
                                                  <input
                                                    className="w-full bg-white border border-neutral-200 rounded-[4px] px-3 py-2 text-[10px] font-semibold outline-none focus:border-black text-black"
                                                    placeholder="Example: Great quality!"
                                                    value={reviewForm.title}
                                                    onChange={e => setReviewForm({ ...reviewForm, title: e.target.value })}
                                                    required
                                                  />
                                                </div>
                                                <div className="space-y-1">
                                                  <label className="text-[8px] font-bold uppercase tracking-wider text-black block">Comments</label>
                                                  <textarea
                                                    className="w-full bg-white border border-neutral-200 rounded-[4px] px-3 py-2 text-[10px] font-semibold outline-none focus:border-black text-black min-h-[60px] resize-y"
                                                    placeholder="Tell us what you liked or disliked..."
                                                    value={reviewForm.comment}
                                                    onChange={e => setReviewForm({ ...reviewForm, comment: e.target.value })}
                                                    required
                                                  />
                                                </div>
                                                <button
                                                  type="submit"
                                                  disabled={submittingReview}
                                                  className="w-full bg-black text-white hover:bg-neutral-800 py-2.5 rounded-[4px] text-[9px] font-black uppercase tracking-widest transition-colors cursor-pointer"
                                                >
                                                  {submittingReview ? "Submitting..." : "Submit Review"}
                                                </button>
                                              </form>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="flex justify-between items-center border-t border-neutral-200 pt-4">
                                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-black">Order Amount</span>
                                <span className="text-[13px] font-black text-black font-mono">
                                  {formatCurrency(order.financials?.currency)}{(order.total ?? 0).toLocaleString()}
                                </span>
                              </div>

                              <div className="pt-2">
                                <span className="text-[9px] font-black uppercase tracking-wider text-black block mb-1">Delivery Address</span>
                                <p className="text-[10px] font-medium text-black uppercase tracking-wider leading-relaxed">
                                  {order.shippingAddress ? (
                                    <>
                                      {order.shippingAddress.fullName}<br/>
                                      {order.shippingAddress.street}, {order.shippingAddress.city}, {order.shippingAddress.country}
                                    </>
                                  ) : "No address specified"}
                                </p>
                              </div>
                            </div>
                            {/* Right Column: TRACKING HISTORY */}
                            <div className="space-y-4 border-t md:border-t-0 md:border-l border-neutral-200 pt-6 md:pt-0 md:pl-8">
                              <div className="flex justify-between items-center border-b border-neutral-200 pb-1.5">
                                <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-black">Tracking History</h4>
                                <span className="text-[8px] font-bold text-black uppercase tracking-widest">Order: #{order.orderNumber}</span>
                              </div>

                              <div className="space-y-5">
                                {/* Current status badge */}
                                <div className="flex items-center gap-2">
                                  <span className={`inline-block px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] rounded-[2px] ${getStatusColor(order.status)}`}>
                                    {order.status}
                                  </span>
                                  {!['Cancelled', 'Refunded'].includes(order.status) && (
                                    <span className="text-[9px] text-neutral-400 font-medium">
                                      Step {Math.max(currentStepIndex + 1, 1)} of {stepperSteps.length}
                                    </span>
                                  )}
                                </div>

                                {/* Cancelled / Refunded message */}
                                {['Cancelled', 'Refunded'].includes(order.status) && (
                                  <div className="p-3 bg-neutral-50 border border-neutral-100 rounded-[4px]">
                                    <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide">
                                      This order has been {order.status.toLowerCase()}.
                                    </p>
                                  </div>
                                )}

                                {/* Vertical Timeline Stepper with connector lines & dates */}
                                {!['Cancelled', 'Refunded'].includes(order.status) && (
                                  <div className="relative">
                                    {stepperSteps.map((step, idx) => {
                                      const isCompleted = idx < currentStepIndex;
                                      const isCurrent = idx === currentStepIndex;
                                      const isLast = idx === stepperSteps.length - 1;

                                      // Find matching timeline entry for this step
                                      const timelineEntry = (order.timeline || []).find(t => t.status === step);
                                      const stepDate = timelineEntry?.timestamp
                                        ? formatOrderDate(timelineEntry.timestamp)
                                        : (isCompleted && idx === 0)
                                          ? formatOrderDate(order.date)
                                          : null;

                                      return (
                                        <div key={step} className="flex items-stretch gap-4">
                                          {/* Left column: circle + connector line */}
                                          <div className="flex flex-col items-center" style={{ width: '28px', flexShrink: 0 }}>
                                            {/* Step circle */}
                                            <div className={`relative z-10 w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${
                                              isCurrent
                                                ? 'bg-black border-black text-white shadow-[0_0_0_5px_rgba(0,0,0,0.07)]'
                                                : isCompleted
                                                  ? 'bg-black border-black text-white'
                                                  : 'bg-white border-neutral-200 text-neutral-300'
                                            }`}>
                                              {isCompleted ? (
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                              ) : isCurrent ? (
                                                <span className="w-2 h-2 rounded-full bg-white block" />
                                              ) : (
                                                <span className="w-1.5 h-1.5 rounded-full bg-neutral-200 block" />
                                              )}
                                            </div>
                                            {/* Vertical connector line (hidden for last item) */}
                                            {!isLast && (
                                              <div
                                                className={`w-[2px] flex-1 mt-0 transition-colors duration-500 ${
                                                  isCompleted ? 'bg-black' : 'bg-neutral-100'
                                                }`}
                                                style={{ minHeight: '28px' }}
                                              />
                                            )}
                                          </div>

                                          {/* Right column: step label + date */}
                                          <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-4'}`}>
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <p className={`text-[11px] font-bold uppercase tracking-[0.1em] leading-tight transition-colors ${
                                                isCurrent ? 'text-black' :
                                                isCompleted ? 'text-black' :
                                                'text-neutral-400'
                                              }`}>
                                                {step}
                                              </p>
                                              {isCurrent && (
                                                <span className="inline-block px-1.5 py-0.5 bg-black text-white text-[7px] font-black uppercase tracking-widest rounded-[2px]">
                                                  Now
                                                </span>
                                              )}
                                            </div>
                                            <p className={`text-[9px] mt-0.5 font-medium transition-colors ${
                                              stepDate
                                                ? isCurrent
                                                  ? 'text-neutral-600'
                                                  : 'text-neutral-500'
                                                : 'text-neutral-400'
                                            }`}>
                                              {stepDate || (isCurrent ? 'In progress...' : '—')}
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Cancel request button if pending */}
                                {['Pending', 'Confirmed', 'Processing'].includes(order.status) && (
                                  <div className="pt-2 text-right">
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleAction("cancelOrder", { orderId: order.id });
                                      }}
                                      className="text-[9px] font-black bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-[4px] uppercase tracking-widest hover:bg-red-100 transition-all cursor-pointer"
                                    >
                                      Request Cancellation
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

            </div>

          </div>

        </div>
      </div>

    </div>
  );
}
