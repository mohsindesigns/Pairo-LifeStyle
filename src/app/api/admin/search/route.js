import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import { can } from "@/lib/rbac";
import Product from "@/models/Product";
import Page from "@/models/Page";
import Blog from "@/models/Blog";
import Category from "@/models/Category";
import Customer from "@/models/Customer";
import Order from "@/models/Order";
import Discount from "@/models/Discount";
import Affiliate from "@/models/Affiliate";
import Promotion from "@/models/Promotion";
import Review from "@/models/Review";
import Script from "@/models/Script";
import { SEARCH_LIMIT, parseSearchWords, buildWordFilter } from "./searchQuery";

export const dynamic = "force-dynamic";

// Lightweight search for the admin topbar: at most SEARCH_LIMIT matches per type,
// only { id, title, href }. Each type is only searched when the caller can view it
// (same permission keys as that type's own admin list endpoint).
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const words = parseSearchWords(searchParams.get("q") || "");
  const wantHome = searchParams.get("home") === "1";
  const user = session.user;

  const results = {};
  if (!words.length && !wantHome) return NextResponse.json({ success: true, results });

  await dbConnect();

  const find = (Model, fields, base, select) => {
    const filter = buildWordFilter(words, fields, base);
    if (!filter) return Promise.resolve([]);
    return Model.find(filter).select(select).sort({ createdAt: -1 }).limit(SEARCH_LIMIT).lean();
  };

  const tasks = [];
  const add = (key, permitted, promise, map) => {
    if (!permitted) return;
    tasks.push(promise.then(docs => { results[key] = docs.map(map); }).catch(err => {
      console.error(`[AdminSearch] ${key} failed:`, err.message);
      results[key] = [];
    }));
  };

  add("products", can(user, "products.view"),
    find(Product, ["name", "sku"], { isDeleted: false }, "name"),
    p => ({ id: String(p._id), title: p.name, href: `/admin/products/${p._id}` }));

  add("pages", can(user, "pages.view"),
    find(Page, ["title"], { isDeleted: { $ne: true } }, "title"),
    pg => ({ id: String(pg._id), title: pg.title, href: `/admin/pages/${pg._id}` }));

  if (wantHome) {
    add("homePage", can(user, "pages.view"),
      Page.find({ isDeleted: { $ne: true }, $or: [{ slug: "home" }, { slug: "" }, { title: { $regex: "^home$", $options: "i" } }] })
        .select("title").limit(1).lean(),
      pg => ({ id: String(pg._id), title: pg.title, href: `/admin/pages/${pg._id}?tab=seo` }));
  }

  add("blogs", can(user, "blogs.view"),
    find(Blog, ["title"], { isDeleted: { $ne: true } }, "title"),
    b => ({ id: String(b._id), title: b.title, href: `/admin/blogs/${b._id}` }));

  add("categories", can(user, "products.view") || can(user, "blogs.view"),
    find(Category, ["name"], { isDeleted: false }, "name"),
    c => ({ id: String(c._id), title: c.name, href: `/admin/products/categories/${c._id}` }));

  add("customers", can(user, "customers.view"),
    find(Customer, ["name", "email"], { role: { $ne: "admin" }, isDeleted: { $ne: true } }, "name email"),
    c => ({ id: String(c._id), title: c.name || c.email, href: `/admin/customers/${c._id}` }));

  add("orders", can(user, "orders.view"),
    find(Order, ["orderNumber", "shippingAddress.fullName", "customer.email"], { isDeleted: { $ne: true } }, "orderNumber shippingAddress.fullName"),
    o => ({ id: String(o._id), title: `#${o.orderNumber} (${o.shippingAddress?.fullName || "Guest"})`, href: `/admin/orders/${o._id}` }));

  add("discounts", can(user, "promotions.view"),
    find(Discount, ["code"], { isDeleted: { $ne: true } }, "code"),
    d => ({ id: String(d._id), title: d.code, href: `/admin/discounts?search=${encodeURIComponent(d.code || "")}` }));

  add("affiliates", can(user, "affiliates.view"),
    find(Affiliate, ["name", "email", "referralCode"], { isDeleted: { $ne: true } }, "name email referralCode"),
    a => ({
      id: String(a._id),
      title: a.referralCode ? `${a.name} (${a.referralCode})` : a.name,
      href: `/admin/affiliates?view=list&search=${encodeURIComponent(a.email || a.referralCode || "")}`,
    }));

  add("promotions", can(user, "promotions.view"),
    find(Promotion, ["title"], {}, "title"),
    p => ({ id: String(p._id), title: p.title, href: `/admin/promotions/${p._id}` }));

  add("reviews", can(user, "reviews.view"),
    find(Review, ["customerName", "title", "comment"], { isDeleted: { $ne: true } }, "customerName"),
    r => ({ id: String(r._id), title: r.customerName, href: `/admin/reviews?search=${encodeURIComponent(r.customerName || "")}` }));

  add("scripts", can(user, "scripts.view"),
    find(Script, ["name"], { isDeleted: { $ne: true } }, "name"),
    s => ({ id: String(s._id), title: s.name, href: `/admin/settings/scripts/${s._id}` }));

  await Promise.all(tasks);
  return NextResponse.json({ success: true, results });
}
