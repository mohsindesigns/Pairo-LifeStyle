import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Customer from "@/models/Customer";
import Order from "@/models/Order";
import { can } from "@/lib/rbac";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!can(session.user, "customers.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
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
