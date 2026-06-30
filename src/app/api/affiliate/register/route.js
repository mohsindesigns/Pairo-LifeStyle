import dbConnect from "@/lib/db";
import Affiliate from "@/models/Affiliate";
import AffiliateApplication from "@/models/AffiliateApplication";
import { sendAffiliateApplicationReceived } from "@/lib/email";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/affiliate/rateLimiter";
import path from "path";
import fs from "fs";
import crypto from "crypto";

function sanitize(text) {
  if (!text || typeof text !== 'string') return "";
  return text.replace(/<[^>]*>/g, '').trim();
}

export async function POST(req) {
  await dbConnect();
  try {
    // 1. Enforce API rate limiting (max 5 application registrations per 15 minutes per IP)
    const rateLimitResponse = rateLimit(req, 5, 15 * 60 * 1000);
    if (rateLimitResponse) return rateLimitResponse;

    const formData = await req.formData();
    
    const email = sanitize(formData.get("email")?.toLowerCase());
    const name = sanitize(formData.get("name"));
    const phone = sanitize(formData.get("phone"));
    const dob = formData.get("dob");
    const tenantId = sanitize(formData.get("tenantId")) || "default";

    if (!email || !name || !phone || !dob) {
      return NextResponse.json({ error: "Missing required personal fields." }, { status: 400 });
    }

    // 2. Check duplicate registrations
    const existingApplication = await AffiliateApplication.findOne({ email, status: { $ne: 'Rejected' } }).lean();
    const existingAffiliate = await Affiliate.findOne({ email }).lean();

    if (existingApplication || existingAffiliate) {
      return NextResponse.json({ error: "An active affiliate account or application with this email already exists." }, { status: 400 });
    }

    // 3. Parse and sanitize Address
    const address = {
      country: sanitize(formData.get("country")),
      state: sanitize(formData.get("state")),
      city: sanitize(formData.get("city")),
      zipCode: sanitize(formData.get("zipCode")),
      street: sanitize(formData.get("street"))
    };

    if (!address.country || !address.state || !address.city || !address.zipCode || !address.street) {
      return NextResponse.json({ error: "Missing address details." }, { status: 400 });
    }

    // 4. Parse and sanitize Banking Info
    const bankingInfo = {
      accountHolder: sanitize(formData.get("accountHolder")),
      bankName: sanitize(formData.get("bankName")),
      accountNumber: sanitize(formData.get("accountNumber")),
      iban: sanitize(formData.get("iban")),
      swiftCode: sanitize(formData.get("swiftCode")),
      routingNumber: sanitize(formData.get("routingNumber")),
      paypalEmail: sanitize(formData.get("paypalEmail"))
    };

    if (!bankingInfo.accountHolder || !bankingInfo.bankName || !bankingInfo.accountNumber) {
      return NextResponse.json({ error: "Missing required bank details." }, { status: 400 });
    }

    // 5. Parse and sanitize Business
    const businessInfo = {
      companyName: sanitize(formData.get("companyName")),
      website: sanitize(formData.get("website")),
      socialLinks: formData.get("socialLinks") ? formData.get("socialLinks").split(",").map(link => sanitize(link)) : []
    };

    // 6. Parse and sanitize Marketing Qs
    const marketingAnswers = {
      promotionStrategy: sanitize(formData.get("promotionStrategy")),
      audienceSize: sanitize(formData.get("audienceSize")),
      experience: sanitize(formData.get("experience"))
    };

    if (!marketingAnswers.promotionStrategy || !marketingAnswers.audienceSize || !marketingAnswers.experience) {
      return NextResponse.json({ error: "Missing marketing strategy details." }, { status: 400 });
    }

    // 7. Secure Document Uploads (Driver License, Passport, etc. -> private storage with magic bytes checks)
    const docFiles = formData.getAll("identityDocuments");
    const uploadedDocs = [];

    const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'];
    const MAX_SIZE = 5 * 1024 * 1024; // Strict 5MB limit

    const privateDir = path.resolve(process.cwd(), "private", "kyc");
    if (!fs.existsSync(privateDir)) {
      fs.mkdirSync(privateDir, { recursive: true });
    }

    for (const file of docFiles) {
      if (!file || typeof file === 'string') continue;
      
      // Verify MIME type limit
      if (!ALLOWED_MIME.includes(file.type)) {
        return NextResponse.json({ error: `File type "${file.type}" not allowed. Only JPEG, PNG, and PDF are supported.` }, { status: 400 });
      }

      // Verify file size limits
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: `File ${file.name} exceeds the 5MB upload limit.` }, { status: 400 });
      }

      // Read file buffer
      const buffer = Buffer.from(await file.arrayBuffer());

      // Validate Magic Bytes Header to prevent malicious file uploads (e.g. scripts disguised as images)
      const magicHex = buffer.slice(0, 4).toString('hex').toUpperCase();
      let isValidMagic = false;

      if (magicHex.startsWith('89504E47')) isValidMagic = true; // PNG: \x89PNG
      else if (magicHex.startsWith('FFD8FF')) isValidMagic = true; // JPEG/JPG: \xFF\xD8\xFF
      else if (magicHex.startsWith('25504446')) isValidMagic = true; // PDF: %PDF

      if (!isValidMagic) {
        return NextResponse.json({ error: `Malicious upload rejected: Magic bytes header validation failed for file "${file.name}".` }, { status: 400 });
      }

      // Write atomically to private/kyc folder (outside NextJS public router)
      const uniqueFilename = `${crypto.randomUUID()}-${path.basename(file.name)}`;
      const filePath = path.resolve(privateDir, uniqueFilename);
      
      await fs.promises.writeFile(filePath, buffer);
      uploadedDocs.push(uniqueFilename);
    }

    if (uploadedDocs.length === 0) {
      return NextResponse.json({ error: "Please upload at least one valid identity verification document." }, { status: 400 });
    }

    // 8. Save Application in DB
    const application = await AffiliateApplication.create({
      name,
      email,
      phone,
      dob: new Date(dob),
      address,
      bankingInfo,
      businessInfo,
      marketingAnswers,
      identityDocuments: uploadedDocs,
      status: 'Pending',
      tenantId
    });

    console.log(`[AffiliateAPI] Saved new application for: ${email}. Secure documents saved: ${uploadedDocs.join(", ")}`);

    // 9. Dispatch notification email
    try {
      await sendAffiliateApplicationReceived(email, name);
    } catch (mailErr) {
      console.error("[AffiliateAPI Email Error]", mailErr.message);
    }

    return NextResponse.json({ success: true, applicationId: application._id }, { status: 201 });

  } catch (err) {
    console.error("[AffiliateAPI Registration Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
