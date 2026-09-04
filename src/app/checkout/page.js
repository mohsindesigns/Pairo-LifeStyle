"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { CreditCard, Truck, ShieldCheck, ArrowRight, Loader2, ChevronDown, Search } from "lucide-react";
import { Elements } from "@stripe/react-stripe-js";
import { useCart } from "@/context/CartContext";
import { useSiteData } from "@/context/SiteContext";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import TurnstileWidget from "@/components/common/TurnstileWidget";
import { stripePromise } from "@/lib/stripeClient";
import StripePaymentForm from "@/components/checkout/StripePaymentForm";
import { usePopup } from "@/context/PopupContext";

const STRIPE_APPEARANCE = {
  theme: "flat",
  variables: {
    colorPrimary: "#000000",
    colorBackground: "#ffffff",
    colorText: "#000000",
    colorTextSecondary: "#525252",
    colorDanger: "#ef4444",
    fontFamily: "inherit",
    borderRadius: "4px",
    fontSizeBase: "13px",
    spacingUnit: "4px"
  },
  rules: {
    ".Input": {
      border: "1px solid #d4d4d4",
      padding: "10px 14px",
      boxShadow: "none"
    },
    ".Input:focus": {
      border: "1px solid #000000",
      boxShadow: "0 0 0 1px #000000"
    },
    ".Label": {
      fontSize: "11px",
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      color: "#525252"
    },
    ".Tab": {
      border: "1px solid #d4d4d4",
      borderRadius: "4px"
    },
    ".Tab--selected": {
      border: "1px solid #000000",
      boxShadow: "0 0 0 1px #000000"
    }
  }
};

function getReferralCode() {
  try {
    const cookieMatch = document.cookie.match(/(^|;)\s*pairo_ref\s*=\s*([^;]+)/);
    if (cookieMatch) {
      const parsed = JSON.parse(decodeURIComponent(cookieMatch[2]));
      if (parsed && parsed.expiresAt > Date.now()) return parsed.code;
    }
    const stored = localStorage.getItem("pairo_ref");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.expiresAt > Date.now()) return parsed.code;
    }
  } catch (e) { }
  return null;
}

function SearchableDropdown({
  label,
  placeholder,
  value,
  onChange,
  options = [],
  loading = false,
  required = false,
  labelClass
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      setSearchTerm(value || "");
    });
  }, [value]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(opt => {
      const name = typeof opt === 'string' ? opt : opt.name;
      return name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [options, searchTerm]);

  return (
    <div className="space-y-1 relative" ref={dropdownRef}>
      <label className={labelClass}>{label}</label>
      {loading ? (
        <div className="flex items-center gap-2 px-3.5 py-3 border border-border rounded-[4px] text-[12px] text-foreground/50 bg-background">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading options…
        </div>
      ) : (
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none">
            <Search className="w-3.5 h-3.5" />
          </span>
          <input
            type="text"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => {
              const val = e.target.value;
              setSearchTerm(val);
              setIsOpen(true);
              const found = options.find(opt => {
                const name = typeof opt === 'string' ? opt : opt.name;
                return name.toLowerCase() === val.toLowerCase();
              });
              onChange(val, found);
            }}
            onFocus={() => setIsOpen(true)}
            className="w-full bg-background border border-border rounded-[4px] pl-9 pr-10 py-3 text-[13px] text-foreground focus:border-primary outline-none font-semibold placeholder:text-foreground/45 transition-all shadow-sm"
            required={required}
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none">
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </span>

          {isOpen && (
            <div className="absolute z-[1000] left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-background border border-border rounded-[4px] shadow-lg animate-in fade-in slide-in-from-top-1 duration-100 divide-y divide-border/20">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, idx) => {
                  const name = typeof opt === 'string' ? opt : opt.name;
                  const isSelected = name.toLowerCase() === (value || "").toLowerCase();
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSearchTerm(name);
                        onChange(name, opt);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                        isSelected 
                          ? 'bg-primary text-background' 
                          : 'text-foreground hover:bg-secondary'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-3 text-[10px] text-foreground/50 uppercase tracking-widest text-center italic bg-background">
                  No matching options
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  const siteData = useSiteData();
  const {
    cartItems,
    cartSubtotal,
    shippingCost,
    cartTotal,
    clearCart,
    appliedPromo,
    discountTotal,
    applyPromoCode,
    removePromoCode,
    selectedShipping,
    setSelectedShipping,
    affiliateDiscount,
    affiliateDiscountAmount,
    removeFromCart,
    isCartLoaded
  } = useCart();
  const { data: session } = useSession();
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef(null);
  const paymentMethods = siteData?.commerce?.paymentMethods || {};
  const cardMethodEnabled = paymentMethods.cardEnabled !== false;
  const codMethodEnabled = paymentMethods.codEnabled !== false;
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [clientSecret, setClientSecret] = useState("");
  const [loadingClientSecret, setLoadingClientSecret] = useState(false);
  const [paymentIntentError, setPaymentIntentError] = useState("");
  const router = useRouter();
  const { showPopup } = usePopup();

  // Form State
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "United States",
    countryCode: "US",
    state: "",
    stateCode: "",
    street: "",
    city: "",
    zip: "",
    customerNote: ""
  });

  // Location cascade state
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  // Shipping rates state
  const [shippingRates, setShippingRates] = useState([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [shippingRatesFetched, setShippingRatesFetched] = useState(false);

  useEffect(() => {
    // Generate unique key for this session to prevent double-orders
    Promise.resolve().then(() => {
      setIdempotencyKey(`pai_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`);
    });
  }, []);

  // Keep the selected payment method valid if the admin disables one
  useEffect(() => {
    Promise.resolve().then(() => {
      if (paymentMethod === "card" && !cardMethodEnabled && codMethodEnabled) {
        setPaymentMethod("cod");
      } else if (paymentMethod === "cod" && !codMethodEnabled && cardMethodEnabled) {
        setPaymentMethod("card");
      }
    });
  }, [cardMethodEnabled, codMethodEnabled, paymentMethod]);

  // Load all countries on mount
  useEffect(() => {
    fetch("/api/locations")
      .then(r => r.json())
      .then(d => { if (d.success) setCountries(d.data); })
      .catch(console.error);
  }, []);

  // Load states when country changes
  useEffect(() => {
    Promise.resolve().then(() => {
      if (!formData.countryCode) { setStates([]); setCities([]); return; }
      setLoadingStates(true);
      setCities([]);
      setFormData(prev => ({ ...prev, state: "", stateCode: "", city: "" }));
      fetch(`/api/locations?countryCode=${formData.countryCode}`)
        .then(r => r.json())
        .then(d => { if (d.success) setStates(d.data); })
        .catch(console.error)
        .finally(() => setLoadingStates(false));
    });
  }, [formData.countryCode]);

  // Load cities when state changes
  useEffect(() => {
    Promise.resolve().then(() => {
      if (!formData.countryCode || !formData.stateCode) { setCities([]); return; }
      setLoadingCities(true);
      setFormData(prev => ({ ...prev, city: "" }));
      fetch(`/api/locations?countryCode=${formData.countryCode}&stateCode=${formData.stateCode}`)
        .then(r => r.json())
        .then(d => { if (d.success) setCities(d.data); })
        .catch(console.error)
        .finally(() => setLoadingCities(false));
    });
  }, [formData.countryCode, formData.stateCode]);

  useEffect(() => {
    if (session) {
      Promise.resolve().then(() => {
        setLoadingProfile(true);
        fetch("/api/user/profile")
          .then(res => res.json())
          .then(data => {
            setProfile(data);
            if (data.email) {
              setFormData(prev => ({ ...prev, email: data.email }));
            }
          })
          .catch(err => console.error("Error fetching profile at checkout:", err))
          .finally(() => setLoadingProfile(false));
      });
    }
  }, [session]);

  useEffect(() => {
    if (isCartLoaded && cartItems.length === 0 && !isProcessing && !isSuccess) {
      router.push("/cart");
    }
  }, [isCartLoaded, cartItems, router, isProcessing, isSuccess]);

  const savedAddresses = useMemo(() => {
    if (!profile) return [];
    const list = [];
    
    // 1. Saved profile addresses
    if (profile.addresses && Array.isArray(profile.addresses)) {
      profile.addresses.forEach(addr => {
        list.push({
          type: "Saved Address",
          fullName: addr.fullName,
          street: addr.street,
          city: addr.city,
          state: addr.state || "",
          zip: addr.zipCode || addr.zip || "",
          country: addr.country || "United States",
          phone: addr.phone || ""
        });
      });
    }

    // 2. Past order addresses
    if (profile.orderHistory && Array.isArray(profile.orderHistory)) {
      profile.orderHistory.forEach(ord => {
        if (ord.shippingAddress && ord.shippingAddress.street) {
          const addr = ord.shippingAddress;
          const isDup = list.some(item => 
            item.street.toLowerCase().trim() === addr.street.toLowerCase().trim() && 
            item.city.toLowerCase().trim() === addr.city.toLowerCase().trim()
          );
          if (!isDup) {
            list.push({
              type: `Past Order #${ord.orderNumber}`,
              fullName: addr.fullName,
              street: addr.street,
              city: addr.city,
              state: addr.state || "",
              zip: addr.zip || addr.zipCode || "",
              country: addr.country || "United States",
              phone: addr.phone || ""
            });
          }
        }
      });
    }

    return list;
  }, [profile]);

  const handleApplyPromo = async () => {
    if (!promoCode) return;
    setApplyingPromo(true);
    setPromoError("");
    const res = await applyPromoCode(promoCode, formData.email);
    setApplyingPromo(false);
    if (res.success) {
      setPromoCode("");
    } else {
      setPromoError(res.error);
    }
  };

  // Fetch shipping rates when address fields are filled
  const fetchRates = useCallback(async () => {
    if (!formData.country) return;
    setLoadingRates(true);
    try {
      const res = await fetch('/api/shipping/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: { country: formData.country, state: formData.state, city: formData.city, zip: formData.zip },
          subtotal: cartSubtotal,
          items: cartItems
        })
      });
      const data = await res.json();
      if (data.success) {
        setShippingRates(data.rates || []);
        setShippingRatesFetched(true);
        // Auto-select first rate if none selected
        if (!selectedShipping && data.rates?.length > 0) {
          setSelectedShipping(data.rates[0]);
        }
      }
    } catch (e) { console.error('Failed to fetch shipping rates', e); }
    finally { setLoadingRates(false); }
  }, [formData.country, formData.state, formData.city, formData.zip, cartSubtotal, cartItems, selectedShipping, setSelectedShipping]);

  // Debounce: fetch rates when address changes
  useEffect(() => {
    const t = setTimeout(fetchRates, 600);
    return () => clearTimeout(t);
  }, [fetchRates]);

  // Debounced email-change promo code validation
  useEffect(() => {
    if (appliedPromo && formData.email) {
      const delayDebounceFn = setTimeout(() => {
        const revalidate = async () => {
          setPromoError("");
          const res = await applyPromoCode(appliedPromo.code, formData.email);
          if (!res.success) {
            setPromoError(`Coupon removed: ${res.error}`);
          }
        };
        revalidate();
      }, 500);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [formData.email, appliedPromo?.code, applyPromoCode]);

  const [errors, setErrors] = useState({});

  const validateField = (name, value) => {
    let error = "";
    const cleanVal = (value || "").trim();

    if (["email", "lastName", "street", "city", "phone"].includes(name) && !cleanVal) {
      return "This field is required";
    }

    switch (name) {
      case "firstName":
      case "lastName":
        if (cleanVal && cleanVal.length < 2) {
          error = "Must be at least 2 characters";
        } else if (cleanVal && cleanVal.length > 50) {
          error = "Must be at most 50 characters";
        } else if (cleanVal && !/^[A-Za-z\s\-]+$/.test(cleanVal)) {
          error = "Only letters, spaces, or hyphens are allowed";
        }
        break;
      case "email":
        if (cleanVal && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanVal)) {
          error = "Please enter a valid email address";
        } else if (cleanVal && cleanVal.length > 100) {
          error = "Email is too long";
        }
        break;
      case "phone":
        if (cleanVal && !/^\+?[0-9\s\-\(\)]{7,20}$/.test(cleanVal)) {
          error = "Please enter a valid phone number (7-20 digits)";
        }
        break;
      case "street":
        if (cleanVal && cleanVal.length < 5) {
          error = "Please enter a valid street address";
        } else if (cleanVal && cleanVal.length > 150) {
          error = "Address is too long";
        }
        break;
      case "city":
        if (cleanVal && cleanVal.length < 2) {
          error = "Please enter a valid city";
        } else if (cleanVal && cleanVal.length > 50) {
          error = "City name is too long";
        } else if (cleanVal && !/^[A-Za-z\s\-\.]+$/.test(cleanVal)) {
          error = "City contains invalid characters";
        }
        break;
      case "zip": {
        const countryCode = (formData.countryCode || "").toUpperCase();
        if (!cleanVal) {
          error = "Postal code / ZIP is required";
        } else if (countryCode === "US") {
          if (!/^\d{5}(-\d{4})?$/.test(cleanVal)) {
            error = "US ZIP code must be 5 digits (e.g., 90210) or 5+4 format";
          }
        } else if (countryCode === "PK") {
          if (!/^\d{5}$/.test(cleanVal)) {
            error = "Pakistan postal code must be exactly 5 digits (e.g., 44000)";
          }
        } else if (countryCode === "GB") {
          if (!/^[A-Z]{1,2}[0-9R][0-9A-Z]?\s*[0-9][ABD-HJLNP-UW-Z]{2}$/i.test(cleanVal)) {
            error = "Please enter a valid UK postcode (e.g., SW1A 1AA)";
          }
        } else if (countryCode === "CA") {
          if (!/^[A-Z][0-9][A-Z]\s*[0-9][A-Z][0-9]$/i.test(cleanVal)) {
            error = "Please enter a valid Canadian postal code (e.g., K1A 0B1)";
          }
        } else {
          // General fallback: must contain at least one digit and be 3-10 alphanumeric characters
          if (!/^(?=.*\d)[A-Za-z0-9\s\-]{3,10}$/.test(cleanVal)) {
            error = "Please enter a valid postal code (3-10 characters, including digits)";
          }
        }
        break;
      }
      default:
        break;
    }
    return error;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Sanitize input values on the fly: restrict emojis, script tags, HTML tags
    let sanitized = value
      .replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "")
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
      .replace(/<\/?[^>]+(>|$)/g, "");

    if (name === "firstName" || name === "lastName" || name === "city") {
      sanitized = sanitized.slice(0, 50);
    } else if (name === "email") {
      sanitized = sanitized.slice(0, 100);
    } else if (name === "phone") {
      sanitized = sanitized.replace(/[^0-9\s\+\-\(\)]/g, "").slice(0, 25);
    } else if (name === "street") {
      sanitized = sanitized.slice(0, 150);
    } else if (name === "zip") {
      sanitized = sanitized.slice(0, 10);
    }

    setFormData(prev => ({ ...prev, [name]: sanitized }));

    const error = validateField(name, sanitized);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const validateForm = () => {
    const newErrors = {};
    Object.keys(formData).forEach(key => {
      if (key !== "customerNote" && key !== "stateCode" && key !== "countryCode" && key !== "firstName") {
        const err = validateField(key, formData[key]);
        if (err) {
          newErrors[key] = err;
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstErrKey = Object.keys(newErrors)[0];
      const el = document.getElementsByName(firstErrKey)[0];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
      }
      return false;
    }

    if (!turnstileToken) {
      showPopup({
        title: "Security Check Required",
        message: "Please complete the security check before placing your order.",
        type: "warning",
      });
      return;
    }
    return true;
  };

  const buildCheckoutPayload = () => ({
    items: cartItems,
    idempotencyKey,
          turnstileToken,
    customerEmail: formData.email,
    customerNote: formData.customerNote,
    shippingAddress: {
      fullName: `${formData.firstName} ${formData.lastName}`,
      street: formData.street,
      city: formData.city,
      state: formData.state,
      zip: formData.zip,
      phone: formData.phone,
      country: formData.country
    },
    shippingSnapshot: selectedShipping ? {
      version: 1,
      zoneId: selectedShipping.zoneId,
      zoneName: selectedShipping.zoneName,
      methodId: selectedShipping.methodId,
      methodName: selectedShipping.methodName,
      provider: selectedShipping.provider,
      cost: selectedShipping.cost,
      currency: selectedShipping.currency,
      settings: selectedShipping.settings,
      conditions: selectedShipping.conditions,
      capturedAt: new Date().toISOString()
    } : null,
    referralCode: getReferralCode(),
    financials: {
      subtotal: cartSubtotal,
      shippingCost: shippingCost,
      discountTotal: discountTotal || 0,
      total: cartTotal,
      promoCode: appliedPromo?.code || null
    }
  });

  const buildCheckoutPayloadRef = useRef(buildCheckoutPayload);
  useEffect(() => {
    buildCheckoutPayloadRef.current = buildCheckoutPayload;
  });

  const fetchClientSecret = useCallback(async (payload) => {
    setLoadingClientSecret(true);
    setPaymentIntentError("");
    try {
      const res = await fetch("/api/checkout/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setClientSecret(data.clientSecret);
      } else {
        setClientSecret("");
        setPaymentIntentError(data.error || "Unable to initialize payment. Please try again.");
      }
    } catch (err) {
      setClientSecret("");
      setPaymentIntentError("Unable to initialize payment. Please try again.");
    } finally {
      setLoadingClientSecret(false);
    }
  }, []);

  // Debounce: (re)create the PaymentIntent when priced inputs change
  useEffect(() => {
    if (paymentMethod !== "card") return;
    if (!idempotencyKey || !cartItems || cartItems.length === 0) return;

    Promise.resolve().then(() => {
      setClientSecret("");
      setPaymentIntentError("");
    });

    const t = setTimeout(() => {
      fetchClientSecret(buildCheckoutPayloadRef.current());
    }, 600);
    return () => clearTimeout(t);
  }, [paymentMethod, idempotencyKey, cartItems, cartSubtotal, shippingCost, appliedPromo?.code, selectedShipping, fetchClientSecret]);

  const handlePayment = async () => {
    if (!validateForm()) return;

    setIsProcessing(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCheckoutPayloadRef.current())
      });

      const data = await response.json();

      if (data.success) {
        setIsSuccess(true);
        clearCart();
        router.push(`/checkout/success?id=${data.orderId}&orderNumber=${data.orderNumber}`);
      } else {
        turnstileRef.current?.reset();
        setTurnstileToken("");
        showPopup({
          title: "Order Failed",
          message: data.error || "Unable to complete order. Please check your information and try again.",
          type: "error",
        });
      }
    } catch (err) {
      turnstileRef.current?.reset();
      setTurnstileToken("");
      console.error(err);
      showPopup({
        title: "Order Error",
        message: "An unexpected error occurred during checkout. Please try again.",
        type: "error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const brandName = siteData?.siteSettings?.general?.brandName || "";
  const inputClass = "w-full bg-white border border-neutral-300 rounded-[4px] px-3.5 py-2.5 text-[13px] placeholder:text-neutral-400 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all duration-200 text-black";
  const labelClass = "block text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1";

  if (!isCartLoaded) {
    return (
      <div className="bg-white min-h-screen text-black font-sans selection:bg-black selection:text-white">
        <main className="container mx-auto px-2 sm:px-4 md:px-8 py-8 md:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Form Column Skeleton */}
            <div className="lg:col-span-7 space-y-8">
              {/* Contact Info */}
              <section className="space-y-4">
                <div className="flex justify-between items-baseline">
                  <div className="w-16 h-4 bg-neutral-100 animate-pulse rounded-[4px]" />
                  <div className="w-12 h-3 bg-neutral-100 animate-pulse rounded-[2px]" />
                </div>
                <div className="w-full h-10 bg-neutral-100 animate-pulse rounded-[4px]" />
              </section>

              {/* Delivery Info */}
              <section className="space-y-4">
                <div className="w-16 h-4 bg-neutral-100 animate-pulse rounded-[4px]" />
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="w-full h-10 bg-neutral-100 animate-pulse rounded-[4px]" />
                    <div className="w-full h-10 bg-neutral-100 animate-pulse rounded-[4px]" />
                  </div>
                  <div className="w-full h-10 bg-neutral-100 animate-pulse rounded-[4px]" />
                  <div className="grid grid-cols-3 gap-4">
                    <div className="w-full h-10 bg-neutral-100 animate-pulse rounded-[4px]" />
                    <div className="w-full h-10 bg-neutral-100 animate-pulse rounded-[4px]" />
                    <div className="w-full h-10 bg-neutral-100 animate-pulse rounded-[4px]" />
                  </div>
                  <div className="w-full h-10 bg-neutral-100 animate-pulse rounded-[4px]" />
                </div>
              </section>
            </div>

            {/* Right Summary Column Skeleton */}
            <div className="lg:col-span-5 bg-[#FAF9F6] border border-black/[0.04] rounded-[4px] p-6 md:p-8 space-y-6">
              <div className="w-24 h-4 bg-neutral-200/60 animate-pulse rounded-[4px]" />
              <div className="space-y-4 pt-2">
                {[1, 2].map((i) => (
                  <div key={i} className="flex gap-4 items-center">
                    <div className="w-10 h-12 bg-neutral-200/60 animate-pulse rounded-[4px]" />
                    <div className="flex-1 space-y-1.5">
                      <div className="w-1/2 h-3 bg-neutral-200/60 animate-pulse rounded-[2px]" />
                      <div className="w-1/4 h-2 bg-neutral-200/60 animate-pulse rounded-[2px]" />
                    </div>
                    <div className="w-12 h-3 bg-neutral-200/60 animate-pulse rounded-[2px]" />
                  </div>
                ))}
                <div className="pt-4 border-t border-neutral-200 flex justify-between">
                  <div className="w-16 h-3 bg-neutral-200/60 animate-pulse rounded-[2px]" />
                  <div className="w-12 h-3 bg-neutral-200/60 animate-pulse rounded-[2px]" />
                </div>
                <div className="flex justify-between">
                  <div className="w-24 h-4 bg-neutral-200/60 animate-pulse rounded-[4px]" />
                  <div className="w-16 h-6 bg-neutral-200/60 animate-pulse rounded-[4px]" />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen text-black font-sans selection:bg-black selection:text-white">
      {/* Loading Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-black" />
          <p className="text-xs uppercase tracking-widest font-bold text-neutral-600">Processing Your Order...</p>
        </div>
      )}



      {/* Main Container - Matches site margins/padding */}
      <div className="container mx-auto px-2 sm:px-4 md:px-8 py-8 md:py-12">
        <h1 className="text-[28px] md:text-[36px] font-bold tracking-tight text-black mb-8 leading-none">
          Checkout
        </h1>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">

          {/* Left Column: Checkout Forms (60% / 7 Cols) */}
          <div className="lg:col-span-7 space-y-8">

            {/* 1. Contact Info */}
            <section className="space-y-4">
              <div className="flex justify-between items-baseline">
                <h2 className="text-xs font-bold uppercase tracking-wider text-black">Contact</h2>
                <Link href="/login" className="text-xs font-bold text-neutral-600 hover:text-black underline tracking-wide">Log in</Link>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className={labelClass}>Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Email"
                    className={`${inputClass} ${errors.email ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
                    required
                  />
                  {errors.email && <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.email}</p>}
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 accent-black rounded border-neutral-300"
                  />
                  <span className="text-[12px] text-neutral-600 font-medium leading-none">Email me with news and offers</span>
                </label>
              </div>
            </section>

            {/* 2. Delivery Info */}
            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-black">Delivery</h2>

              <div className="space-y-3.5">
                {/* Saved Address Selector */}
                {savedAddresses.length > 0 && (
                  <div className="space-y-1 bg-[#FAF9F6] border border-black/[0.04] p-4 rounded-[4px] mb-2">
                    <label className={`${labelClass} text-black font-bold`}>Use Saved Address for Faster Checkout</label>
                    <div className="relative">
                      <select
                        onChange={(e) => {
                          const idx = parseInt(e.target.value);
                          if (!isNaN(idx) && savedAddresses[idx]) {
                            const addr = savedAddresses[idx];
                            const nameParts = (addr.fullName || "").trim().split(" ");
                            const firstName = nameParts[0] || "";
                            const lastName = nameParts.slice(1).join(" ") || "";
                            setFormData(prev => ({
                              ...prev,
                              firstName,
                              lastName,
                              street: addr.street,
                              city: addr.city,
                              state: addr.state,
                              zip: addr.zip,
                              country: addr.country || "United States",
                              phone: addr.phone || prev.phone
                            }));
                            setErrors({});
                          }
                        }}
                        className="w-full bg-white border border-neutral-300 rounded-[4px] px-3.5 py-2.5 text-xs font-semibold focus:border-black outline-none transition-all text-black appearance-none"
                        defaultValue=""
                      >
                        <option value="" disabled>Select a saved address...</option>
                        {savedAddresses.map((addr, idx) => (
                          <option key={idx} value={idx}>
                            {addr.fullName} — {addr.street}, {addr.city} ({addr.type})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-black absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Country Selection */}
                <SearchableDropdown
                  label="Country / Region *"
                  placeholder="Search Country / Region…"
                  value={formData.country}
                  options={countries}
                  labelClass={labelClass}
                  required
                  onChange={(val, matched) => {
                    setFormData(prev => ({
                      ...prev,
                      country: val,
                      countryCode: matched ? matched.isoCode : "",
                      state: "", stateCode: "", city: ""
                    }));
                    setErrors(prev => ({ ...prev, country: "" }));
                  }}
                />
                {errors.country && <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.country}</p>}

                {/* Names */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className={labelClass}>First name (optional)</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      placeholder="First name"
                      className={`${inputClass} ${errors.firstName ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
                    />
                    {errors.firstName && <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.firstName}</p>}
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>Last name *</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      placeholder="Last name"
                      className={`${inputClass} ${errors.lastName ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
                      required
                    />
                    {errors.lastName && <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.lastName}</p>}
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1">
                  <label className={labelClass}>Street Address *</label>
                  <input
                    type="text"
                    name="street"
                    value={formData.street}
                    onChange={handleInputChange}
                    placeholder="Address"
                    className={`${inputClass} ${errors.street ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
                    required
                  />
                  {errors.street && <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.street}</p>}
                </div>

                {/* State / Province */}
                {states.length > 0 ? (
                  <>
                    <SearchableDropdown
                      label="State / Province *"
                      placeholder="Search State / Province…"
                      value={formData.state}
                      options={states}
                      loading={loadingStates}
                      labelClass={labelClass}
                      required
                      onChange={(val, matched) => {
                        setFormData(prev => ({
                          ...prev,
                          state: val,
                          stateCode: matched ? matched.isoCode : "",
                          city: ""
                        }));
                        setErrors(prev => ({ ...prev, state: "" }));
                      }}
                    />
                    {errors.state && <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.state}</p>}
                  </>
                ) : (
                  <div className="space-y-1">
                    <label className={labelClass}>State / Province</label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      placeholder="State / Province"
                      className={`${inputClass} ${errors.state ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
                    />
                    {errors.state && <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.state}</p>}
                  </div>
                )}

                {/* City + ZIP */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {cities.length > 0 ? (
                    <div className="space-y-1">
                      <SearchableDropdown
                        label="City *"
                        placeholder="Search City…"
                        value={formData.city}
                        options={cities}
                        loading={loadingCities}
                        labelClass={labelClass}
                        required
                        onChange={(val) => {
                          setFormData(prev => ({
                            ...prev,
                            city: val
                          }));
                          setErrors(prev => ({ ...prev, city: "" }));
                        }}
                      />
                      {errors.city && <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.city}</p>}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className={labelClass}>City *</label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        placeholder="City"
                        className={`${inputClass} ${errors.city ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
                        required
                      />
                      {errors.city && <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.city}</p>}
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className={labelClass}>Postal code / ZIP</label>
                    <input
                      type="text"
                      name="zip"
                      value={formData.zip}
                      onChange={handleInputChange}
                      placeholder="Postal code"
                      className={`${inputClass} ${errors.zip ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
                    />
                    {errors.zip && <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.zip}</p>}
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <label className={labelClass}>Phone *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="Phone"
                    className={`${inputClass} ${errors.phone ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
                    required
                  />
                  {errors.phone && <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.phone}</p>}
                </div>

                {/* Customer Note */}
                <div className="space-y-1">
                  <label className={labelClass}>Order notes (optional)</label>
                  <textarea
                    name="customerNote"
                    value={formData.customerNote}
                    onChange={handleInputChange}
                    placeholder="Notes about your order..."
                    rows={2}
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>
            </section>

            {/* 3. Shipping Method */}
            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-black">Shipping Method</h2>
              {loadingRates && (
                <div className="flex items-center gap-2 py-3 text-xs text-neutral-500">
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Calculating shipping rates...</span>
                </div>
              )}
              {!loadingRates && shippingRates.length === 0 && (
                <p className="text-xs text-neutral-400 italic">Enter your shipping details above to calculate rates.</p>
              )}
              {shippingRates.length > 0 && (
                <div className="border border-neutral-200 rounded-[4px] divide-y divide-neutral-200 overflow-hidden bg-white">
                  {shippingRates.map((rate) => (
                    <label
                      key={rate.methodId}
                      className={`flex items-center justify-between p-4 cursor-pointer hover:bg-neutral-50/50 transition-colors ${selectedShipping?.methodId === rate.methodId ? "bg-neutral-50/30" : ""
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="shippingMethod"
                          checked={selectedShipping?.methodId === rate.methodId}
                          onChange={() => setSelectedShipping(rate)}
                          className="accent-black w-4 h-4"
                        />
                        <div>
                          <p className="text-[13px] font-semibold text-black">{rate.methodName}</p>
                          {rate.description && <p className="text-[11px] text-neutral-500">{rate.description}</p>}
                        </div>
                      </div>
                      <span className="text-[13px] font-bold text-black font-mono">
                        {rate.cost === 0 ? "Free" : `$${rate.cost.toLocaleString()}`}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </section>

            {/* 4. Payment Method */}
            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-black">Payment</h2>
              <div className="border border-neutral-200 rounded-[4px] divide-y divide-neutral-200 overflow-hidden bg-white">
                {cardMethodEnabled && (
                  <label
                    className={`flex items-center justify-between p-4 cursor-pointer hover:bg-neutral-50/50 transition-colors ${paymentMethod === "card" ? "bg-neutral-50/30" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === "card"}
                        onChange={() => setPaymentMethod("card")}
                        className="accent-black w-4 h-4"
                      />
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-neutral-600" />
                        <span className="text-[13px] font-semibold text-black">Credit / Debit Card</span>
                      </div>
                    </div>
                  </label>
                )}
                {codMethodEnabled && (
                  <label
                    className={`flex items-center justify-between p-4 cursor-pointer hover:bg-neutral-50/50 transition-colors ${paymentMethod === "cod" ? "bg-neutral-50/30" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === "cod"}
                        onChange={() => setPaymentMethod("cod")}
                        className="accent-black w-4 h-4"
                      />
                      <div className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-neutral-600" />
                        <span className="text-[13px] font-semibold text-black">Cash on Delivery (COD)</span>
                      </div>
                    </div>
                  </label>
                )}
              </div>

              {paymentMethod === "card" && (
                <div className="pt-1">
                  {loadingClientSecret && !clientSecret && (
                    <div className="space-y-3 border border-neutral-200 rounded-[4px] p-4 bg-[#FAF9F6]/40">
                      <div className="w-full h-10 bg-neutral-100 animate-pulse rounded-[4px]" />
                      <div className="w-full h-10 bg-neutral-100 animate-pulse rounded-[4px]" />
                      <div className="w-2/3 h-10 bg-neutral-100 animate-pulse rounded-[4px]" />
                    </div>
                  )}
                  {!loadingClientSecret && paymentIntentError && (
                    <p className="text-[11px] text-red-600 font-semibold border border-red-200 bg-red-50 rounded-[4px] p-3">
                      {paymentIntentError}
                    </p>
                  )}
                  {clientSecret && (
                    <Elements stripe={stripePromise} options={{ clientSecret, appearance: STRIPE_APPEARANCE }}>
                      <StripePaymentForm
                        returnUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/checkout/success?idempotencyKey=${idempotencyKey}`}
                        idempotencyKey={idempotencyKey}
                        onValidate={validateForm}
                        disabled={loadingClientSecret}
                      />
                    </Elements>
                  )}
                </div>
              )}
            </section>

            {/* Submit Action (Cash on Delivery only — Card has its own submit button above) */}
            {paymentMethod === "cod" && (
              <div className="pt-4 space-y-4">
              <TurnstileWidget
                ref={turnstileRef}
                onVerify={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken("")}
              />

                <button
                  type="button"
                  onClick={handlePayment}
                  disabled={isProcessing || !cartItems || cartItems.length === 0}
                  className="w-full bg-black text-white hover:bg-neutral-900 py-4 rounded-[4px] text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>Complete Order</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Order Summary (40% / 5 Cols) - STICKY */}
          <div className="lg:col-span-5 bg-[#FAF9F6] border border-black/[0.04] rounded-[4px] p-6 md:p-8 space-y-6 lg:sticky lg:top-28 self-start">
            <h2 className="text-xs font-bold uppercase tracking-wider text-black">Order Summary</h2>

            {/* Cart Products List */}
            <div className="divide-y divide-neutral-200/80 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
              {(cartItems || []).map((item, index) => {
                const itemImage = item.image || (Array.isArray(item.images) && item.images[0]) || "/placeholder.jpg";
                const itemKey = `${item.id || item._id}-${item.selectedSize || "Standard"}-${item.selectedColor || "Standard"}-${index}`;
                const uniqueKeyForCart = `${item.id}-${item.selectedSize || "Standard"}-${item.selectedColor || "Standard"}`;
                return (
                  <div key={itemKey} className="flex gap-4 items-center py-3.5 first:pt-0 last:pb-0">
                    <div className="relative shrink-0 w-14 h-18">
                      <div className="w-full h-full bg-[#FAF9F6] rounded-lg border border-black/[0.05] overflow-hidden">
                        <img src={itemImage} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <span className="absolute -top-1.5 -right-1.5 bg-black text-white rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-bold shadow-md z-10 border border-white">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-1 space-y-0.5 min-w-0">
                      <p className="text-[13px] font-bold text-black uppercase tracking-wide truncate">{item.name}</p>

                      {item.selectedOptions && (
                        <p className="text-[10px] text-black font-semibold uppercase tracking-wider">
                          {Object.entries(item.selectedOptions).map(([k, v]) => `${k}: ${v}`).join(" / ")}
                        </p>
                      )}

                      {/* Made to Measure Badge */}
                      {item.madeToMeasure?.enabled && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded text-[9px] font-bold uppercase tracking-wide">
                            ✦ Made to Measure
                          </span>
                          <details className="mt-1">
                            <summary className="text-[9px] text-black/60 cursor-pointer hover:text-black transition-colors select-none">View measurements</summary>
                            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] text-black font-semibold">
                              {Object.entries(item.madeToMeasure.measurements || {}).map(([k, v]) => v ? (
                                <span key={k}><span className="font-bold capitalize text-black">{k.replace(/([A-Z])/g, ' $1')}</span>: {v} {item.madeToMeasure.unit}</span>
                              ) : null)}
                              {item.madeToMeasure.notes && <span className="col-span-2 italic text-black/80 font-semibold">Note: {item.madeToMeasure.notes}</span>}
                            </div>
                          </details>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <p className="text-[12px] font-bold text-black font-mono">
                          ${(item.price * item.quantity).toLocaleString()}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeFromCart(uniqueKeyForCart)}
                          className="text-[10px] font-bold text-black/60 hover:text-red-500 transition-colors uppercase tracking-wider cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Coupon Code Input */}
            <div className="pt-5 border-t border-neutral-200/80 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Discount code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-white border border-neutral-300 rounded-[4px] px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider outline-none focus:border-black placeholder:text-neutral-400 text-black transition-all"
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  disabled={!promoCode || applyingPromo}
                  className="px-5 py-2.5 bg-neutral-800 text-white hover:bg-black rounded-[4px] text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  {applyingPromo ? "..." : "Apply"}
                </button>
              </div>
              {promoError && <p className="text-[10px] text-red-600 font-bold ml-1 uppercase tracking-wider">{promoError}</p>}
              {appliedPromo && (
                <div className="flex items-center justify-between px-3 py-2 bg-[#FAF9F6] border border-neutral-200 rounded-[3px]">
                  <span className="text-[10px] font-bold text-black uppercase tracking-wider">
                    Discount ({appliedPromo.code}) Applied
                  </span>
                  <button
                    type="button"
                    onClick={removePromoCode}
                    className="text-[10px] font-bold text-black hover:underline uppercase tracking-wider"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Pricing Summary */}
            <div className="space-y-3 pt-5 border-t border-neutral-200/80 text-[13px] text-black font-semibold">
              <div className="flex justify-between items-center">
                <span className="text-black/80">Subtotal</span>
                <span className="text-black font-bold font-mono">${(cartSubtotal || 0).toLocaleString()}</span>
              </div>

              {discountTotal > 0 && (
                <div className="flex justify-between items-center text-black font-semibold">
                  <span>Discount</span>
                  <span className="font-mono">-${discountTotal.toLocaleString()}</span>
                </div>
              )}

              {affiliateDiscount?.type !== "None" && affiliateDiscountAmount > 0 && (
                <div className="flex justify-between items-center text-black font-semibold">
                  <span>Referral Discount</span>
                  <span className="font-mono">-${affiliateDiscountAmount.toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-black/80">Shipping</span>
                <span className="text-black font-bold font-mono">
                  {selectedShipping
                    ? (shippingCost === 0 ? "Free" : `$${shippingCost.toLocaleString()}`)
                    : "Calculated at next step"}
                </span>
              </div>

              <div className="pt-5 flex justify-between items-end border-t border-neutral-200/80">
                <span className="text-sm font-bold uppercase tracking-wider text-black">Total</span>
                <span className="text-2xl font-black text-black font-mono">${cartTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Security & Trust Badges */}
            <div className="pt-5 border-t border-neutral-200/80 space-y-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 shrink-0 text-black" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-black">Secure Checkout Guarantee</p>
                  <p className="text-[10px] text-black/60 font-semibold">Your details are fully protected and processed securely.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5 shrink-0 text-black" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-black">Reliable Home Delivery</p>
                  <p className="text-[10px] text-black/60 font-semibold">Orders are packed with care and shipped via trusted carriers.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
