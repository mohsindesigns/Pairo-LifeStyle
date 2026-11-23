// Query builders for the admin Orders list (GET /api/admin/orders).
// Kept free of DB/Next imports so the filter logic can be unit-tested.

const NOT_DELETED = { isDeleted: { $ne: true } };

// An order is "referred" when it carries any affiliate attribution.
const REFERRED = {
  $or: [
    { affiliateReferralCode: { $nin: [null, ""] } },
    { affiliateId: { $ne: null } },
  ],
};
const NON_REFERRED = {
  affiliateReferralCode: { $in: [null, ""] },
  affiliateId: null,
};

// Status tabs on the list. "Completed" = Delivered (the final, successful status).
export const ORDER_STATUS_TABS = ["all", "Processing", "Delivered", "Cancelled", "affiliate", "trash"];

// The search box text is matched literally (never as a pattern) and capped in length: a pattern such as "(a+)+$"
// can otherwise tie the database up.
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function searchClause(search) {
  const term = typeof search === "string" ? search.trim().slice(0, 100) : "";
  if (!term) return null;
  const rx = { $regex: escapeRegex(term), $options: "i" };
  return {
    $or: [
      { orderNumber: rx },
      { "customer.email": rx },
      { "shippingAddress.fullName": rx },
    ],
  };
}

/**
 * @param {{ status?: string, search?: string, referral?: string, trash?: boolean, affiliateOnly?: boolean }} p
 */
export function buildOrderListQuery({ status, search, referral, trash = false, affiliateOnly = false } = {}) {
  const and = [trash ? { isDeleted: true } : NOT_DELETED];

  if (status && status !== "all") and.push({ status });
  if (affiliateOnly || referral === "referred") and.push(REFERRED);
  else if (referral === "non-referred") and.push(NON_REFERRED);

  const s = searchClause(search);
  if (s) and.push(s);

  return { $and: and };
}

const hasAttribution = {
  $or: [
    { $ne: [{ $ifNull: ["$affiliateReferralCode", ""] }, ""] },
    { $ne: [{ $ifNull: ["$affiliateId", null] }, null] },
  ],
};

/**
 * One aggregation returning the count for every status tab (respects search,
 * not the status/referral filters, so each tab shows its own total).
 */
export function buildOrderCountsPipeline(search) {
  const s = searchClause(search);
  const live = { $ne: ["$isDeleted", true] };
  const countIf = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });
  const statusIs = (st) => ({ $and: [live, { $eq: ["$status", st] }] });

  return [
    ...(s ? [{ $match: s }] : []),
    {
      $group: {
        _id: null,
        all: countIf(live),
        Processing: countIf(statusIs("Processing")),
        Delivered: countIf(statusIs("Delivered")),
        Cancelled: countIf(statusIs("Cancelled")),
        affiliate: countIf({ $and: [live, hasAttribution] }),
        trash: countIf({ $eq: ["$isDeleted", true] }),
      },
    },
  ];
}

export function emptyOrderCounts() {
  return Object.fromEntries(ORDER_STATUS_TABS.map((k) => [k, 0]));
}
