"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Upload, X, Loader2, AlertCircle, ShoppingBag, Gift, Minus, Plus } from "lucide-react";

import { useCart } from "@/context/CartContext";
import { ARTWORK_ACCEPTED_FORMATS } from "@/lib/customizationOptions";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB — matches /api/uploads/artwork server limit

function GiftItemCard({ item, selected, onToggle }) {
  return (
    <div
      className={`relative rounded-[var(--radius,10px)] border-2 transition-colors duration-200 overflow-hidden bg-white ${
        selected ? "border-primary shadow-sm" : "border-black/10 hover:border-primary/40"
      }`}
    >
      <button type="button" onClick={onToggle} className="w-full text-left block">
        <div className="relative aspect-[4/3] bg-black/[0.03]">
          {item.image ? (
            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-primary/30">
              <Gift className="w-6 h-6" />
            </div>
          )}
          <span
            className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              selected ? "bg-primary border-primary" : "bg-white/90 border-black/20"
            }`}
          >
            {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
          </span>
        </div>
        <div className="px-2 py-1.5">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[12px] font-bold text-primary truncate">{item.name}</span>
            <span className="shrink-0 text-[10px] font-bold text-primary/70 bg-primary/10 rounded-full px-1.5 py-0.5">
              +${Number(item.priceDelta || 0).toFixed(2)}
            </span>
          </div>
          {item.description && (
            <p className="text-[10px] text-primary/60 leading-snug line-clamp-1 mt-0.5">{item.description}</p>
          )}
        </div>
      </button>
    </div>
  );
}

/** One logo for the whole order: applied to every selected item. */
function LogoUpload({ logo, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setError(null);
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!ARTWORK_ACCEPTED_FORMATS.split(",").includes(ext)) return setError("Unsupported file format.");
    if (file.size > MAX_UPLOAD_BYTES) return setError("File exceeds the 10MB limit.");

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads/artwork", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) onChange({ url: data.url, name: file.name });
      else setError(data.error || "Upload failed. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[13px] font-bold text-primary">
        Your logo <span className="text-primary/50 font-medium">(applied to all selected items)</span>
      </p>
      {logo?.url ? (
        <div className="flex items-center gap-2.5 bg-black/[0.03] rounded-[var(--radius,8px)] px-3 py-2">
          <div className="w-9 h-9 rounded-md border border-black/10 overflow-hidden shrink-0 bg-white">
            {/\.(png|jpg|jpeg|svg|webp)$/i.test(logo.url) ? (
              <img src={logo.url} alt={logo.name} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-primary/60">FILE</div>
            )}
          </div>
          <span className="text-[12px] font-semibold text-primary truncate flex-1">{logo.name}</span>
          <button type="button" onClick={() => { onChange(null); setError(null); }} className="text-primary/50 hover:text-red-600 transition-colors shrink-0" aria-label="Remove logo">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 text-[12px] font-bold uppercase tracking-wide text-primary border border-dashed border-primary/40 hover:border-primary rounded-[var(--radius,8px)] px-3 py-3 transition-all disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Uploading..." : "Upload your logo"}
        </button>
      )}
      <input ref={inputRef} type="file" accept={ARTWORK_ACCEPTED_FORMATS} className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      {error && (
        <p className="flex items-center gap-1 text-[11px] text-red-600 font-semibold">
          <AlertCircle className="w-3 h-3 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

export default function CorporateGiftingActions({ product, unitPrice, onExtraChange }) {
  const { addToCart } = useCart();
  const router = useRouter();

  const giftItems = useMemo(
    () => (product.corporateGifting?.items || []).filter((i) => i.active !== false),
    [product.corporateGifting]
  );
  const minSelections = product.corporateGifting?.minSelections || 3;

  const [selections, setSelections] = useState({}); // { [itemId]: true }
  const [logo, setLogo] = useState(null); // one logo for the whole order
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [showGateMessage, setShowGateMessage] = useState(false);

  const selectedIds = Object.keys(selections);
  const selectedCount = selectedIds.length;
  const meetsMinimum = selectedCount >= minSelections;

  const deltaTotal = giftItems.reduce((sum, item) => {
    if (selections[item._id]) return sum + (Number(item.priceDelta) || 0);
    return sum;
  }, 0);

  // Report the extra to the page so the existing main price updates (no separate total box).
  useEffect(() => {
    onExtraChange?.(deltaTotal);
    return () => onExtraChange?.(0);
  }, [deltaTotal, onExtraChange]);

  // unitPrice already includes the extra (the page folds it into its main price).
  const lineUnitPrice = Number(product.price) + deltaTotal;
  const runningTotal = (Number(unitPrice ?? lineUnitPrice) || 0) * quantity;

  const toggleItem = (item) => {
    setSelections((prev) => {
      const next = { ...prev };
      if (next[item._id]) {
        delete next[item._id];
      } else {
        next[item._id] = true;
      }
      return next;
    });
  };

  const buildCartItem = () => ({
    ...product,
    price: lineUnitPrice,
    quantity,
    image: product.images?.[0] || product.image,
    corporateGifting: {
      enabled: true,
      minSelections,
      selections: giftItems
        .filter((item) => selections[item._id])
        .map((item) => ({
          itemId: item._id,
          name: item.name,
          image: item.image,
          priceDelta: item.priceDelta || 0,
          artwork: logo || null,
        })),
    },
  });

  const handleAddToCart = (openDrawer = true) => {
    if (!meetsMinimum) {
      setShowGateMessage(true);
      return;
    }
    addToCart(buildCartItem(), openDrawer);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  };

  const handleBuyNow = () => {
    if (!meetsMinimum) {
      setShowGateMessage(true);
      return;
    }
    handleAddToCart(false);
    router.push("/checkout");
  };

  if (giftItems.length === 0) {
    return (
      <div className="rounded-[var(--radius,12px)] border border-amber-300 bg-amber-50 p-4 text-[13px] text-amber-800 font-medium">
        No customization items have been configured for this product yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[15px] md:text-[17px] font-bold text-primary">
          Choose your items <span className="text-primary/50 font-medium">(select at least {minSelections})</span>
        </p>
        <span className={`text-[12px] font-bold px-2.5 py-1 rounded-full ${meetsMinimum ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary"}`}>
          {selectedCount} selected
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {giftItems.map((item) => (
          <GiftItemCard
            key={item._id}
            item={item}
            selected={!!selections[item._id]}
            onToggle={() => toggleItem(item)}
          />
        ))}
      </div>

      <LogoUpload logo={logo} onChange={setLogo} />

      {!meetsMinimum && showGateMessage && (
        <p className="flex items-center gap-2 text-[13px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-[var(--radius,8px)] px-3 py-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Please select at least {minSelections} items ({selectedCount} selected) before adding to cart.
        </p>
      )}

      <div className="space-y-3 pt-1">
        <div className="flex items-center gap-3">
          <p className="text-[15px] md:text-[17px] font-bold text-primary">Quantity:</p>
          <div className="flex items-center justify-center rounded-[var(--radius,8px)] border border-primary/30 gap-2 h-10 min-w-[104px]">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="text-primary hover:text-primary/70 transition-colors p-1.5"
              aria-label="Decrease quantity"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-bold text-[14px] w-6 text-center text-primary select-none">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              className="text-primary hover:text-primary/70 transition-colors p-1.5"
              aria-label="Increase quantity"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleAddToCart(true)}
          disabled={!meetsMinimum}
          className="w-full h-14 rounded-[var(--radius,12px)] bg-primary text-white font-bold uppercase tracking-wide text-[15px] md:text-[16px] flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:brightness-110 transition-all duration-200 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:shadow-none"
        >
          {addedFeedback ? (
            <>
              <Check className="w-5 h-5" strokeWidth={3} /> Added to cart
            </>
          ) : (
            <>
              <ShoppingBag className="w-5 h-5" />
              Add to cart — ${runningTotal.toFixed(2)}
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleBuyNow}
          disabled={!meetsMinimum}
          className="w-full h-12 rounded-[var(--radius,12px)] border-2 border-primary bg-white text-primary font-bold uppercase tracking-wide text-[15px] hover:bg-primary hover:text-white transition-all duration-200 active:scale-[0.99] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-primary"
        >
          Buy now
        </button>
      </div>
    </div>
  );
}
