"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import { trackAddToCart, trackRemoveFromCart } from "@/lib/analytics";

const CartContext = createContext();

// Stable per-line key for a cart item. Unique lines (made-to-measure / Corporate Gifting)
// each carry their own `lineId` (stamped on add, since two such lines for the same
// product/size/color are NOT the same line and must never collide/merge on remove or
// quantity-update); every other line falls back to the mergeable id-size-color composite.
export function getCartItemKey(item) {
  return item?.lineId || `${item.id}-${item.selectedSize}-${item.selectedColor}`;
}

export function CartProvider({ children }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCartLoaded, setIsCartLoaded] = useState(false);
  const [prevStorageKey, setPrevStorageKey] = useState("");

  // Dynamic storage key based on user ID
  const storageKey = session?.user?.id ? `pairo-cart-${session.user.id}` : "pairo-cart-guest";

  if (storageKey !== prevStorageKey) {
    setPrevStorageKey(storageKey);
    setIsCartLoaded(false);
  }

  // Load cart from localStorage when storageKey changes
  useEffect(() => {
    const savedCart = localStorage.getItem(storageKey);
    Promise.resolve().then(() => {
      if (savedCart) {
        try {
          setCartItems(JSON.parse(savedCart));
        } catch (e) {
          console.error("Failed to parse cart", e);
          setCartItems([]);
        }
      } else {
        setCartItems([]);
      }
      setIsCartLoaded(true);
    });
  }, [storageKey]);

  // Save cart to localStorage on change
  useEffect(() => {
    if (cartItems.length >= 0) {
      localStorage.setItem(storageKey, JSON.stringify(cartItems));
    }
  }, [cartItems, storageKey]);

  const [appliedPromo, setAppliedPromo] = useState(null);
  const [selectedShipping, setSelectedShipping] = useState(null);
  const [affiliateDiscount, setAffiliateDiscount] = useState({ type: 'None', value: 0, code: null });

  // A promo code picked up from a shared/QR link (see /promo/[code]) that hasn't
  // applied yet — e.g. the shopper's cart was empty or below the minimum spend
  // at the time. Kept separate from appliedPromo (which the empty-cart effect
  // below clears) so it survives until the cart actually qualifies.
  const PENDING_PROMO_KEY = "pairo-pending-promo";
  const [pendingPromoCode, setPendingPromoCodeState] = useState(null);

  // A personal, email-locked voucher picked up from an abandoned-cart recovery link, for a guest who hasn't typed
  // their email yet: { code, token }, not persisted (the link's own token is what proves the email, each time it's
  // used — see applyPromoCode's recoveryToken param and /api/coupons/validate). Kept so the promo re-evaluation
  // effect below can keep re-proving the voucher by token (not just by email) until a real email is known, instead
  // of racing it with a no-code request and silently dropping the discount.
  const [activeRecoveryVoucher, setActiveRecoveryVoucher] = useState(null);

  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const stored = localStorage.getItem(PENDING_PROMO_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.code && parsed.expiresAt > Date.now()) {
            setPendingPromoCodeState(parsed.code);
          } else {
            localStorage.removeItem(PENDING_PROMO_KEY);
          }
        }
      } catch (e) {}
    });
  }, []);

  const setPendingPromoCode = useCallback((code) => {
    if (!code) {
      localStorage.removeItem(PENDING_PROMO_KEY);
      setPendingPromoCodeState(null);
      return;
    }
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    localStorage.setItem(PENDING_PROMO_KEY, JSON.stringify({ code, expiresAt }));
    setPendingPromoCodeState(code);
  }, []);

  const clearPendingPromoCode = useCallback(() => {
    localStorage.removeItem(PENDING_PROMO_KEY);
    setPendingPromoCodeState(null);
  }, []);

  // Read affiliate referral cookie/localStorage on mount and whenever storage changes
  const readAffiliateCookie = useCallback(() => {
    try {
      const cookieMatch = document.cookie.match(/(^|;)\s*pairo_ref\s*=\s*([^;]+)/);
      if (cookieMatch) {
        const parsed = JSON.parse(decodeURIComponent(cookieMatch[2]));
        if (parsed && parsed.expiresAt > Date.now()) {
          setAffiliateDiscount({
            type: parsed.customerDiscountType || 'None',
            value: parsed.customerDiscountValue || 0,
            code: parsed.code || null
          });
          return;
        }
      }
      const stored = localStorage.getItem('pairo_ref');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.expiresAt > Date.now()) {
          setAffiliateDiscount({
            type: parsed.customerDiscountType || 'None',
            value: parsed.customerDiscountValue || 0,
            code: parsed.code || null
          });
          return;
        }
      }
    } catch (e) {}
    setAffiliateDiscount({ type: 'None', value: 0, code: null });
  }, []);

  useEffect(() => {
    readAffiliateCookie();
    window.addEventListener('storage', readAffiliateCookie);
    window.addEventListener('pairo_ref_updated', readAffiliateCookie);
    return () => {
      window.removeEventListener('storage', readAffiliateCookie);
      window.removeEventListener('pairo_ref_updated', readAffiliateCookie);
    };
  }, [readAffiliateCookie]);
  // Load promo code from localStorage when storageKey changes
  useEffect(() => {
    const savedPromo = localStorage.getItem(`pairo-promo-${storageKey}`);
    Promise.resolve().then(() => {
      if (savedPromo) {
        try {
          setAppliedPromo(JSON.parse(savedPromo));
        } catch (e) {
          setAppliedPromo(null);
        }
      } else {
        setAppliedPromo(null);
      }
    });
  }, [storageKey]);

  // Save promo code to localStorage when it changes
  useEffect(() => {
    if (appliedPromo) {
      localStorage.setItem(`pairo-promo-${storageKey}`, JSON.stringify(appliedPromo));
    } else {
      localStorage.removeItem(`pairo-promo-${storageKey}`);
    }
  }, [appliedPromo, storageKey]);

  // Clear promo if cart is empty
  useEffect(() => {
    if (cartItems.length === 0) {
      setAppliedPromo(null);
    }
  }, [cartItems]);

  const addToCart = useCallback((product, openDrawer = true) => {
    const normalizedProduct = {
      ...product,
      id: product.id || product._id,
      selectedSize: product.selectedSize || product.selectedOptions?.Size || product.selectedOptions?.size || "Standard",
      selectedColor: product.selectedColor || product.selectedOptions?.Color || product.selectedOptions?.color || "Standard",
      image: product.image || (product.images && product.images[0]) || "/placeholder.jpg",
    };

    // Items with madeToMeasure or Corporate Gifting selections are always unique (never merged) —
    // each line can carry a different set of selected items/uploaded logos.
    const isUniqueLine = !!normalizedProduct.madeToMeasure?.enabled || !!normalizedProduct.corporateGifting?.enabled;

    setCartItems((prevItems) => {
      if (!isUniqueLine) {
        const isMergeable = (item) =>
          item.id === normalizedProduct.id &&
          item.selectedSize === normalizedProduct.selectedSize &&
          item.selectedColor === normalizedProduct.selectedColor &&
          !item.madeToMeasure?.enabled &&
          !item.corporateGifting?.enabled;

        const existingItem = prevItems.find(isMergeable);
        if (existingItem) {
          return prevItems.map((item) =>
            isMergeable(item) ? { ...item, quantity: item.quantity + 1 } : item
          );
        }
      }

      // Unique lines (made-to-measure / Corporate Gifting) are added once per add-to-cart
      // action, not merged, and get their own stable key so two differently-configured lines
      // for the same product/size/color never collide on remove/quantity-update.
      const initialQuantity = isUniqueLine ? Math.max(1, Number(normalizedProduct.quantity) || 1) : 1;
      const lineId = isUniqueLine
        ? `${normalizedProduct.id}-u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        : undefined;
      return [...prevItems, { ...normalizedProduct, quantity: initialQuantity, ...(lineId ? { lineId } : {}) }];
    });
    if (openDrawer) {
      setIsCartOpen(true);
    }

    // GA4 Event: add_to_cart
    trackAddToCart(product);
  }, []);

  const removeFromCart = useCallback((uniqueKey) => {
    // GA4 Event: remove_from_cart — fire with the removed line's details before it's gone.
    const removed = cartItems.find((item) => getCartItemKey(item) === uniqueKey);
    if (removed) trackRemoveFromCart(removed);

    setCartItems((prevItems) => prevItems.filter((item) => getCartItemKey(item) !== uniqueKey));
  }, [cartItems]);

  const updateQuantity = useCallback((uniqueKey, delta) => {
    setCartItems((prevItems) =>
      prevItems
        .map((item) => {
          if (getCartItemKey(item) === uniqueKey) {
            return { ...item, quantity: Math.max(0, item.quantity + delta) };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const cartCount    = cartItems.reduce((total, item) => total + item.quantity, 0);
  const cartSubtotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const shippingCost = (selectedShipping && !appliedPromo?.freeShipping) ? (selectedShipping.cost ?? 0) : 0;

  // Re-validate coupon code and evaluate automatic promotions automatically when cart items or subtotal changes
  useEffect(() => {
    if (cartItems.length > 0) {
      const hasManualCode = appliedPromo && !appliedPromo.isAutomatic && !appliedPromo.appliedPromotions?.[0]?.isAutomatic;
      // A recovery voucher takes over from `pendingPromoCode` once known: this keeps the request this effect fires
      // (e.g. right after an abandoned-cart restore adds items, racing the recovery flow's own apply call) asking
      // for the SAME code+token the recovery flow is applying, so whichever of the two finishes last still lands on
      // the correct, discounted result instead of one silently overwriting the other with "no code".
      const codeToTry = hasManualCode ? appliedPromo.code : (pendingPromoCode || activeRecoveryVoucher?.code || "");

      const evaluatePromotions = async () => {
        try {
          const res = await fetch("/api/coupons/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: codeToTry,
              cartSubtotal,
              items: cartItems,
              email: session?.user?.email || null,
              recoveryToken: activeRecoveryVoucher?.token || null
            })
          });
          const data = await res.json();
          if (data.success) {
            if (data.appliedPromotions && data.appliedPromotions.length > 0) {
              setAppliedPromo(data);
              // The pending (QR/link) code just applied for real — stop tracking it separately.
              if (!hasManualCode && codeToTry && pendingPromoCode) {
                clearPendingPromoCode();
              }
            } else {
              setAppliedPromo(null);
            }
          } else {
            setAppliedPromo(null);
            // Leave a pending code in place — it may still qualify once the cart
            // grows (e.g. a minimum-spend or minimum-quantity coupon).
          }
        } catch (err) {
          console.error("Failed to evaluate promotions on cart change", err);
        }
      };
      evaluatePromotions();
    } else {
      setAppliedPromo(null);
      setActiveRecoveryVoucher(null);
    }
  }, [cartItems, cartSubtotal, session, pendingPromoCode, activeRecoveryVoucher]);

  // Dynamic promo discount calculation
  const discountTotal = (() => {
    if (!appliedPromo) return 0;
    
    // Use server-calculated amount directly when available
    if (appliedPromo.discountAmount !== undefined && appliedPromo.discountAmount !== null) {
      return Math.min(appliedPromo.discountAmount, cartSubtotal);
    }
    
    if (appliedPromo.type === "percentage" || appliedPromo.type === "percentage_discount") {
      return (cartSubtotal * appliedPromo.value) / 100;
    } else {
      return Math.min(appliedPromo.value, cartSubtotal);
    }
  })();

  // Affiliate customer discount (independent from promo codes)
  const affiliateDiscountAmount = (() => {
    if (!affiliateDiscount || affiliateDiscount.type === 'None' || !affiliateDiscount.value) return 0;
    if (affiliateDiscount.type === 'Percentage') {
      return Math.round((cartSubtotal * affiliateDiscount.value / 100) * 100) / 100;
    } else if (affiliateDiscount.type === 'Fixed') {
      return Math.min(affiliateDiscount.value, cartSubtotal);
    }
    return 0;
  })();

  // Grand total = subtotal - promo discount - affiliate discount + shipping
  const cartTotal = Math.max(0, cartSubtotal - discountTotal - affiliateDiscountAmount + shippingCost);

  const applyPromoCode = useCallback(async (code, email = null, recoveryToken = null) => {
    if (!code) return { success: false, error: "No code provided" };
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, cartSubtotal, items: cartItems, email, recoveryToken })
      });
      const data = await res.json();
      if (data.success) {
        setAppliedPromo(data);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      return { success: false, error: "Connection error" };
    }
  }, [cartSubtotal, cartItems]);

  // Cart recovery from an abandoned-cart email link, on whatever page the shopper lands on (?recover=<token> —
  // today that is /checkout or /shop, but this works anywhere the param shows up, since CartProvider wraps every
  // storefront page). Restores the cart on a device/browser that never had it, auto-applies the voucher the email
  // promised with no email retyping (the token itself proves whose cart this is — see /api/checkout/recover and
  // the recoveryToken param above), and confirms it with a small toast. Runs once per token; `recovering` keeps
  // checkout's empty-cart redirect from firing while this is still in flight.
  const recoverStartedRef = useRef(false);
  const [recovering, setRecovering] = useState(() =>
    typeof window !== "undefined" && Boolean(new URLSearchParams(window.location.search).get("recover"))
  );
  const cartReady = isCartLoaded && status !== "loading";

  useEffect(() => {
    if (!cartReady || recoverStartedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("recover");
    if (!token) return;
    recoverStartedRef.current = true;

    const stripParam = () => {
      params.delete("recover");
      const qs = params.toString();
      router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`);
    };

    (async () => {
      const hadItems = cartItems.length > 0;
      let data = null;
      try {
        const res = await fetch(`/api/checkout/recover?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        if (res.ok) data = await res.json();
      } catch (e) {
        data = null;
      }
      stripParam();

      // Set BEFORE restoring items: adding items fires the cart-change promo re-evaluation effect above, which
      // would otherwise run with no code yet and could race the applyPromoCode call below into silently clearing
      // the discount. With this set first, that effect asks for the same code+token too, so it converges on the
      // same correct, discounted result no matter which of the two finishes last.
      if (data?.success && data.voucherCode) {
        setActiveRecoveryVoucher({ code: data.voucherCode, token });
      }

      let restoredCount = 0;
      if (data?.success && !hadItems && Array.isArray(data.items) && data.items.length > 0) {
        // Same item shape the product page builds; addToCart adds one unit per call and merges identical lines.
        for (const item of data.items) {
          for (let i = 0; i < (Number(item.quantity) || 1); i++) addToCart(item, false);
        }
        restoredCount = data.items.length;
      }

      let voucherApplied = "";
      if (data?.success && data.voucherCode && (hadItems || restoredCount > 0)) {
        const res = await applyPromoCode(data.voucherCode, null, token);
        if (res.success) voucherApplied = data.voucherCode;
      }

      if (restoredCount > 0 && voucherApplied) {
        toast.success(`Welcome back! Your cart is restored and code ${voucherApplied} is applied.`, { duration: 6000 });
      } else if (voucherApplied) {
        toast.success(`Discount code ${voucherApplied} applied to your order!`, { duration: 6000 });
      } else if (restoredCount > 0) {
        toast.success("We restored your cart.", { duration: 5000 });
      } else if (data?.success && !hadItems) {
        toast("Those saved items are no longer available.", { icon: "ℹ️", duration: 5000 });
      }
      // An invalid, expired, or already-used link stays silent, same as before: it never tells anyone (not even
      // "not found") that it once pointed to something real.

      setRecovering(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartReady]);

  // Quick-add from a Google Shopping ad's "Cart or checkout page URL" link (?buy=<productId> — see
  // /api/checkout/quick-add and src/app/feed.xml/route.js's <g:id>). Adds that one product (quantity 1) so a
  // shopper who taps "Buy"/"Add to cart" on the ad lands on checkout with it already in, ready to pay. Same
  // lazy-init + ref-guard + strip-the-param style as the `recover` effect above, but otherwise independent: no
  // token, no AbandonedCart, just a live product lookup, and — unlike recovery — it always adds regardless of
  // whether the cart already has items (addToCart's own merge logic already handles landing on the same link
  // twice by bumping quantity instead of duplicating the line). Different query param, so both effects can run on
  // the same page load without interfering with each other.
  const quickAddStartedRef = useRef(false);
  // Exposed the same way `recovering` is: while true, checkout's empty-cart redirect must not fire. Without this, a
  // sold-out/ineligible `?buy=` link (cart stays empty the whole time) raced its own router.replace (stripping the
  // param) against that redirect's router.push("/cart") and could leave the shopper stuck on a blank $0 checkout
  // page — neither navigation ever visibly completing — instead of landing cleanly on an empty cart.
  const [quickAdding, setQuickAdding] = useState(() =>
    typeof window !== "undefined" && Boolean(new URLSearchParams(window.location.search).get("buy"))
  );
  useEffect(() => {
    if (!cartReady || quickAddStartedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("buy");
    if (!id) return;
    quickAddStartedRef.current = true;

    const stripParam = () => {
      params.delete("buy");
      const qs = params.toString();
      router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`);
    };

    (async () => {
      let data = null;
      try {
        const res = await fetch(`/api/checkout/quick-add?id=${encodeURIComponent(id)}`, { cache: "no-store" });
        if (res.ok) data = await res.json();
      } catch (e) {
        data = null;
      }
      stripParam();

      if (data?.success && data.item) {
        addToCart(data.item, false);
        toast.success(`${data.item.name} added to your cart!`, { duration: 5000 });
      }
      // Gone, sold out, or not eligible: stay silent, same posture as an invalid recovery link — it never tells
      // anyone (not even "not found") that the link once pointed to something real.
      setQuickAdding(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartReady]);

  const removePromoCode = useCallback(() => {
    setAppliedPromo(null);
    clearPendingPromoCode();
    setActiveRecoveryVoucher(null);
  }, [clearPendingPromoCode]);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setAppliedPromo(null);
    setSelectedShipping(null);
  }, []);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        isCartOpen,
        setIsCartOpen,
        addToCart,
        removeFromCart,
        updateQuantity,
        cartCount,
        cartSubtotal,
        shippingCost,
        cartTotal,
        clearCart,
        appliedPromo,
        discountTotal,
        applyPromoCode,
        removePromoCode,
        pendingPromoCode,
        setPendingPromoCode,
        selectedShipping,
        setSelectedShipping,
        affiliateDiscount,
        affiliateDiscountAmount,
        isCartLoaded: isCartLoaded && status !== "loading",
        recovering,
        quickAdding
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
