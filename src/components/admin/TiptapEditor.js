"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Link } from '@tiptap/extension-link';
import { Image as TiptapImage } from '@tiptap/extension-image';
import { Extension, Node } from '@tiptap/core';
import { useEffect, useState } from 'react';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon,
  Strikethrough,
  List, 
  ListOrdered, 
  Quote, 
  Redo, 
  Undo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link as LinkIcon,
  Link2Off,
  Image as ImageIcon,
  Video as VideoIcon,
  Eraser,
  HelpCircle,
  Settings
} from 'lucide-react';
import MediaPickerModal from './MediaPickerModal';

// --- CUSTOM FONT SIZE EXTENSION ---
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: element => element.style.fontSize,
        renderHTML: attributes => {
          if (!attributes.fontSize) {
            return {};
          }
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
    };
  },
  addCommands() {
    return {
      setFontSize: fontSize => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize }).run();
      },
      unsetFontSize: () => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize: null }).run();
      },
    };
  },
});

// --- CUSTOM IFRAME (VIDEO EMBED) EXTENSION ---
const Iframe = Node.create({
  name: 'iframe',
  group: 'block',
  selectable: true,
  draggable: true,
  atom: true,
  addAttributes() {
    return {
      src: {
        default: null,
      },
      width: {
        default: '100%',
      },
      height: {
        default: '450',
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'iframe',
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { class: 'video-wrapper aspect-video w-full my-6' }, ['iframe', { ...HTMLAttributes, class: 'w-full h-full rounded-lg border-0 shadow-sm', allowfullscreen: 'true' }]];
  },
  addCommands() {
    return {
      setIframe: options => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        });
      },
    };
  },
});

const MenuBar = ({ editor, onInsertImage }) => {
  if (!editor) return null;

  const btnClass = (active) => `p-2 rounded-[2px] border border-transparent hover:border-[#c3c4c7] hover:bg-white transition-all ${active ? 'bg-white border-[#c3c4c7] shadow-sm text-[#2271b1]' : 'text-gray-600'}`;

  // Helper to determine the current heading level or paragraph
  const getHeadingValue = () => {
    if (editor.isActive('heading', { level: 1 })) return 'h1';
    if (editor.isActive('heading', { level: 2 })) return 'h2';
    if (editor.isActive('heading', { level: 3 })) return 'h3';
    if (editor.isActive('heading', { level: 4 })) return 'h4';
    if (editor.isActive('heading', { level: 5 })) return 'h5';
    if (editor.isActive('heading', { level: 6 })) return 'h6';
    return 'p';
  };

  const handleHeadingChange = (e) => {
    const val = e.target.value;
    if (val === 'p') {
      editor.chain().focus().setParagraph().run();
    } else {
      const level = parseInt(val.replace('h', ''));
      editor.chain().focus().toggleHeading({ level }).run();
    }
  };

  const handleFontSizeChange = (e) => {
    const val = e.target.value;
    if (val === 'default') {
      editor.chain().focus().unsetFontSize().run();
    } else {
      editor.chain().focus().setFontSize(val).run();
    }
  };

  const handleColorChange = (e) => {
    const val = e.target.value;
    if (val === 'default') {
      editor.chain().focus().unsetColor().run();
    } else {
      editor.chain().focus().setColor(val).run();
    }
  };

  const handleHighlightChange = (e) => {
    const val = e.target.value;
    if (val === 'none') {
      editor.chain().focus().unsetHighlight().run();
    } else {
      editor.chain().focus().toggleHighlight({ color: val }).run();
    }
  };

  const insertLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL (use relative paths like /shop for Interlinks, or https:// for Outerlinks):', previousUrl);
    
    // cancelled
    if (url === null) return;

    // empty
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    const openInNewTab = window.confirm('Open link in a new tab?');
    if (openInNewTab) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank' }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_self' }).run();
    }
  };

  const insertVideo = () => {
    const url = window.prompt('Enter YouTube or Vimeo URL or Iframe source URL:');
    if (!url) return;

    // If YouTube watch link, convert to embed link
    let embedUrl = url;
    if (url.includes('youtube.com/watch')) {
      const videoId = new URL(url).searchParams.get('v');
      if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes('youtu.be/')) {
      const videoId = url.split('/').pop()?.split('?')[0];
      if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}`;
    }

    editor.chain().focus().setIframe({ src: embedUrl }).run();
  };

  const clearFormatting = () => {
    editor.chain().focus().unsetAllMarks().clearNodes().run();
  };

  const isImageActive = editor.isActive('image');
  const imageAttrs = isImageActive ? editor.getAttributes('image') : {};

  const selectClass = "text-[12px] border border-[#c3c4c7] bg-white px-2 py-1.5 rounded-[2px] outline-none hover:border-[#8c8f94] transition-all cursor-pointer font-medium text-gray-700 h-[32px] flex items-center";

  return (
    <div className="border-b border-[#c3c4c7] bg-[#f6f7f7] px-3 py-2 flex flex-wrap items-center gap-1.5 sticky top-0 z-10 select-none">
      {/* Block / Headings Type */}
      <select 
        value={getHeadingValue()} 
        onChange={handleHeadingChange}
        className={selectClass}
      >
        <option value="p">Paragraph</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="h4">Heading 4</option>
        <option value="h5">Heading 5</option>
        <option value="h6">Heading 6</option>
      </select>

      {/* Font Size Dropdown */}
      <select 
        onChange={handleFontSizeChange}
        className={selectClass}
        title="Font Size"
        defaultValue="default"
      >
        <option value="default">Size (Default)</option>
        <option value="12px">12px</option>
        <option value="14px">14px</option>
        <option value="16px">16px</option>
        <option value="18px">18px</option>
        <option value="20px">20px</option>
        <option value="24px">24px</option>
        <option value="30px">30px</option>
        <option value="36px">36px</option>
        <option value="48px">48px</option>
      </select>

      <div className="w-[1px] h-5 bg-gray-300 mx-0.5" />

      {/* Core Typography Styles */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btnClass(editor.isActive('bold'))}
        title="Bold"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btnClass(editor.isActive('italic'))}
        title="Italic"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={btnClass(editor.isActive('underline'))}
        title="Underline"
      >
        <UnderlineIcon className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btnClass(editor.isActive('strike'))}
        title="Strikethrough"
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </button>

      <div className="w-[1px] h-5 bg-gray-300 mx-0.5" />

      {/* Color Selectors */}
      <select 
        onChange={handleColorChange}
        className={selectClass}
        title="Text Color"
        defaultValue="default"
      >
        <option value="default">Color (Default)</option>
        <option value="#1f2937">Charcoal</option>
        <option value="#ef4444">Red</option>
        <option value="#3b82f6">Blue</option>
        <option value="#10b981">Green</option>
        <option value="#f59e0b">Amber</option>
        <option value="#8b5cf6">Purple</option>
        <option value="#ec4899">Pink</option>
        <option value="#ffffff">White</option>
      </select>

      <select 
        onChange={handleHighlightChange}
        className={selectClass}
        title="Background Highlight"
        defaultValue="none"
      >
        <option value="none">Highlight (None)</option>
        <option value="#fef08a">Yellow</option>
        <option value="#bbf7d0">Green</option>
        <option value="#bfdbfe">Blue</option>
        <option value="#fbcfe8">Pink</option>
        <option value="#e9d5ff">Purple</option>
      </select>

      <div className="w-[1px] h-5 bg-gray-300 mx-0.5" />

      {/* Alignment */}
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        className={btnClass(editor.isActive({ textAlign: 'left' }))}
        title="Align Left"
      >
        <AlignLeft className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        className={btnClass(editor.isActive({ textAlign: 'center' }))}
        title="Align Center"
      >
        <AlignCenter className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        className={btnClass(editor.isActive({ textAlign: 'right' }))}
        title="Align Right"
      >
        <AlignRight className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        className={btnClass(editor.isActive({ textAlign: 'justify' }))}
        title="Justify"
      >
        <AlignJustify className="w-3.5 h-3.5" />
      </button>

      <div className="w-[1px] h-5 bg-gray-300 mx-0.5" />

      {/* Lists & Blockquote */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btnClass(editor.isActive('bulletList'))}
        title="Unordered List"
      >
        <List className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btnClass(editor.isActive('orderedList'))}
        title="Ordered List"
      >
        <ListOrdered className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btnClass(editor.isActive('blockquote'))}
        title="Blockquote"
      >
        <Quote className="w-3.5 h-3.5" />
      </button>

      <div className="w-[1px] h-5 bg-gray-300 mx-0.5" />

      {/* Links */}
      <button
        type="button"
        onClick={insertLink}
        className={btnClass(editor.isActive('link'))}
        title="Insert Link"
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

      <div className="w-[1px] h-5 bg-gray-300 mx-0.5" />

      {/* Media Inserts */}
      <button
        type="button"
        onClick={onInsertImage}
        className={btnClass(false)}
        title="Insert Image"
      >
        <ImageIcon className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={insertVideo}
        className={btnClass(false)}
        title="Embed Video"
      >
        <VideoIcon className="w-3.5 h-3.5" />
      </button>

      <div className="w-[1px] h-5 bg-gray-300 mx-0.5" />

      {/* Utilities */}
      <button
        type="button"
        onClick={clearFormatting}
        className="p-2 rounded-[2px] border border-transparent hover:border-[#c3c4c7] hover:bg-white text-gray-600 transition-all"
        title="Clear Formatting"
      >
        <Eraser className="w-3.5 h-3.5" />
      </button>
      
      <div className="flex-1" />

      {/* Undo / Redo */}
      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        className="p-2 rounded-[2px] text-gray-500 hover:text-gray-800"
        title="Undo"
      >
        <Undo className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        className="p-2 rounded-[2px] text-gray-500 hover:text-gray-800"
        title="Redo"
      >
        <Redo className="w-3.5 h-3.5" />
      </button>

      {/* Image Settings Overlay Bar when image is clicked */}
      {isImageActive && (
        <div className="w-full flex items-center gap-4 bg-blue-50 border border-blue-200 px-3 py-1.5 mt-2 rounded-[2px] animate-in fade-in duration-200">
          <span className="text-[11px] font-bold text-blue-800 flex items-center gap-1">
            <Settings className="w-3.5 h-3.5" /> SELECTED IMAGE:
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-blue-600 font-semibold">Width:</span>
            <select
              value={imageAttrs.width || 'auto'}
              onChange={(e) => editor.chain().focus().updateAttributes('image', { width: e.target.value }).run()}
              className="text-[11px] border border-blue-300 bg-white rounded-[2px] px-1 py-0.5"
            >
              <option value="auto">Auto (Default)</option>
              <option value="25%">25%</option>
              <option value="50%">50%</option>
              <option value="75%">75%</option>
              <option value="100%">100%</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-blue-600 font-semibold">Align:</span>
            <select
              value={imageAttrs.align || 'center'}
              onChange={(e) => editor.chain().focus().updateAttributes('image', { align: e.target.value }).run()}
              className="text-[11px] border border-blue-300 bg-white rounded-[2px] px-1 py-0.5"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[11px] text-blue-600 font-semibold">Alt Text:</span>
            <input
              type="text"
              placeholder="Add description..."
              value={imageAttrs.alt || ''}
              onChange={(e) => editor.chain().focus().updateAttributes('image', { alt: e.target.value }).run()}
              className="text-[11px] border border-blue-300 bg-white rounded-[2px] px-2 py-0.5 flex-1 outline-none focus:border-blue-500"
            />
          </div>
          <button 
            onClick={() => editor.chain().focus().selectParentNode().run()} 
            className="text-[11px] text-blue-700 underline font-medium hover:text-blue-900"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
};

export default function TiptapEditor({ content, onChange }) {
  const [mediaModalOpen, setMediaModalOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      FontSize,
      Iframe,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[#2271b1] underline font-medium cursor-pointer transition-colors hover:text-[#135e96]',
        },
      }),
      TiptapImage.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'editorial-inserted-image rounded-lg h-auto my-6 shadow-sm',
        },
      }).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            width: {
              default: 'auto',
              renderHTML: attributes => {
                if (!attributes.width || attributes.width === 'auto') return {};
                return {
                  style: `width: ${attributes.width}; max-width: 100%;`
                };
              },
            },
            align: {
              default: 'center',
              renderHTML: attributes => {
                let alignClass = 'mx-auto block';
                if (attributes.align === 'left') alignClass = 'mr-auto ml-0 block';
                if (attributes.align === 'right') alignClass = 'ml-auto mr-0 block';
                return {
                  class: `editorial-inserted-image rounded-lg h-auto my-6 shadow-sm ${alignClass}`
                };
              }
            }
          };
        }
      }),
    ],
    content: content || '',
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
    <div className="bg-white border border-[#c3c4c7] shadow-inner overflow-hidden relative">
      <MenuBar editor={editor} onInsertImage={() => setMediaModalOpen(true)} />
      <div className="tiptap-wrapper">
         <EditorContent editor={editor} />
      </div>
      <MediaPickerModal 
        open={mediaModalOpen} 
        onClose={() => setMediaModalOpen(false)} 
        onSelect={(media) => {
          if (media && media.url) {
            editor.chain().focus().setImage({ src: media.url, alt: media.filename || '' }).run();
          }
          setMediaModalOpen(false);
        }}
        title="Select Media to Insert"
      />
      <style jsx global>{`
        .tiptap-wrapper .ProseMirror {
          min-height: 450px;
          outline: none;
        }
        .tiptap-wrapper .ProseMirror > * { margin-top: 0; margin-bottom: 1rem; }
        .tiptap-wrapper .ProseMirror > *:last-child { margin-bottom: 0; }
        .tiptap-wrapper .ProseMirror h1 { font-size: 2rem; font-weight: 800; line-height: 1.2; margin-top: 2rem; color: #111; }
        .tiptap-wrapper .ProseMirror h2 { font-size: 1.6rem; font-weight: 700; line-height: 1.3; margin-top: 1.75rem; color: #222; }
        .tiptap-wrapper .ProseMirror h3 { font-size: 1.35rem; font-weight: 700; line-height: 1.3; margin-top: 1.5rem; color: #333; }
        .tiptap-wrapper .ProseMirror h4 { font-size: 1.15rem; font-weight: 700; line-height: 1.4; margin-top: 1.25rem; color: #444; }
        .tiptap-wrapper .ProseMirror h5 { font-size: 1rem; font-weight: 700; line-height: 1.4; margin-top: 1.25rem; color: #555; }
        .tiptap-wrapper .ProseMirror h6 { font-size: 0.875rem; font-weight: 700; line-height: 1.4; margin-top: 1.25rem; color: #666; }
        .tiptap-wrapper .ProseMirror p { margin-bottom: 0.75rem; }
        .tiptap-wrapper .ProseMirror ul { list-style-type: disc; padding-left: 1.5rem; margin-top: 0.25rem; margin-bottom: 0.75rem; }
        .tiptap-wrapper .ProseMirror ol { list-style-type: decimal; padding-left: 1.5rem; margin-top: 0.25rem; margin-bottom: 0.75rem; }
        .tiptap-wrapper .ProseMirror li { margin-bottom: 0.15rem; }
        .tiptap-wrapper .ProseMirror li p { margin-bottom: 0 !important; }
        .tiptap-wrapper .ProseMirror blockquote { border-left: 3px solid #e5e7eb; padding-left: 1.25rem; font-style: italic; color: #4b5563; margin: 1.5rem 0; }
        .tiptap-wrapper .ProseMirror img { max-width: 100%; border-radius: 8px; margin: 1.5rem auto; display: block; }
        .tiptap-wrapper .ProseMirror *:first-child { margin-top: 0 !important; }
        .video-wrapper iframe { width: 100%; height: 100%; border-radius: 8px; border: 0; }
      `}</style>
    </div>
  );
}
