"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Quote, 
  Redo, 
  Undo,
  Heading1,
  Heading2,
  Code,
  Link as LinkIcon,
  Link2Off,
  ExternalLink
} from 'lucide-react';
import Link from '@tiptap/extension-link';

const MenuBar = ({ editor }) => {
  if (!editor) return null;

  const btnClass = (active) => `p-1.5 px-3 rounded-[2px] border border-transparent hover:border-[#c3c4c7] hover:bg-white transition-all ${active ? 'bg-white border-[#c3c4c7] shadow-sm' : ''}`;

  return (
    <div className="border-b border-[#c3c4c7] bg-[#f6f7f7] px-2 py-1 flex flex-wrap gap-1 sticky top-0 z-10">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btnClass(editor.isActive('bold'))}
      >
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btnClass(editor.isActive('italic'))}
      >
        <Italic className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={btnClass(editor.isActive('heading', { level: 1 }))}
      >
        <Heading1 className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btnClass(editor.isActive('heading', { level: 2 }))}
      >
        <Heading2 className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btnClass(editor.isActive('bulletList'))}
      >
        <List className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btnClass(editor.isActive('orderedList'))}
      >
        <ListOrdered className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btnClass(editor.isActive('blockquote'))}
      >
        <Quote className="w-3.5 h-3.5" />
      </button>
      <div className="w-[1px] h-4 bg-gray-300 mx-1 self-center" />
      <button
        type="button"
        onClick={() => {
          const url = window.prompt('Enter URL (use relative paths like /shop for Interlinks, or https:// for Outerlinks)');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        className={btnClass(editor.isActive('link'))}
        title="Insert Link (Outer/Inter)"
      >
        <LinkIcon className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().unsetLink().run()}
        disabled={!editor.isActive('link')}
        className={btnClass(false) + " disabled:opacity-30"}
        title="Remove Link"
      >
        <Link2Off className="w-3.5 h-3.5" />
      </button>
      <div className="w-[1px] h-4 bg-gray-300 mx-1 self-center" />
      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        className="p-1.5 px-3 rounded-[2px] border border-transparent hover:border-[#c3c4c7] hover:bg-white transition-all"
      >
        <Undo className="w-3.5 h-3.5 text-gray-400" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        className="p-1.5 px-3 rounded-[2px] border border-transparent hover:border-[#c3c4c7] hover:bg-white transition-all"
      >
        <Redo className="w-3.5 h-3.5 text-gray-400" />
      </button>
    </div>
  );
};

export default function TiptapEditor({ content, onChange }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[#2271b1] underline font-medium cursor-pointer transition-colors hover:text-[#135e96]',
        },
      }),
    ],
    content: content || '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[450px] p-8 text-[15px] leading-[1.6] max-w-none font-sans bg-white text-gray-800',
      },
    },
  });

  // Keep editor content in sync with external prop changes (e.g. initial load)
  useEffect(() => {
    if (editor && content !== undefined) {
      const currentHtml = editor.getHTML();
      if (content !== currentHtml && content !== '<p></p>') {
        editor.commands.setContent(content || '');
      }
    }
  }, [content, editor]);

  return (
    <div className="bg-white border border-[#c3c4c7] shadow-inner overflow-hidden">
      <MenuBar editor={editor} />
      <div className="tiptap-wrapper">
         <EditorContent editor={editor} />
      </div>
      <style jsx global>{`
        .tiptap-wrapper .ProseMirror {
          min-height: 450px;
          outline: none;
        }
        .tiptap-wrapper .ProseMirror > * { margin-top: 0; margin-bottom: 1rem; }
        .tiptap-wrapper .ProseMirror > *:last-child { margin-bottom: 0; }
        .tiptap-wrapper .ProseMirror h1 { font-size: 1.75rem; font-weight: 800; line-height: 1.2; margin-top: 1.5rem; color: #111; }
        .tiptap-wrapper .ProseMirror h2 { font-size: 1.4rem; font-weight: 700; line-height: 1.3; margin-top: 1.25rem; color: #222; }
        .tiptap-wrapper .ProseMirror p { margin-bottom: 0.75rem; }
        .tiptap-wrapper .ProseMirror ul { list-style-type: disc; padding-left: 1.5rem; margin-top: 0.25rem; margin-bottom: 0.75rem; }
        .tiptap-wrapper .ProseMirror ol { list-style-type: decimal; padding-left: 1.5rem; margin-top: 0.25rem; margin-bottom: 0.75rem; }
        .tiptap-wrapper .ProseMirror li { margin-bottom: 0.15rem; }
        .tiptap-wrapper .ProseMirror li p { margin-bottom: 0 !important; }
        .tiptap-wrapper .ProseMirror blockquote { border-left: 3px solid #e5e7eb; padding-left: 1.25rem; font-style: italic; color: #4b5563; margin: 1.5rem 0; }
        .tiptap-wrapper .ProseMirror *:first-child { margin-top: 0 !important; }
      `}</style>
    </div>
  );
}
