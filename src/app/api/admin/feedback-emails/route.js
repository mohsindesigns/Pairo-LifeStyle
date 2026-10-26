import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { can } from "@/lib/rbac";
import { getFeedbackAudience, getCampaignProgress, getRecentFeedbackLog, startFeedbackCampaign, sendFeedbackTest, isSmtpConfigured } from "@/lib/feedbackEmailService";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "orders.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const [{ counts }, log] = await Promise.all([getFeedbackAudience(), getRecentFeedbackLog(25)]);
    return NextResponse.json({ success: true, counts, progress: getCampaignProgress(), log, smtpConfigured: isSmtpConfigured() });
  } catch (err) {
    console.error("[feedback-emails GET]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST { action: "start" } sends to everyone not yet asked (in the background); { action: "test", email } sends a sample.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(can(session.user, "orders.update") || can(session.user, "orders.edit"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "test") {
      const result = await sendFeedbackTest(body.email, session.user.id);
      return NextResponse.json(result.sent ? { success: true } : { success: false, error: result.error }, { status: result.sent ? 200 : 400 });
    }
    if (body.action === "start") {
      if (!isSmtpConfigured()) return NextResponse.json({ error: "Email is not set up on the server, so nothing can be sent." }, { status: 400 });
      const result = await startFeedbackCampaign({ staffId: session.user.id });
      return NextResponse.json({ success: result.started, ...result }, { status: result.started ? 202 : 409 });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[feedback-emails POST]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
