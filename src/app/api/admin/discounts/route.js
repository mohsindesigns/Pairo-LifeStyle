import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Discount from "@/models/Discount";
import { NextResponse } from "next/server";

// Verify session is admin or staff
async function checkAuth() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "admin" && !session.user.isStaff)) {
    return null;
  }
  return session;
}

export async function GET(req) {
  const session = await checkAuth();
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

    const discounts = await Discount.find(query).sort({ createdAt: -1 });

    // 3. Stats Calculation
    const [allCount, activeCount, expiredCount, trashCount] = await Promise.all([
      Discount.countDocuments({ isDeleted: { $ne: true } }),
      Discount.countDocuments({
        isDeleted: { $ne: true },
        isActive: true,
        $or: [
          { endDate: { $exists: false } },
          { endDate: null },
          { endDate: { $gte: now } }
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
  const session = await checkAuth();
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

    // Expiry date end-of-day timezone normalization (23:59:59.999 UTC)
    let expiryDate = null;
    if (body.endDate && body.endDate !== "") {
      expiryDate = new Date(body.endDate);
      expiryDate.setUTCHours(23, 59, 59, 999);
    }

    // Valid ObjectId checks
    const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

    const specificProducts = Array.isArray(body.specificProducts) ? body.specificProducts : [];
    for (const prodId of specificProducts) {
      if (!isValidObjectId(prodId)) {
        return NextResponse.json({ error: `Product ID "${prodId}" is not a valid 24-character hex ID.` }, { status: 400 });
      }
    }

    const specificCategories = Array.isArray(body.specificCategories) ? body.specificCategories : [];
    for (const catId of specificCategories) {
      if (!isValidObjectId(catId)) {
        return NextResponse.json({ error: `Category ID "${catId}" is not a valid 24-character hex ID.` }, { status: 400 });
      }
    }

    // Sanitize values to prevent CastErrors
    const data = {
      code: codeUpper,
      type: body.type || "percentage",
      value: Number(body.value),
      minPurchase: (body.minPurchase !== "" && body.minPurchase !== null && body.minPurchase !== undefined) ? Number(body.minPurchase) : 0,
      usageLimit: (body.usageLimit && body.usageLimit !== "") ? Number(body.usageLimit) : null,
      endDate: expiryDate,
      isActive: body.isActive !== undefined ? body.isActive : true,
      firstOrderOnly: body.firstOrderOnly !== undefined ? !!body.firstOrderOnly : false,
      userRegistrationRequired: body.userRegistrationRequired !== undefined ? !!body.userRegistrationRequired : false,
      newsletterSubscribedOnly: body.newsletterSubscribedOnly !== undefined ? !!body.newsletterSubscribedOnly : false,
      specificProducts,
      specificCategories,
      usagePerUserLimit: (body.usagePerUserLimit !== undefined && body.usagePerUserLimit !== "") ? Number(body.usagePerUserLimit) : 1
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
    if (isNaN(data.usagePerUserLimit) || data.usagePerUserLimit <= 0) {
      return NextResponse.json({ error: "Usage limit per user must be a positive number." }, { status: 400 });
    }

    const discount = await Discount.create(data);
    return NextResponse.json(discount, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  const session = await checkAuth();
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
        const expiryDate = new Date(body.endDate);
        expiryDate.setUTCHours(23, 59, 59, 999);
        discount.endDate = expiryDate;
      } else {
        discount.endDate = null;
      }
    }

    const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

    if (body.firstOrderOnly !== undefined) discount.firstOrderOnly = !!body.firstOrderOnly;
    if (body.userRegistrationRequired !== undefined) discount.userRegistrationRequired = !!body.userRegistrationRequired;
    if (body.newsletterSubscribedOnly !== undefined) discount.newsletterSubscribedOnly = !!body.newsletterSubscribedOnly;
    
    if (body.specificProducts !== undefined) {
      const prods = Array.isArray(body.specificProducts) ? body.specificProducts : [];
      for (const prodId of prods) {
        if (!isValidObjectId(prodId)) {
          return NextResponse.json({ error: `Product ID "${prodId}" is not a valid 24-character hex ID.` }, { status: 400 });
        }
      }
      discount.specificProducts = prods;
    }
    
    if (body.specificCategories !== undefined) {
      const cats = Array.isArray(body.specificCategories) ? body.specificCategories : [];
      for (const catId of cats) {
        if (!isValidObjectId(catId)) {
          return NextResponse.json({ error: `Category ID "${catId}" is not a valid 24-character hex ID.` }, { status: 400 });
        }
      }
      discount.specificCategories = cats;
    }
    if (body.usagePerUserLimit !== undefined) {
      const limitPerUser = (body.usagePerUserLimit !== "" && body.usagePerUserLimit !== null) ? Number(body.usagePerUserLimit) : 1;
      if (isNaN(limitPerUser) || limitPerUser <= 0) {
        return NextResponse.json({ error: "Usage limit per user must be a positive number." }, { status: 400 });
      }
      discount.usagePerUserLimit = limitPerUser;
    }

    if (body.isActive !== undefined) {
      discount.isActive = body.isActive;
    }

    await discount.save();
    return NextResponse.json(discount);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  const session = await checkAuth();
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
      await discount.save();
      return NextResponse.json({ success: true, message: "Coupon moved to Trash." });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
