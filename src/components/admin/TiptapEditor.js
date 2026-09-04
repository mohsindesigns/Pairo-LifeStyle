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
import { useEffect, useState, useRef } from 'react';
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
  Check,
  X,
  Sparkles
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

const MenuBar = ({ editor, onInsertImage, selectedImage, onOpenImageEditor }) => {
  if (!editor) return null;

  const btnClass = (active) => `p-2 rounded-[2px] border border-transparent hover:border-[#c3c4c7] hover:bg-white transition-all ${active ? 'bg-white border-[#c3c4c7] shadow-sm text-[#2271b1]' : 'text-gray-600'}`;

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

        {/* Lists & Quotes */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btnClass(editor.isActive('bulletList'))}
          title="Bullet List"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btnClass(editor.isActive('orderedList'))}
          title="Numbered List"
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
        {editor.isActive('link') && (
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetLink().run()}
            className={btnClass(false)}
            title="Unlink"
          >
            <Link2Off className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Media Inserts */}
        <button
          type="button"
          onClick={onInsertImage}
          className="flex items-center gap-1 bg-[#2271b1] text-white px-2.5 py-1 text-[12px] font-semibold rounded-[2px] hover:bg-[#135e96] transition-colors ml-1"
          title="Add Media / Image from Library"
        >
          <ImageIcon className="w-3.5 h-3.5" /> Add Image
        </button>

        <button
          type="button"
          onClick={insertVideo}
          className="flex items-center gap-1 bg-white border border-[#c3c4c7] text-gray-700 px-2 py-1 text-[12px] font-semibold rounded-[2px] hover:bg-gray-50 transition-colors"
          title="Embed Video (YouTube / Vimeo)"
        >
          <VideoIcon className="w-3.5 h-3.5" /> Embed Video
        </button>

        {selectedImage && (
          <button
            type="button"
            onClick={onOpenImageEditor}
            className="flex items-center gap-1 bg-amber-500 text-white px-2.5 py-1 text-[12px] font-bold rounded-[2px] hover:bg-amber-600 transition-colors animate-pulse"
            title="Selected Image Options"
          >
            <Sliders className="w-3.5 h-3.5" /> Edit Image Size/Align
          </button>
        )}

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
    </div>
  );
};

// --- IMAGE EDIT PANEL (ALWAYS VISIBLE & WORKING WHEN AN IMAGE IS CLICKED) ---
const ImageEditPanel = ({ selectedImage, onUpdate, onReplace, onRemove, onClose }) => {
  if (!selectedImage) return null;

  return (
    <div className="w-full bg-[#f0f6fc] border-b border-[#2271b1]/30 p-3 shadow-md transition-all select-none animate-in fade-in slide-in-from-top-2 duration-150">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#2271b1] text-white flex items-center justify-center font-bold">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[12px] font-bold text-[#1d2327] uppercase tracking-wider block">
              Image Customization
            </span>
            <span className="text-[10px] text-gray-500 block truncate max-w-[200px]">
              {selectedImage.alt || selectedImage.src?.split('/').pop() || 'Selected Image'}
            </span>
          </div>
        </div>

        {/* Controls Container */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Width Preset / Custom */}
          <div className="flex items-center gap-1 bg-white border border-[#c3c4c7] px-2 py-1 rounded-[2px]">
            <span className="text-[11px] font-bold text-gray-700">Width:</span>
            <select
              value={['auto', '25%', '33%', '50%', '75%', '100%'].includes(selectedImage.width) ? selectedImage.width : 'custom'}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== 'custom') {
                  onUpdate({ width: val });
                }
              }}
              className="text-[11px] bg-transparent outline-none font-semibold text-[#2271b1] cursor-pointer"
            >
              <option value="auto">Auto (Original)</option>
              <option value="25%">25% Width</option>
              <option value="33%">33% Width (1/3)</option>
              <option value="50%">50% Width (Half)</option>
              <option value="75%">75% Width</option>
              <option value="100%">100% Full Width</option>
              <option value="custom">Custom (px/%)</option>
            </select>
            <input
              type="text"
              placeholder="e.g. 400px"
              value={selectedImage.width || ''}
              onChange={(e) => onUpdate({ width: e.target.value })}
              className="w-16 text-[11px] border-l border-gray-200 pl-1.5 text-gray-800 outline-none font-medium bg-transparent"
              title="Custom width (e.g. 350px or 60%)"
            />
          </div>

          {/* Height */}
          <div className="flex items-center gap-1 bg-white border border-[#c3c4c7] px-2 py-1 rounded-[2px]">
            <span className="text-[11px] font-bold text-gray-700">Height:</span>
            <input
              type="text"
              placeholder="auto or px"
              value={selectedImage.height || ''}
              onChange={(e) => onUpdate({ height: e.target.value })}
              className="w-16 text-[11px] text-gray-800 outline-none font-medium bg-transparent"
              title="Custom height (e.g. 250px or auto)"
            />
          </div>

          {/* Alignment & Text Wrap */}
          <div className="flex items-center gap-1 bg-white border border-[#c3c4c7] px-2 py-1 rounded-[2px]">
            <span className="text-[11px] font-bold text-gray-700">Align:</span>
            <select
              value={selectedImage.align || 'center'}
              onChange={(e) => onUpdate({ align: e.target.value })}
              className="text-[11px] bg-transparent outline-none font-semibold text-gray-800 cursor-pointer"
            >
              <option value="center">Center Block (No wrap)</option>
              <option value="left">Left Block (No wrap)</option>
              <option value="right">Right Block (No wrap)</option>
              <option value="float-left">Wrap Left (Float)</option>
              <option value="float-right">Wrap Right (Float)</option>
            </select>
          </div>

          {/* Alt Text */}
          <div className="flex items-center gap-1 bg-white border border-[#c3c4c7] px-2 py-1 rounded-[2px] min-w-[140px]">
            <span className="text-[11px] font-bold text-gray-700">Alt:</span>
            <input
              type="text"
              placeholder="SEO alt text..."
              value={selectedImage.alt || ''}
              onChange={(e) => onUpdate({ alt: e.target.value })}
              className="w-28 text-[11px] text-gray-800 outline-none font-medium bg-transparent"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onReplace}
              className="flex items-center gap-1 bg-[#2271b1] text-white px-2.5 py-1 text-[11px] font-bold rounded-[2px] hover:bg-[#135e96] transition-colors"
              title="Replace image from media library"
            >
              <RefreshCw className="w-3 h-3" /> Replace
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="flex items-center gap-1 bg-white border border-red-300 text-red-600 px-2 py-1 text-[11px] font-bold rounded-[2px] hover:bg-red-50 transition-colors"
              title="Delete this image"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1 bg-emerald-600 text-white px-2.5 py-1 text-[11px] font-bold rounded-[2px] hover:bg-emerald-700 transition-colors shadow-sm"
              title="Save & Close image toolbar"
            >
              <Check className="w-3 h-3" /> Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function TiptapEditor({ content, onChange }) {
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [isReplacingImage, setIsReplacingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const editorContainerRef = useRef(null);

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
    onSelectionUpdate: ({ editor }) => {
      if (editor.isActive('image')) {
        const attrs = editor.getAttributes('image');
        setSelectedImage(prev => ({
          ...(prev || {}),
          ...attrs
        }));
      }
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[450px] p-8 text-[15px] leading-[1.6] max-w-none font-sans bg-white text-gray-800',
      },
      handleClick(view, pos, event) {
        const target = event.target;
        if (target && target.tagName === 'IMG') {
          try {
            const domPos = view.posAtDOM(target, 0);
            if (typeof domPos === 'number' && domPos >= 0) {
              const $pos = view.state.doc.resolve(domPos);
              let nodePos = domPos;
              if ($pos.nodeAfter && $pos.nodeAfter.type.name === 'image') {
                nodePos = domPos;
              } else if ($pos.nodeBefore && $pos.nodeBefore.type.name === 'image') {
                nodePos = domPos - $pos.nodeBefore.nodeSize;
              } else if ($pos.parent && $pos.parent.type.name === 'image') {
                nodePos = $pos.before();
              }
              const nodeSelection = NodeSelection.create(view.state.doc, nodePos);
              view.dispatch(view.state.tr.setSelection(nodeSelection));
              
              setSelectedImage({
                src: target.getAttribute('src') || '',
                alt: target.getAttribute('alt') || '',
                title: target.getAttribute('title') || '',
                width: target.getAttribute('width') || target.style?.width || 'auto',
                height: target.getAttribute('height') || target.style?.height || 'auto',
                align: target.getAttribute('data-align') || 'center',
                pos: nodePos
              });
              return true;
            }
          } catch (err) {
            // fallback selection
          }

          setSelectedImage({
            src: target.getAttribute('src') || '',
            alt: target.getAttribute('alt') || '',
            title: target.getAttribute('title') || '',
            width: target.getAttribute('width') || target.style?.width || 'auto',
            height: target.getAttribute('height') || target.style?.height || 'auto',
            align: target.getAttribute('data-align') || 'center',
            pos: null
          });
          return true;
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

  // Click listener directly on DOM images inside editor to guarantee image click detection
  const handleWrapperClick = (e) => {
    const img = e.target.closest('img');
    if (img) {
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      const title = img.getAttribute('title') || '';
      const width = img.getAttribute('width') || img.style?.width || 'auto';
      const height = img.getAttribute('height') || img.style?.height || 'auto';
      const align = img.getAttribute('data-align') || 'center';

      let foundPos = null;
      if (editor && editor.view) {
        try {
          const domPos = editor.view.posAtDOM(img, 0);
          if (typeof domPos === 'number' && domPos >= 0) {
            const $pos = editor.state.doc.resolve(domPos);
            let nodePos = domPos;
            if ($pos.nodeAfter && $pos.nodeAfter.type.name === 'image') {
              nodePos = domPos;
            } else if ($pos.nodeBefore && $pos.nodeBefore.type.name === 'image') {
              nodePos = domPos - $pos.nodeBefore.nodeSize;
            } else if ($pos.parent && $pos.parent.type.name === 'image') {
              nodePos = $pos.before();
            }
            const nodeSelection = NodeSelection.create(editor.state.doc, nodePos);
            editor.view.dispatch(editor.state.tr.setSelection(nodeSelection));
            foundPos = nodePos;
          }
        } catch (err) {}
      }

      setSelectedImage({
        src,
        alt,
        title,
        width,
        height,
        align,
        pos: foundPos
      });
    }
  };

  const updateSelectedImage = (attrs) => {
    if (!editor) return;

    setSelectedImage(prev => prev ? ({ ...prev, ...attrs }) : null);

    if (selectedImage?.pos !== null && selectedImage?.pos !== undefined) {
      try {
        const node = editor.state.doc.nodeAt(selectedImage.pos);
        if (node && node.type.name === 'image') {
          const tr = editor.state.tr.setNodeMarkup(selectedImage.pos, undefined, {
            ...node.attrs,
            ...attrs
          });
          editor.view.dispatch(tr);
          onChange(editor.getHTML());
          return;
        }
      } catch (err) {}
    }

    editor.chain().focus().updateAttributes('image', attrs).run();
  };

  const handleOpenMedia = (isReplace = false) => {
    setIsReplacingImage(isReplace);
    setMediaModalOpen(true);
  };

  const handleRemoveImage = () => {
    if (!editor) return;
    if (selectedImage?.pos !== null && selectedImage?.pos !== undefined) {
      try {
        const node = editor.state.doc.nodeAt(selectedImage.pos);
        if (node) {
          const tr = editor.state.tr.delete(selectedImage.pos, selectedImage.pos + node.nodeSize);
          editor.view.dispatch(tr);
          setSelectedImage(null);
          onChange(editor.getHTML());
          return;
        }
      } catch (err) {}
    }
    editor.chain().focus().deleteSelection().run();
    setSelectedImage(null);
  };

  return (
    <div className="bg-white border border-[#c3c4c7] shadow-inner overflow-hidden relative">
      <MenuBar 
        editor={editor} 
        onInsertImage={() => handleOpenMedia(false)}
        selectedImage={selectedImage}
        onOpenImageEditor={() => {}}
      />
      
      {/* Comprehensive Image Editing Panel */}
      <ImageEditPanel 
        selectedImage={selectedImage}
        onUpdate={updateSelectedImage}
        onReplace={() => handleOpenMedia(true)}
        onRemove={handleRemoveImage}
        onClose={() => setSelectedImage(null)}
      />

      <div 
        ref={editorContainerRef} 
        onClick={handleWrapperClick}
        className="tiptap-wrapper"
      >
         <EditorContent editor={editor} />
      </div>

      <MediaPickerModal 
        open={mediaModalOpen} 
        onClose={() => {
          setMediaModalOpen(false);
          setIsReplacingImage(false);
        }} 
        onSelect={(media) => {
          if (media && media.url) {
            if (isReplacingImage && selectedImage) {
              updateSelectedImage({ src: media.url, alt: media.filename || '' });
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
        .tiptap-wrapper .ProseMirror img { 
          max-width: 100%; 
          border-radius: 8px; 
          cursor: pointer;
          transition: outline 0.15s ease, box-shadow 0.15s ease;
        }
        .tiptap-wrapper .ProseMirror img:hover { 
          outline: 2px dashed #2271b1; 
          outline-offset: 3px; 
        }
        .tiptap-wrapper .ProseMirror img.ProseMirror-selectednode { 
          outline: 3px solid #2271b1 !important; 
          outline-offset: 4px !important; 
          box-shadow: 0 0 0 6px rgba(34, 113, 177, 0.15);
        }
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
