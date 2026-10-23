// Pure helpers for the admin coupons screen (no React, no DB) so they can be unit-tested.

const toId = (x) => (typeof x === "object" && x?._id ? String(x._id) : String(x));

// Stored Date (or ISO string) -> "YYYY-MM-DD", the format the coupons API expects.
// Matches how the edit form pre-fills its date inputs.
export function toDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

// Prefers the real specificCustomerEmails field; falls back to deriving from populated
// specificCustomers (ObjectId refs with .email) for any coupon saved before that field
// existed. Used everywhere a discount's customer-restriction list needs to become the
// comma-separated string the form/duplicate payloads work with.
export function deriveCustomerEmailsString(discount) {
  if (discount.specificCustomerEmails && discount.specificCustomerEmails.length > 0) {
    return discount.specificCustomerEmails.join(", ");
  }
  if (discount.specificCustomers && discount.specificCustomers.length > 0) {
    return discount.specificCustomers.map(c => typeof c === 'object' ? c.email : c).join(", ");
  }
  return "";
}

// Builds the POST body for duplicating a coupon. Only admin-editable fields are copied —
// never _id, isDeleted, usageCount, Stripe sync fields, notified/redeemed lists, timestamps.
// The copy starts inactive; `duplicate: true` tells the server to derive a unique
// "<CODE>-COPY" / "<CODE>-COPY-2" … code from `code`.
export function buildDuplicatePayload(d) {
  return {
    duplicate: true,
    code: d.code,
    type: d.type || "percentage",
    value: d.value,
    minPurchase: d.minPurchase ?? "",
    usageLimit: d.usageLimit ?? "",
    usagePerUserLimit: d.usagePerUserLimit ?? "",
    startDate: toDateInput(d.startDate),
    endDate: toDateInput(d.endDate),
    isActive: false,
    firstOrderOnly: !!d.firstOrderOnly,
    userRegistrationRequired: !!d.userRegistrationRequired,
    newsletterSubscribedOnly: !!d.newsletterSubscribedOnly,
    specificProducts: Array.isArray(d.specificProducts) ? d.specificProducts.map(toId).filter(Boolean) : [],
    specificCategories: Array.isArray(d.specificCategories) ? d.specificCategories.map(toId).filter(Boolean) : [],
    maxDiscountAmount: d.maxDiscountAmount ?? "",
    minQuantity: d.minQuantity ?? "",
    excludeSaleItems: !!d.excludeSaleItems,
    // A duplicate carries over who it's restricted to, but not who's already been notified.
    specificCustomerEmails: deriveCustomerEmailsString(d),
    oneRedemptionPerDevice: !!d.oneRedemptionPerDevice,
  };
}

// n-th candidate code for a duplicate: CODE-COPY, CODE-COPY-2, CODE-COPY-3, …
export function copyCodeCandidate(code, n) {
  const base = `${String(code || "").toUpperCase().trim()}-COPY`;
  return n <= 1 ? base : `${base}-${n}`;
}

// Quick Edit total-limit check: blank = unlimited, otherwise a whole number >= 1.
export function isValidUsageLimitInput(value) {
  if (value === "" || value === null || value === undefined) return true;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1;
}
