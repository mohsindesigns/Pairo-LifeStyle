export const SECTION_SCHEMAS = {
  hero_slider: {
    name: "Hero Slider",
    icon: "Layout",
    fields: [
      { name: "slides", label: "Slides", type: "repeater", fields: [
        { name: "title", label: "Title", type: "text" },
        { name: "subtitle", label: "Subtitle", type: "textarea" },
        { name: "image", label: "Image URL", type: "image" },
        { name: "buttonText", label: "Button Text", type: "text" },
        { name: "link", label: "Button Link", type: "text" }
      ]},
      { name: "brand", label: "Brand Settings", type: "group", fields: [
        { name: "tagline", label: "Tagline", type: "text" }
      ]},
      { name: "labels", label: "Labels", type: "group", fields: [
        { name: "viewCollection", label: "View Collection Label", type: "text" },
        { name: "viewCollectionLink", label: "View Collection Link", type: "text" }
      ]},
      { name: "marqueeItems", label: "Marquee Items", type: "repeater", fields: [
        { name: "text", label: "Display Text", type: "text" },
        { name: "icon", label: "Icon Name", type: "icon" }
      ]}
    ]
  },
  product_grid: {
    name: "Product Collection",
    icon: "ShoppingBag",
    fields: [
      { name: "title", label: "Section Title", type: "text" },
      { name: "seriesLabel", label: "Series Label (Badge)", type: "text" },
      { name: "ctaLabel", label: "CTA Button Text", type: "text" },
      { name: "collectionId", label: "Select Collection", type: "select", options: "categories" },
      { name: "limit", label: "Product Limit", type: "number", default: 8 },
    ]
  },
  feature_marquee: {
    name: "Feature Marquee",
    icon: "Zap",
    fields: [
      { name: "items", label: "Marquee Items", type: "repeater", fields: [
        { name: "text", label: "Display Text", type: "text" },
        { name: "subText", label: "Sub Text (e.g. PAIRO — 26)", type: "text" },
        { name: "icon", label: "Icon", type: "icon" }
      ]},
      { name: "speed", label: "Scroll Speed (seconds)", type: "number", default: 40 }
    ]
  },
  category_showcase: {
    name: "Category Showcase",
    icon: "Grid",
    fields: [
      { name: "title", label: "Section Title", type: "text" },
      { name: "label", label: "Section Badge", type: "text" },
      { name: "viewAll", label: "View All Label", type: "text" },
      { name: "categoryIds", label: "Selected Categories", type: "multiselect", options: "categories" }
    ]
  },
  blog_grid: {
    name: "Blog Showcase",
    icon: "FileText",
    fields: [
      { name: "title", label: "Section Title", type: "text" },
      { name: "label", label: "Section Badge", type: "text" },
      { name: "blogIds", label: "Select Blogs to Show", type: "multiselect", options: "blogs" },
      { name: "readMore", label: "Read More Label", type: "text" }
    ]
  },
  testimonials: {
    name: "Testimonial Slider",
    icon: "Star",
    fields: [
      { name: "title", label: "Section Title", type: "text" },
      { name: "label", label: "Section Badge", type: "text" },
      { name: "buttonText", label: "CTA Button Text", type: "text" },
      { name: "verifiedLabel", label: "Verified Account Label", type: "text" },
      { name: "reviews", label: "Reviews", type: "repeater", fields: [
        { name: "name", label: "Customer Name", type: "text" },
        { name: "text", label: "Testimonial Text", type: "textarea" },
        { name: "rating", label: "Rating (1-5)", type: "number" }
      ]}
    ]
  },
  banner_feature: {
    name: "Promotional Banner",
    icon: "Image",
    fields: [
      { name: "title", label: "Banner Heading", type: "text" },
      { name: "description", label: "Paragraph text", type: "textarea" },
      { name: "badge1", label: "Badge 1 (Top)", type: "text" },
      { name: "badge2", label: "Badge 2 (Bottom)", type: "text" },
      { name: "image", label: "Banner Image URL", type: "image" },
      { name: "ctaText", label: "Button Label", type: "text" },
      { name: "linkType", label: "Link to", type: "select", options: [
        { label: "Product", value: "product" },
        { label: "Collection", value: "collection" }
      ]},
      { name: "productId", label: "Select Product", type: "select", options: "products", dependsOn: "linkType", visibleIf: "product" },
      { name: "collectionId", label: "Select Collection", type: "select", options: "categories", dependsOn: "linkType", visibleIf: "collection" },
      { name: "features", label: "Banner Features (Max 2)", type: "repeater", fields: [
        { name: "text", label: "Feature Text", type: "text" },
        { name: "icon", label: "Icon Name", type: "icon" }
      ]}
    ]
  },
  about_hero: {
    name: "About Hero",
    icon: "Layout",
    fields: [
      { name: "title", label: "Title", type: "text" },
      { name: "subtitle", label: "Subtitle", type: "textarea" },
      { name: "label", label: "Label", type: "text" },
      { name: "image", label: "Background Image", type: "image" },
      { name: "buttonText", label: "Button Text", type: "text" },
      { name: "link", label: "Button Link", type: "text" },
      { name: "marqueeEnabled", label: "Enable Marquee", type: "select", options: [
        { label: "Yes", value: "true" },
        { label: "No", value: "false" }
      ]},
      { name: "marqueeItems", label: "Marquee Items", type: "repeater", fields: [
        { name: "text", label: "Item Text", type: "text" },
        { name: "icon", label: "Icon Name", type: "icon" }
      ]}
    ]
  },
  story_section: {
    name: "Story Section",
    icon: "BookOpen",
    fields: [
      { name: "title", label: "Title", type: "text" },
      { name: "label", label: "Label", type: "text" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "image", label: "Side Image", type: "image" },
      { name: "features", label: "Features", type: "repeater", fields: [
        { name: "title", label: "Feature Title", type: "text" },
        { name: "desc", label: "Feature Description", type: "textarea" }
      ]}
    ]
  },
  studio_gallery: {
    name: "Studio Gallery",
    icon: "Image",
    fields: [
      { name: "title", label: "Title", type: "text" },
      { name: "label", label: "Label", type: "text" },
      { name: "images", label: "Gallery Images", type: "repeater", fields: [
        { name: "url", label: "Image URL", type: "image" }
      ]}
    ]
  },
  promise_section: {
    name: "Promise Section",
    icon: "ShieldCheck",
    fields: [
      { name: "title", label: "Title", type: "text" },
      { name: "label", label: "Label", type: "text" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "image", label: "Background Image", type: "image" },
      { name: "items", label: "Promise Items", type: "repeater", fields: [
        { name: "title", label: "Item Title", type: "text" },
        { name: "desc", label: "Item Description", type: "textarea" }
      ]},
      { name: "stats", label: "Stats", type: "repeater", fields: [
        { name: "label", label: "Stat Label", type: "text" },
        { name: "value", label: "Stat Value", type: "text" }
      ]}
    ]
  },
  cta_section: {
    name: "CTA Section",
    icon: "Target",
    fields: [
      { name: "title", label: "Title", type: "text" },
      { name: "primaryBtnLabel", label: "Primary Button Label", type: "text" },
      { name: "primaryBtnLink", label: "Primary Button Link", type: "text" },
      { name: "secondaryBtnLabel", label: "Secondary Button Label", type: "text" },
      { name: "secondaryBtnLink", label: "Secondary Button Link", type: "text" }
    ]
  },
  contact_hero: {
    name: "Contact Hero",
    icon: "Layout",
    fields: [
      { name: "title", label: "Hero Title", type: "text" },
      { name: "subtitle", label: "Hero Subtitle", type: "textarea" },
      { name: "label", label: "Hero Label (Badge)", type: "text" },
      { name: "image", label: "Background Image", type: "image" },
      { name: "buttonText", label: "CTA Button Text", type: "text" },
      { name: "link", label: "Button Link (URL or ID)", type: "text" },
      { name: "marqueeEnabled", label: "Enable Marquee", type: "select", options: [
        { label: "Yes", value: "true" },
        { label: "No", value: "false" }
      ]},
      { name: "marqueeItems", label: "Marquee Items", type: "repeater", fields: [
        { name: "text", label: "Item Text", type: "text" },
        { name: "icon", label: "Icon Name", type: "icon" }
      ]}
    ]
  },
  contact_section: {
    name: "Contact Details & Form",
    icon: "Mail",
    fields: [
      { name: "officeLabel", label: "Office Label", type: "text" },
      { name: "officeTitle", label: "Office Title", type: "text" },
      { name: "address", label: "Physical Address", type: "textarea" },
      { name: "channels", label: "Contact Channels", type: "repeater", fields: [
        { name: "label", label: "Channel Label", type: "text" },
        { name: "value", label: "Channel Value (Email/Phone)", type: "text" }
      ]},
      { name: "socialLabel", label: "Social Label", type: "text" },
      { name: "socialLinks", label: "Social Icons", type: "repeater", fields: [
        { name: "platform", label: "Platform", type: "select", options: [
          { label: "Instagram", value: "instagram" },
          { label: "Facebook", value: "facebook" },
          { label: "Twitter / X", value: "twitter" },
          { label: "TikTok", value: "tiktok" },
          { label: "YouTube", value: "youtube" },
          { label: "LinkedIn", value: "linkedin" },
          { label: "Pinterest", value: "pinterest" },
          { label: "Snapchat", value: "snapchat" },
          { label: "WhatsApp", value: "whatsapp" }
        ]},
        { name: "url", label: "URL (full link)", type: "text" }
      ]},
      { name: "formTitle", label: "Form Heading", type: "text" },
      { name: "formSubtitle", label: "Form Subheading", type: "text" },
      { name: "subjects", label: "Form Subjects (Comma separated)", type: "text" },
      { name: "buttonText", label: "Submit Button Text", type: "text" }
    ]
  },
  rich_text: {
    name: "Rich Text Content",
    icon: "FileText",
    fields: [
      { name: "title", label: "Page Heading", type: "text" },
      { name: "content", label: "Page Content", type: "quill" }
    ]
  }
};
