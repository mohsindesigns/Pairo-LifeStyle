import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Discount from "@/models/Discount";
import Customer from "@/models/Customer";
import Product from "@/models/Product";
import Category from "@/models/Category";
import { NextResponse } from "next/server";

import { can } from "@/lib/rbac";
import { syncDiscountToStripe, deactivateDiscountStripeCode } from "@/lib/discountStripeSync";
// Verify session is staff AND (when a permission is given) holds that permission.
// Coupons live under the "promotions" permission module — previously any staff role
// could create/edit/delete coupons regardless of their assigned permissions.
async function checkAuth(permission = null) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) {
    return null;
  }
  if (permission && !can(session.user, permission)) {
    return null;
  }
  return session;
}

// Resolves a comma/newline-separated list of customer emails (the admin-facing
// input format) into Customer ObjectIds for storage on Discount.specificCustomers.
async function resolveCustomerIds(emailsInput) {
  if (!emailsInput || typeof emailsInput !== "string") return [];
  const emails = emailsInput.split(/[,\n]/).map(e => e.trim().toLowerCase()).filter(Boolean);
  if (emails.length === 0) return [];

  const customers = await Customer.find({ email: { $in: emails } }).select("_id email");
  const foundEmails = new Set(customers.map(c => c.email.toLowerCase()));
  const notFound = emails.filter(e => !foundEmails.has(e));
  if (notFound.length > 0) {
    throw new Error(`No customer account found for: ${notFound.join(", ")}`);
  }
  return customers.map(c => c._id);
}

export async function GET(req) {
  const session = await checkAuth("promotions.view");
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "All"; // All, Active, Expired, Trash
    const search = searchParams.get("search");

    const now = new Date();
    const query = {};

    // 1. Status Filter
    if (status === "Trash") {
      query.isDeleted = true;
    } else {
      query.isDeleted = { $ne: true };
      if (status === "Active") {
        query.isActive = true;
        query.$and = [
          {
            $or: [
              { endDate: { $exists: false } },
              { endDate: null },
              { endDate: { $gte: now } }
            ]
          },
          {
            $or: [
              { startDate: { $exists: false } },
              { startDate: null },
              { startDate: { $lte: now } }
            ]
          }
        ];
      } else if (status === "Expired") {
        query.endDate = { $lt: now };
      }
    }

    // 2. Search Filter
    if (search) {
      query.$or = [
        { code: { $regex: search.trim(), $options: "i" } },
        { type: { $regex: search.trim(), $options: "i" } }
      ];
    }

    const discounts = await Discount.find(query)
      .populate("specificCustomers", "email")
      .populate("specificProducts", "name image images price sku slug")
      .populate("specificCategories", "name slug")
      .sort({ createdAt: -1 });

    // 3. Stats Calculation
    const [allCount, activeCount, expiredCount, trashCount] = await Promise.all([
      Discount.countDocuments({ isDeleted: { $ne: true } }),
      Discount.countDocuments({
        isDeleted: { $ne: true },
        isActive: true,
        $and: [
          {
            $or: [
              { endDate: { $exists: false } },
              { endDate: null },
              { endDate: { $gte: now } }
            ]
          },
          {
            $or: [
              { startDate: { $exists: false } },
              { startDate: null },
              { startDate: { $lte: now } }
            ]
          }
        ]
      }),
      Discount.countDocuments({ isDeleted: { $ne: true }, endDate: { $lt: now } }),
      Discount.countDocuments({ isDeleted: true })
    ]);

    return NextResponse.json({
      discounts,
      stats: {
        allCount,
        activeCount,
        expiredCount,
        trashCount
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await checkAuth("promotions.manage");
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();
  try {
    const body = await req.json();
    
    if (!body.code || !body.value) {
      return NextResponse.json({ error: "Code and value are required fields." }, { status: 400 });
    }

    const codeUpper = body.code.toUpperCase().trim();

    // Check uniqueness (across all, including Trash, due to DB index uniqueness constraints)
    const existing = await Discount.findOne({ code: codeUpper });
    if (existing) {
      if (existing.isDeleted) {
        return NextResponse.json({ error: `Coupon code "${codeUpper}" already exists in Trash. Please restore or permanently delete it first.` }, { status: 400 });
      } else {
        return NextResponse.json({ error: `Coupon code "${codeUpper}" already exists.` }, { status: 400 });
      }
    }

    // Expiry date end-of-day normalization — constructed via the local Date
    // constructor (not setUTCHours) so "2026-09-10" resolves to the end of
    // that calendar date in the server's own timezone, not an arbitrary UTC
    // offset that can cut the coupon off hours before the admin's local midnight.
    let expiryDate = null;
    if (body.endDate && body.endDate !== "") {
      const [y, m, d] = body.endDate.split("-").map(Number);
      expiryDate = new Date(y, m - 1, d, 23, 59, 59, 999);
    }

    let startDate = null;
    if (body.startDate && body.startDate !== "") {
      const [y, m, d] = body.startDate.split("-").map(Number);
      startDate = new Date(y, m - 1, d, 0, 0, 0, 0);
    }

    // Valid ObjectId checks
    const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

    const rawSpecificProducts = Array.isArray(body.specificProducts) ? body.specificProducts : [];
    const specificProducts = rawSpecificProducts.map(p => (typeof p === 'object' && p?._id ? String(p._id) : String(p))).filter(Boolean);
    for (const prodId of specificProducts) {
      if (!isValidObjectId(prodId)) {
        return NextResponse.json({ error: `Product ID "${prodId}" is not a valid 24-character hex ID.` }, { status: 400 });
      }
    }

    const rawSpecificCategories = Array.isArray(body.specificCategories) ? body.specificCategories : [];
    const specificCategories = rawSpecificCategories.map(c => (typeof c === 'object' && c?._id ? String(c._id) : String(c))).filter(Boolean);
    for (const catId of specificCategories) {
      if (!isValidObjectId(catId)) {
        return NextResponse.json({ error: `Category ID "${catId}" is not a valid 24-character hex ID.` }, { status: 400 });
      }
    }

    let specificCustomers;
    try {
      specificCustomers = await resolveCustomerIds(body.specificCustomerEmails);
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // Sanitize values to prevent CastErrors
    const data = {
      code: codeUpper,
      type: body.type || "percentage",
      value: Number(body.value),
      minPurchase: (body.minPurchase !== "" && body.minPurchase !== null && body.minPurchase !== undefined) ? Number(body.minPurchase) : 0,
      usageLimit: (body.usageLimit && body.usageLimit !== "") ? Number(body.usageLimit) : null,
      startDate,
      endDate: expiryDate,
      isActive: body.isActive !== undefined ? body.isActive : true,
      firstOrderOnly: body.firstOrderOnly !== undefined ? !!body.firstOrderOnly : false,
      userRegistrationRequired: body.userRegistrationRequired !== undefined ? !!body.userRegistrationRequired : false,
      newsletterSubscribedOnly: body.newsletterSubscribedOnly !== undefined ? !!body.newsletterSubscribedOnly : false,
      specificProducts,
      specificCategories,
      // Blank/omitted = unlimited (null); the admin form now surfaces an explicit "Unlimited" toggle
      usagePerUserLimit: (body.usagePerUserLimit !== undefined && body.usagePerUserLimit !== "" && body.usagePerUserLimit !== null) ? Number(body.usagePerUserLimit) : null,
      maxDiscountAmount: (body.maxDiscountAmount !== undefined && body.maxDiscountAmount !== "" && body.maxDiscountAmount !== null) ? Number(body.maxDiscountAmount) : null,
      minQuantity: (body.minQuantity !== undefined && body.minQuantity !== "" && body.minQuantity !== null) ? Number(body.minQuantity) : 0,
      excludeSaleItems: body.excludeSaleItems !== undefined ? !!body.excludeSaleItems : false,
      specificCustomers,
      oneRedemptionPerDevice: body.oneRedemptionPerDevice !== undefined ? !!body.oneRedemptionPerDevice : false
    };

    if (data.type === "percentage" && data.value > 100) {
      return NextResponse.json({ error: "Percentage discount value cannot exceed 100%." }, { status: 400 });
    }

    if (isNaN(data.value) || data.value <= 0) {
      return NextResponse.json({ error: "Coupon value must be a valid number greater than 0." }, { status: 400 });
    }
    if (isNaN(data.minPurchase) || data.minPurchase < 0) {
      return NextResponse.json({ error: "Minimum purchase requirement must be a non-negative number." }, { status: 400 });
    }
    if (data.usageLimit !== null && (isNaN(data.usageLimit) || data.usageLimit <= 0)) {
      return NextResponse.json({ error: "Usage limit must be a positive number." }, { status: 400 });
    }
    if (data.usagePerUserLimit !== null && (isNaN(data.usagePerUserLimit) || data.usagePerUserLimit <= 0)) {
      return NextResponse.json({ error: "Usage limit per user must be a positive number." }, { status: 400 });
    }
    if (data.maxDiscountAmount !== null && (isNaN(data.maxDiscountAmount) || data.maxDiscountAmount <= 0)) {
      return NextResponse.json({ error: "Max discount cap must be a positive number." }, { status: 400 });
    }
    if (isNaN(data.minQuantity) || data.minQuantity < 0) {
      return NextResponse.json({ error: "Minimum quantity must be a non-negative number." }, { status: 400 });
    }
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
      return NextResponse.json({ error: "Start date must be before the expiry date." }, { status: 400 });
    }

    const discount = await Discount.create(data);

    const stripeState = await syncDiscountToStripe(discount);
    Object.assign(discount, stripeState);
    await discount.save();

    return NextResponse.json(discount, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  const session = await checkAuth("promotions.manage");
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing coupon ID." }, { status: 400 });

    const body = await req.json();

    const discount = await Discount.findById(id);
    if (!discount) return NextResponse.json({ error: "Coupon not found." }, { status: 404 });

    // Handle Restore
    if (body.restore) {
      discount.isDeleted = false;
      const stripeState = await syncDiscountToStripe(discount);
      Object.assign(discount, stripeState);
      await discount.save();
      return NextResponse.json(discount);
    }

    // Normal Update / Quick Edit Sanitization
    // Check type and value validations
    const nextType = body.type !== undefined ? body.type : discount.type;
    const nextValue = body.value !== undefined ? Number(body.value) : discount.value;
    if (nextType === "percentage" && nextValue > 100) {
      return NextResponse.json({ error: "Percentage discount value cannot exceed 100%." }, { status: 400 });
    }

    if (body.code !== undefined) {
      const codeUpper = body.code.toUpperCase().trim();
      if (codeUpper !== discount.code) {
        const existing = await Discount.findOne({ code: codeUpper });
        if (existing) {
          if (existing.isDeleted) {
            return NextResponse.json({ error: `Coupon code "${codeUpper}" already exists in Trash.` }, { status: 400 });
          } else {
            return NextResponse.json({ error: `Coupon code "${codeUpper}" already exists.` }, { status: 400 });
          }
        }
      }
      discount.code = codeUpper;
    }

    if (body.type !== undefined) discount.type = body.type;
    
    if (body.value !== undefined) {
      const val = Number(body.value);
      if (isNaN(val) || val <= 0) {
        return NextResponse.json({ error: "Coupon value must be a valid number greater than 0." }, { status: 400 });
      }
      discount.value = val;
    }

    if (body.minPurchase !== undefined) {
      const minP = (body.minPurchase !== "" && body.minPurchase !== null) ? Number(body.minPurchase) : 0;
      if (isNaN(minP) || minP < 0) {
        return NextResponse.json({ error: "Minimum purchase requirement must be a non-negative number." }, { status: 400 });
      }
      discount.minPurchase = minP;
    }

    if (body.usageLimit !== undefined) {
      const limit = (body.usageLimit && body.usageLimit !== "") ? Number(body.usageLimit) : null;
      if (limit !== null && (isNaN(limit) || limit <= 0)) {
        return NextResponse.json({ error: "Usage limit must be a positive number." }, { status: 400 });
      }
      discount.usageLimit = limit;
    }

    if (body.endDate !== undefined) {
      if (body.endDate && body.endDate !== "") {
        const [y, m, d] = body.endDate.split("-").map(Number);
        discount.endDate = new Date(y, m - 1, d, 23, 59, 59, 999);
      } else {
        discount.endDate = null;
      }
    }

    if (body.startDate !== undefined) {
      if (body.startDate && body.startDate !== "") {
        const [y, m, d] = body.startDate.split("-").map(Number);
        discount.startDate = new Date(y, m - 1, d, 0, 0, 0, 0);
      } else {
        discount.startDate = null;
      }
    }

    if (discount.startDate && discount.endDate && discount.startDate > discount.endDate) {
      return NextResponse.json({ error: "Start date must be before the expiry date." }, { status: 400 });
    }

    const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

    if (body.firstOrderOnly !== undefined) discount.firstOrderOnly = !!body.firstOrderOnly;
    if (body.userRegistrationRequired !== undefined) discount.userRegistrationRequired = !!body.userRegistrationRequired;
    if (body.newsletterSubscribedOnly !== undefined) discount.newsletterSubscribedOnly = !!body.newsletterSubscribedOnly;
    
    if (body.specificProducts !== undefined) {
      const rawProds = Array.isArray(body.specificProducts) ? body.specificProducts : [];
      const prods = rawProds.map(p => (typeof p === 'object' && p?._id ? String(p._id) : String(p))).filter(Boolean);
      for (const prodId of prods) {
        if (!isValidObjectId(prodId)) {
          return NextResponse.json({ error: `Product ID "${prodId}" is not a valid 24-character hex ID.` }, { status: 400 });
        }
      }
      discount.specificProducts = prods;
    }
    
    if (body.specificCategories !== undefined) {
      const rawCats = Array.isArray(body.specificCategories) ? body.specificCategories : [];
      const cats = rawCats.map(c => (typeof c === 'object' && c?._id ? String(c._id) : String(c))).filter(Boolean);
      for (const catId of cats) {
        if (!isValidObjectId(catId)) {
          return NextResponse.json({ error: `Category ID "${catId}" is not a valid 24-character hex ID.` }, { status: 400 });
        }
      }
      discount.specificCategories = cats;
    }
    if (body.usagePerUserLimit !== undefined) {
      // Blank/null = unlimited, surfaced via the admin form's "Unlimited" toggle
      const limitPerUser = (body.usagePerUserLimit !== "" && body.usagePerUserLimit !== null) ? Number(body.usagePerUserLimit) : null;
      if (limitPerUser !== null && (isNaN(limitPerUser) || limitPerUser <= 0)) {
        return NextResponse.json({ error: "Usage limit per user must be a positive number." }, { status: 400 });
      }
      discount.usagePerUserLimit = limitPerUser;
    }

    if (body.maxDiscountAmount !== undefined) {
      const cap = (body.maxDiscountAmount !== "" && body.maxDiscountAmount !== null) ? Number(body.maxDiscountAmount) : null;
      if (cap !== null && (isNaN(cap) || cap <= 0)) {
        return NextResponse.json({ error: "Max discount cap must be a positive number." }, { status: 400 });
      }
      discount.maxDiscountAmount = cap;
    }

    if (body.minQuantity !== undefined) {
      const minQty = (body.minQuantity !== "" && body.minQuantity !== null) ? Number(body.minQuantity) : 0;
      if (isNaN(minQty) || minQty < 0) {
        return NextResponse.json({ error: "Minimum quantity must be a non-negative number." }, { status: 400 });
      }
      discount.minQuantity = minQty;
    }

    if (body.excludeSaleItems !== undefined) discount.excludeSaleItems = !!body.excludeSaleItems;
    if (body.oneRedemptionPerDevice !== undefined) discount.oneRedemptionPerDevice = !!body.oneRedemptionPerDevice;

    if (body.specificCustomerEmails !== undefined) {
      try {
        discount.specificCustomers = await resolveCustomerIds(body.specificCustomerEmails);
      } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }

    if (body.isActive !== undefined) {
      discount.isActive = body.isActive;
    }

    const stripeState = await syncDiscountToStripe(discount);
    Object.assign(discount, stripeState);
    await discount.save();
    return NextResponse.json(discount);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  const session = await checkAuth("promotions.manage");
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing coupon ID." }, { status: 400 });

    const discount = await Discount.findById(id);
    if (!discount) return NextResponse.json({ error: "Coupon not found." }, { status: 404 });

    if (discount.isDeleted) {
      // Hard delete if already soft-deleted
      await Discount.findByIdAndDelete(id);
      return NextResponse.json({ success: true, message: "Coupon permanently deleted." });
    } else {
      // Soft delete
      discount.isDeleted = true;
      await deactivateDiscountStripeCode(discount);
      await discount.save();
      return NextResponse.json({ success: true, message: "Coupon moved to Trash." });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
