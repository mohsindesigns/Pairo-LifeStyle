const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI.trim().replace(/^["'](.+)["']$/, "$1");

// Helper to read file safely
function readFileContent(filename) {
  const filePath = path.join(__dirname, "..", "..", filename);
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.error(`Error reading ${filename}:`, err.message);
    return null;
  }
}

// Convert plain text file content to clean Quill-compatible HTML
function textToHtml(text) {
  const lines = text.split(/\r?\n/);
  let html = "";
  let inList = false;

  for (const raw of lines) {
    const line = raw.trim();

    // Divider line
    if (line.startsWith("___") || line.includes("_____")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += "<hr/>";
      continue;
    }

    // Bullet item
    if (line.startsWith("●") || line.startsWith("•") || (line.startsWith("-") && line.length > 2)) {
      const item = line.replace(/^[●•-]\s*/, "").trim();
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${item}</li>`;
      continue;
    }

    // Flush list
    if (inList) { html += "</ul>"; inList = false; }

    // Empty line → skip
    if (!line) continue;

    // Numbered section heading: "1. Something" or "12. Something"
    if (/^\d+\.\s+\S/.test(line)) {
      html += `<h2>${line}</h2>`;
      continue;
    }

    // Short standalone title line (no punctuation at end, < 60 chars) → h2
    const looksLikeHeading = line.length < 65 && !line.endsWith(".") && !line.endsWith(",") && !line.endsWith(")") && !/^[a-z]/.test(line);
    if (looksLikeHeading && line.split(" ").length <= 8) {
      html += `<h2>${line}</h2>`;
      continue;
    }

    // Normal paragraph
    html += `<p>${line}</p>`;
  }

  if (inList) html += "</ul>";
  return html;
}

async function seedLegalPages() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected successfully.");

    const db = mongoose.connection.db;
    const pagesCollection = db.collection("pages");

    const pageDefinitions = [
      {
        slug: "terms",
        title: "Terms & Conditions",
        file: "terms.txt"
      },
      {
        slug: "privacy",
        title: "Privacy Policy",
        file: "privacy.txt"
      },
      {
        slug: "shipping",
        title: "Shipping & Delivery",
        file: "shipping.txt"
      },
      {
        slug: "refund-policy",
        title: "Return & Refund Policy",
        file: "refundpolicy.tsxt"
      }
    ];

    for (const def of pageDefinitions) {
      const content = readFileContent(def.file);
      if (!content) {
        console.warn(`Skipping ${def.slug} due to missing file content.`);
        continue;
      }

      console.log(`Processing page: ${def.title} (slug: ${def.slug})...`);

      const htmlContent = textToHtml(content);
      const sectionId = `legal-${def.slug}-${Math.random().toString(36).substring(2, 11)}`;

      const pageData = {
        title: def.title,
        slug: def.slug,
        description: `${def.title} for Pairo Lifestyle.`,
        status: "Published",
        template: "default",
        isSystem: true,
        tenantId: "DEFAULT_STORE",
        sections: [
          {
            id: sectionId,
            type: "rich_text",
            enabled: true,
            order: 0,
            config: {
              title: def.title,
              content: htmlContent
            },
            overrides: {
              padding: "py-0",
              background: "transparent",
              customClasses: ""
            }
          }
        ],
        seo: {
          title: `${def.title} | Pairo Lifestyle`,
          description: `Read Pairo Lifestyle's official ${def.title}.`,
          keywords: [def.slug, "legal", "pairo"],
          noIndex: false,
          noFollow: false
        },
        updatedAt: new Date()
      };

      // Check if exists
      const existing = await pagesCollection.findOne({ slug: def.slug, tenantId: "DEFAULT_STORE" });
      if (existing) {
        console.log(`Page with slug "${def.slug}" already exists. Updating it...`);
        await pagesCollection.updateOne(
          { _id: existing._id },
          {
            $set: {
              title: pageData.title,
              description: pageData.description,
              status: pageData.status,
              template: pageData.template,
              isSystem: pageData.isSystem,
              sections: pageData.sections,
              seo: pageData.seo,
              updatedAt: pageData.updatedAt
            }
          }
        );
        console.log(`Page "${def.title}" updated successfully.`);
      } else {
        console.log(`Page with slug "${def.slug}" does not exist. Creating it...`);
        await pagesCollection.insertOne({
          ...pageData,
          createdAt: new Date()
        });
        console.log(`Page "${def.title}" created successfully.`);
      }
    }

    console.log("All legal pages seeded successfully!");

    // Seed redirects for flexible URLs
    const redirectsCollection = db.collection("redirects");
    const redirectDefs = [
      { oldPath: "/refund", newPath: "/refund-policy", statusCode: 301 },
      { oldPath: "/refundpolicy", newPath: "/refund-policy", statusCode: 301 },
      { oldPath: "/privacy-policy", newPath: "/privacy", statusCode: 301 },
      { oldPath: "/terms-and-conditions", newPath: "/terms", statusCode: 301 }
    ];

    for (const r of redirectDefs) {
      console.log(`Setting redirect: ${r.oldPath} -> ${r.newPath}...`);
      await redirectsCollection.updateOne(
        { oldPath: r.oldPath },
        {
          $set: {
            newPath: r.newPath,
            statusCode: r.statusCode,
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        { upsert: true }
      );
    }
    console.log("All page redirects configured!");

    process.exit(0);
  } catch (err) {
    console.error("Seeding legal pages failed:", err);
    process.exit(1);
  }
}

seedLegalPages();
