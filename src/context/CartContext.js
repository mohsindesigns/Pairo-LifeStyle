"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";

const CartContext = createContext();

export function CartProvider({ children }) {
  const { data: session } = useSession();
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Dynamic storage key based on user ID
  const storageKey = session?.user?.id ? `pairo-cart-${session.user.id}` : "pairo-cart-guest";

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
    });
  }, [storageKey]);

  // Save cart to localStorage on change
  useEffect(() => {
    if (cartItems.length >= 0) {
      localStorage.setItem(storageKey, JSON.stringify(cartItems));
    }
  }, [cartItems, storageKey]);

  const [appliedPromo, setAppliedPromo] = useState(null);

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

  const addToCart = (product, openDrawer = true) => {
    const normalizedProduct = {
      ...product,
      id: product.id || product._id,
      selectedSize: product.selectedSize || product.selectedOptions?.Size || product.selectedOptions?.size || "Standard",
      selectedColor: product.selectedColor || product.selectedOptions?.Color || product.selectedOptions?.color || "Standard",
      image: product.image || (product.images && product.images[0]) || "/placeholder.jpg",
    };

    setCartItems((prevItems) => {
      const existingItem = prevItems.find(
        (item) => 
          item.id === normalizedProduct.id && 
          item.selectedSize === normalizedProduct.selectedSize && 
          item.selectedColor === normalizedProduct.selectedColor
      );

      if (existingItem) {
        return prevItems.map((item) =>
          (item.id === normalizedProduct.id && 
           item.selectedSize === normalizedProduct.selectedSize && 
           item.selectedColor === normalizedProduct.selectedColor)
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prevItems, { ...normalizedProduct, quantity: 1 }];
    });
    if (openDrawer) {
      setIsCartOpen(true);
    }
  };

  const removeFromCart = (uniqueKey) => {
    setCartItems((prevItems) => 
      prevItems.filter((item) => {
        const itemKey = `${item.id}-${item.selectedSize}-${item.selectedColor}`;
        return itemKey !== uniqueKey;
      })
    );
  };

  const updateQuantity = (uniqueKey, delta) => {
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
  };

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const cartSubtotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);

  // Re-validate coupon code automatically when cart items or subtotal changes
  useEffect(() => {
    if (appliedPromo && cartItems.length > 0) {
      const revalidatePromo = async () => {
        try {
          const res = await fetch("/api/coupons/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: appliedPromo.code, cartSubtotal, items: cartItems })
          });
          const data = await res.json();
          if (data.success) {
            setAppliedPromo(data);
          } else {
            // If it becomes invalid (e.g. minSpend not met), clear the promo
            setAppliedPromo(null);
          }
        } catch (err) {
          console.error("Failed to re-validate promo on cart change", err);
        }
      };
      revalidatePromo();
    }
  }, [cartItems, cartSubtotal]);

  // Dynamic discount calculation
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

  const applyPromoCode = async (code, email = null) => {
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
  };

  const removePromoCode = () => {
    setAppliedPromo(null);
  };

  const clearCart = () => {
    setCartItems([]);
    setAppliedPromo(null);
  };

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
        clearCart,
        appliedPromo,
        discountTotal,
        applyPromoCode,
        removePromoCode
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
