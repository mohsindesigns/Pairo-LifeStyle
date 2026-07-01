"use client";

export default function RichTextSection({ title = "", content = "" }) {
  if (!content && !title) return null;

  return (
    <>
      {/* Quill Snow rendered HTML styles scoped to this section */}
      <style>{`
        .rich-text-body h1 {
          font-size: 20px;
          font-weight: 900;
          color: #000;
          margin: 28px 0 12px;
          line-height: 1.3;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .rich-text-body h2 {
          font-size: 15px;
          font-weight: 900;
          color: #000;
          margin: 24px 0 10px;
          line-height: 1.4;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .rich-text-body h3 {
          font-size: 13px;
          font-weight: 800;
          color: #000;
          margin: 18px 0 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .rich-text-body p {
          font-size: 13px;
          font-weight: 400;
          color: #000;
          line-height: 1.8;
          margin-bottom: 12px;
        }
        .rich-text-body ul,
        .rich-text-body ol {
          padding-left: 22px;
          margin-bottom: 14px;
          color: #000;
        }
        .rich-text-body li {
          font-size: 13px;
          font-weight: 400;
          color: #000;
          line-height: 1.8;
          margin-bottom: 5px;
        }
        .rich-text-body ul li { list-style-type: disc; }
        .rich-text-body ol li { list-style-type: decimal; }
        .rich-text-body blockquote {
          border-left: 3px solid #000;
          padding: 10px 16px;
          margin: 18px 0;
          background: #f8f8f8;
          font-size: 13px;
          color: #000;
          font-style: italic;
        }
        .rich-text-body a {
          color: #000;
          text-decoration: underline;
          font-weight: 600;
        }
        .rich-text-body strong { font-weight: 700; color: #000; }
        .rich-text-body em { font-style: italic; color: #000; }
        .rich-text-body u { text-decoration: underline; color: #000; }
        .rich-text-body hr {
          border: none;
          border-top: 1px solid #e0e0e0;
          margin: 24px 0;
        }
      `}</style>

      <section className="py-12 md:py-20 bg-white min-h-[50vh]">
        <div className="max-w-2xl mx-auto px-5 sm:px-8">
          {title && (
            <h1 className="text-[16px] sm:text-[20px] font-black uppercase tracking-[0.06em] text-black mb-8 pb-4 border-b-2 border-black">
              {title}
            </h1>
          )}
          {content && (
            <div
              className="rich-text-body"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )}
        </div>
      </section>
    </>
  );
}
