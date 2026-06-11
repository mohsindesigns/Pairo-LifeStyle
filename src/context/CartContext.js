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

  const addToCart = (product) => {
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
    setIsCartOpen(true);
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

  const clearCart = () => {
    setCartItems([]);
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
