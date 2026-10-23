import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import ProductQuestion from "@/models/ProductQuestion";
import "@/models/Product"; // registers the model used by populate("productId")
import { can } from "@/lib/rbac";
import { sendQuestionReplyEmail } from "@/lib/email";
import { logAction } from "@/lib/audit";
import mongoose from "mongoose";

const STATUSES = ["Pending", "Approved", "Hidden"];

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!can(session.user, "products.edit") && !can(session.user, "reviews.moderate")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, status, replyText } = body;

    await dbConnect();
    const question = await ProductQuestion.findById(id).populate("productId");
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Restore from trash (the only action allowed on a trashed question)
    if (action === "restore") {
      if (!question.isDeleted) return NextResponse.json(question);
      question.isDeleted = false;
      question.deletedAt = null;
      await question.save();
      await logAction(req, session, "RESTORE_PRODUCT_QUESTION", "product_questions", {}, String(question._id));
      return NextResponse.json(question);
    }

    if (question.isDeleted) {
      return NextResponse.json({ error: "This question is in the trash. Restore it first." }, { status: 409 });
    }

    if (action === "toggle_status") {
      if (!STATUSES.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      question.status = status;
      await question.save();

      await logAction(req, session, "TOGGLE_QUESTION_STATUS", "product_questions", { status }, String(question._id));

      return NextResponse.json(question);
    }

    if (action === "reply") {
      const text = String(replyText || "").trim();
      if (!text) {
        return NextResponse.json({ error: "Reply text is required" }, { status: 400 });
      }

      // The storefront shows the first reply as "the store answer", so editing an answer
      // updates that reply in place instead of stacking a second, never-shown one.
      const isEdit = question.replies.length > 0;
      if (isEdit) {
        question.replies[0].answer = text;
        question.replies[0].staffId = session.user.id;
        question.replies[0].staffName = session.user.name || "Store Administrator";
      } else {
        question.replies.push({
          staffId: session.user.id,
          staffName: session.user.name || "Store Administrator",
          answer: text
        });
      }

      // Auto-approve the question when replying
      question.status = "Approved";
      await question.save();

      // Send email to customer
      const product = question.productId;
      if (product) {
        await sendQuestionReplyEmail({
          customerEmail: question.customerEmail,
          customerName: question.customerName,
          originalQuestion: question.question,
          replyText: text,
          productName: product.name,
          productSlug: product.slug
        });
      }

      await logAction(req, session, isEdit ? "EDIT_PRODUCT_QUESTION_REPLY" : "REPLY_PRODUCT_QUESTION", "product_questions", { replyText: text }, String(question._id));

      return NextResponse.json(question);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("PUT Admin Product Question Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE moves a question to the trash. DELETE ?permanent=true removes it for good, and only
// works on a question that is already in the trash.
export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!can(session.user, "products.delete") && !can(session.user, "reviews.delete")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    const permanent = new URL(req.url).searchParams.get("permanent") === "true";

    await dbConnect();
    const question = await ProductQuestion.findById(id);
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    if (permanent) {
      if (!question.isDeleted) {
        return NextResponse.json({ error: "Move the question to the trash before deleting it permanently." }, { status: 409 });
      }
      await ProductQuestion.deleteOne({ _id: id });
      await logAction(req, session, "PERMANENT_DELETE_PRODUCT_QUESTION", "product_questions", {}, String(id));
      return NextResponse.json({ success: true, message: "Question permanently deleted" });
    }

    if (question.isDeleted) {
      return NextResponse.json({ success: true, message: "Question already in trash" });
    }

    question.isDeleted = true;
    question.deletedAt = new Date();
    await question.save();

    await logAction(req, session, "DELETE_PRODUCT_QUESTION", "product_questions", {}, String(id));

    return NextResponse.json({ success: true, message: "Question moved to trash" });
  } catch (error) {
    console.error("DELETE Admin Product Question Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
