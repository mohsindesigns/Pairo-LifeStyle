import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Affiliate from "@/models/Affiliate";
import AffiliateApplication from "@/models/AffiliateApplication";
import AffiliateClick from "@/models/AffiliateClick";
import AffiliateCommission from "@/models/AffiliateCommission";
import AffiliatePayout from "@/models/AffiliatePayout";
import Order from "@/models/Order";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac";

export async function GET(req) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isStaff || !can(session.user, "affiliates.view")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Run all stats queries in parallel for performance
    const [
      totalAffiliates,
      activeAffiliates,
      pendingApplications,
      approvedApplications,
      rejectedApplications,
      totalClicks,
      totalReferralOrders,
      commissionStats,
      payoutStats,
      topAffiliates,
      recentApplications,
      recentOrders,
      recentPayouts,
      revenueStats,
      monthlyClicks,
      monthlyOrders
    ] = await Promise.all([
      Affiliate.countDocuments({ isDeleted: { $ne: true } }),
      Affiliate.countDocuments({ status: 'Active', isDeleted: { $ne: true } }),
      AffiliateApplication.countDocuments({ status: 'Pending' }),
      AffiliateApplication.countDocuments({ status: 'Approved' }),
      AffiliateApplication.countDocuments({ status: 'Rejected' }),
      AffiliateClick.countDocuments(),
      Order.countDocuments({ affiliateId: { $ne: null } }),

      // Commission amounts by status
      AffiliateCommission.aggregate([
        { $group: { _id: "$status", total: { $sum: "$commissionAmount" } } }
      ]),

      // Payout amounts by status
      AffiliatePayout.aggregate([
        { $group: { _id: "$status", total: { $sum: "$amount" } } }
      ]),

      // Top 5 affiliates by lifetime earnings
      Affiliate.find({ isDeleted: { $ne: true } })
        .sort({ lifetimeEarnings: -1 })
        .limit(5)
        .select("name email referralCode commissionRate commissionType balance lifetimeEarnings profilePhoto")
        .lean(),

      // Recent 5 applications
      AffiliateApplication.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("name email status referralCode createdAt profilePhoto")
        .lean(),

      // Recent 5 referred orders
      Order.find({ affiliateId: { $ne: null } })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("affiliateId", "name referralCode")
        .select("orderNumber status financials.total affiliateId affiliateReferralCode createdAt")
        .lean(),

      // Recent 5 payout requests
      AffiliatePayout.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("affiliateId", "name referralCode")
        .select("amount paymentMethod status affiliateId createdAt")
        .lean(),

      // Total revenue from referred orders
      Order.aggregate([
        { $match: { affiliateId: { $ne: null } } },
        { $group: { _id: null, total: { $sum: "$financials.total" } } }
      ]),

      // Monthly clicks trend (last 6 months)
      AffiliateClick.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ]),

      // Monthly orders trend (last 6 months)
      Order.aggregate([
        { $match: { affiliateId: { $ne: null }, createdAt: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ])
    ]);

    // Format commission stats
    const commissionMap = {};
    commissionStats.forEach(g => { commissionMap[g._id] = g.total || 0; });
    const totalCommissionPaid = commissionMap['Approved'] || 0;
    const pendingCommission = commissionMap['Pending'] || 0;

    // Format payout stats
    const payoutMap = {};
    payoutStats.forEach(g => { payoutMap[g._id] = g.total || 0; });
    const totalPaid = payoutMap['Paid'] || 0;

    // Revenue
    const totalRevenue = revenueStats[0]?.total || 0;

    // Conversion rate
    const conversionRate = totalClicks > 0 ? ((totalReferralOrders / totalClicks) * 100).toFixed(1) : 0;

    // Merge monthly chart data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const clickMap = {};
    const orderMap = {};
    monthlyClicks.forEach(m => { clickMap[`${m._id.year}-${m._id.month}`] = m.count; });
    monthlyOrders.forEach(m => { orderMap[`${m._id.year}-${m._id.month}`] = m.count; });

    const now = new Date();
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      chartData.push({
        month: months[d.getMonth()],
        clicks: clickMap[key] || 0,
        orders: orderMap[key] || 0
      });
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalAffiliates,
        activeAffiliates,
        pendingApplications,
        approvedApplications,
        rejectedApplications,
        totalClicks,
        totalReferralOrders,
        totalRevenue,
        totalCommissionPaid,
        pendingCommission,
        totalPaid,
        conversionRate: Number(conversionRate)
      },
      topAffiliates,
      recentApplications,
      recentOrders,
      recentPayouts,
      chartData
    });

  } catch (error) {
    console.error("[AdminAffiliateOverview GET Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
