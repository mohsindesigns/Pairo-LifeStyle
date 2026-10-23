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
import { useEffect, useState, useRef, useId } from 'react';
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
import { usePopup } from '@/context/PopupContext';
import ThemedSelect from "@/components/ui/ThemedSelect";

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
  const { showPrompt, showConfirm } = usePopup();
  if (!editor) return null;

  const btnClass = (active) => `inline-flex items-center justify-center w-10 h-10 md:w-8 md:h-8 rounded-[2px] border ${active ? 'bg-white border-[#8c8f94] text-[#1d2327] shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]' : 'border-transparent text-[#3c434a] hover:bg-white hover:border-[#c3c4c7] hover:text-[#2271b1]'}`;

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
      editor.chain().focus().unsetFontSize().setParagraph().run();
    } else {
      const level = parseInt(val.replace('h', ''));
      editor.chain().focus().unsetFontSize().toggleHeading({ level }).run();
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

  const insertLink = async () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = await showPrompt('Enter URL (relative /page for internal, or https:// for external):', previousUrl || '', 'Insert link');
    
    if (url === null) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    const openInNewTab = await showConfirm('Open link in a new tab?', 'Link target', { confirmText: 'New tab', cancelText: 'Same tab' });
    if (openInNewTab) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank', rel: 'noopener' }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_self', rel: null }).run();
    }
  };

  const insertVideo = async () => {
    const url = await showPrompt('Enter YouTube or Vimeo URL or Iframe source URL:', '', 'Embed video');
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

  const selectClass = "text-[13px] border border-[#8c8f94] bg-white pl-2 pr-6 rounded-[3px] outline-none focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1] cursor-pointer text-[#2c3338] h-10 md:h-8 max-w-full";
  const textBtnClass = "wp-btn";

  return (
    <div className="bg-[#f6f7f7] px-2 py-1.5 select-none max-w-full">
      <div className="flex flex-wrap items-center gap-1 tiptap-toolbar max-w-full min-w-0" role="toolbar" aria-label="Formatting">
        {/* Block / Headings Type */}
        <ThemedSelect 
          value={getHeadingValue()} 
          onChange={handleHeadingChange}
          className={selectClass}
          aria-label="Block format"
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
          <option value="h5">Heading 5</option>
          <option value="h6">Heading 6</option>
        </ThemedSelect>

        {/* Font Size Dropdown */}
        <ThemedSelect 
          onChange={handleFontSizeChange}
          className={selectClass}
          title="Font Size"
          aria-label="Font Size"
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
        </ThemedSelect>

        <span aria-hidden="true" className="w-px h-6 bg-[#dcdcde] mx-1" />

        {/* Core Typography Styles */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btnClass(editor.isActive('bold'))}
          title="Bold"
          aria-label="Bold"
          aria-pressed={editor.isActive('bold')}
        >
          <Bold className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btnClass(editor.isActive('italic'))}
          title="Italic"
          aria-label="Italic"
          aria-pressed={editor.isActive('italic')}
        >
          <Italic className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={btnClass(editor.isActive('underline'))}
          title="Underline"
          aria-label="Underline"
          aria-pressed={editor.isActive('underline')}
        >
          <UnderlineIcon className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={btnClass(editor.isActive('strike'))}
          title="Strikethrough"
          aria-label="Strikethrough"
          aria-pressed={editor.isActive('strike')}
        >
          <Strikethrough className="w-4 h-4" aria-hidden="true" />
        </button>

        <span aria-hidden="true" className="w-px h-6 bg-[#dcdcde] mx-1" />

        {/* Color Selectors */}
        <ThemedSelect 
          onChange={handleColorChange}
          className={selectClass}
          title="Text Color"
          aria-label="Text Color"
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
        </ThemedSelect>

        <ThemedSelect 
          onChange={handleHighlightChange}
          className={selectClass}
          title="Background Highlight"
          aria-label="Background Highlight"
          defaultValue="none"
        >
          <option value="none">Highlight (None)</option>
          <option value="#fef08a">Yellow</option>
          <option value="#bbf7d0">Green</option>
          <option value="#bfdbfe">Blue</option>
          <option value="#fbcfe8">Pink</option>
          <option value="#e9d5ff">Purple</option>
        </ThemedSelect>

        <span aria-hidden="true" className="w-px h-6 bg-[#dcdcde] mx-1" />

        {/* Alignment */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={btnClass(editor.isActive({ textAlign: 'left' }))}
          title="Align Left"
          aria-label="Align Left"
          aria-pressed={editor.isActive({ textAlign: 'left' })}
        >
          <AlignLeft className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={btnClass(editor.isActive({ textAlign: 'center' }))}
          title="Align Center"
          aria-label="Align Center"
          aria-pressed={editor.isActive({ textAlign: 'center' })}
        >
          <AlignCenter className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={btnClass(editor.isActive({ textAlign: 'right' }))}
          title="Align Right"
          aria-label="Align Right"
          aria-pressed={editor.isActive({ textAlign: 'right' })}
        >
          <AlignRight className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={btnClass(editor.isActive({ textAlign: 'justify' }))}
          title="Justify"
          aria-label="Justify"
          aria-pressed={editor.isActive({ textAlign: 'justify' })}
        >
          <AlignJustify className="w-4 h-4" aria-hidden="true" />
        </button>

        <span aria-hidden="true" className="w-px h-6 bg-[#dcdcde] mx-1" />

        {/* Lists & Quotes */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btnClass(editor.isActive('bulletList'))}
          title="Bullet List"
          aria-label="Bullet List"
          aria-pressed={editor.isActive('bulletList')}
        >
          <List className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btnClass(editor.isActive('orderedList'))}
          title="Numbered List"
          aria-label="Numbered List"
          aria-pressed={editor.isActive('orderedList')}
        >
          <ListOrdered className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={btnClass(editor.isActive('blockquote'))}
          title="Blockquote"
          aria-label="Blockquote"
          aria-pressed={editor.isActive('blockquote')}
        >
          <Quote className="w-4 h-4" aria-hidden="true" />
        </button>

        <span aria-hidden="true" className="w-px h-6 bg-[#dcdcde] mx-1" />

        {/* Links */}
        <button
          type="button"
          onClick={insertLink}
          className={btnClass(editor.isActive('link'))}
          title="Insert Link"
          aria-label="Insert Link"
          aria-pressed={editor.isActive('link')}
        >
          <LinkIcon className="w-4 h-4" aria-hidden="true" />
        </button>
        {editor.isActive('link') && (
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetLink().run()}
            className={btnClass(false)}
            title="Unlink"
            aria-label="Unlink"
          >
            <Link2Off className="w-4 h-4" aria-hidden="true" />
          </button>
        )}

        {/* Media Inserts */}
        <button
          type="button"
          onClick={onInsertImage}
          className={textBtnClass}
          title="Add Media / Image from Library"
        >
          <ImageIcon className="w-4 h-4" aria-hidden="true" /> Add Media
        </button>

        <button
          type="button"
          onClick={insertVideo}
          className={textBtnClass}
          title="Embed Video (YouTube / Vimeo)"
        >
          <VideoIcon className="w-4 h-4" aria-hidden="true" /> Embed Video
        </button>

        {selectedImage && (
          <button
            type="button"
            onClick={onOpenImageEditor}
            className={textBtnClass}
            title="Selected Image Options"
          >
            <Sliders className="w-4 h-4" aria-hidden="true" /> Edit Image Size/Align
          </button>
        )}

        <span aria-hidden="true" className="w-px h-6 bg-[#dcdcde] mx-1" />

        {/* Utilities */}
        <button
          type="button"
          onClick={clearFormatting}
          className={btnClass(false)}
          title="Clear Formatting"
          aria-label="Clear Formatting"
        >
          <Eraser className="w-4 h-4" aria-hidden="true" />
        </button>
        
        <div className="flex-1" />

        {/* Undo / Redo */}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          className={btnClass(false)}
          title="Undo"
          aria-label="Undo"
        >
          <Undo className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          className={btnClass(false)}
          title="Redo"
          aria-label="Redo"
        >
          <Redo className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

// --- IMAGE EDIT PANEL (ALWAYS VISIBLE & WORKING WHEN AN IMAGE IS CLICKED) ---
const ImageEditPanel = ({ selectedImage, onUpdate, onReplace, onRemove, onClose }) => {
  const uid = useId();
  if (!selectedImage) return null;

  return (
    <div className="w-full bg-white border-t border-[#dcdcde] px-3 py-2.5 select-none" role="group" aria-label="Image settings">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#646970]" aria-hidden="true" />
          <div>
            <span className="text-[13px] font-semibold text-[#1d2327] block">
              Image Customization
            </span>
            <span className="text-[12px] text-[#646970] block truncate max-w-[200px]">
              {selectedImage.alt || selectedImage.src?.split('/').pop() || 'Selected Image'}
            </span>
          </div>
        </div>

        {/* Controls Container */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Width Preset / Custom */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <label htmlFor={`${uid}-width`} className="text-[13px] text-[#1d2327]">Width:</label>
            <ThemedSelect
              value={['auto', '25%', '33%', '50%', '75%', '100%'].includes(selectedImage.width) ? selectedImage.width : 'custom'}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== 'custom') {
                  onUpdate({ width: val });
                }
              }}
              id={`${uid}-width`}
              className="wp-select"
            >
              <option value="auto">Auto (Original)</option>
              <option value="25%">25% Width</option>
              <option value="33%">33% Width (1/3)</option>
              <option value="50%">50% Width (Half)</option>
              <option value="75%">75% Width</option>
              <option value="100%">100% Full Width</option>
              <option value="custom">Custom (px/%)</option>
            </ThemedSelect>
            <input
              type="text"
              placeholder="e.g. 400px"
              value={selectedImage.width || ''}
              onChange={(e) => onUpdate({ width: e.target.value })}
              aria-label="Custom width"
              className="wp-input"
              style={{ width: 90 }}
              title="Custom width (e.g. 350px or 60%)"
            />
          </div>

          {/* Height */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <label htmlFor={`${uid}-height`} className="text-[13px] text-[#1d2327]">Height:</label>
            <input
              type="text"
              placeholder="auto or px"
              value={selectedImage.height || ''}
              onChange={(e) => onUpdate({ height: e.target.value })}
              id={`${uid}-height`}
              className="wp-input"
              style={{ width: 90 }}
              title="Custom height (e.g. 250px or auto)"
            />
          </div>

          {/* Alignment & Text Wrap */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <label htmlFor={`${uid}-align`} className="text-[13px] text-[#1d2327]">Align:</label>
            <ThemedSelect
              value={selectedImage.align || 'center'}
              onChange={(e) => onUpdate({ align: e.target.value })}
              id={`${uid}-align`}
              className="wp-select"
            >
              <option value="center">Center Block (No wrap)</option>
              <option value="left">Left Block (No wrap)</option>
              <option value="right">Right Block (No wrap)</option>
              <option value="float-left">Wrap Left (Float)</option>
              <option value="float-right">Wrap Right (Float)</option>
            </ThemedSelect>
          </div>

          {/* Alt Text */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <label htmlFor={`${uid}-alt`} className="text-[13px] text-[#1d2327]">Alt:</label>
            <input
              type="text"
              placeholder="SEO alt text..."
              value={selectedImage.alt || ''}
              onChange={(e) => onUpdate({ alt: e.target.value })}
              id={`${uid}-alt`}
              className="wp-input"
              style={{ width: 160 }}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onReplace}
              className="wp-btn"
              title="Replace image from media library"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Replace
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="wp-btn" style={{ color: "#b32d2e", borderColor: "#b32d2e" }}
              title="Delete this image"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Delete
            </button>
            <button
              type="button"
              onClick={onClose}
              className="wp-btn wp-btn-primary"
              title="Save & Close image toolbar"
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" /> Done
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
    // Tiptap 3 no longer re-renders on every transaction by default; without this the toolbar
    // (block format select, bold/italic/list states) never reflects where the cursor is.
    shouldRerenderOnTransaction: true,
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
        class: 'focus:outline-none min-h-[450px] p-8 text-[15px] leading-[1.6] max-w-none font-sans bg-white text-gray-800 editorial-content-rich',
      },
      transformPastedHTML(html) {
        if (!html) return html;
        // Clean out pasted Google Docs & Word inline font-size, font-family, and
        // line-height that break editor heading formatting.
        //
        // IMPORTANT: do NOT strip `font-weight: normal` / `font-weight: 400`
        // here. Google Docs wraps its entire copied fragment in something like
        // <b id="docs-internal-guid-xxxx" style="font-weight:normal;"> and marks
        // genuinely non-bold runs with <span style="font-weight:400;...">.
        // Tiptap's Bold extension (@tiptap/extension-bold) specifically relies on
        // those inline styles to avoid the extremely common "paste from Google
        // Docs makes everything bold" bug: its parse rule for <b> only applies
        // the bold mark when the tag's OWN style isn't "font-weight:normal", and
        // it has a dedicated `style: 'font-weight=400'` rule that explicitly
        // clears any inherited bold mark. Stripping those declarations (as this
        // function previously did) destroys the exact signal those rules need,
        // so the bare <b> wrapper then matches the generic bold rule and the
        // whole paste turns bold. Leaving font-weight alone lets Tiptap's
        // built-in handling do the right thing, while real bold text (explicit
        // <strong>/<b> without a "normal" override, or font-weight >= 500) is
        // untouched and still renders bold.
        return html.replace(/style="([^"]*)"/gi, (match, styles) => {
          const cleaned = styles
            .split(';')
            .map(s => s.trim())
            .filter(s => {
              if (!s) return false;
              const lower = s.toLowerCase();
              if (lower.startsWith('font-size:')) return false;
              if (lower.startsWith('font-family:')) return false;
              if (lower.startsWith('line-height:')) return false;
              return true;
            })
            .join('; ');
          return cleaned ? `style="${cleaned}"` : '';
        });
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
    <div className="bg-white border border-[#dcdcde] relative">
      <div className="tiptap-sticky-header bg-[#f6f7f7] border-b border-[#dcdcde]">
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
      </div>

      <div 
        ref={editorContainerRef} 
        onClick={handleWrapperClick}
        className="tiptap-wrapper editorial-content-rich"
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
        .tiptap-wrapper .ProseMirror h1, .tiptap-wrapper .ProseMirror h1 * { font-size: 2.1rem !important; font-weight: 800 !important; line-height: 1.25 !important; margin-top: 1.75rem; color: #111; }
        .tiptap-wrapper .ProseMirror h2, .tiptap-wrapper .ProseMirror h2 * { font-size: 1.65rem !important; font-weight: 750 !important; line-height: 1.3 !important; margin-top: 1.5rem; color: #222; }
        .tiptap-wrapper .ProseMirror h3, .tiptap-wrapper .ProseMirror h3 * { font-size: 1.35rem !important; font-weight: 700 !important; line-height: 1.35 !important; margin-top: 1.25rem; color: #333; }
        .tiptap-wrapper .ProseMirror h4, .tiptap-wrapper .ProseMirror h4 * { font-size: 1.15rem !important; font-weight: 700 !important; line-height: 1.4 !important; margin-top: 1rem; color: #444; }
        .tiptap-wrapper .ProseMirror h5, .tiptap-wrapper .ProseMirror h5 * { font-size: 1.02rem !important; font-weight: 650 !important; line-height: 1.4 !important; margin-top: 1rem; color: #555; }
        .tiptap-wrapper .ProseMirror h6, .tiptap-wrapper .ProseMirror h6 * { font-size: 0.9rem !important; font-weight: 650 !important; line-height: 1.4 !important; margin-top: 0.75rem; color: #666; }
        .tiptap-wrapper .ProseMirror p { margin-bottom: 0.75rem; }
        /* Beat the admin's compact 13px p/li size so body text reads as body text next to headings */
        .tiptap-wrapper .ProseMirror p, .tiptap-wrapper .ProseMirror li { font-size: 15px; line-height: 1.6; }
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
