"use client";

function makeLinksDofollow(html) {
  if (!html) return "";
  return html.replace(/<a\s+([^>]*href=["']([^"']*)["'][^>]*)>/gi, (match, body) => {
    if (/rel=["']([^"']*)["']/i.test(body)) {
      return match.replace(/rel=["']([^"']*)["']/gi, (relMatch, relValue) => {
        const cleanRel = relValue
          .replace(/\bnofollow\b/gi, '')
          .replace(/\bnoindex\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        return cleanRel ? `rel="${cleanRel}"` : '';
      });
    }
    return match;
  });
}

export default function RichTextSection({ title = "", content = "", headingLevel = "h1" }) {
  if (!content && !title) return null;

  return (
    <>
      <style>{`
        .rich-text-body h1,
        .rich-text-body h1 * {
          font-size: 20px;
          font-weight: 900;
          color: var(--primary) !important;
          margin: 28px 0 12px;
          line-height: 1.3;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .rich-text-body h2,
        .rich-text-body h2 * {
          font-size: 15px;
          font-weight: 900;
          color: var(--primary) !important;
          margin: 24px 0 10px;
          line-height: 1.4;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .rich-text-body h3,
        .rich-text-body h3 * {
          font-size: 13px;
          font-weight: 800;
          color: var(--primary) !important;
          margin: 18px 0 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .rich-text-body p,
        .rich-text-body p * {
          font-size: 13px;
          font-weight: 400;
          color: #000000 !important;
          line-height: 1.8;
          margin-bottom: 12px;
        }
        .rich-text-body ul,
        .rich-text-body ol {
          padding-left: 22px;
          margin-bottom: 14px;
          color: #000000 !important;
        }
        .rich-text-body li,
        .rich-text-body li * {
          font-size: 13px;
          font-weight: 400;
          color: #000000 !important;
          line-height: 1.8;
          margin-bottom: 5px;
        }
        .rich-text-body ul li { list-style-type: disc; }
        .rich-text-body ol li { list-style-type: decimal; }
        .rich-text-body blockquote,
        .rich-text-body blockquote * {
          border-left: 3px solid var(--primary);
          padding: 10px 16px;
          margin: 18px 0;
          background: #f8f8f8;
          font-size: 13px;
          color: #000000 !important;
          font-style: italic;
        }
        .rich-text-body a,
        .rich-text-body a * {
          color: #000000 !important;
          text-decoration: underline;
          font-weight: 600;
        }
        .rich-text-body strong { font-weight: 700; color: #000000 !important; }
        .rich-text-body em { font-style: italic; color: #000000 !important; }
        .rich-text-body u { text-decoration: underline; color: #000000 !important; }
        .rich-text-body hr {
          border: none;
          border-top: 1px solid #e0e0e0;
          margin: 24px 0;
        }
        .rich-text-body img {
          border-radius: 8px;
          max-width: 100%;
        }
        .rich-text-body img[data-align="center"], .rich-text-body img:not([data-align]) {
          margin: 1.5rem auto;
          display: block;
        }
        .rich-text-body img[data-align="left"] {
          margin: 1.5rem auto 1.5rem 0;
          display: block;
        }
        .rich-text-body img[data-align="right"] {
          margin: 1.5rem 0 1.5rem auto;
          display: block;
        }
        .rich-text-body img[data-align="float-left"] {
          float: left;
          margin: 0.5rem 1.5rem 1rem 0;
          display: inline-block;
        }
        .rich-text-body img[data-align="float-right"] {
          float: right;
          margin: 0.5rem 0 1rem 1.5rem;
          display: inline-block;
        }
      `}</style>

      <section className="py-10 md:py-16 bg-white min-h-[50vh]">
        <div className="container mx-auto px-2 sm:px-4 md:px-8">
          <div className="w-full">
            {(() => {
              const HeadingTag = headingLevel;
              return title && (
                <HeadingTag className="text-[16px] sm:text-[20px] font-black uppercase tracking-[0.06em] text-black mb-8 pb-4 border-b border-black/10">
                  {title}
                </HeadingTag>
              );
            })()}
            {content && (
              <div
                className="rich-text-body"
                dangerouslySetInnerHTML={{ __html: makeLinksDofollow(content) }}
              />
            )}
          </div>
        </div>
      </section>
    </>
  );
}
