const decodeBasicEntities = (t) =>
  t.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

/**
 * H1-H3 headings of a blog post's HTML as table-of-contents entries: [{ id, title }].
 * Pure string work (no DOM), so it gives the same result on the server and in the browser and the
 * table of contents is already in the server-rendered HTML.
 */
export function extractTocSections(html) {
  if (!html) return [];
  const out = [];
  const re = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = re.exec(html))) {
    const text = decodeBasicEntities(m[2].replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
    const i = out.length;
    const id = `toc-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${i}`;
    out.push({ id, title: text });
  }
  return out;
}
