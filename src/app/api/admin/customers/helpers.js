// Pure helpers for the admin customers API (no DB access, unit-tested in
// src/__tests__/admin-customers-helpers.test.js).

export const CUSTOMERS_PAGE_SIZE = 20;

// Same pattern the storefront signup route uses.
export const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Reads ?page=&search=&filter= (all | active | trash) from the list request. `paginated` is false when
// no page param is given, so legacy callers (Topbar search, New Order screen)
// keep receiving the full array.
export function parseCustomerListParams(searchParams) {
  const rawPage = searchParams.get("page");
  const paginated = rawPage !== null;
  const page = Math.max(1, parseInt(rawPage, 10) || 1);
  const search = (searchParams.get("search") || "").trim().slice(0, 200);
  const rawFilter = searchParams.get("filter");
  const filter = rawFilter === "active" || rawFilter === "trash" ? rawFilter : "all";
  return { paginated, page, search, filter, limit: CUSTOMERS_PAGE_SIZE };
}

// Base Mongo filter for the list: excludes admins, excludes trashed customers
// (or only trashed ones with trash: true), optional search on name/email/phone,
// optional restriction to ids of customers with orders.
export function buildCustomerFilter({ search = "", activeIds = null, trash = false } = {}) {
  const filter = { role: { $ne: "admin" }, isDeleted: trash ? true : { $ne: true } };
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: "i" };
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  if (activeIds) filter._id = { $in: activeIds };
  return filter;
}

// Validates and normalizes the "Add new customer" payload.
// Returns { errors: string[], value: { name, email, phone, password } }.
export function validateNewCustomer(body = {}) {
  const errors = [];
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  const firstName = str(body.firstName);
  const lastName = str(body.lastName);
  const name = [firstName, lastName].filter(Boolean).join(" ") || str(body.name);
  const email = str(body.email).toLowerCase();
  const phone = str(body.phone);
  const password = typeof body.password === "string" ? body.password : "";

  if (!email) errors.push("Email is required.");
  else if (!EMAIL_PATTERN.test(email)) errors.push("Please provide a valid email address.");
  if (password.length < 8) errors.push("Password must be at least 8 characters.");
  if (phone && !/^[0-9+()\-.\s]{4,30}$/.test(phone)) errors.push("Please provide a valid phone number.");

  // Customer.name is required by the model; fall back to the email's local part.
  return { errors, value: { name: name || email.split("@")[0], email, phone, password } };
}

export function totalPages(total, limit = CUSTOMERS_PAGE_SIZE) {
  return Math.max(1, Math.ceil((Number(total) || 0) / limit));
}

// DELETE ?mode= for a customer: "trash" (soft delete) or "permanent" (hard delete,
// only allowed once the customer is already in the Trash). Anything else -> "trash".
export function parseCustomerDeleteMode(value) {
  return value === "permanent" ? "permanent" : "trash";
}
