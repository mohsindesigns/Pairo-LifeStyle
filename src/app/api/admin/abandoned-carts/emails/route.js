import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import AbandonedCart from "@/models/AbandonedCart";
import AbandonedCartEmailLog from "@/models/AbandonedCartEmailLog";
import { can } from "@/lib/rbac";
import { buildCsv } from "@/lib/csv-escape";
import { getFromAddress, isSmtpConfigured } from "@/lib/email";
import { getAbandonedCartSettings, getLastScan } from "@/lib/abandonedCartSettings";
import { getAbandonedCartDiagnostics, getWaitingCarts } from "@/lib/abandonedCartService";

export const dynamic = "force-dynamic";

const STATUSES = ["sent", "failed", "skipped", "gave-up"];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Emails sent before the activity log existed only left a "sent" flag on the cart. Turn those into log rows once so
 * the activity list is complete from the very first email. Idempotent: only carts without any log row are added.
 */
let backfill = null;
function ensureLegacyLogs() {
  // One shared promise: concurrent first requests must not each insert the same rows.
  backfill ||= (async () => {
    const logged = await AbandonedCartEmailLog.distinct("cartId", { status: "sent" });
    // Anything claimed in the last few minutes is being logged by the sender right now: leave it alone.
    const settled = new Date(Date.now() - 10 * 60 * 1000);
    const legacy = await AbandonedCart.find({
      "recoveryEmail.sent": true,
      $or: [{ "recoveryEmail.sentAt": null }, { "recoveryEmail.sentAt": { $lt: settled } }],
      _id: { $nin: logged },
    })
      .select("contact shippingAddress items cartTotal recoveryEmail createdAt")
      .limit(2000)
      .lean();
    if (!legacy.length) return;
    await AbandonedCartEmailLog.bulkWrite(
      legacy.map((c) => {
        const when = c.recoveryEmail?.sentAt || c.createdAt || new Date();
        const items = Array.isArray(c.items) ? c.items : [];
        return {
          updateOne: {
            filter: { cartId: c._id, reason: "logged-before-activity-tracking" },
            update: {
              $setOnInsert: {
                email: String(c.contact?.email || "").toLowerCase(),
                firstName: c.contact?.firstName || String(c.shippingAddress?.fullName || "").split(" ")[0] || "",
                status: "sent",
                trigger: "cron",
                voucherCode: c.recoveryEmail?.voucherCode || "",
                voucherKind: "",
                cartTotal: Number(c.cartTotal) || 0,
                itemCount: items.reduce((n, i) => n + (Number(i.quantity) || 1), 0),
                itemNames: items.slice(0, 4).map((i) => String(i.name || "").slice(0, 80)).filter(Boolean),
                createdAt: when,
                updatedAt: when,
              },
            },
            upsert: true,
            timestamps: false,
          },
        };
      }),
      { ordered: false }
    );
  })().catch((err) => {
    backfill = null; // try again on the next request
    console.error("[AbandonedCart] legacy log backfill:", err.message);
  });
  return backfill;
}

// GET /api/admin/abandoned-carts/emails?status=all|sent|failed|skipped|gave-up&search=&page=&limit=&format=csv
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "orders.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await dbConnect();
    await ensureLegacyLogs();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";
    const search = (searchParams.get("search") || "").trim().slice(0, 100);
    const query = {};
    if (STATUSES.includes(status)) query.status = status;
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: "i" };
      query.$or = [{ email: rx }, { voucherCode: rx }, { firstName: rx }, { error: rx }, { messageId: rx }];
    }

    // CSV export: everything that matches (up to 5000 rows), formula-injection safe.
    if (searchParams.get("format") === "csv") {
      const rows = await AbandonedCartEmailLog.find(query).sort({ createdAt: -1 }).limit(5000).lean();
      const head = ["Date (UTC)", "Email", "Name", "Status", "Reason", "Trigger", "Attempt", "Voucher", "Voucher type", "Discount", "Cart total", "Items", "Subject", "Message ID", "Mail server response", "Error"];
      const csv = buildCsv([
        head,
        ...rows.map((r) => [
          new Date(r.createdAt).toISOString(), r.email, r.firstName, r.status, r.reason, r.trigger, r.attempt, r.voucherCode, r.voucherKind,
          r.discountLabel, r.cartTotal, (r.itemNames || []).join(" | "), r.subject, r.messageId, r.smtpResponse, r.error,
        ]),
      ]);
      return new NextResponse(csv, {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="abandoned-cart-emails-${new Date().toISOString().slice(0, 10)}.csv"` },
      });
    }

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10) || 25));
    const dayAgo = new Date(Date.now() - 24 * 3600e3);

    const [items, total, grouped, sentToday, settings, lastScan, diagnostics, waiting] = await Promise.all([
      AbandonedCartEmailLog.find(query).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AbandonedCartEmailLog.countDocuments(query),
      AbandonedCartEmailLog.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      AbandonedCartEmailLog.countDocuments({ status: "sent", createdAt: { $gte: dayAgo } }),
      getAbandonedCartSettings(),
      getLastScan(),
      getAbandonedCartDiagnostics(),
      getWaitingCarts({ limit: 25 }),
    ]);

    const counts = { all: 0, sent: 0, failed: 0, skipped: 0, "gave-up": 0 };
    for (const g of grouped) {
      if (g._id in counts) counts[g._id] = g.count;
      counts.all += g.count;
    }

    return NextResponse.json({
      success: true,
      items,
      counts,
      sentLast24h: sentToday,
      pagination: { total, pages: Math.max(1, Math.ceil(total / limit)), currentPage: page },
      settings,
      scheduler: {
        lastScan,
        lastScanAgeMinutes: lastScan?.at ? Math.max(0, Math.round((Date.now() - new Date(lastScan.at).getTime()) / 60000)) : null,
        builtInScheduler: process.env.NODE_ENV === "production" && !/^(1|true)$/i.test(String(process.env.DISABLE_INTERNAL_SCHEDULER || "")),
      },
      mail: { smtpConfigured: isSmtpConfigured(), sender: getFromAddress() },
      diagnostics,
      waiting,
    });
  } catch (err) {
    console.error("[/api/admin/abandoned-carts/emails GET]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
