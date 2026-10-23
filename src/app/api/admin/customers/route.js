import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Customer from "@/models/Customer";
import Order from "@/models/Order";
import { can } from "@/lib/rbac";
import { sanitizeText } from "@/lib/sanitize";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  parseCustomerListParams,
  buildCustomerFilter,
  escapeRegex,
  validateNewCustomer,
  totalPages,
} from "./helpers";

// Adds orderCount / totalSpent / lastOrderDate from the Orders collection.
async function enrichWithOrderStats(customers) {
  return Promise.all(customers.map(async (customer) => {
    try {
      // Find orders for this specific customer
      const orders = await Order.find({ "customer.userId": customer._id, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).lean();

      return {
        ...customer,
        orderCount: orders.length,
        totalSpent: orders.reduce((sum, o) => sum + (o.financials?.total || 0), 0),
        lastOrderDate: orders[0]?.createdAt || null
      };
    } catch (e) {
      console.error(`Error enriching customer ${customer.email}:`, e.message);
      return { ...customer, orderCount: 0, totalSpent: 0, lastOrderDate: null };
    }
  }));
}

// Ids of customers with at least one non-cancelled order ("Active Customers").
async function getActiveCustomerIds() {
  return Order.distinct("customer.userId", {
    "customer.userId": { $ne: null },
    status: { $ne: "Cancelled" },
    isDeleted: { $ne: true },
  });
}

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!can(session.user, "customers.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { paginated, page, search, filter, limit } = parseCustomerListParams(new URL(req.url).searchParams);

  await dbConnect();
  try {
    // Legacy shape (no ?page): full array, used by Topbar search and New Order screen.
    if (!paginated) {
      const customers = await Customer.find({ role: { $ne: "admin" } })
          .select('-password')
          .sort({ createdAt: -1 })
          .lean();

      if (!customers || customers.length === 0) {
          return NextResponse.json([]);
      }
      return NextResponse.json(await enrichWithOrderStats(customers));
    }

    // Paginated list for the Customers screen.
    const activeIds = await getActiveCustomerIds();
    const listFilter = buildCustomerFilter({ search, activeIds: filter === "active" ? activeIds : null });

    const [total, allCount, activeCount] = await Promise.all([
      Customer.countDocuments(listFilter),
      Customer.countDocuments(buildCustomerFilter()),
      Customer.countDocuments(buildCustomerFilter({ activeIds })),
    ]);

    const pages = totalPages(total, limit);
    const currentPage = Math.min(page, pages);
    const customers = await Customer.find(listFilter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * limit)
        .limit(limit)
        .lean();

    return NextResponse.json({
      customers: await enrichWithOrderStats(customers),
      total,
      page: currentPage,
      pages,
      limit,
      counts: { all: allCount, active: activeCount },
    });
  } catch (error) {
    console.error("[Customer API Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Admin "Add new customer". Customers have no separate create permission in the
// RBAC matrix, so creation requires customers.edit.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!can(session.user, "customers.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { errors, value } = validateNewCustomer(body);
  if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });

  await dbConnect();
  try {
    // Case-insensitive uniqueness check (older records may not be lowercased).
    const existing = await Customer.findOne({
      email: { $regex: `^${escapeRegex(value.email)}$`, $options: "i" },
    }).select("_id").lean();
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    // Same hashing as storefront signup (src/app/api/auth/signup/route.js).
    const hashedPassword = await bcrypt.hash(value.password, 12);

    const customer = await Customer.create({
      name: sanitizeText(value.name) || value.email.split("@")[0],
      email: value.email,
      phone: value.phone || null,
      password: hashedPassword,
      // Created by staff, so the account can sign in without the email-verification step.
      emailVerified: true,
      role: "user",
    });

    const { password: _password, ...safe } = customer.toObject();
    return NextResponse.json(safe, { status: 201 });
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    console.error("[Customer API Create Error]:", error);
    return NextResponse.json({ error: "Failed to create customer." }, { status: 500 });
  }
}
