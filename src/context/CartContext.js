"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

const CartContext = createContext();

export function CartProvider({ children }) {
  const { data: session, status } = useSession();
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

    // Items with madeToMeasure are always unique (never merged)
    const isM2M = !!normalizedProduct.madeToMeasure?.enabled;

    setCartItems((prevItems) => {
      if (!isM2M) {
        const existingItem = prevItems.find(
          (item) =>
            item.id === normalizedProduct.id &&
            item.selectedSize === normalizedProduct.selectedSize &&
            item.selectedColor === normalizedProduct.selectedColor &&
            !item.madeToMeasure?.enabled
        );

        if (existingItem) {
          return prevItems.map((item) =>
            (item.id === normalizedProduct.id &&
             item.selectedSize === normalizedProduct.selectedSize &&
             item.selectedColor === normalizedProduct.selectedColor &&
             !item.madeToMeasure?.enabled)
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        }
      }

      return [...prevItems, { ...normalizedProduct, quantity: 1 }];
    });
    if (openDrawer) {
      setIsCartOpen(true);
    }
  }, []);

  const removeFromCart = useCallback((uniqueKey) => {
    setCartItems((prevItems) =>
      prevItems.filter((item) => {
        const itemKey = `${item.id}-${item.selectedSize}-${item.selectedColor}`;
        return itemKey !== uniqueKey;
      })
    );
  }, []);

  const updateQuantity = useCallback((uniqueKey, delta) => {
    setCartItems((prevItems) =>
      prevItems
        .map((item) => {
          const itemKey = `${item.id}-${item.selectedSize}-${item.selectedColor}`;
          if (itemKey === uniqueKey) {
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
      const codeToTry = hasManualCode ? appliedPromo.code : (pendingPromoCode || "");

      const evaluatePromotions = async () => {
        try {
          const res = await fetch("/api/coupons/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: codeToTry,
              cartSubtotal,
              items: cartItems,
              email: session?.user?.email || null
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
    }
  }, [cartItems, cartSubtotal, session, pendingPromoCode]);

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

  const applyPromoCode = useCallback(async (code, email = null) => {
    if (!code) return { success: false, error: "No code provided" };
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, cartSubtotal, items: cartItems, email })
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

  const removePromoCode = useCallback(() => {
    setAppliedPromo(null);
    clearPendingPromoCode();
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
        isCartLoaded: isCartLoaded && status !== "loading"
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
