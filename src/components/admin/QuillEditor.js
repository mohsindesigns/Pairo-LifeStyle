"use client";

import { useEffect, useRef } from "react";

export default function QuillEditor({ value = "", onChange, height = "280px" }) {
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !editorRef.current) return;
    initialized.current = true;

    // Load Quill CSS from CDN once
    if (!document.getElementById("quill-snow-css")) {
      const link = document.createElement("link");
      link.id = "quill-snow-css";
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css";
      document.head.appendChild(link);
    }

    // Inject custom overrides for Quill toolbar/editor to match site aesthetic
    if (!document.getElementById("quill-custom-css")) {
      const style = document.createElement("style");
      style.id = "quill-custom-css";
      style.textContent = `
        .ql-toolbar.ql-snow {
          border: none !important;
          border-bottom: 1px solid #dcdcde !important;
          background: #f6f7f7;
          padding: 4px 6px;
          font-family: inherit;
          display: flex !important;
          flex-wrap: wrap !important;
          align-items: center;
          gap: 2px;
          max-width: 100% !important;
        }
        .ql-toolbar.ql-snow .ql-formats { display: inline-flex; align-items: center; margin-right: 8px; padding-right: 8px; border-right: 1px solid #dcdcde; }
        .ql-toolbar.ql-snow .ql-formats:last-child { border-right: 0; margin-right: 0; padding-right: 0; }
        .ql-snow.ql-toolbar button {
          width: 32px; height: 32px; padding: 7px;
          border: 1px solid transparent; border-radius: 2px;
        }
        .ql-snow.ql-toolbar button:hover { background: #fff; border-color: #c3c4c7; }
        .ql-snow.ql-toolbar button.ql-active { background: #fff; border-color: #8c8f94; box-shadow: inset 0 1px 2px rgba(0,0,0,.12); }
        .ql-snow.ql-toolbar button:focus-visible { outline: 2px solid #2271b1; outline-offset: 1px; }
        @media (max-width: 782px) {
          .ql-snow.ql-toolbar button { width: 40px; height: 40px; padding: 10px; }
          .ql-snow .ql-picker { height: 40px; }
        }
        .ql-container.ql-snow {
          border: none !important;
          font-family: inherit;
          font-size: 13px;
          max-width: 100% !important;
        }
        .ql-editor {
          min-height: ${height};
          color: #000;
          font-size: 13px;
          line-height: 1.7;
          padding: 14px 16px;
        }
        /* Scoped + !important so the admin's compact h1/h2/h3/p sizes (globals.css) don't flatten the content */
        .admin-dashboard-container .ql-editor p { font-size: 15px !important; line-height: 1.6 !important; margin-bottom: 10px; color: #000; }
        .admin-dashboard-container .ql-editor h1 { font-size: 28px !important; line-height: 1.25 !important; font-weight: 800 !important; color: #000; margin: 18px 0 10px; }
        .admin-dashboard-container .ql-editor h2 { font-size: 22px !important; line-height: 1.3 !important; font-weight: 750 !important; color: #000; margin: 16px 0 8px; }
        .admin-dashboard-container .ql-editor h3 { font-size: 18px !important; line-height: 1.35 !important; font-weight: 700 !important; color: #000; margin: 14px 0 6px; }
        .admin-dashboard-container .ql-editor > :first-child { margin-top: 0; }
        .admin-dashboard-container .ql-editor li { font-size: 15px !important; }
        .ql-editor ul, .ql-editor ol { padding-left: 20px; color: #000; margin-bottom: 10px; }
        .ql-editor li { margin-bottom: 4px; color: #000; }
        .ql-editor blockquote { border-left: 3px solid #000; padding-left: 12px; color: #000; font-style: italic; }
        .ql-editor a { color: #000; text-decoration: underline; }
        .ql-editor.ql-blank::before { color: #999; font-style: normal; }
        .ql-snow .ql-stroke { stroke: #3c434a !important; }
        .ql-snow .ql-fill { fill: #3c434a !important; }
        .ql-snow .ql-picker { color: #2c3338 !important; }
        .ql-snow .ql-picker-label { border: 1px solid #8c8f94 !important; border-radius: 3px; background: #fff; }
        .ql-snow .ql-picker-options { border: 1px solid #c3c4c7 !important; box-shadow: 0 3px 6px rgba(0,0,0,.08); }
        .ql-snow.ql-toolbar button:hover .ql-stroke,
        .ql-snow .ql-toolbar button:hover .ql-stroke,
        .ql-snow.ql-toolbar button.ql-active .ql-stroke,
        .ql-snow .ql-toolbar button.ql-active .ql-stroke { stroke: #1d2327 !important; }
        .ql-snow.ql-toolbar button.ql-active .ql-fill { fill: #1d2327 !important; }
      `;
      document.head.appendChild(style);
    }

    import("quill").then(({ default: Quill }) => {
      if (!editorRef.current || quillRef.current) return;

      const quill = new Quill(editorRef.current, {
        theme: "snow",
        placeholder: "Write your page content here...",
        modules: {
          toolbar: [
            [{ header: [1, 2, 3, false] }],
            ["bold", "italic", "underline"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["blockquote", "link"],
            ["clean"],
          ],
        },
      });

      // Set initial HTML content
      if (value) {
        quill.clipboard.dangerouslyPasteHTML(value);
      }

      // Emit HTML on every change
      quill.on("text-change", () => {
        const html = quill.root.innerHTML;
        // Treat empty editor as empty string
        onChange?.(html === "<p><br></p>" ? "" : html);
      });

      // Accessible names for the icon-only toolbar buttons
      const toolbarEl = quill.getModule("toolbar")?.container;
      toolbarEl?.setAttribute("aria-label", "Formatting");
      toolbarEl?.setAttribute("role", "toolbar");
      toolbarEl?.querySelectorAll("button").forEach((btn) => {
        const fmt = (btn.className.match(/ql-(\w+)/) || [])[1] || "";
        const val = btn.value ? ` ${btn.value}` : "";
        const names = { bold: "Bold", italic: "Italic", underline: "Underline", blockquote: "Blockquote", link: "Insert link", clean: "Clear formatting", "list ordered": "Numbered list", "list bullet": "Bulleted list" };
        btn.setAttribute("aria-label", names[`${fmt}${val}`] || names[fmt] || fmt);
      });

      quillRef.current = quill;
    });

    return () => {
      quillRef.current = null;
      initialized.current = false;
    };
  }, []);

  // Keep in sync if value is reset from outside (e.g. page reload/save)
  useEffect(() => {
    if (!quillRef.current) return;
    const current = quillRef.current.root.innerHTML;
    if (value !== current && (value === "" || value !== current)) {
      quillRef.current.clipboard.dangerouslyPasteHTML(value || "");
    }
  }, [value]);

  return (
    <div className="border border-[#dcdcde] overflow-hidden bg-white">
      <div ref={editorRef} />
    </div>
  );
}
