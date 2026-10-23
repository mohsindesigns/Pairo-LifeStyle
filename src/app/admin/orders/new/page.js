"use client";

import { Fragment, useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Plus, X, Search, Loader2, ChevronLeft } from "lucide-react";
import { toast } from "react-hot-toast";
import { Page, PageHeader, Notice, formatMoney } from "@/components/admin/ui";
import { can } from "@/lib/rbac";
import { usePopup } from "@/context/PopupContext";
import { addressFromCustomer, isSameAddress } from "@/lib/order-address-prefill";
import CustomizationEditor, { defaultCustomization } from "./CustomizationEditor";

const inputClass = "wp-input wp-full";
const selectClass = "wp-select wp-full";
const labelClass = "wp-label";

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

  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    // forOrder=true lets staff with orders.create (but not products.view) load the picker.
    fetch("/api/admin/products?forOrder=true")
      .then(async r => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error || "Failed to load products");
        return data;
      })
      .then(data => setAllProducts(Array.isArray(data) ? data : []))
      .catch((err) => {
        setAllProducts([]);
        setLoadError(err?.message || "Failed to load products");
      })
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
      const res = await fetch(`/api/admin/products?id=${productStub._id}&forOrder=true`);
      const product = await res.json();
      if (!res.ok || !product) throw new Error(product?.error || "Failed to load product details");
      setPendingProduct(product);
      setSelectedOptions({});
      setQuantity(1);
      setPrice(product.price || 0);
    } catch (err) {
      toast.error(err?.message || "Failed to load product details");
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
      orderType: "simple",
      customization: null,
    });
    setPendingProduct(null);
  };

  return (
    <div>
      {loadError && (
        <div className="wp-notice wp-notice-error" role="alert" style={{ margin: "0 0 10px" }}>
          <p>Couldn&apos;t load products: {loadError}</p>
        </div>
      )}
      <label htmlFor="new-order-product-search" className={labelClass}>Add product</label>
      <div style={{ position: "relative" }}>
        <Search className="w-4 h-4" aria-hidden="true" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#646970", pointerEvents: "none" }} />
        <input
          id="new-order-product-search"
          type="search"
          autoComplete="off"
          placeholder={loading ? "Loading products..." : "Search products by name..."}
          value={search}
          disabled={loading}
          onChange={(e) => setSearch(e.target.value)}
          className={inputClass}
          style={{ paddingLeft: 30 }}
        />
        {matches.length > 0 && (
          <div
            role="listbox"
            aria-label="Matching products"
            style={{ position: "absolute", zIndex: 20, left: 0, right: 0, marginTop: 2, background: "#fff", border: "1px solid #c3c4c7", boxShadow: "0 3px 6px rgba(0,0,0,0.08)", maxHeight: 256, overflowY: "auto" }}
          >
            {matches.map(p => (
              <button
                key={p._id}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => pickProduct(p)}
                className="hover:bg-[#f0f6fc]"
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "6px 10px", minHeight: 44, background: "transparent", border: 0, borderBottom: "1px solid #f0f0f1", cursor: "pointer" }}
              >
                <span className="wp-thumb" style={{ width: 32, height: 32 }}>
                  <img src={p.image || p.images?.[0] || "/placeholder.jpg"} alt="" />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="wp-strong" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  <span className="wp-muted wp-small">${p.price?.toLocaleString()} · Stock: {p.manageStock ? p.stock : "Unmanaged"}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loadingDetail && (
        <p className="wp-muted" style={{ margin: "8px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading product...
        </p>
      )}

      {pendingProduct && (
        <div style={{ marginTop: 10, border: "1px solid #c3c4c7", background: "#fff" }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #dcdcde" }} className="wp-strong">{pendingProduct.name}</div>
          <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0 12px" }}>
            {(pendingProduct.attributes || []).map(attr => (
              <div key={attr.name} className="wp-field">
                <label htmlFor={`new-order-attr-${attr.name}`} className={labelClass}>{attr.name} *</label>
                <select
                  id={`new-order-attr-${attr.name}`}
                  className={selectClass}
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
            <div className="wp-field">
              <label htmlFor="new-order-pending-qty" className={labelClass}>Quantity</label>
              <input id="new-order-pending-qty" type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
            </div>
            <div className="wp-field">
              <label htmlFor="new-order-pending-price" className={labelClass}>Price (editable) *</label>
              <input id="new-order-pending-price" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="wp-box-foot">
            <button type="button" onClick={() => setPendingProduct(null)} className="wp-btn">
              Cancel
            </button>
            <span className="wp-spacer" />
            <button
              type="button"
              onClick={handleAdd}
              disabled={requiredAttrsMissing}
              className="wp-btn wp-btn-primary"
            >
              <Plus className="w-4 h-4" aria-hidden="true" /> Add item
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
  const [customersError, setCustomersError] = useState("");
  const { showConfirm } = usePopup();
  // The last address we filled in automatically (initially the blank form), so we can tell
  // whether the admin has edited the shipping fields themselves.
  const lastAutoAddress = useRef({
    fullName: "", street: "", city: "", state: "", zip: "", country: "United States", phone: ""
  });

  // Generated once per visit to this form so a double-click (or a retried network request)
  // on "Create Order" can't create two orders with two separate stock decrements — the API
  // dedupes on this key the same way customer checkout does.
  useEffect(() => {
    setIdempotencyKey(`admord_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`);
  }, []);

  useEffect(() => {
    // forOrder=true lets staff with orders.create (but not customers.view) load the picker.
    fetch("/api/admin/customers?forOrder=true")
      .then(async r => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error || "Failed to load customers");
        return data;
      })
      .then(data => setCustomers(Array.isArray(data) ? data : []))
      .catch((err) => {
        setCustomers([]);
        setCustomersError(err?.message || "Failed to load customers");
      })
      .finally(() => setLoadingCustomers(false));
  }, []);

  // Choosing an existing customer prefills the shipping address from their default (or
  // first) saved address. If the admin has already typed something different, ask first.
  const handleSelectCustomer = async (id) => {
    setSelectedCustomerId(id);
    const customer = customers.find(c => c._id === id);
    if (!customer) return;
    const prefill = addressFromCustomer(customer, shippingAddress);
    if (!prefill || isSameAddress(prefill, shippingAddress)) return;
    const untouched = isSameAddress(shippingAddress, lastAutoAddress.current);
    if (!untouched) {
      const ok = await showConfirm(
        "Replace the shipping address you've entered with this customer's saved address?",
        "Use saved address?",
        { confirmText: "Replace" }
      );
      if (!ok) return;
    }
    setShippingAddress(prefill);
    lastAutoAddress.current = prefill;
  };

  const removeItem = (key) => setLineItems(prev => prev.filter(i => i.key !== key));
  const updateItem = (key, patch) => setLineItems(prev => prev.map(i => i.key === key ? { ...i, ...patch } : i));

  const subtotal = lineItems.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0);
  const total = subtotal + (Number(shippingCost) || 0);

  // Validation errors show next to the Create Order button and as a toast (the
  // button can be far from the top of the form on a phone).
  const fail = (message) => {
    setError(message);
    toast.error(message);
  };

  const handleSubmit = async () => {
    setError("");

    if (lineItems.length === 0) {
      fail("Add at least one product to the order.");
      return;
    }
    if (!shippingAddress.fullName || !shippingAddress.street || !shippingAddress.city || !shippingAddress.country) {
      fail("Shipping name, street, city, and country are required.");
      return;
    }
    if (customerMode === "existing" && !selectedCustomerId) {
      fail("Select a customer.");
      return;
    }
    if (customerMode === "guest" && !guestEmail) {
      fail("Enter a guest email address.");
      return;
    }
    if (lineItems.some(i => Number(i.price) < 0)) {
      fail("Price cannot be negative.");
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
            customization: i.orderType === "customized" ? i.customization : null,
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
      toast.error(err.message || "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

  const backLink = (
    <Link href="/admin/orders" className="wp-btn">
      <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back to orders
    </Link>
  );

  if (status === "loading") return null;

  if (!can(session?.user, "orders.create")) {
    return (
      <Page>
        <PageHeader title="Add new order" actions={backLink} />
        <Notice type="error">You don&apos;t have permission to create orders.</Notice>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Add new order" actions={backLink} />
      <div className="wp-cols">

        {/* ===================== MAIN COLUMN ===================== */}
        <div className="wp-col-main">

          {/* Order data */}
          <section className="wp-postbox" aria-labelledby="new-order-data-title">
            <div style={{ padding: "16px 16px 0" }}>
              <h2 id="new-order-data-title" style={{ margin: 0, fontSize: 20, fontWeight: 400, color: "#1d2327", lineHeight: 1.3 }}>
                New order details
              </h2>
              <p className="wp-muted" style={{ margin: "4px 0 0" }}>Fields marked * are required.</p>
            </div>

            <div className="wp-order-cols" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>

              {/* General */}
              <div style={{ minWidth: 0 }}>
                <h3>General</h3>
                <fieldset className="wp-field" style={{ border: 0, padding: 0, margin: "0 0 12px" }}>
                  <legend className={labelClass}>Customer</legend>
                  <label className="wp-check">
                    <input type="radio" name="new-order-customer-mode" checked={customerMode === "guest"} onChange={() => setCustomerMode("guest")} />
                    Guest / New
                  </label>
                  <label className="wp-check">
                    <input type="radio" name="new-order-customer-mode" checked={customerMode === "existing"} onChange={() => setCustomerMode("existing")} />
                    Existing customer
                  </label>
                </fieldset>

                {customerMode === "existing" ? (
                  <div className="wp-field">
                    <label htmlFor="new-order-customer" className={labelClass}>Select customer *</label>
                    <select
                      id="new-order-customer"
                      className={selectClass}
                      value={selectedCustomerId}
                      onChange={(e) => handleSelectCustomer(e.target.value)}
                      disabled={loadingCustomers}
                    >
                      <option value="">{loadingCustomers ? "Loading customers..." : "Select a customer..."}</option>
                      {customers.map(c => (
                        <option key={c._id} value={c._id}>{c.name} — {c.email}</option>
                      ))}
                    </select>
                    {customersError && (
                      <div className="wp-notice wp-notice-error" role="alert" style={{ margin: "8px 0 0" }}>
                        <p>Couldn&apos;t load customers: {customersError}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="wp-field">
                    <label htmlFor="new-order-guest-email" className={labelClass}>Email *</label>
                    <input id="new-order-guest-email" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className={inputClass} />
                    <p className="wp-desc">The recipient&apos;s name and phone are taken from the shipping address.</p>
                  </div>
                )}

                <div className="wp-field">
                  <label htmlFor="new-order-payment-status" className={labelClass}>Payment status</label>
                  <select id="new-order-payment-status" className={selectClass} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>

              {/* Shipping */}
              <div style={{ minWidth: 0 }}>
                <h3>Shipping</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0 12px" }}>
                  <div className="wp-field" style={{ gridColumn: "1 / -1" }}>
                    <label htmlFor="new-order-ship-fullName" className={labelClass}>Full name *</label>
                    <input id="new-order-ship-fullName" type="text" value={shippingAddress.fullName} onChange={(e) => setShippingAddress(prev => ({ ...prev, fullName: e.target.value }))} className={inputClass} />
                  </div>
                  <div className="wp-field" style={{ gridColumn: "1 / -1" }}>
                    <label htmlFor="new-order-ship-street" className={labelClass}>Street *</label>
                    <input id="new-order-ship-street" type="text" value={shippingAddress.street} onChange={(e) => setShippingAddress(prev => ({ ...prev, street: e.target.value }))} className={inputClass} />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="new-order-ship-city" className={labelClass}>City *</label>
                    <input id="new-order-ship-city" type="text" value={shippingAddress.city} onChange={(e) => setShippingAddress(prev => ({ ...prev, city: e.target.value }))} className={inputClass} />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="new-order-ship-state" className={labelClass}>State</label>
                    <input id="new-order-ship-state" type="text" value={shippingAddress.state} onChange={(e) => setShippingAddress(prev => ({ ...prev, state: e.target.value }))} className={inputClass} />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="new-order-ship-zip" className={labelClass}>ZIP / Postal code</label>
                    <input id="new-order-ship-zip" type="text" value={shippingAddress.zip} onChange={(e) => setShippingAddress(prev => ({ ...prev, zip: e.target.value }))} className={inputClass} />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="new-order-ship-country" className={labelClass}>Country *</label>
                    <input id="new-order-ship-country" type="text" value={shippingAddress.country} onChange={(e) => setShippingAddress(prev => ({ ...prev, country: e.target.value }))} className={inputClass} />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="new-order-ship-phone" className={labelClass}>Phone</label>
                    <input id="new-order-ship-phone" type="text" value={shippingAddress.phone} onChange={(e) => setShippingAddress(prev => ({ ...prev, phone: e.target.value }))} className={inputClass} />
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* Items */}
          <section className="wp-postbox" aria-labelledby="new-order-items-title">
            <div className="wp-postbox-head">
              <h2 id="new-order-items-title">Items</h2>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="wp-list-table">
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col" className="wp-num" style={{ textAlign: "right" }}>Cost</th>
                    <th scope="col" className="wp-num" style={{ textAlign: "center" }}>Qty</th>
                    <th scope="col" className="wp-num wp-hide-sm" style={{ textAlign: "right" }}>Total</th>
                    <th scope="col" style={{ width: 44 }}><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length === 0 && (
                    <tr><td colSpan={5} className="wp-muted">No items yet. Search for a product below to add it to the order.</td></tr>
                  )}
                  {lineItems.map(item => (
                    <Fragment key={item.key}>
                    <tr>
                      <td style={{ minWidth: 120 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <span className="wp-thumb wp-hide-sm">
                            <img src={item.image || "/placeholder.jpg"} alt="" />
                          </span>
                          <div style={{ minWidth: 0, flex: 1, wordBreak: "break-word" }}>
                            <div className="wp-strong">{item.name}</div>
                            {item.variantTitle && <div className="wp-muted wp-small">{item.variantTitle}</div>}

                            <fieldset style={{ border: 0, padding: 0, margin: "6px 0 0", wordBreak: "normal", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0 12px" }}>
                              <legend className="sr-only">Order type for {item.name}</legend>
                              <span className="wp-muted wp-small" aria-hidden="true">Order type:</span>
                              <label className="wp-check">
                                <input
                                  type="radio"
                                  name={`order-type-${item.key}`}
                                  checked={item.orderType !== "customized"}
                                  onChange={() => updateItem(item.key, { orderType: "simple" })}
                                />
                                Simple
                              </label>
                              <label className="wp-check">
                                <input
                                  type="radio"
                                  name={`order-type-${item.key}`}
                                  checked={item.orderType === "customized"}
                                  onChange={() => updateItem(item.key, { orderType: "customized", customization: item.customization || defaultCustomization() })}
                                />
                                Customized order
                              </label>
                            </fieldset>

                          </div>
                        </div>
                      </td>
                      <td className="wp-num">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          aria-label={`Price for ${item.name}`}
                          value={item.price}
                          onChange={(e) => updateItem(item.key, { price: e.target.value })}
                          className="wp-input"
                          style={{ width: 76, textAlign: "right" }}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="number"
                          min={1}
                          aria-label={`Quantity for ${item.name}`}
                          value={item.quantity}
                          onChange={(e) => updateItem(item.key, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                          className="wp-input"
                          style={{ width: 52, textAlign: "center" }}
                        />
                      </td>
                      <td className="wp-num wp-hide-sm wp-strong" style={{ whiteSpace: "nowrap" }}>
                        {formatMoney((Number(item.price) || 0) * (Number(item.quantity) || 0))}
                      </td>
                      <td style={{ width: 44 }}>
                        <button
                          type="button"
                          onClick={() => removeItem(item.key)}
                          aria-label={`Remove ${item.name}`}
                          title="Remove item"
                          className="wp-btn"
                          style={{ minWidth: 32, padding: "0 6px", color: "#d63638", borderColor: "#d63638" }}
                        >
                          <X className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                    {item.orderType === "customized" && (
                      <tr>
                        <td colSpan={5} style={{ paddingTop: 0 }}>
                          <CustomizationEditor
                            value={item.customization}
                            onChange={(c) => updateItem(item.key, { customization: c })}
                          />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px", borderTop: "1px solid #dcdcde" }}>
              <div style={{ width: "100%", maxWidth: 300 }}>
                <div className="wp-kv">
                  <span className="wp-kv-k wp-muted">Items subtotal</span>
                  <span className="wp-kv-v">{formatMoney(subtotal)}</span>
                </div>
                <div className="wp-kv">
                  <label htmlFor="new-order-shipping-cost" className="wp-kv-k wp-muted">Shipping</label>
                  <input
                    id="new-order-shipping-cost"
                    type="number"
                    min={0}
                    step="0.01"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(e.target.value)}
                    className="wp-input"
                    style={{ width: 100, textAlign: "right" }}
                  />
                </div>
                <div className="wp-kv" style={{ borderTop: "1px solid #dcdcde", marginTop: 4, paddingTop: 10 }}>
                  <span className="wp-kv-k wp-strong">Order total</span>
                  <span className="wp-kv-v" style={{ fontSize: 15 }}>{formatMoney(total)}</span>
                </div>
              </div>
            </div>

            <div className="wp-box-foot" style={{ display: "block" }}>
              <ProductPicker onAdd={(item) => setLineItems(prev => [...prev, item])} />
            </div>
          </section>
        </div>

        {/* ===================== SIDE COLUMN ===================== */}
        <div className="wp-col-side">
          <section className="wp-postbox" aria-labelledby="new-order-actions-title">
            <div className="wp-postbox-head">
              <h2 id="new-order-actions-title">Order actions</h2>
            </div>
            <div className="wp-inside">
              <div className="wp-kv">
                <span className="wp-kv-k wp-muted">Items</span>
                <span className="wp-kv-v">{lineItems.length}</span>
              </div>
              <div className="wp-kv">
                <span className="wp-kv-k wp-muted">Payment</span>
                <span className={`wp-pill wp-pill-sm ${paymentStatus === "Paid" ? "wp-st-paid" : "wp-st-unpaid"}`}>{paymentStatus}</span>
              </div>
              <div className="wp-kv">
                <span className="wp-kv-k wp-muted">Total</span>
                <span className="wp-kv-v">{formatMoney(total)}</span>
              </div>

              <div className="wp-field" style={{ marginTop: 12, marginBottom: 0 }}>
                <label htmlFor="new-order-note" className={labelClass}>Note (optional)</label>
                <textarea id="new-order-note" rows={3} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} className="wp-textarea wp-full" />
              </div>

              {error && (
                <div className="wp-notice wp-notice-error" role="alert" style={{ margin: "12px 0 0" }}>
                  <p>{error}</p>
                </div>
              )}
            </div>
            <div className="wp-box-foot">
              <span className="wp-spacer" />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !idempotencyKey}
                className="wp-btn wp-btn-primary"
              >
                {submitting ? "Creating Order..." : "Create Order"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </Page>
  );
}
