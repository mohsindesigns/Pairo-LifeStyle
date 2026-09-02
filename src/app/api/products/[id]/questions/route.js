import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import ProductQuestion from "@/models/ProductQuestion";
import { sendQuestionConfirmationEmail, sendAdminQuestionNotification } from "@/lib/email";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { sanitizeText, sanitizeObject } from "@/lib/sanitize";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import mongoose from "mongoose";

export async function GET(req, { params }) {
  try {
    const resolvedParams = await params;
    const { id: paramId } = resolvedParams;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;

    await dbConnect();

    // Find the product
    const product = await Product.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(paramId) ? paramId : null },
        { id: /^\d+$/.test(paramId) ? parseInt(paramId) : -1 },
        { slug: paramId }
      ]
    }).select("_id name slug").lean();

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const query = {
      productId: product._id,
      status: "Approved",
      isDeleted: { $ne: true }
    };

    const total = await ProductQuestion.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const questions = await ProductQuestion.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      questions,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    console.error("GET Product Questions Public Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const ip = getClientIp(req);

    // 1. Rate Limiting (5 questions per minute per IP)
    const rateCheck = await checkRateLimit(req, { limit: 5, window: 60, keyPrefix: "PROD_QUESTION" });
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: `Too many requests. Please wait ${rateCheck.resetIn} seconds before trying again.` },
        { status: 429 }
      );
    }

    const rawBody = await req.json().catch(() => ({}));
    const { turnstileToken } = rawBody;

    // 2. Cloudflare Turnstile Verification
    const turnstileCheck = await verifyTurnstileToken(turnstileToken, ip);
    if (!turnstileCheck.success) {
      return NextResponse.json(
        { error: turnstileCheck.error || "Security check failed. Please verify the captcha." },
        { status: 400 }
      );
    }

    const body = sanitizeObject(rawBody);
    const { customerName, customerEmail, question } = body;

    // Field validation
    if (!customerName || customerName.trim() === "") {
      return NextResponse.json({ error: "Full Name is required" }, { status: 400 });
    }
    if (!customerEmail || !/^\S+@\S+\.\S+$/.test(customerEmail)) {
      return NextResponse.json({ error: "A valid Email Address is required" }, { status: 400 });
    }
    if (!question || question.trim() === "") {
      return NextResponse.json({ error: "Question text is required" }, { status: 400 });
    }

    const resolvedParams = await params;
    const { id: paramId } = resolvedParams;

    await dbConnect();

    // Find the product
    const product = await Product.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(paramId) ? paramId : null },
        { id: /^\d+$/.test(paramId) ? parseInt(paramId) : -1 },
        { slug: paramId }
      ]
    }).select("_id name slug").lean();

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Create the question in Pending status
    const newQuestion = await ProductQuestion.create({
      productId: product._id,
      customerName: sanitizeText(customerName.trim()),
      customerEmail: sanitizeText(customerEmail.trim()),
      question: sanitizeText(question.trim()),
      status: "Pending"
    });

    // Send emails non-blocking
    Promise.all([
      sendQuestionConfirmationEmail({
        customerEmail: customerEmail.trim(),
        customerName: customerName.trim(),
        productName: product.name
      }),
      sendAdminQuestionNotification({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        productName: product.name,
        questionText: question.trim()
      })
    ]).catch(err => console.error("[ProductQuestion Email Error]", err.message));

    return NextResponse.json({
      success: true,
      question: newQuestion
    });
  } catch (error) {
    console.error("POST Product Question Public Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
