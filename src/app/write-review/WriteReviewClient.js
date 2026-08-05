"use client";

import { useState } from "react";
import ProductReviews from "@/components/product/ProductReviews";

export default function WriteReviewClient({ products = [] }) {
  const [selectedProductId, setSelectedProductId] = useState("");

  const selectedProduct = products.find(p => p._id === selectedProductId);

  const resolveImageUrl = (img) => {
    if (!img) return "";
    if (img.startsWith("http://") || img.startsWith("https://") || img.startsWith("data:")) return img;
    if (img.startsWith("/")) return img;
    return `/${img}`;
  };

  const getProductImage = (prod) => {
    return prod.images?.[0] || prod.image || "";
  };

  return (
    <div className="space-y-8 text-left">
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-wider text-black block">
          Select Product
        </label>
        <select
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          className="w-full bg-white border border-black/15 rounded-[4px] px-4 py-3 text-sm font-medium focus:border-black outline-none transition-all text-black"
        >
          <option value="">-- Choose a product to review --</option>
          {products.map(p => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {selectedProduct && (
        <div className="border-t border-black/5 pt-8 space-y-6">
          <div className="flex items-center gap-4 bg-neutral-50 p-4 border border-black/[0.04] rounded-[8px]">
            {getProductImage(selectedProduct) && (
              <div className="w-16 h-20 bg-white border border-black/10 rounded-[4px] overflow-hidden shrink-0 flex items-center justify-center p-1">
                <img
                  src={resolveImageUrl(getProductImage(selectedProduct))}
                  alt={selectedProduct.name}
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Reviewing Piece</p>
              <h3 className="text-sm font-black uppercase tracking-wide text-black">{selectedProduct.name}</h3>
            </div>
          </div>

          <div id="reviews-section">
            <ProductReviews
              productId={selectedProductId}
              productName={selectedProduct.name}
              autoOpen={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
