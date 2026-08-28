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
import { NodeSelection } from '@tiptap/pm/state';
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
  Settings,
  Trash2,
  RefreshCw,
  Sliders,
  Check
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

const MenuBar = ({ editor, onInsertImage, onReplaceImage }) => {
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
    const url = window.prompt('Enter URL (relative /page for internal, or https:// for external):', previousUrl);
    
    if (url === null) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    const openInNewTab = window.confirm('Open link in a new tab?');
    if (openInNewTab) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank', rel: 'noopener' }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_self', rel: null }).run();
    }
  };

  const insertVideo = () => {
    const url = window.prompt('Enter YouTube or Vimeo URL or Iframe source URL:');
    if (!url) return;

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
    <div className="border-b border-[#c3c4c7] bg-[#f6f7f7] px-3 py-2 sticky top-0 z-10 select-none">
      <div className="flex flex-wrap items-center gap-1.5">
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
          title="Insert Link (Do-Follow by default)"
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
      </div>

      {/* Comprehensive Image Settings Toolbar when image is clicked/selected */}
      {isImageActive && (
        <div className="w-full flex flex-wrap items-center gap-3 bg-blue-50 border border-blue-200 px-3 py-2 mt-2 rounded-[3px] shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-1.5 font-bold text-blue-900 text-[11px] uppercase tracking-wider pr-2 border-r border-blue-200">
            <Sliders className="w-3.5 h-3.5 text-blue-700" /> Image Settings:
          </div>

          {/* Width Preset / Custom */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-blue-800 font-semibold">Width:</span>
            <select
              value={['auto', '25%', '33%', '50%', '75%', '100%'].includes(imageAttrs.width) ? imageAttrs.width : 'custom'}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== 'custom') {
                  editor.chain().focus().updateAttributes('image', { width: val }).run();
                }
              }}
              className="text-[11px] border border-blue-300 bg-white rounded-[2px] px-1.5 py-1 text-gray-800 outline-none focus:border-blue-500 font-medium"
            >
              <option value="auto">Auto (100% max)</option>
              <option value="25%">25%</option>
              <option value="33%">33% (1/3)</option>
              <option value="50%">50% (Half)</option>
              <option value="75%">75%</option>
              <option value="100%">100% (Full)</option>
              <option value="custom">Custom (px or %)</option>
            </select>
            <input
              type="text"
              placeholder="e.g. 350px"
              value={imageAttrs.width || ''}
              onChange={(e) => editor.chain().focus().updateAttributes('image', { width: e.target.value }).run()}
              className="w-20 text-[11px] border border-blue-300 bg-white rounded-[2px] px-1.5 py-1 text-gray-800 outline-none focus:border-blue-500 font-medium"
              title="Custom width (e.g. 400px or 60%)"
            />
          </div>

          {/* Height */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-blue-800 font-semibold">Height:</span>
            <input
              type="text"
              placeholder="auto or px"
              value={imageAttrs.height || ''}
              onChange={(e) => editor.chain().focus().updateAttributes('image', { height: e.target.value }).run()}
              className="w-20 text-[11px] border border-blue-300 bg-white rounded-[2px] px-1.5 py-1 text-gray-800 outline-none focus:border-blue-500 font-medium"
              title="Custom height (e.g. 250px or auto)"
            />
          </div>

          {/* Alignment & Text Wrap */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-blue-800 font-semibold">Align & Wrap:</span>
            <select
              value={imageAttrs.align || 'center'}
              onChange={(e) => editor.chain().focus().updateAttributes('image', { align: e.target.value }).run()}
              className="text-[11px] border border-blue-300 bg-white rounded-[2px] px-1.5 py-1 text-gray-800 outline-none focus:border-blue-500 font-medium"
            >
              <option value="center">Center Block (No wrap)</option>
              <option value="left">Left Block (No wrap)</option>
              <option value="right">Right Block (No wrap)</option>
              <option value="float-left">Wrap Left (Text flows right)</option>
              <option value="float-right">Wrap Right (Text flows left)</option>
            </select>
          </div>

          {/* Alt Text */}
          <div className="flex items-center gap-1 flex-1 min-w-[140px]">
            <span className="text-[11px] text-blue-800 font-semibold">Alt:</span>
            <input
              type="text"
              placeholder="SEO image alt description..."
              value={imageAttrs.alt || ''}
              onChange={(e) => editor.chain().focus().updateAttributes('image', { alt: e.target.value }).run()}
              className="flex-1 text-[11px] border border-blue-300 bg-white rounded-[2px] px-2 py-1 text-gray-800 outline-none focus:border-blue-500 font-medium"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            {onReplaceImage && (
              <button 
                type="button"
                onClick={onReplaceImage} 
                className="flex items-center gap-1 text-[11px] text-blue-700 bg-white border border-blue-300 px-2 py-1 rounded-[2px] hover:bg-blue-100 font-semibold transition-colors"
                title="Replace with another image from media library"
              >
                <RefreshCw className="w-3 h-3" /> Replace
              </button>
            )}
            <button 
              type="button"
              onClick={() => editor.chain().focus().deleteSelection().run()} 
              className="flex items-center gap-1 text-[11px] text-red-600 bg-white border border-red-200 px-2 py-1 rounded-[2px] hover:bg-red-50 font-semibold transition-colors"
              title="Remove image"
            >
              <Trash2 className="w-3 h-3" /> Remove
            </button>
            <button 
              type="button"
              onClick={() => editor.chain().focus().selectParentNode().run()} 
              className="flex items-center gap-1 text-[11px] text-white bg-blue-600 px-2.5 py-1 rounded-[2px] hover:bg-blue-700 font-semibold transition-colors shadow-sm"
              title="Done editing image"
            >
              <Check className="w-3 h-3" /> Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function TiptapEditor({ content, onChange }) {
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [isReplacingImage, setIsReplacingImage] = useState(false);

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
          rel: null,
        },
      }),
      TiptapImage.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'editorial-inserted-image rounded-lg shadow-sm',
        },
      }).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            src: {
              default: null,
              parseHTML: el => el.getAttribute('src'),
              renderHTML: attrs => attrs.src ? { src: attrs.src } : {},
            },
            alt: {
              default: '',
              parseHTML: el => el.getAttribute('alt') || '',
              renderHTML: attrs => ({ alt: attrs.alt || '' }),
            },
            title: {
              default: '',
              parseHTML: el => el.getAttribute('title') || '',
              renderHTML: attrs => attrs.title ? { title: attrs.title } : {},
            },
            width: {
              default: 'auto',
              parseHTML: el => el.getAttribute('width') || el.style?.width || 'auto',
              renderHTML: attrs => {
                if (!attrs.width || attrs.width === 'auto') return {};
                return {
                  width: attrs.width,
                  style: `width: ${attrs.width}; max-width: 100%;`
                };
              },
            },
            height: {
              default: 'auto',
              parseHTML: el => el.getAttribute('height') || el.style?.height || 'auto',
              renderHTML: attrs => {
                if (!attrs.height || attrs.height === 'auto') return {};
                return {
                  height: attrs.height,
                  style: `height: ${attrs.height};`
                };
              },
            },
            align: {
              default: 'center',
              parseHTML: el => el.getAttribute('data-align') || 'center',
              renderHTML: attrs => {
                const align = attrs.align || 'center';
                let alignClass = 'mx-auto block my-6';
                if (align === 'left') alignClass = 'mr-auto ml-0 block my-6';
                if (align === 'right') alignClass = 'ml-auto mr-0 block my-6';
                if (align === 'float-left') alignClass = 'float-left mr-6 mb-4 mt-2';
                if (align === 'float-right') alignClass = 'float-right ml-6 mb-4 mt-2';
                return {
                  'data-align': align,
                  class: `editorial-inserted-image rounded-lg shadow-sm ${alignClass}`
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
      handleClick(view, pos, event) {
        if (event.target && event.target.tagName === 'IMG') {
          const nodePos = view.posAtDOM(event.target, 0);
          if (typeof nodePos === 'number' && nodePos >= 0) {
            try {
              const nodeSelection = NodeSelection.create(view.state.doc, nodePos);
              view.dispatch(view.state.tr.setSelection(nodeSelection));
              return true;
            } catch (err) {
              // ignore
            }
          }
        }
        return false;
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

  const handleOpenMedia = (isReplace = false) => {
    setIsReplacingImage(isReplace);
    setMediaModalOpen(true);
  };

  return (
    <div className="bg-white border border-[#c3c4c7] shadow-inner overflow-hidden relative">
      <MenuBar 
        editor={editor} 
        onInsertImage={() => handleOpenMedia(false)}
        onReplaceImage={() => handleOpenMedia(true)}
      />
      <div className="tiptap-wrapper">
         <EditorContent editor={editor} />
      </div>
      <MediaPickerModal 
        open={mediaModalOpen} 
        onClose={() => setMediaModalOpen(false)} 
        onSelect={(media) => {
          if (media && media.url) {
            if (isReplacingImage && editor) {
              editor.chain().focus().updateAttributes('image', { src: media.url, alt: media.filename || '' }).run();
            } else if (editor) {
              editor.chain().focus().setImage({ src: media.url, alt: media.filename || '' }).run();
            }
          }
          setMediaModalOpen(false);
          setIsReplacingImage(false);
        }}
        title={isReplacingImage ? "Select Replacement Image" : "Select Media to Insert"}
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
        .tiptap-wrapper .ProseMirror img { max-width: 100%; border-radius: 8px; }
        .tiptap-wrapper .ProseMirror img.ProseMirror-selectednode { outline: 3px solid #2271b1; outline-offset: 2px; }
        .tiptap-wrapper .ProseMirror img[data-align="center"], .tiptap-wrapper .ProseMirror img:not([data-align]) { margin: 1.5rem auto; display: block; }
        .tiptap-wrapper .ProseMirror img[data-align="left"] { margin: 1.5rem auto 1.5rem 0; display: block; }
        .tiptap-wrapper .ProseMirror img[data-align="right"] { margin: 1.5rem 0 1.5rem auto; display: block; }
        .tiptap-wrapper .ProseMirror img[data-align="float-left"] { float: left; margin: 0.5rem 1.5rem 1rem 0; display: inline-block; }
        .tiptap-wrapper .ProseMirror img[data-align="float-right"] { float: right; margin: 0.5rem 0 1rem 1.5rem; display: inline-block; }
        .tiptap-wrapper .ProseMirror *:first-child { margin-top: 0 !important; }
        .video-wrapper iframe { width: 100%; height: 100%; border-radius: 8px; border: 0; }
      `}</style>
    </div>
  );
}
