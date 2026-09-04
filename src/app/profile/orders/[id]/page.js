"use client";

import { useState, useEffect } from "react";
import { 
  ChevronLeft, 
  Package, 
  Truck, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  ShieldCheck,
  Info,
  CreditCard,
  Check,
  Star
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { usePopup } from "@/context/PopupContext";

export default function UserOrderDetailPage() {
  const { id } = useParams();
  const { showPopup, showConfirm } = usePopup();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

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

  const handleReviewSubmit = async (e, productId, orderId) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      const res = await fetch("/api/reviews/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          orderId,
          rating: reviewForm.rating,
          title: reviewForm.title,
          comment: reviewForm.comment,
          customerName: reviewForm.customerName,
          recommend: reviewForm.recommend
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
        showPopup({
          title: "Review Error",
          message: data.error || "Failed to submit review.",
          type: "error",
        });
      }
    } catch (err) {
      console.error(err);
      showPopup({
        title: "Error",
        message: "Error submitting review. Please try again.",
        type: "error",
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleCancel = async () => {
    const confirmed = await showConfirm(
      "Are you sure you want to cancel this order? This action cannot be undone.",
      "Cancel Order"
    );
    if (!confirmed) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/profile/orders/${id}/cancel`, { method: "PATCH" });
      const data = await res.json();
      if (data.success) {
        await showPopup({
          title: "Order Cancelled",
          message: "Order cancelled successfully.",
          type: "success",
        });
        window.location.reload();
      } else {
        showPopup({
          title: "Cancellation Failed",
          message: data.error || "Failed to cancel order.",
          type: "error",
        });
      }
    } catch (err) {
      showPopup({
        title: "Error",
        message: "Failed to cancel order.",
        type: "error",
      });
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/profile/orders/${id}`); // We'll need this API too
        const data = await res.json();
        if (data.success) setOrder(data.order);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  if (loading) return <div className="p-20 text-center font-bold text-sm tracking-widest uppercase animate-pulse">Retrieving Order Intelligence...</div>;
  if (!order) return <div className="p-20 text-center font-bold text-sm text-red-500 uppercase tracking-widest">Order not found.</div>;

  const getStatusColor = (status) => {
    if (status === 'Delivered' || status === 'Completed') {
      return 'bg-black text-white';
    }
    if (status === 'Cancelled' || status === 'Refunded') {
      return 'bg-neutral-50 text-black border border-black/15 line-through';
    }
    return 'bg-neutral-100 text-black border border-black/5';
  };

  const steps = ['Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];
  let currentStep = steps.indexOf(order.status);
  if (currentStep === -1 && order.status === 'Completed') {
    currentStep = 6;
  }

  return (
    <div className="bg-[#FAF9F6] min-h-screen text-black pb-32 selection:bg-black selection:text-white">
      <div className="container mx-auto px-2 sm:px-4 md:px-8 pt-2 pb-12">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-6 border-b border-black/10 pb-4">
          <div className="space-y-4">
             <Link 
               href="/profile/orders" 
               className="text-[9px] font-black uppercase tracking-widest text-black hover:opacity-75 transition-opacity flex items-center gap-1.5 border border-black/10 px-4 py-2 rounded-[4px] bg-white shadow-sm w-fit"
             >
                <ChevronLeft className="w-3.5 h-3.5" /> Back to History
             </Link>
             <h1 className="text-[24px] font-bold uppercase tracking-[0.1em] text-black">{order.orderNumber}</h1>
          </div>
          <div className="flex items-center gap-4">
              <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-[2px] ${getStatusColor(order.status)}`}>
                 {order.status}
              </span>
             {['Pending', 'Confirmed'].includes(order.status) && (
               <button 
                onClick={handleCancel}
                disabled={cancelling}
                className="text-[9px] font-black uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors disabled:opacity-50 cursor-pointer"
               >
                 {cancelling ? "Cancelling..." : "Cancel Order"}
               </button>
             )}
          </div>
        </div>

         {/* Visual Progress Stepper */}
         {!['Cancelled', 'Refunded'].includes(order.status) && (() => {
           const row1Progress = Math.min(Math.max(currentStep, 0), 3) / 3;
           const row2Progress = Math.min(Math.max(currentStep - 4, 0), 2) / 2;
           const stepsPositions = [
             { step: 'Pending', col: 'col-start-1', row: 'row-start-1' },
             { step: 'Confirmed', col: 'col-start-2', row: 'row-start-1' },
             { step: 'Processing', col: 'col-start-3', row: 'row-start-1' },
             { step: 'Packed', col: 'col-start-4', row: 'row-start-1' },
             { step: 'Shipped', col: 'col-start-4', row: 'row-start-2' },
             { step: 'Out for Delivery', col: 'col-start-3', row: 'row-start-2' },
             { step: 'Delivered', col: 'col-start-2', row: 'row-start-2' }
           ];
           return (
             <div className="bg-[#FAF9F6] border border-black/[0.05] rounded-[4px] p-6 mb-12 select-none">
               <div className="relative">
                 {/* Background Connectors */}
                 <div className="absolute left-[12.5%] right-[12.5%] top-[16px] h-[2px] bg-neutral-200 -z-10" />
                 <div className="absolute right-[12.5%] top-[16px] bottom-[16px] w-[2px] bg-neutral-200 -z-10" />
                 <div className="absolute left-[37.5%] right-[12.5%] bottom-[16px] h-[2px] bg-neutral-200 -z-10" />

                 {/* Active Connector Overlays */}
                 <div 
                   className="absolute left-[12.5%] top-[16px] h-[2px] bg-black -z-10 transition-all duration-500" 
                   style={{ width: `calc(${row1Progress * 75}%)` }} 
                 />
                 <div 
                   className="absolute right-[12.5%] top-[16px] w-[2px] bg-black -z-10 transition-all duration-500" 
                   style={{ height: currentStep >= 4 ? 'calc(100% - 32px)' : '0px' }} 
                 />
                 <div 
                   className="absolute right-[12.5%] bottom-[16px] h-[2px] bg-black -z-10 transition-all duration-500" 
                   style={{ width: `calc(${row2Progress * 50}%)` }} 
                 />

                 <div className="grid grid-cols-4 gap-y-12 gap-x-2 relative">
                   {stepsPositions.map((item, idx) => {
                     const isCompleted = idx <= currentStep;
                     const isCurrent = idx === currentStep;
                     return (
                       <div key={idx} className={`${item.col} ${item.row} flex flex-col items-center text-center relative`}>
                          {/* Node Circle */}
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-[11px] font-medium transition-all duration-300 ${
                            isCurrent ? 'bg-black text-white border-black scale-105 shadow-sm ring-4 ring-black/5' :
                            isCompleted ? 'bg-black text-white border-black' :
                            'bg-white text-neutral-400 border-neutral-200'
                          }`}>
                            {idx + 1}
                          </div>
                          
                          {/* Step Label */}
                          <span className={`text-[10px] uppercase tracking-wide mt-2 max-w-[85px] line-clamp-2 transition-colors ${
                            isCurrent ? 'text-black font-semibold' : 
                            isCompleted ? 'text-black font-medium' : 'text-neutral-400 font-normal'
                          }`}>
                            {item.step}
                          </span>
                       </div>
                     );
                   })}
                 </div>
               </div>
             </div>
           );
         })()}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
           
           {/* Left: Items & Summary */}
           <div className="lg:col-span-7 space-y-12">
              <section className="space-y-8">
                 <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-black">Acquired Pieces</h2>
                 <div className="space-y-6">
                    {order.items.map((item, i) => {
                      const isDelivered = order.status === 'Delivered' || order.status === 'Completed' || order.payment?.status === 'Paid';
                      const reviewId = `${order._id}-${item.productId}`;
                      const showForm = activeReviewId === reviewId;
                      const inputClass = "w-full bg-white border border-neutral-300 rounded-[4px] px-3.5 py-2.5 text-xs font-semibold focus:border-black outline-none transition-all text-black";

                      return (
                        <div key={i} className="space-y-4 pt-4 first:pt-0 border-t first:border-t-0 border-black/5">
                          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 group items-start sm:items-center justify-between">
                            <div className="flex gap-4 sm:gap-6 items-start sm:items-center min-w-0">
                              <div className="w-16 h-20 bg-[#FAF9F6] rounded-[4px] overflow-hidden border border-black/10 shrink-0">
                                 <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                                 <h3 className="text-xs font-black uppercase tracking-wider text-black">{item.name}</h3>
                                 <div className="flex flex-col gap-0.5">
                                    <p className="text-[9px] font-bold text-black uppercase">Qty {item.quantity}</p>
                                    {item.selectedVariant?.options && Object.entries(item.selectedVariant.options).map(([key, val]) => (
                                      <p key={key} className="text-[9px] font-bold text-black uppercase">{key}: {val}</p>
                                    ))}
                                 </div>
                                 <p className="text-sm font-bold tracking-tight mt-1 text-black font-mono">${item.priceAtPurchase.toLocaleString()}</p>
                              </div>
                            </div>

                            {isDelivered && (
                              <button
                                onClick={() => {
                                  if (showForm) {
                                    setActiveReviewId(null);
                                  } else {
                                    setActiveReviewId(reviewId);
                                    setReviewForm({
                                      rating: 5,
                                      title: "",
                                      comment: "",
                                      customerName: order.shippingAddress?.fullName || "",
                                      recommend: true
                                    });
                                  }
                                }}
                                className="text-[9px] border border-black/15 text-black hover:bg-neutral-50 px-3 py-1.5 rounded-[4px] font-bold uppercase tracking-widest cursor-pointer self-start sm:self-center transition-colors"
                              >
                                {showForm ? "Cancel Review" : "Write Review"}
                              </button>
                            )}
                          </div>

                          {/* Inline Review Form */}
                          {showForm && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              className="bg-[#FAF9F6] border border-black/[0.04] rounded-[4px] p-4 mt-2 space-y-4"
                            >
                              <div className="flex items-center justify-between border-b border-black/5 pb-2">
                                <span className="text-[9px] font-black uppercase tracking-widest text-black flex items-center gap-1.5">
                                  <Check className="w-3.5 h-3.5 text-green-600" /> Submit Verified Purchase Review
                                </span>
                              </div>

                              {reviewSuccessMessage ? (
                                <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-[10px] uppercase font-bold tracking-widest text-center rounded-[2px]">
                                  {reviewSuccessMessage}
                                </div>
                              ) : (
                                <form onSubmit={(e) => handleReviewSubmit(e, item.productId, order.orderNumber, order.shippingAddress?.fullName)} className="space-y-3">
                                  {/* Stars Picker */}
                                  <div className="space-y-1">
                                    <label className="text-[8px] font-bold uppercase tracking-wider text-black block">Rating</label>
                                    <div className="flex gap-1.5">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                          type="button"
                                          key={star}
                                          onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                                          className="p-0.5 cursor-pointer hover:scale-110 transition-transform"
                                        >
                                          <Star className={`w-4 h-4 ${star <= reviewForm.rating ? "fill-black text-black" : "text-black/25"}`} />
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[8px] font-bold uppercase tracking-wider text-black">Headline Title</label>
                                    <input
                                      placeholder="e.g. Absolutely Outstanding!"
                                      className={inputClass}
                                      value={reviewForm.title}
                                      onChange={e => setReviewForm({ ...reviewForm, title: e.target.value })}
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[8px] font-bold uppercase tracking-wider text-black">Review Comments</label>
                                    <textarea
                                      placeholder="Detail your acquisition experience..."
                                      rows={3}
                                      className={`${inputClass} resize-none`}
                                      value={reviewForm.comment}
                                      onChange={e => setReviewForm({ ...reviewForm, comment: e.target.value })}
                                    />
                                  </div>

                                  <div className="flex items-center gap-4">
                                    <label className="text-[8px] font-bold uppercase tracking-wider text-black">Would you recommend this item?</label>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setReviewForm({ ...reviewForm, recommend: true })}
                                        className={`px-3 py-1 rounded-[2px] text-[8px] font-bold uppercase tracking-widest border transition-colors ${
                                          reviewForm.recommend ? 'bg-black text-white border-black' : 'border-black/15 text-black'
                                        }`}
                                      >
                                        Yes
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setReviewForm({ ...reviewForm, recommend: false })}
                                        className={`px-3 py-1 rounded-[2px] text-[8px] font-bold uppercase tracking-widest border transition-colors ${
                                          !reviewForm.recommend ? 'bg-black text-white border-black' : 'border-black/15 text-black'
                                        }`}
                                      >
                                        No
                                      </button>
                                    </div>
                                  </div>

                                  <button
                                    type="submit"
                                    disabled={submittingReview}
                                    className="w-full bg-black text-white py-2.5 rounded-[4px] text-[9px] font-black uppercase tracking-[0.2em] hover:bg-neutral-900 transition-all cursor-pointer shadow-sm disabled:opacity-50 mt-2"
                                  >
                                    {submittingReview ? "Submitting Review..." : "Submit Review"}
                                  </button>
                                </form>
                              )}
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                 </div>
              </section>

              <section className="pt-12 border-t border-black/5 space-y-6">
                 <div className="flex justify-between items-baseline text-black">
                    <span className="text-[10px] font-bold uppercase tracking-widest">Subtotal</span>
                    <span className="text-sm font-bold text-black">${order.financials.subtotal.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between items-baseline text-black">
                    <span className="text-[10px] font-bold uppercase tracking-widest">Shipping</span>
                    <span className="text-[10px] font-bold text-black uppercase tracking-widest">Complimentary</span>
                 </div>
                 <div className="flex justify-between items-end pt-8 border-t border-black/5">
                    <span className="text-xs font-bold uppercase tracking-[0.3em]">Total Balance</span>
                    <span className="text-4xl font-bold tracking-tighter">${order.financials.total.toLocaleString()}</span>
                 </div>
              </section>
           </div>

           {/* Right: Timeline & Info */}
           <div className="lg:col-span-5 space-y-8">
              {/* Timeline */}
              <div className="bg-[#FAF9F6] border border-black/[0.06] rounded-[4px] p-6 sm:p-8 space-y-8">
                 <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-black">Order Journey</h2>
                 <div className="space-y-8">
                    {(() => {
                      const filtered = order.timeline?.filter(e => e.source !== 'Admin' || e.status === order.status) || [];
                      const timelineEvents = filtered.length > 0 ? filtered : [{
                        status: order.status,
                        message: order.status === 'Pending' 
                          ? 'Order placed successfully. Pending confirmation.' 
                          : `Order is currently in ${order.status.toLowerCase()} status.`,
                        timestamp: order.createdAt || new Date(),
                        source: 'System'
                      }];
                      return timelineEvents.map((event, i) => (
                        <div key={i} className="flex gap-4 sm:gap-6 relative">
                           <div className="flex flex-col items-center relative shrink-0 w-3">
                              <div className="w-3 h-3 rounded-full bg-black shadow-sm z-10" />
                              {i !== timelineEvents.length - 1 && (
                                <div className="w-[1px] absolute top-3 bottom-0 bg-black/20 left-1/2 -translate-x-1/2" />
                              )}
                           </div>
                           <div className="space-y-1 pb-4">
                              <p className="text-xs font-semibold uppercase tracking-wider text-black">{event.status}</p>
                              <p className="text-xs text-black/90 leading-relaxed font-medium">{event.message}</p>
                              <p className="text-[9px] font-semibold text-black uppercase tracking-wider">
                                 {new Date(event.timestamp).toLocaleString("en-US", {
                                   month: "short",
                                   day: "numeric",
                                   year: "numeric",
                                   hour: "numeric",
                                   minute: "2-digit",
                                   hour12: true
                                 })}
                              </p>
                           </div>
                        </div>
                      ));
                    })()}
                 </div>
              </div>

              {/* Delivery Info */}
              <div className="p-6 sm:p-8 border border-black/[0.06] rounded-[4px] bg-white space-y-8">
                 <div className="space-y-4">
                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-black">
                       <MapPin className="w-4 h-4" /> Destination
                    </div>
                    <p className="text-sm font-bold leading-relaxed">
                       {order.shippingAddress.fullName}<br />
                       {order.shippingAddress.street}<br />
                       {order.shippingAddress.city}, {order.shippingAddress.zip}<br />
                       {order.shippingAddress.country}
                    </p>
                 </div>

                 <div className="pt-8 border-t border-black/5 space-y-4">
                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-black">
                       <Info className="w-4 h-4" /> Notice
                    </div>
                    <p className="text-[10px] leading-relaxed text-black font-semibold italic">
                       Each piece is meticulously inspected by our master craftsmen before dispatch. 
                    </p>
                 </div>
              </div>
           </div>

        </div>
      </div>
    </div>
  );
}
