import dbConnect from './db';
import Product from '@/models/Product';
import '@/models/Category';
import '@/models/SizeChart';
import { SIZES_CM, SIZES_IN } from './sizeChartDefaults';

/**
 * Works out which size chart applies to a product, using the same rules as the
 * storefront (ClientProductActions.getResolvedSizeChart):
 *   none → no chart | custom → the product's own reusable chart |
 *   category_default → primary category's chart, else the first category with one.
 * Returns { type: 'reusable', chart } | { type: 'product_custom', sizeGuide } | null.
 */
export function resolveProductSizeChart(product) {
  const source = product.sizeChartSource || (product.sizeGuide?.enabled ? 'product_custom' : 'category_default');

  if (source === 'none') return null;
  if (source === 'product_custom') return { type: 'product_custom', sizeGuide: product.sizeGuide };
  if (source === 'custom' && product.sizeChart && !product.sizeChart.isDeleted) {
    return { type: 'reusable', chart: product.sizeChart };
  }
  if (source === 'category_default') {
    const primary = product.primaryCategory;
    if (primary?.sizeChart && !primary.sizeChart.isDeleted) return { type: 'reusable', chart: primary.sizeChart };
    for (const cat of product.categories || []) {
      if (cat?.sizeChart && !cat.sizeChart.isDeleted) return { type: 'reusable', chart: cat.sizeChart };
    }
  }
  return null;
}

function absoluteUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
  return url.startsWith('/') ? `${base}${url}` : url;
}

/** Turns a resolved chart into plain table data the email can render. */
function toEmailChart(resolved, productName) {
  if (resolved.type === 'reusable') {
    const c = resolved.chart;
    return {
      key: `chart:${c._id}`,
      productNames: [productName],
      heading: c.publicHeading || c.label || 'Size Chart',
      description: c.description || '',
      columns: c.columns || [],
      rows: c.rows || [],
      imageUrl: '',
    };
  }
  const g = resolved.sizeGuide || {};
  const cm = g.sizesCm?.length ? g.sizesCm : SIZES_CM;
  const inch = g.sizesIn?.length ? g.sizesIn : SIZES_IN;
  const sizeLabel = (g.sizeName || '').trim() || 'Size';
  return {
    key: `guide:${(g.chartImage || '') + cm.map((r) => r.size).join(',')}`,
    productNames: [productName],
    heading: 'Size Chart',
    description: '',
    columns: [sizeLabel, 'US', 'EU', 'Chest (cm)', 'Chest (in)', 'Sleeves (cm)', 'Sleeves (in)'],
    rows: cm.map((r, i) => [r.size, r.us, r.eu, r.chest, inch[i]?.chest ?? '', r.sleeves, inch[i]?.sleeves ?? '']),
    imageUrl: absoluteUrl(g.chartImage),
  };
}

/**
 * Returns the distinct size charts for the products in an order (several
 * products sharing a chart produce one entry). Made-to-measure lines are
 * skipped — those customers already supplied exact measurements.
 */
export async function resolveOrderSizeCharts(order) {
  const lines = (order.items || []).filter((it) => it.productId && !it.madeToMeasure?.enabled);
  const ids = [...new Set(lines.map((it) => String(it.productId)))];
  if (ids.length === 0) return [];

  await dbConnect();
  const products = await Product.find({ _id: { $in: ids } })
    .populate({ path: 'categories', populate: { path: 'sizeChart' } })
    .populate({ path: 'primaryCategory', populate: { path: 'sizeChart' } })
    .populate('sizeChart')
    .lean();

  const byKey = new Map();
  for (const product of products) {
    const resolved = resolveProductSizeChart(product);
    if (!resolved) continue;
    const chart = toEmailChart(resolved, product.name);
    const existing = byKey.get(chart.key);
    if (existing) existing.productNames.push(product.name);
    else byKey.set(chart.key, chart);
  }
  return [...byKey.values()];
}
