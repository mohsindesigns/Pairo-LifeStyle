import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import { can } from "@/lib/rbac";
import { BUCKET_FORMATS, BUCKET_UNITS } from "@/lib/admin-dashboard";
import Order from "@/models/Order";
import Product from "@/models/Product";
import Customer from "@/models/Customer";
import Blog from "@/models/Blog";
import Page from "@/models/Page";
import Review from "@/models/Review";
import ProductQuestion from "@/models/ProductQuestion";
import CustomJacketInquiry from "@/models/CustomJacketInquiry";
import CorporateGiftingInquiry from "@/models/CorporateGiftingInquiry";
import AffiliateApplication from "@/models/AffiliateApplication";
import SizeConfirmation from "@/models/SizeConfirmation";

// Cancelled and refunded orders are not sales.
const NOT_SALES = ["Cancelled", "Refunded"];
const MAX_WINDOW_MS = 400 * 24 * 60 * 60 * 1000;

function parseWindow(searchParams) {
  const from = new Date(searchParams.get("from"));
  const to = new Date(searchParams.get("to"));
  const unit = searchParams.get("unit");
  const tz = searchParams.get("tz") || "UTC";
  if (isNaN(from) || isNaN(to) || to <= from || to - from > MAX_WINDOW_MS) return null;
  if (!BUCKET_UNITS.includes(unit)) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    return null;
  }
  const length = to - from;
  return { from, to, unit, tz, prevFrom: new Date(from - length), prevTo: from };
}

async function salesTotals(from, to) {
  const [row] = await Order.aggregate([
    { $match: { createdAt: { $gte: from, $lt: to }, status: { $nin: NOT_SALES }, isDeleted: { $ne: true } } },
    { $group: { _id: null, gross: { $sum: "$financials.total" }, orders: { $sum: 1 } } },
  ]);
  return { gross: row?.gross || 0, orders: row?.orders || 0 };
}

async function salesSection(w) {
  const [current, previous, buckets, topSellers, newCustomers, prevNewCustomers] = await Promise.all([
    salesTotals(w.from, w.to),
    salesTotals(w.prevFrom, w.prevTo),
    Order.aggregate([
      { $match: { createdAt: { $gte: w.from, $lt: w.to }, status: { $nin: NOT_SALES }, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: { $dateToString: { format: BUCKET_FORMATS[w.unit], date: "$createdAt", timezone: w.tz } },
          gross: { $sum: "$financials.total" },
          orders: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: w.from, $lt: w.to }, status: { $nin: NOT_SALES }, isDeleted: { $ne: true } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: { productId: "$items.productId", name: "$items.name" },
          image: { $first: "$items.image" },
          units: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.priceAtPurchase", "$items.quantity"] } },
        },
      },
      { $sort: { units: -1, revenue: -1 } },
      { $limit: 5 },
    ]),
    Customer.countDocuments({ createdAt: { $gte: w.from, $lt: w.to }, role: { $ne: "admin" } }),
    Customer.countDocuments({ createdAt: { $gte: w.prevFrom, $lt: w.prevTo }, role: { $ne: "admin" } }),
  ]);

  return {
    current: { ...current, newCustomers },
    previous: { ...previous, newCustomers: prevNewCustomers },
    buckets: Object.fromEntries(buckets.map((b) => [b._id, { gross: b.gross, orders: b.orders }])),
    topSellers: topSellers.map((t) => ({
      productId: t._id.productId,
      name: t._id.name,
      image: t.image || null,
      units: t.units,
      revenue: t.revenue,
    })),
  };
}

async function ordersSection() {
  const [recent, statusRows] = await Promise.all([
    Order.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(6)
      .select("orderNumber status createdAt financials.total financials.currency shippingAddress.fullName customer.email payment.status")
      .lean(),
    Order.aggregate([{ $match: { isDeleted: { $ne: true } } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  return {
    recent: recent.map((o) => ({
      _id: o._id,
      orderNumber: o.orderNumber,
      status: o.status,
      createdAt: o.createdAt,
      total: o.financials?.total || 0,
      currency: o.financials?.currency || "USD",
      customer: o.shippingAddress?.fullName || o.customer?.email || "Guest",
      paymentStatus: o.payment?.status || "Pending",
    })),
    statusCounts: Object.fromEntries(statusRows.map((r) => [r._id, r.count])),
  };
}

async function stockSection() {
  const products = await Product.find({ isDeleted: { $ne: true }, manageStock: { $ne: false } })
    .select("name stock lowStockThreshold productType variantCombinations.title variantCombinations.stock images image status")
    .limit(1000)
    .lean();

  const low = [];
  for (const p of products) {
    const threshold = p.lowStockThreshold ?? 2;
    const combos = (p.variantCombinations || []).filter((v) => typeof v.stock === "number");
    if (p.productType === "variable" && combos.length) {
      for (const v of combos) {
        if (v.stock <= threshold) low.push({ productId: p._id, name: p.name, variant: v.title, stock: v.stock, threshold });
      }
    } else if ((p.stock ?? 0) <= threshold) {
      low.push({ productId: p._id, name: p.name, variant: null, stock: p.stock ?? 0, threshold });
    }
  }
  low.sort((a, b) => a.stock - b.stock);
  return { lowStock: low.slice(0, 8), lowStockTotal: low.length };
}

// Items that need someone to act on them, newest first. Each source is only queried when the
// viewer may open the page it links to.
async function activitySection(user) {
  const jobs = [];
  const LIMIT = 5;

  if (can(user, "submissions.view")) {
    jobs.push(
      CustomJacketInquiry.find({ status: "New", isDeleted: { $ne: true } }).sort({ createdAt: -1 }).limit(LIMIT)
        .select("firstName lastName jacketType createdAt").lean()
        .then((rows) => rows.map((r) => ({
          kind: "custom-inquiry",
          title: "Custom jacket inquiry",
          text: `from ${[r.firstName, r.lastName].filter(Boolean).join(" ")}${r.jacketType ? `: ${r.jacketType}` : ""}`,
          at: r.createdAt,
          href: "/admin/custom-jacket-inquiries",
          action: "Reply",
        }))),
      CorporateGiftingInquiry.find({ status: "New", isDeleted: { $ne: true } }).sort({ createdAt: -1 }).limit(LIMIT)
        .select("company contactName quantity createdAt").lean()
        .then((rows) => rows.map((r) => ({
          kind: "gifting-inquiry",
          title: "Corporate gifting inquiry",
          text: `from ${r.company || r.contactName}${r.quantity ? `, ${r.quantity} units` : ""}`,
          at: r.createdAt,
          href: "/admin/corporate-gifting-inquiries",
          action: "Open inquiry",
        })))
    );
  }
  if (can(user, "reviews.view")) {
    jobs.push(
      Review.find({ status: "Pending", isDeleted: { $ne: true } }).sort({ createdAt: -1 }).limit(LIMIT)
        .select("rating customerName productId createdAt").populate("productId", "name").lean()
        .then((rows) => rows.map((r) => ({
          kind: "review",
          title: `${r.rating}-star review`,
          text: `by ${r.customerName}${r.productId?.name ? ` on ${r.productId.name}` : ""} is awaiting approval`,
          at: r.createdAt,
          href: "/admin/reviews",
          action: "Moderate",
        })))
    );
  }
  if (can(user, "products.view")) {
    jobs.push(
      ProductQuestion.find({ status: "Pending", isDeleted: { $ne: true } }).sort({ createdAt: -1 }).limit(LIMIT)
        .select("customerName productId createdAt").populate("productId", "name").lean()
        .then((rows) => rows.map((r) => ({
          kind: "question",
          title: "Product question",
          text: `from ${r.customerName}${r.productId?.name ? ` on ${r.productId.name}` : ""}`,
          at: r.createdAt,
          href: "/admin/product-questions",
          action: "Answer",
        })))
    );
  }
  if (can(user, "affiliates.view")) {
    jobs.push(
      AffiliateApplication.find({ status: { $in: ["Pending", "Under Review"] } }).sort({ createdAt: -1 }).limit(LIMIT)
        .select("name createdAt").lean()
        .then((rows) => rows.map((r) => ({
          kind: "affiliate",
          title: "Affiliate application",
          text: `from ${r.name}`,
          at: r.createdAt,
          href: "/admin/affiliates?view=requests",
          action: "Review",
        })))
    );
  }
  if (can(user, "orders.view")) {
    jobs.push(
      SizeConfirmation.find({ unreadReplies: { $gt: 0 } }).sort({ lastReplyAt: -1 }).limit(LIMIT)
        .select("orderId orderNumber customerName customerEmail lastReplyAt updatedAt").lean()
        .then((rows) => rows.map((r) => ({
          kind: "size-reply",
          title: "Size confirmation reply",
          text: `from ${r.customerName || r.customerEmail} on order #${r.orderNumber}`,
          at: r.lastReplyAt || r.updatedAt,
          href: `/admin/orders/${r.orderId}`,
          action: "View order",
        })))
    );
  }

  const groups = await Promise.all(jobs);
  return groups.flat().sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8);
}

async function glanceSection(user) {
  const entries = [];
  if (can(user, "products.view")) {
    entries.push(
      Product.countDocuments({ status: "Published", isDeleted: { $ne: true } }).then((n) => ["publishedProducts", n]),
      Product.countDocuments({ status: "Draft", isDeleted: { $ne: true } }).then((n) => ["draftProducts", n])
    );
  }
  if (can(user, "orders.view")) entries.push(Order.countDocuments({ isDeleted: { $ne: true } }).then((n) => ["orders", n]));
  if (can(user, "customers.view")) entries.push(Customer.countDocuments({ role: { $ne: "admin" } }).then((n) => ["customers", n]));
  if (can(user, "blogs.view")) entries.push(Blog.countDocuments({ isDeleted: { $ne: true } }).then((n) => ["posts", n]));
  if (can(user, "pages.view")) entries.push(Page.estimatedDocumentCount().then((n) => ["pages", n]));
  return Object.fromEntries(await Promise.all(entries));
}

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user;

  const window = parseWindow(new URL(req.url).searchParams);
  if (!window) {
    return NextResponse.json({ success: false, error: "Invalid date range" }, { status: 400 });
  }

  try {
    await dbConnect();
  } catch (error) {
    console.error("Dashboard: database connection failed", error);
    return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 503 });
  }

  // Every section is optional and fails on its own, so one bad query degrades one box
  // instead of blanking the whole dashboard.
  const tasks = {
    glance: glanceSection(user),
    activity: activitySection(user),
  };
  if (can(user, "analytics.view")) tasks.sales = salesSection(window);
  if (can(user, "orders.view")) tasks.orders = ordersSection();
  if (can(user, "products.view")) tasks.stock = stockSection();

  const names = Object.keys(tasks);
  const results = await Promise.allSettled(Object.values(tasks));
  const data = {};
  const errors = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled") data[names[i]] = r.value;
    else {
      console.error(`Dashboard section "${names[i]}" failed`, r.reason);
      errors[names[i]] = "Could not load this section.";
    }
  });

  return NextResponse.json({
    success: true,
    data,
    errors,
    permissions: {
      sales: can(user, "analytics.view"),
      orders: can(user, "orders.view"),
      products: can(user, "products.view"),
    },
  });
}
