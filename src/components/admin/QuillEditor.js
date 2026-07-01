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
          border-bottom: 2px solid #000 !important;
          background: #fafafa;
          padding: 8px 12px;
          font-family: inherit;
        }
        .ql-container.ql-snow {
          border: none !important;
          font-family: inherit;
          font-size: 13px;
        }
        .ql-editor {
          min-height: ${height};
          color: #000;
          font-size: 13px;
          line-height: 1.7;
          padding: 14px 16px;
        }
        .ql-editor p { margin-bottom: 10px; color: #000; }
        .ql-editor h1 { font-size: 20px; font-weight: 900; color: #000; margin-bottom: 8px; }
        .ql-editor h2 { font-size: 16px; font-weight: 900; color: #000; margin-bottom: 6px; }
        .ql-editor h3 { font-size: 14px; font-weight: 700; color: #000; margin-bottom: 6px; }
        .ql-editor ul, .ql-editor ol { padding-left: 20px; color: #000; margin-bottom: 10px; }
        .ql-editor li { margin-bottom: 4px; color: #000; }
        .ql-editor blockquote { border-left: 3px solid #000; padding-left: 12px; color: #000; font-style: italic; }
        .ql-editor a { color: #000; text-decoration: underline; }
        .ql-editor.ql-blank::before { color: #999; font-style: normal; }
        .ql-snow .ql-stroke { stroke: #000 !important; }
        .ql-snow .ql-fill { fill: #000 !important; }
        .ql-snow .ql-picker { color: #000 !important; }
        .ql-snow .ql-picker-options { border: 2px solid #000 !important; }
        .ql-snow.ql-toolbar button:hover .ql-stroke,
        .ql-snow .ql-toolbar button:hover .ql-stroke,
        .ql-snow.ql-toolbar button.ql-active .ql-stroke,
        .ql-snow .ql-toolbar button.ql-active .ql-stroke { stroke: #000 !important; }
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
    <div className="border-2 border-black rounded overflow-hidden bg-white">
      <div ref={editorRef} />
    </div>
  );
}
