import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import Customer from "@/models/Customer";
import Blog from "@/models/Blog";
import SiteConfig from "@/models/SiteConfig";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { can } from "@/lib/rbac";

const DAY_MS = 86400000;

// Store currency: the configured store currency, else the most recent order's currency, else USD.
async function resolveStoreCurrency() {
  const config = await SiteConfig.findOne({ key: "main" }).select("commerce.storeCurrency").lean();
  if (config?.commerce?.storeCurrency) return config.commerce.storeCurrency;
  const order = await Order.findOne({ isDeleted: { $ne: true }, "financials.currency": { $nin: [null, ""] } })
    .sort({ createdAt: -1 })
    .select("financials.currency")
    .lean();
  return order?.financials?.currency || "USD";
}

// Every UTC day from `since` through `until` (inclusive), with 0 for days that had no sales.
// $dateToString groups by UTC day, so the keys are built in UTC to match.
function fillSalesByDay(rows = [], since, until) {
  const byDay = new Map(rows.map((r) => [r._id, r]));
  const out = [];
  const start = Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate());
  for (let t = start; t <= until.getTime(); t += DAY_MS) {
    const key = new Date(t).toISOString().slice(0, 10);
    out.push(byDay.get(key) || { _id: key, revenue: 0, orders: 0 });
  }
  return out;
}

export async function GET(req) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);

    if (!session || !session.user.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!can(session.user, "analytics.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(new Date().setDate(now.getDate() - 30));
    const sevenDaysAgo = new Date(new Date().setDate(now.getDate() - 7));

    // Run all queries in parallel for performance
    const [stats, totalProducts, totalUsers, totalBlogs, recentOrders, statusBreakdown, currency] = await Promise.all([

      // 1. Order Aggregation
      Order.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $facet: {
            overall: [
              {
                $group: {
                  _id: null,
                  totalRevenue: { $sum: "$financials.total" },
                  totalOrders: { $count: {} },
                  avgOrderValue: { $avg: "$financials.total" }
                }
              }
            ],
            last30Days: [
              { $match: { createdAt: { $gte: thirtyDaysAgo } } },
              {
                $group: {
                  _id: null,
                  revenue: { $sum: "$financials.total" },
                  count: { $count: {} }
                }
              }
            ],
            last7Days: [
              { $match: { createdAt: { $gte: sevenDaysAgo } } },
              {
                $group: {
                  _id: null,
                  revenue: { $sum: "$financials.total" },
                  count: { $count: {} }
                }
              }
            ],
            salesByDay: [
              { $match: { createdAt: { $gte: thirtyDaysAgo } } },
              {
                $group: {
                  _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                  revenue: { $sum: "$financials.total" },
                  orders: { $count: {} }
                }
              },
              { $sort: { "_id": 1 } }
            ],
            topProducts: [
              { $unwind: "$items" },
              {
                $group: {
                  _id: "$items.name",
                  unitsSold: { $sum: "$items.quantity" },
                  revenue: { $sum: { $multiply: ["$items.priceAtPurchase", "$items.quantity"] } }
                }
              },
              { $sort: { unitsSold: -1 } },
              { $limit: 5 }
            ],
            variantInsights: [
              { $unwind: "$items" },
              {
                $group: {
                  _id: {
                    name: "$items.name",
                    variant: "$items.selectedVariant.title"
                  },
                  unitsSold: { $sum: "$items.quantity" }
                }
              },
              { $sort: { unitsSold: -1 } },
              { $limit: 8 }
            ]
          }
        }
      ]),

      // 2. Total Published Products
      Product.countDocuments({ status: "Published", isDeleted: { $ne: true } }),

      // 3. Total Customers (non-admin)
      Customer.countDocuments({ role: { $ne: "admin" } }),

      // 4. Total Blogs
      Blog.countDocuments({ isDeleted: { $ne: true } }),

      // 5. Recent 5 Orders
      Order.find({ isDeleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("orderNumber status createdAt financials customer shippingAddress"),

      // 6. Order Status Breakdown
      Order.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: "$status", count: { $count: {} } } },
        { $sort: { count: -1 } }
      ]),

      // 7. Store currency for formatting money on the client
      resolveStoreCurrency()
    ]);

    const facets = stats[0] || {};

    return NextResponse.json({
      success: true,
      data: {
        ...facets,
        salesByDay: fillSalesByDay(facets.salesByDay, thirtyDaysAgo, now),
        currency,
        totalProducts,
        totalCustomers: totalUsers,
        totalBlogs,
        recentOrders,
        statusBreakdown
      }
    });

  } catch (error) {
    console.error("Analytics Fetch Error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
