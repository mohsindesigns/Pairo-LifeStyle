// Helpers for the admin "Add new order" screen: build a shipping-address form value from
// an existing customer's saved addresses.

const FIELDS = ["fullName", "street", "city", "state", "zip", "country", "phone"];

/**
 * Returns the order-form shipping address for `customer`, using their default saved
 * address (or the first one). Returns null when the customer has no saved address.
 * `current` supplies fallbacks for fields the saved address doesn't have.
 */
export function addressFromCustomer(customer, current = {}) {
  const addresses = Array.isArray(customer?.addresses) ? customer.addresses : [];
  const addr = addresses.find(a => a?.isDefault) || addresses[0];
  if (!addr) return null;
  return {
    fullName: addr.fullName || customer.name || "",
    street: addr.street || "",
    city: addr.city || "",
    state: addr.state || "",
    zip: addr.zipCode || addr.zip || "",
    country: addr.country || current.country || "",
    phone: addr.phone || customer.phone || "",
  };
}

export function isSameAddress(a = {}, b = {}) {
  return FIELDS.every(f => String(a?.[f] ?? "").trim() === String(b?.[f] ?? "").trim());
}
