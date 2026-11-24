import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import Category from "@/models/Category";
import { checkRateLimit } from "@/lib/rateLimit";

// Lightweight storefront search. Public, rate limited, card fields only.
// Deliberately separate from /api/products (which returns the full catalog).

const MAX_QUERY_LENGTH = 60;
const MAX_TOKENS = 6;
const MAX_TOKEN_LENGTH = 30;
const MAX_PRODUCTS = 12;
const MAX_CATEGORIES = 4;
const CANDIDATE_LIMIT = 60;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// lowercase, punctuation/hyphens -> spaces, collapsed
const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9À-￿]+/g, " ")
    .trim();

// "jackets" -> "jacket", "boxes" -> "box", but leave "glass"/"bus"-like words (ss) alone.
function stem(token) {
  if (token.length > 4 && /(ses|xes|zes|ches|shes)$/.test(token)) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

function tokenize(raw) {
  const q = String(raw || "").slice(0, MAX_QUERY_LENGTH);
  const seen = new Set();
  const tokens = [];
  for (const t of normalize(q).split(" ")) {
    if (t.length < 2) continue;
    const s = stem(t.slice(0, MAX_TOKEN_LENGTH));
    if (seen.has(s)) continue;
    seen.add(s);
    tokens.push(s);
    if (tokens.length >= MAX_TOKENS) break;
  }
  return tokens;
}

// Escaped regex source for a token that tolerates separators between characters,
// so "tshirt" matches "t-shirt" and "bomberjacket" matches "bomber jacket".
function tokenPattern(token) {
  return Array.from(token).map(escapeRegex).join("[\\s\\-_]*");
}

function topCategories(categories) {
  return [...categories]
    .sort((a, b) => (b.productCount || 0) - (a.productCount || 0) || a.name.localeCompare(b.name))
    .slice(0, 8)
    .map((c) => ({ name: c.name, slug: c.slug }));
}

export async function GET(req) {
  try {
    const rate = await checkRateLimit(req, { limit: 60, window: 60, keyPrefix: "SEARCH" });
    if (!rate.success) {
      return Response.json(
        { products: [], categories: [], message: "Too many searches. Please slow down." },
        { status: 429, headers: { "Retry-After": String(rate.resetIn || 60) } }
      );
    }

    const { searchParams } = new URL(req.url);
    const rawQ = (searchParams.get("q") || "").slice(0, MAX_QUERY_LENGTH);
    const tokens = tokenize(rawQ);

    await dbConnect();

    const allCategories = await Category.find({
      isDeleted: { $ne: true },
      status: { $ne: "Draft" },
      type: { $ne: "blog" },
    })
      .select("name slug productCount")
      .lean();

    const headers = { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" };

    if (tokens.length === 0) {
      return Response.json({ products: [], categories: [], topCategories: topCategories(allCategories) }, { headers });
    }

    const regexes = tokens.map((t) => new RegExp(tokenPattern(t), "i"));
    const catById = new Map(allCategories.map((c) => [String(c._id), c]));

    // Categories whose name matches every token
    const matchedCategories = allCategories
      .filter((c) => regexes.every((re) => re.test(c.name || "")))
      .sort((a, b) => (b.productCount || 0) - (a.productCount || 0))
      .slice(0, MAX_CATEGORIES);

    // Each token must match name OR category name OR sku OR tags (legacy category string too).
    const perToken = regexes.map((re) => {
      const catIds = allCategories.filter((c) => re.test(c.name || "")).map((c) => c._id);
      const or = [{ name: re }, { category: re }, { sku: re }, { tags: re }];
      if (catIds.length) {
        or.push({ categories: { $in: catIds } }, { primaryCategory: { $in: catIds } });
      }
      return { $or: or };
    });

    const candidates = await Product.find({
      status: "Published",
      isDeleted: { $ne: true },
      $and: perToken,
    })
      .select("name slug price compareAtPrice image images category categories primaryCategory isFeatured")
      .sort({ isFeatured: -1, createdAt: -1 })
      .limit(CANDIDATE_LIMIT)
      .lean();

    const nq = normalize(rawQ);
    const nqJoined = nq.replace(/ /g, "");
    const scored = candidates.map((p) => {
      const nn = normalize(p.name);
      const nnJoined = nn.replace(/ /g, "");
      let score = 40; // matched via category / sku / tags
      if (nn === nq || nnJoined === nqJoined) score = 100;
      else if (nn.startsWith(nq) || nnJoined.startsWith(nqJoined)) score = 80;
      else if (tokens.every((t) => nn.includes(t) || nnJoined.includes(t))) score = 60;
      if (p.isFeatured) score += 1;
      return { p, score };
    });
    scored.sort((a, b) => b.score - a.score);

    const products = scored.slice(0, MAX_PRODUCTS).map(({ p }) => {
      const cat =
        catById.get(String(p.primaryCategory || "")) ||
        (p.categories && catById.get(String(p.categories[0]))) ||
        null;
      return {
        _id: String(p._id),
        name: p.name,
        slug: p.slug || null,
        price: p.price,
        compareAtPrice: p.compareAtPrice || null,
        image: (p.images && p.images[0]) || p.image || null,
        categoryName: cat?.name || p.category || "",
      };
    });

    return Response.json(
      { products, categories: matchedCategories.map((c) => ({ name: c.name, slug: c.slug })) },
      { headers }
    );
  } catch (error) {
    console.error("GET Search Error:", error);
    return Response.json({ products: [], categories: [], message: "Search unavailable" }, { status: 500 });
  }
}
