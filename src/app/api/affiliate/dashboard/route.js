import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Affiliate from "@/models/Affiliate";
import AffiliateClick from "@/models/AffiliateClick";
import AffiliateCommission from "@/models/AffiliateCommission";
import AffiliatePayout from "@/models/AffiliatePayout";
import Order from "@/models/Order";
import { NextResponse } from "next/server";

export async function GET(req) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isAffiliate) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const affiliate = await Affiliate.findById(session.user.id).lean();
    if (!affiliate) {
      return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });
    }

    if (affiliate.status !== 'Active') {
      return NextResponse.json({ error: "Unauthorized: Account suspended or inactive" }, { status: 403 });
    }

    const affiliateId = affiliate._id;

    // 1. Gather counts and balances in parallel
    const [
      clicksCount,
      ordersCount,
      commissionsSummary,
      payoutsSummary
    ] = await Promise.all([
      AffiliateClick.countDocuments({ affiliateId }),
      Order.countDocuments({ affiliateId }),
      AffiliateCommission.aggregate([
        { $match: { affiliateId } },
        { $group: {
            _id: "$status",
            totalAmount: { $sum: "$commissionAmount" }
          }
        }
      ]),
      AffiliatePayout.aggregate([
        { $match: { affiliateId } },
        { $group: {
            _id: "$status",
            totalAmount: { $sum: "$amount" }
          }
        }
      ])
    ]);

    // Format aggregations
    let pendingCommissions = 0;
    let approvedCommissions = 0;
    let reversedCommissions = 0;

    commissionsSummary.forEach(group => {
      if (group._id === 'Pending') pendingCommissions = group.totalAmount;
      if (group._id === 'Approved') approvedCommissions = group.totalAmount;
      if (group._id === 'Reversed') reversedCommissions = group.totalAmount;
    });

    let requestedPayouts = 0;
    let paidPayouts = 0;

    payoutsSummary.forEach(group => {
      if (group._id === 'Requested' || group._id === 'Under Review' || group._id === 'Approved') {
        requestedPayouts += group.totalAmount;
      }
      if (group._id === 'Paid') {
        paidPayouts = group.totalAmount;
      }
    });

    // 2. Fetch the 6-Month Click & Conversion Trend Chart
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [clicksTrend, ordersTrend] = await Promise.all([
      AffiliateClick.aggregate([
        { $match: { affiliateId, createdAt: { $gte: sixMonthsAgo } } },
        { $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ]),
      Order.aggregate([
        { $match: { affiliateId, createdAt: { $gte: sixMonthsAgo } } },
        { $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ])
    ]);

    // Align monthly metrics for UI chart consumption
    const monthsName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const chartData = [];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();

      const clickMatch = clicksTrend.find(c => c._id.year === y && c._id.month === m);
      const orderMatch = ordersTrend.find(o => o._id.year === y && o._id.month === m);

      chartData.push({
        month: `${monthsName[m - 1]} ${y}`,
        clicks: clickMatch ? clickMatch.count : 0,
        conversions: orderMatch ? orderMatch.count : 0
      });
    }

    // 3. Conversion rates
    const conversionRate = clicksCount > 0 ? Math.round((ordersCount / clicksCount) * 10000) / 100 : 0;

    return NextResponse.json({
      success: true,
      profile: {
        name: affiliate.name,
        email: affiliate.email,
        referralCode: affiliate.referralCode,
        couponCode: affiliate.couponCode || null,
        balance: affiliate.balance,
        lifetimeEarnings: affiliate.lifetimeEarnings
      },
      metrics: {
        clicks: clicksCount,
        conversions: ordersCount,
        conversionRate,
        pendingCommissions,
        approvedCommissions,
        reversedCommissions,
        requestedPayouts,
        paidPayouts
      },
      chartData
    });

  } catch (error) {
    console.error("[AffiliateDashboard API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
