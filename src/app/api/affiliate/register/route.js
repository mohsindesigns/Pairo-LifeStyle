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

// Validates and saves a single uploaded file, returns the saved filename or throws
async function validateAndSaveFile(file, allowedMimes, maxSize, privateDir) {
  if (!allowedMimes.includes(file.type)) {
    throw new Error(`File type "${file.type}" not allowed. Accepted: ${allowedMimes.join(", ")}`);
  }
  if (file.size > maxSize) {
    throw new Error(`File "${file.name}" exceeds the ${Math.round(maxSize / 1024 / 1024)}MB size limit.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const magicHex = buffer.slice(0, 4).toString('hex').toUpperCase();
  let isValidMagic = false;

  if (magicHex.startsWith('89504E47')) isValidMagic = true; // PNG
  else if (magicHex.startsWith('FFD8FF')) isValidMagic = true;  // JPEG/JPG
  else if (magicHex.startsWith('25504446')) isValidMagic = true; // PDF
  else if (magicHex.startsWith('52494646') || magicHex.startsWith('57454250')) isValidMagic = true; // WebP (RIFF/WEBP)

  if (!isValidMagic) {
    throw new Error(`Security rejection: "${file.name}" failed magic-bytes validation.`);
  }

  const uniqueFilename = `${crypto.randomUUID()}-${path.basename(file.name)}`;
  const filePath = path.resolve(privateDir, uniqueFilename);
  await fs.promises.writeFile(filePath, buffer);
  return uniqueFilename;
}

export async function POST(req) {
  await dbConnect();
  try {
    // 1. Rate limiting
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

    // 3. Parse and validate referral code
    let referralCode = sanitize(formData.get("referralCode"))?.toUpperCase().replace(/\s+/g, '') || "";
    if (referralCode) {
      if (!/^[A-Za-z0-9_-]+$/.test(referralCode)) {
        return NextResponse.json({ error: "Referral code may only contain letters, numbers, hyphens, and underscores." }, { status: 400 });
      }
      const codeConflict = await Affiliate.findOne({ referralCode }) ||
                           await AffiliateApplication.findOne({ referralCode, status: { $ne: 'Rejected' } });
      if (codeConflict) {
        return NextResponse.json({ error: "That referral code is already taken. Please choose a different one." }, { status: 400 });
      }
    } else {
      // Auto-generate unique code from first name
      const namePart = name.trim().split(" ")[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || "AFF";
      referralCode = namePart;
      let codeCount = 0;
      while (
        await Affiliate.findOne({ referralCode }) ||
        await AffiliateApplication.findOne({ referralCode, status: { $ne: 'Rejected' } })
      ) {
        codeCount++;
        referralCode = `${namePart}${codeCount}`;
      }
    }

    // 4. Parse Address
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

    // 5. Parse Banking Info
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

    // 6. Parse Business Info
    const businessInfo = {
      companyName: sanitize(formData.get("companyName")),
      website: sanitize(formData.get("website")),
      socialLinks: formData.get("socialLinks") ? formData.get("socialLinks").split(",").map(link => sanitize(link)) : []
    };

    // 7. Parse Marketing Answers
    const marketingAnswers = {
      promotionStrategy: sanitize(formData.get("promotionStrategy")),
      audienceSize: sanitize(formData.get("audienceSize")),
      experience: sanitize(formData.get("experience"))
    };
    if (!marketingAnswers.promotionStrategy || !marketingAnswers.audienceSize || !marketingAnswers.experience) {
      return NextResponse.json({ error: "Missing marketing strategy details." }, { status: 400 });
    }

    // 8. Setup private storage directory
    const privateDir = path.resolve(process.cwd(), "private", "kyc");
    if (!fs.existsSync(privateDir)) {
      fs.mkdirSync(privateDir, { recursive: true });
    }

    const KYC_ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'];
    const PHOTO_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const MAX_DOC_SIZE = 5 * 1024 * 1024; // 5MB
    const MAX_PHOTO_SIZE = 3 * 1024 * 1024; // 3MB

    // 9. Profile Photo (required)
    const profilePhotoFile = formData.get("profilePhoto");
    let profilePhotoFilename = null;
    if (profilePhotoFile && typeof profilePhotoFile !== 'string' && profilePhotoFile.size > 0) {
      try {
        profilePhotoFilename = await validateAndSaveFile(profilePhotoFile, PHOTO_ALLOWED_MIME, MAX_PHOTO_SIZE, privateDir);
      } catch (err) {
        return NextResponse.json({ error: `Profile photo: ${err.message}` }, { status: 400 });
      }
    }

    // 10. Bank Verification Document (optional but recommended)
    const bankDocFile = formData.get("bankVerificationDocument");
    let bankDocFilename = null;
    if (bankDocFile && typeof bankDocFile !== 'string' && bankDocFile.size > 0) {
      try {
        bankDocFilename = await validateAndSaveFile(bankDocFile, KYC_ALLOWED_MIME, MAX_DOC_SIZE, privateDir);
      } catch (err) {
        return NextResponse.json({ error: `Bank verification document: ${err.message}` }, { status: 400 });
      }
    }

    // 11. Identity Documents (KYC — required, at least 1)
    const docFiles = formData.getAll("identityDocuments");
    const uploadedDocs = [];
    for (const file of docFiles) {
      if (!file || typeof file === 'string') continue;
      try {
        const filename = await validateAndSaveFile(file, KYC_ALLOWED_MIME, MAX_DOC_SIZE, privateDir);
        uploadedDocs.push(filename);
      } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }

    if (uploadedDocs.length === 0) {
      return NextResponse.json({ error: "Please upload at least one valid identity verification document." }, { status: 400 });
    }

    // 12. Save Application in DB
    const application = await AffiliateApplication.create({
      name,
      email,
      phone,
      dob: new Date(dob),
      address,
      bankingInfo,
      businessInfo,
      marketingAnswers,
      referralCode,
      identityDocuments: uploadedDocs,
      profilePhoto: profilePhotoFilename,
      bankVerificationDocument: bankDocFilename,
      status: 'Pending',
      tenantId
    });

    console.log(`[AffiliateAPI] Saved application for: ${email}. Code: ${referralCode}. Docs: ${uploadedDocs.length}`);

    // 13. Dispatch notification email
    try {
      await sendAffiliateApplicationReceived(email, name);
    } catch (mailErr) {
      console.error("[AffiliateAPI Email Error]", mailErr.message);
    }

    return NextResponse.json({ success: true, applicationId: application._id, referralCode }, { status: 201 });

  } catch (err) {
    console.error("[AffiliateAPI Registration Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
