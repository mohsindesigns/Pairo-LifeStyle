import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Customer from "@/models/Customer";
import Order from "@/models/Order";
import { can } from "@/lib/rbac";
import { sanitizeText } from "@/lib/sanitize";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { escapeRegex, validateCustomerUpdate } from "../helpers";

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!can(session.user, "customers.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  await dbConnect();

  try {
    const customer = await Customer.findById(id).select("-password").lean();
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    // Fetch all orders for this user
    const orders = await Order.find({ "customer.userId": id, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).lean();

    return NextResponse.json({
        ...customer,
        orders: orders.map(o => ({
            ...o,
            id: o._id.toString()
        }))
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Admin "Edit customer": PATCH { name?, email?, phone? }. Trashed customers must be
// restored first. Orders keep their own customer snapshot and are not touched.
export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!can(session.user, "customers.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { errors, value } = validateCustomerUpdate(body);
  if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  if (value.name) value.name = sanitizeText(value.name) || value.name;

  await dbConnect();
  try {
    const customer = await Customer.findOne({ _id: id, role: { $ne: "admin" } }).select("email isDeleted").lean();
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    if (customer.isDeleted) {
      return NextResponse.json({ error: "This customer is in the Trash. Restore them before making changes." }, { status: 409 });
    }

    if (value.email && value.email !== String(customer.email || "").toLowerCase()) {
      const taken = await Customer.findOne({
        _id: { $ne: id },
        email: { $regex: `^${escapeRegex(value.email)}$`, $options: "i" },
      }).select("_id").lean();
      if (taken) return NextResponse.json({ error: "Another account already uses this email." }, { status: 409 });
    } else {
      delete value.email;
    }

    const updated = await Customer.findByIdAndUpdate(id, { $set: value }, { new: true }).select("-password").lean();
    return NextResponse.json({ success: true, customer: updated });
  } catch (error) {
    if (error?.code === 11000) return NextResponse.json({ error: "Another account already uses this email." }, { status: 409 });
    console.error("[Customer API Update Error]:", error);
    return NextResponse.json({ error: "Failed to update customer." }, { status: 500 });
  }
}
