"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, Trash2, Search, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { can } from "@/lib/rbac";

const inputClass = "w-full bg-white border border-[#8c8f94] rounded-[3px] px-3 py-2 text-[13px] outline-none focus:border-[#2271b1] transition-all text-black";
const labelClass = "block text-[11px] font-bold text-[#3c434a] uppercase tracking-wide mb-1";

function resolveVariantTitle(product, selectedOptions) {
  if (!selectedOptions) return null;
  return (product.attributes || []).map(a => selectedOptions[a.name]).filter(Boolean).join(" / ")
    || Object.values(selectedOptions).join(" / ");
}

function resolveVariantPrice(product, selectedOptions) {
  if (!product?.variantCombinations?.length) return product?.price ?? 0;
  const title = resolveVariantTitle(product, selectedOptions);
  const variant = title ? product.variantCombinations.find(vc => vc.title === title) : null;
  return (variant?.price !== undefined && variant?.price !== null) ? variant.price : (product.price ?? 0);
}

function ProductPicker({ onAdd }) {
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pendingProduct, setPendingProduct] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetch("/api/admin/products")
      .then(r => r.json())
      .then(data => setAllProducts(Array.isArray(data) ? data : []))
      .catch(() => setAllProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const matches = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allProducts.filter(p => p.name?.toLowerCase().includes(q)).slice(0, 8);
  }, [search, allProducts]);

  const pickProduct = async (productStub) => {
    setSearch("");
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/products?id=${productStub._id}`);
      const product = await res.json();
      setPendingProduct(product);
      setSelectedOptions({});
      setQuantity(1);
      setPrice(product.price || 0);
    } catch {
      toast.error("Failed to load product details");
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (pendingProduct) setPrice(resolveVariantPrice(pendingProduct, selectedOptions));
  }, [selectedOptions, pendingProduct]);

  const requiredAttrsMissing = pendingProduct?.attributes?.some(a => !selectedOptions[a.name]);

  const handleAdd = () => {
    if (!pendingProduct || requiredAttrsMissing) return;
    onAdd({
      key: `${pendingProduct._id}-${Date.now()}`,
      productId: pendingProduct._id,
      name: pendingProduct.name,
      image: pendingProduct.images?.[0] || pendingProduct.image,
      selectedOptions: Object.keys(selectedOptions).length > 0 ? selectedOptions : null,
      variantTitle: resolveVariantTitle(pendingProduct, selectedOptions),
      quantity: Math.max(1, parseInt(quantity, 10) || 1),
      price: Number(price) || 0,
    });
    setPendingProduct(null);
  };

  return (
    <div className="border border-[#ccd0d4] bg-[#f6f7f7] rounded-[3px] p-3 space-y-3">
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-[#646970] absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder={loading ? "Loading products..." : "Search products by name..."}
          value={search}
          disabled={loading}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} pl-8`}
        />
        {matches.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#ccd0d4] rounded-[3px] shadow-lg max-h-64 overflow-y-auto divide-y divide-[#f0f0f1]">
            {matches.map(p => (
              <button
                key={p._id}
                type="button"
                onClick={() => pickProduct(p)}
                className="w-full flex items-center gap-2.5 text-left px-3 py-2 hover:bg-[#f6f7f7] cursor-pointer"
              >
                <img src={p.image || p.images?.[0] || "/placeholder.jpg"} alt="" className="w-8 h-8 object-cover rounded-[2px] border border-[#e0e0e0]" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-black truncate">{p.name}</p>
                  <p className="text-[11px] text-[#646970]">${p.price?.toLocaleString()} · Stock: {p.manageStock ? p.stock : "Unmanaged"}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {loadingDetail && (
        <div className="flex items-center gap-2 text-[12px] text-[#646970]"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading product...</div>
      )}

      {pendingProduct && (
        <div className="bg-white border border-[#ccd0d4] rounded-[3px] p-3 space-y-3">
          <p className="text-[13px] font-bold text-black">{pendingProduct.name}</p>

          {(pendingProduct.attributes || []).map(attr => (
            <div key={attr.name}>
              <label className={labelClass}>{attr.name} *</label>
              <select
                className={inputClass}
                value={selectedOptions[attr.name] || ""}
                onChange={(e) => setSelectedOptions(prev => ({ ...prev, [attr.name]: e.target.value }))}
              >
                <option value="" disabled>Select {attr.name}...</option>
                {(attr.values || []).map(v => (
                  <option key={v.value} value={v.value}>{v.label || v.value}</option>
                ))}
              </select>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Quantity</label>
              <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Price (editable) *</label>
              <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={requiredAttrsMissing}
              className="flex items-center gap-1.5 bg-[#2271b1] text-white px-3 py-1.5 rounded-[3px] text-[12px] font-bold hover:bg-[#135e96] disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Item
            </button>
            <button type="button" onClick={() => setPendingProduct(null)} className="text-[12px] font-semibold text-[#646970] hover:text-black cursor-pointer">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminNewOrderPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [lineItems, setLineItems] = useState([]);
  const [customerMode, setCustomerMode] = useState("guest");
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState({
    fullName: "", street: "", city: "", state: "", zip: "", country: "United States", phone: ""
  });
  const [shippingCost, setShippingCost] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState("Paid");
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");

  // Generated once per visit to this form so a double-click (or a retried network request)
  // on "Create Order" can't create two orders with two separate stock decrements — the API
  // dedupes on this key the same way customer checkout does.
  useEffect(() => {
    setIdempotencyKey(`admord_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`);
  }, []);

  useEffect(() => {
    fetch("/api/admin/customers")
      .then(r => r.json())
      .then(data => setCustomers(Array.isArray(data) ? data : []))
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCustomers(false));
  }, []);

  const removeItem = (key) => setLineItems(prev => prev.filter(i => i.key !== key));
  const updateItem = (key, patch) => setLineItems(prev => prev.map(i => i.key === key ? { ...i, ...patch } : i));

  const subtotal = lineItems.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0);
  const total = subtotal + (Number(shippingCost) || 0);

  const handleSubmit = async () => {
    setError("");

    if (lineItems.length === 0) {
      setError("Add at least one product to the order.");
      return;
    }
    if (!shippingAddress.fullName || !shippingAddress.street || !shippingAddress.city || !shippingAddress.country) {
      setError("Shipping name, street, city, and country are required.");
      return;
    }
    if (customerMode === "existing" && !selectedCustomerId) {
      setError("Select a customer.");
      return;
    }
    if (customerMode === "guest" && !guestEmail) {
      setError("Enter a guest email address.");
      return;
    }
    if (lineItems.some(i => Number(i.price) < 0)) {
      setError("Price cannot be negative.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          items: lineItems.map(i => ({
            productId: i.productId,
            selectedOptions: i.selectedOptions,
            quantity: i.quantity,
            priceOverride: i.price,
          })),
          customer: customerMode === "existing"
            ? { customerId: selectedCustomerId }
            : { email: guestEmail },
          shippingAddress,
          shippingCost: Number(shippingCost) || 0,
          paymentStatus,
          adminNote,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create order");
      }
      toast.success(`Order #${data.order.orderNumber} created`);
      router.push(`/admin/orders/${data.order._id}`);
    } catch (err) {
      setError(err.message || "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") return null;

  if (!can(session?.user, "orders.create")) {
    return (
      <AdminPageLayout title="Create Order" breadcrumbs={[{ label: "Orders", href: "/admin/orders" }, { label: "Create Order" }]}>
        <div className="bg-white border border-[#ccd0d4] p-6 text-[13px] text-[#646970]">
          You don&apos;t have permission to create orders.
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout title="Create Order" breadcrumbs={[{ label: "Orders", href: "/admin/orders" }, { label: "Create Order" }]}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Line Items */}
          <div className="bg-white border border-[#ccd0d4] shadow-sm">
            <div className="px-3 py-2.5 border-b border-[#ccd0d4] bg-[#f6f7f7]">
              <h2 className="text-[13px] font-bold text-[#1d2327]">Products</h2>
            </div>
            <div className="p-3 space-y-3">
              {lineItems.length > 0 && (
                <div className="divide-y divide-[#f0f0f1] border border-[#f0f0f1] rounded-[3px]">
                  {lineItems.map(item => (
                    <div key={item.key} className="flex items-center gap-3 p-2.5">
                      <img src={item.image || "/placeholder.jpg"} alt="" className="w-10 h-10 object-cover rounded-[2px] border border-[#e0e0e0] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-black truncate">{item.name}</p>
                        {item.variantTitle && <p className="text-[11px] text-[#646970]">{item.variantTitle}</p>}
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(item.key, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        className="w-16 border border-[#8c8f94] rounded-[3px] px-2 py-1 text-[12px] text-center"
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.price}
                        onChange={(e) => updateItem(item.key, { price: e.target.value })}
                        className="w-24 border border-[#8c8f94] rounded-[3px] px-2 py-1 text-[12px] text-right"
                      />
                      <button type="button" onClick={() => removeItem(item.key)} className="text-[#bc0b0d] hover:text-red-700 cursor-pointer shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <ProductPicker onAdd={(item) => setLineItems(prev => [...prev, item])} />
            </div>
          </div>

          {/* Customer */}
          <div className="bg-white border border-[#ccd0d4] shadow-sm">
            <div className="px-3 py-2.5 border-b border-[#ccd0d4] bg-[#f6f7f7]">
              <h2 className="text-[13px] font-bold text-[#1d2327]">Customer</h2>
            </div>
            <div className="p-3 space-y-3">
              <div className="flex gap-4 text-[12px] font-semibold">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={customerMode === "guest"} onChange={() => setCustomerMode("guest")} className="accent-[#2271b1]" />
                  Guest / New
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={customerMode === "existing"} onChange={() => setCustomerMode("existing")} className="accent-[#2271b1]" />
                  Existing Customer
                </label>
              </div>

              {customerMode === "existing" ? (
                <select
                  className={inputClass}
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  disabled={loadingCustomers}
                >
                  <option value="">{loadingCustomers ? "Loading customers..." : "Select a customer..."}</option>
                  {customers.map(c => (
                    <option key={c._id} value={c._id}>{c.name} — {c.email}</option>
                  ))}
                </select>
              ) : (
                <div>
                  <label className={labelClass}>Email *</label>
                  <input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className={inputClass} />
                  <p className="text-[11px] text-[#646970] mt-1">The recipient's name and phone are taken from the shipping address below.</p>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-white border border-[#ccd0d4] shadow-sm">
            <div className="px-3 py-2.5 border-b border-[#ccd0d4] bg-[#f6f7f7]">
              <h2 className="text-[13px] font-bold text-[#1d2327]">Shipping Address</h2>
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={labelClass}>Full Name *</label>
                <input type="text" value={shippingAddress.fullName} onChange={(e) => setShippingAddress(prev => ({ ...prev, fullName: e.target.value }))} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Street *</label>
                <input type="text" value={shippingAddress.street} onChange={(e) => setShippingAddress(prev => ({ ...prev, street: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>City *</label>
                <input type="text" value={shippingAddress.city} onChange={(e) => setShippingAddress(prev => ({ ...prev, city: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>State</label>
                <input type="text" value={shippingAddress.state} onChange={(e) => setShippingAddress(prev => ({ ...prev, state: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>ZIP / Postal Code</label>
                <input type="text" value={shippingAddress.zip} onChange={(e) => setShippingAddress(prev => ({ ...prev, zip: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Country *</label>
                <input type="text" value={shippingAddress.country} onChange={(e) => setShippingAddress(prev => ({ ...prev, country: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input type="text" value={shippingAddress.phone} onChange={(e) => setShippingAddress(prev => ({ ...prev, phone: e.target.value }))} className={inputClass} />
              </div>
            </div>
          </div>
        </div>

        {/* Right column: summary + submit */}
        <div className="space-y-4">
          <div className="bg-white border border-[#ccd0d4] shadow-sm p-3 space-y-3">
            <h2 className="text-[13px] font-bold text-[#1d2327]">Order Summary</h2>

            <div className="space-y-1 text-[13px]">
              <div className="flex justify-between"><span className="text-[#646970]">Subtotal</span><span className="font-semibold">${subtotal.toLocaleString()}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-[#646970]">Shipping</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                  className="w-24 border border-[#8c8f94] rounded-[3px] px-2 py-1 text-[12px] text-right"
                />
              </div>
              <div className="flex justify-between pt-2 border-t border-[#f0f0f1] font-bold text-black">
                <span>Total</span><span>${total.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <label className={labelClass}>Payment Status</label>
              <select className={inputClass} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Note (optional)</label>
              <textarea rows={2} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} className={`${inputClass} resize-none`} />
            </div>

            {error && <p className="text-[12px] text-red-600 font-semibold">{error}</p>}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !idempotencyKey}
              className="w-full bg-[#2271b1] text-white py-2.5 rounded-[3px] text-[13px] font-bold hover:bg-[#135e96] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Creating Order..." : "Create Order"}
            </button>
          </div>
        </div>
      </div>
    </AdminPageLayout>
  );
}
