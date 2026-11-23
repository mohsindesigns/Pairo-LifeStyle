// Query builders for the admin Abandoned Carts list (GET /api/admin/abandoned-carts).
// Kept free of DB/Next imports so the filter logic can be unit-tested.

export const ABANDONED_CART_VIEWS = ["active", "recovered", "all", "trash"];

const NOT_DELETED = { isDeleted: { $ne: true } };

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function searchClause(search) {
  const term = String(search || "").trim();
  if (!term) return null;
  const rx = { $regex: escapeRegex(term), $options: "i" };
  return {
    $or: [
      { "contact.email": rx },
      { "contact.firstName": rx },
      { "contact.lastName": rx },
      { "contact.phone": rx },
      { "shippingAddress.fullName": rx },
    ],
  };
}

/** @param {{ view?: string, search?: string }} p */
export function buildAbandonedCartQuery({ view = "active", search = "" } = {}) {
  const v = ABANDONED_CART_VIEWS.includes(view) ? view : "active";
  const and = [v === "trash" ? { isDeleted: true } : NOT_DELETED];
  if (v === "active" || v === "recovered") and.push({ status: v });
  const s = searchClause(search);
  if (s) and.push(s);
  return { $and: and };
}

/** One aggregation returning the count for every view tab (respects search). */
export function buildAbandonedCartCountsPipeline(search) {
  const s = searchClause(search);
  const live = { $ne: ["$isDeleted", true] };
  const countIf = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });
  return [
    ...(s ? [{ $match: s }] : []),
    {
      $group: {
        _id: null,
        active: countIf({ $and: [live, { $eq: ["$status", "active"] }] }),
        recovered: countIf({ $and: [live, { $eq: ["$status", "recovered"] }] }),
        all: countIf(live),
        trash: countIf({ $eq: ["$isDeleted", true] }),
      },
    },
  ];
}

export function emptyAbandonedCartCounts() {
  return Object.fromEntries(ABANDONED_CART_VIEWS.map((k) => [k, 0]));
}
