import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import CorporateGiftingInquiry from "@/models/CorporateGiftingInquiry";
import { sendCorporateGiftingConfirmation, sendCorporateGiftingAdminNotification } from "@/lib/email";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { sanitizeObject } from "@/lib/sanitize";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const str = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const urlList = (v, max) =>
  (Array.isArray(v) ? v : []).filter((u) => typeof u === "string" && u.length < 600).slice(0, max);

export async function POST(req) {
  try {
    const ip = getClientIp(req);

    const rateCheck = await checkRateLimit(req, { limit: 5, window: 60, keyPrefix: "CORPORATE_GIFTING" });
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: `Too many requests. Please wait ${rateCheck.resetIn} seconds before trying again.` },
        { status: 429 }
      );
    }

    const rawBody = await req.json().catch(() => ({}));

    const turnstileCheck = await verifyTurnstileToken(rawBody.turnstileToken, ip);
    if (!turnstileCheck.success) {
      return NextResponse.json(
        { error: turnstileCheck.error || "Security check failed. Please verify the captcha." },
        { status: 400 }
      );
    }

    const body = sanitizeObject(rawBody);

    const company = str(body.company);
    const contactName = str(body.contactName);
    const email = str(body.email).toLowerCase();
    const phone = str(body.phone, 40);
    const occasion = str(body.occasion);
    const quantity = str(body.quantity);
    const items = (Array.isArray(body.items) ? body.items : []).map((i) => str(i, 80)).filter(Boolean).slice(0, 30);

    if (!company) return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    if (!contactName) return NextResponse.json({ error: "Contact person is required" }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "A valid work email is required" }, { status: 400 });
    }
    if (!phone) return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    if (!occasion) return NextResponse.json({ error: "Occasion is required" }, { status: 400 });
    if (!/^\d{1,6}$/.test(quantity) || Number(quantity) < 1) {
      return NextResponse.json({ error: "Enter a valid number of packs" }, { status: 400 });
    }
    if (items.length === 0) return NextResponse.json({ error: "Select at least one item for the pack" }, { status: 400 });

    await dbConnect();

    const inquiry = await CorporateGiftingInquiry.create({
      company,
      contactName,
      email,
      phone,
      country: str(body.country),
      city: str(body.city),
      occasion,
      quantity,
      budget: str(body.budget),
      deliveryDate: str(body.deliveryDate, 60),
      items,
      branding: str(body.branding),
      packaging: str(body.packaging),
      leather: str(body.leather),
      brandColors: str(body.brandColors),
      greetingCard: body.greetingCard === true,
      logos: (Array.isArray(body.logos) ? body.logos : [])
        .filter((l) => l && typeof l.url === "string")
        .slice(0, 5)
        .map((l) => ({ url: l.url.slice(0, 600), name: str(l.name, 150) })),
      notes: str(body.notes, 2000),
      referenceImages: urlList(body.referenceImages, 15),
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || ""
    });

    Promise.all([
      sendCorporateGiftingConfirmation(email, contactName, inquiry.toObject()),
      sendCorporateGiftingAdminNotification(inquiry.toObject())
    ]).catch((err) => console.error("[CorporateGifting Email Error]", err.message));

    return NextResponse.json({ success: true, id: inquiry._id }, { status: 201 });
  } catch (err) {
    console.error("[CorporateGiftingInquiry POST Error]", err);
    return NextResponse.json({ error: "Failed to submit inquiry. Please try again." }, { status: 500 });
  }
}
