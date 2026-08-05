import HomeTemplate from "@/templates/HomeTemplate";
import AboutTemplate from "@/templates/AboutTemplate";
import ContactTemplate from "@/templates/ContactTemplate";
import DefaultTemplate from "@/templates/DefaultTemplate";
import CustomJacketTemplate from "@/templates/CustomJacketTemplate";
import GalleryTemplate from "@/templates/GalleryTemplate";
import SizeChartTemplate from "@/templates/SizeChartTemplate";

export const TEMPLATE_REGISTRY = {
  home: {
    name: "Homepage Template",
    component: HomeTemplate,
    allowedSections: [
      "hero_slider",
      "product_grid",
      "feature_marquee",
      "banner_feature",
      "category_showcase",
      "blog_grid",
      "testimonials"
    ],
    defaultSections: [
      { type: "hero_slider", config: {} },
      { type: "product_grid", config: { title: "NEW ARRIVALS", limit: 16 } },
      { type: "feature_marquee", config: {} },
      { type: "product_grid", config: { title: "TOP SELLING", limit: 16 } },
      { type: "banner_feature", config: {} },
      { type: "category_showcase", config: {} },
      { type: "blog_grid", config: {} },
      { type: "testimonials", config: {} }
    ]
  },
  about: {
    name: "About Page Template",
    component: AboutTemplate,
    allowedSections: [
      "about_hero",
      "story_section",
      "studio_gallery",
      "promise_section",
      "cta_section"
    ],
    defaultSections: [
      { type: "about_hero", config: {} },
      { type: "story_section", config: {} },
      { type: "studio_gallery", config: {} },
      { type: "promise_section", config: {} },
      { type: "cta_section", config: {} }
    ]
  },
  contact: {
    name: "Contact Page Template",
    component: ContactTemplate,
    allowedSections: [
      "contact_hero",
      "contact_section"
    ],
    defaultSections: [
      { type: "contact_hero", config: {} },
      { type: "contact_section", config: {} }
    ]
  },
  default: {
    name: "Default Template",
    component: DefaultTemplate,
    allowedSections: [
      "feature_marquee",
      "banner_feature",
      "blog_grid",
      "testimonials",
      "rich_text",
      "blog_hero"
    ],
    defaultSections: []
  },
  "custom-jacket": {
    name: "Custom Jacket Page",
    component: CustomJacketTemplate,
    allowedSections: [
      "custom_jacket_hero",
      "custom_jacket_process",
      "custom_jacket_form"
    ],
    defaultSections: [
      { type: "custom_jacket_hero", config: {} },
      { type: "custom_jacket_process", config: {} },
      { type: "custom_jacket_form", config: {} }
    ]
  },
  gallery: {
    name: "Gallery Page",
    component: GalleryTemplate,
    allowedSections: [
      "gallery_hero",
      "gallery_grid"
    ],
    defaultSections: [
      { type: "gallery_hero", config: {} },
      { type: "gallery_grid", config: {} }
    ]
  },
  "size-chart": {
    name: "Size Chart Page",
    component: SizeChartTemplate,
    allowedSections: [
      "size_chart_hero",
      "size_chart_display"
    ],
    defaultSections: [
      { type: "size_chart_hero", config: {} },
      { type: "size_chart_display", config: {} }
    ]
  }
};

/**
 * Validates that all sections in a given page configuration are allowed by the template.
 * @param {string} templateKey The template identifier
 * @param {Array} sections List of section objects
 * @returns {Object} { isValid: boolean, error: string|null }
 */
export function validateTemplateSections(templateKey, sections) {
  const config = TEMPLATE_REGISTRY[templateKey || "default"];
  if (!config) {
    return { isValid: false, error: `Template "${templateKey}" not found in registry.` };
  }
  
  if (!sections || !Array.isArray(sections)) {
    return { isValid: true, error: null };
  }

  for (const s of sections) {
    if (!config.allowedSections.includes(s.type)) {
      return { 
        isValid: false, 
        error: `Section type "${s.type}" is not allowed in template "${config.name}".` 
      };
    }
  }

  return { isValid: true, error: null };
}
