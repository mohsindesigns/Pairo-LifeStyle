import { describe, it, expect } from "vitest";
import { extractTocSections } from "@/lib/blogToc";

describe("blog table of contents (built on the server)", () => {
  it("lists h1-h3 in order with stable ids", () => {
    const t = extractTocSections("<h2>The Origin</h2><p>x</p><h3>1920s: Motorcycle</h3><h4>skip me</h4><h1>Top</h1>");
    expect(t.map((x) => x.title)).toEqual(["The Origin", "1920s: Motorcycle", "Top"]);
    expect(t[0].id).toBe("toc-the-origin-0");
    expect(t[1].id).toBe("toc-1920s-motorcycle-1");
  });

  it("strips nested tags and decodes entities, like textContent would", () => {
    const t = extractTocSections('<h2 class="a"><strong>Shearling &amp; Fur</strong>&nbsp;Guide</h2><h3>Men&#39;s <em>Style</em></h3>');
    expect(t.map((x) => x.title)).toEqual(["Shearling & Fur Guide", "Men's Style"]);
  });

  it("handles multi-line headings, empty input and no headings", () => {
    expect(extractTocSections("<h2>\n  Two\n  Lines\n</h2>")[0].title).toBe("Two Lines");
    expect(extractTocSections("")).toEqual([]);
    expect(extractTocSections(null)).toEqual([]);
    expect(extractTocSections("<p>no headings</p>")).toEqual([]);
  });
});
