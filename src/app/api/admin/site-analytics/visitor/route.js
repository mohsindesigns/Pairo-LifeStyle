import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import { can } from "@/lib/rbac";
import { isBounced } from "@/lib/analyticsDimensions";
import AnalyticsSession from "@/models/AnalyticsSession";
import AnalyticsPageView from "@/models/AnalyticsPageView";
import AnalyticsEvent from "@/models/AnalyticsEvent";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "analytics.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const visitorId = new URL(req.url).searchParams.get("visitorId") || "";
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(visitorId)) {
    return NextResponse.json({ error: "Invalid visitorId" }, { status: 400 });
  }

  try {
    await dbConnect();

    const sessions = await AnalyticsSession.find({ visitorId })
      .sort({ startedAt: -1 })
      .limit(20)
      .lean();
    const sessionIds = sessions.map((s) => s.sessionId);

    const [pageViews, events] = await Promise.all([
      AnalyticsPageView.find({ sessionId: { $in: sessionIds } })
        .sort({ enteredAt: 1 })
        .limit(500)
        .select("sessionId path title pageType enteredAt engagedMs maxScrollPct referrer device source")
        .lean(),
      AnalyticsEvent.find({ sessionId: { $in: sessionIds } })
        .sort({ createdAt: 1 })
        .limit(1000)
        .select("sessionId pageViewId name path pageType label href section durationMs fieldName filled value currency items search_term createdAt")
        .lean(),
    ]);

    const sessionsOut = sessions.map((s) => {
      const views = pageViews.filter((p) => p.sessionId === s.sessionId);
      const evs = events.filter((e) => e.sessionId === s.sessionId);
      const byView = new Map(views.map((p) => [String(p._id), []]));
      const unassigned = [];
      for (const e of evs) {
        const key = e.pageViewId ? String(e.pageViewId) : null;
        if (key && byView.has(key)) byView.get(key).push(e);
        else unassigned.push(e);
      }
      return {
        session: { ...s, bounced: isBounced(s) },
        pageViews: views.map((p) => ({ ...p, activity: byView.get(String(p._id)) })),
        unassigned,
      };
    });

    const identified = sessions.find((s) => s.userId);
    return NextResponse.json({
      success: true,
      visitorId,
      user: identified ? { id: identified.userId, name: identified.userName, email: identified.userEmail } : null,
      sessions: sessionsOut,
    });
  } catch (error) {
    console.error("Visitor journey error:", error);
    return NextResponse.json({ error: "Failed to load journey" }, { status: 500 });
  }
}
