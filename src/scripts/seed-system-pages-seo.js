const mongoose = require("mongoose");
require("dotenv").config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI.trim().replace(/^["'](.+)["']$/, "$1");

async function seedSystemPages() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected successfully.");

  const db = mongoose.connection.db;
  const pagesCollection = db.collection("pages");

  const systemPages = [
    {
      slug: "blog",
      title: "Blog / Editorial",
      description: "Manage editorial articles, brand journals, and news.",
      seo: {
        title: "Journal | Pairo Editorial",
        description: "Explore the stories, craftsmanship, and heritage behind Pairo's archival shearling collection.",
        keywords: ["blog", "journal", "pairo lifestyle"],
        noIndex: false,
        noFollow: false
      }
    },
    {
      slug: "collections",
      title: "Collections",
      description: "Manage your categories/collections overview page.",
      seo: {
        title: "Collections | Pairo Store",
        description: "Browse all Pairo collections — premium shearling and leather jackets crafted for modern wear.",
        keywords: ["collections", "categories", "pairo jackets"],
        noIndex: false,
        noFollow: false
      }
    },
    {
      slug: "shop",
      title: "Shop All Catalog",
      description: "Manage your Shop All products catalog page.",
      seo: {
        title: "Shop All | Pairo Store",
        description: "Browse Pairo's handcrafted premium shearling jackets, coats, and accessories.",
        keywords: ["shop all", "buy shearling jacket", "pairo outerwear"],
        noIndex: false,
        noFollow: false
      }
    }
  ];

  for (const page of systemPages) {
    const pageData = {
      title: page.title,
      slug: page.slug,
      description: page.description,
      status: "Published",
      template: "default",
      isSystem: true,
      sections: [],
      seo: page.seo,
      updatedAt: new Date()
    };

    const existing = await pagesCollection.findOne({ slug: page.slug });
    if (existing) {
      console.log(`Page "${page.slug}" already exists. Updating its metadata...`);
      await pagesCollection.updateOne(
        { _id: existing._id },
        {
          $set: {
            title: pageData.title,
            description: pageData.description,
            isSystem: true,
            seo: pageData.seo,
            updatedAt: pageData.updatedAt
          }
        }
      );
    } else {
      console.log(`Creating page "${page.slug}"...`);
      await pagesCollection.insertOne({
        ...pageData,
        createdAt: new Date()
      });
    }
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seedSystemPages().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
