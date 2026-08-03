import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Customer from "@/models/Customer";
import Order from "@/models/Order";
import Product from "@/models/Product";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    await dbConnect();
    
    // Fetch Customer
    let customer = await Customer.findById(session.user.id).select("-password").lean();
    if (!customer) {
      if (session.user.isStaff) {
        const Staff = (await import("@/models/Staff")).default;
        const staff = await Staff.findById(session.user.id).select("-password").lean();
        if (staff) {
          const profileData = {
            _id: staff._id.toString(),
            name: staff.name,
            email: staff.email,
            role: staff.role?.slug?.toUpperCase() || "STAFF",
            createdAt: staff.createdAt,
            addresses: [],
            orderHistory: []
          };
          const orders = await Order.find({
            "customer.email": staff.email,
            tenantId: 'DEFAULT_STORE'
          }).sort({ createdAt: -1 }).lean();
          if (orders.length > 0) {
            const productIds = orders.flatMap(o => (o.items || []).map(item => item.productId)).filter(Boolean);
            const dbProducts = await Product.find({ _id: { $in: productIds } }).select("images image").lean();
            const productImageMap = {};
            dbProducts.forEach(p => {
              productImageMap[p._id.toString()] = p.images?.[0] || p.image || "";
            });
            profileData.orderHistory = orders.map(o => ({
              id: o._id.toString(),
              orderNumber: o.orderNumber,
              trackingId: o.idempotencyKey ? o.idempotencyKey.replace('pai_', '').toUpperCase() : o._id.toString().slice(-12).toUpperCase(),
              total: o.financials.total,
              date: o.createdAt,
              status: o.status,
              items: (o.items || []).map(item => ({
                ...item,
                image: item.image || (item.productId ? productImageMap[item.productId.toString()] : "") || ""
              })),
              shippingAddress: o.shippingAddress
            }));
          }
          return NextResponse.json(profileData);
        }
      }
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    // Fetch Orders from Order collection (Live data)
    const orders = await Order.find({ 
      "customer.userId": session.user.id,
      tenantId: 'DEFAULT_STORE' // or dynamic tenantId
    }).sort({ createdAt: -1 }).lean();

    // Fetch product images for any orders with missing image URLs
    const productIds = orders.flatMap(o => (o.items || []).map(item => item.productId)).filter(Boolean);
    const dbProducts = await Product.find({ _id: { $in: productIds } }).select("images image").lean();
    const productImageMap = {};
    dbProducts.forEach(p => {
      productImageMap[p._id.toString()] = p.images?.[0] || p.image || "";
    });

    // Merge for compatibility with frontend
    const profileData = {
      ...customer,
      orderHistory: orders.map(o => ({
        id: o._id.toString(),
        orderNumber: o.orderNumber,
        trackingId: o.idempotencyKey ? o.idempotencyKey.replace('pai_', '').toUpperCase() : o._id.toString().slice(-12).toUpperCase(),
        total: o.financials.total,
        date: o.createdAt,
        status: o.status,
        items: (o.items || []).map(item => ({
          ...item,
          image: item.image || (item.productId ? productImageMap[item.productId.toString()] : "") || ""
        })),
        shippingAddress: o.shippingAddress
      }))
    };

    return NextResponse.json(profileData);
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const { action, data } = body;
    await dbConnect();
    let customer = await Customer.findById(session.user.id);
    if (!customer) {
      if (session.user.isStaff) {
        const Staff = (await import("@/models/Staff")).default;
        const staff = await Staff.findById(session.user.id);
        if (staff) {
          if (action === "updateInfo") {
            staff.name = data.name || staff.name;
            const newEmail = data.email?.trim().toLowerCase();
            if (newEmail && newEmail !== staff.email) {
              const emailExists = await Staff.findOne({ email: newEmail, _id: { $ne: staff._id } });
              if (emailExists) {
                return NextResponse.json({ message: "Email is already in use by another staff account." }, { status: 400 });
              }
              staff.email = newEmail;
            }
            await staff.save();
            return NextResponse.json({ message: "Profile updated successfully.", user: staff });
          }
        }
      }
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }
    switch (action) {
      case "updateInfo": {
        customer.name = data.name || customer.name;
        
        const newEmail = data.email?.trim().toLowerCase();
        if (newEmail && newEmail !== customer.email) {
          // Check if the new email is already in use by another customer
          const emailExists = await Customer.findOne({ email: newEmail, _id: { $ne: customer._id } });
          if (emailExists) {
            return NextResponse.json({ message: "Email is already in use by another account." }, { status: 400 });
          }

          // Generate verification token for new email
          const crypto = await import("crypto");
          const token = crypto.randomBytes(32).toString("hex");
          const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

          customer.pendingEmail = newEmail;
          customer.pendingEmailToken = token;
          customer.pendingEmailTokenExpiry = expiry;

          const siteUrl = process.env.NEXTAUTH_URL || "https://pairolifestyle.com";
          const verificationUrl = `${siteUrl}/verify-email?token=${token}&type=change`;
          
          const { sendEmailVerification } = await import("@/lib/email");
          try {
            await sendEmailVerification(newEmail, customer.name, verificationUrl);
            await customer.save();
            return NextResponse.json({ 
              message: "Profile updated. A verification link has been sent to your new email.", 
              emailVerificationPending: true,
              user: customer 
            });
          } catch (emailError) {
            console.error("[ProfileUpdate] ⚠️ Failed to send verification email for email change:", emailError);
            // Fallback: update email directly without verification if email system is failing
            customer.email = newEmail;
            customer.pendingEmail = null;
            customer.pendingEmailToken = null;
            customer.pendingEmailTokenExpiry = null;
            await customer.save();
            return NextResponse.json({ 
              message: "Profile updated successfully.", 
              emailVerificationPending: false,
              user: customer 
            });
          }
        }
        break;
      }
      case "addAddress":
        if (data.isDefault) customer.addresses.forEach(a => a.isDefault = false);
        customer.addresses.push(data);
        break;
      case "deleteAddress":
        customer.addresses = customer.addresses.filter(a => a._id.toString() !== data.id);
        break;
      case "addPayment":
        if (data.isDefault) customer.paymentMethods.forEach(p => p.isDefault = false);
        customer.paymentMethods.push(data);
        break;
      case "deletePayment":
        customer.paymentMethods = customer.paymentMethods.filter(p => p._id.toString() !== data.id);
        break;
      case "deleteAccount":
        return NextResponse.json({ message: "Account deletion is disabled for this store." }, { status: 403 });
      case "cancelOrder": {
        const order = await Order.findOne({ _id: data.orderId, "customer.userId": session.user.id });
        if (!order) return NextResponse.json({ message: "Order not found" }, { status: 404 });
        
        // Cancellation Logic: Only if not already shipped/packed
        const cancellableStatuses = ['Pending', 'Confirmed', 'Processing'];
        if (!cancellableStatuses.includes(order.status)) {
          return NextResponse.json({ message: `Cannot cancel order with status: ${order.status}` }, { status: 400 });
        }

        const oldStatus = order.status;
        order.status = 'Cancelled';
        order.timeline.push({
          status: 'Cancelled',
          message: 'Order cancelled by customer',
          source: 'Customer'
        });
        await order.save();
        
        // Dispatch event for listeners (like email)
        const pairoEvents = (await import("@/lib/events")).default;
        pairoEvents.dispatch('ORDER_CANCELLED', order);
        
        return NextResponse.json({ message: "Order cancelled successfully" });
      }
      default:
        return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    }
    await customer.save();
    return NextResponse.json({ message: "Profile updated successfully", user: customer });
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
