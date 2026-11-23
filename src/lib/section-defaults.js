/**
 * Default content for sections whose components ship with built-in copy.
 *
 * Single source of truth for two things:
 *  - the storefront components (they fall back to these values), and
 *  - the page builder, which fills any missing field with these values when a page is opened, so
 *    the admin sees (and can edit) the real content instead of empty boxes.
 *
 * Repeater lists use the builder's shape: [{ label }] (or the field names noted below).
 */

const labels = (list) => list.map((label) => ({ label }));

export const SECTION_DEFAULTS = {
  corporate_gifting_hero: {
    label: "CORPORATE COLLECTION • MADE TO ORDER",
    title: "CUSTOMIZE CORPORATE GIFTING",
    subtitle: "Handcrafted leather gift packs for your team and clients, finished with your logo and wrapped to impress.",
    image: "",
    primaryButtonText: "Build your pack",
    primaryButtonLink: "#gifting-inquiry",
    secondaryButtonText: "See how it works",
    secondaryButtonLink: "#gifting-process",
    breadcrumb: "Corporate Gifting",
  },

  corporate_gifting_process: {
    sectionLabel: "THE PROCESS",
    sectionTitle: "FROM IDEA TO GIFT BOX IN FOUR STEPS",
    sectionDescription: "",
    steps: [
      {
        title: "Share your requirements",
        description: "Tell us the occasion, how many packs you need, your budget, and your deadline. One short form is all it takes.",
        image: "",
      },
      {
        title: "Pick your items",
        description: "Mix and match wallets, card holders, keychains, laptop sleeves, or jackets. We'll suggest combinations that fit your budget.",
        image: "",
      },
      {
        title: "Approve your branded sample",
        description: "You get a digital mockup with your logo on every item, plus a physical sample on request. Production starts only after your approval.",
        image: "",
      },
      {
        title: "Crafted, packed, and delivered",
        description: "Each piece is handcrafted, quality checked, and packed in premium gift boxes, then shipped to one office or many.",
        image: "",
      },
    ],
  },

  corporate_gifting_form: {
    eyebrow: "BULK INQUIRY",
    formTitle: "BUILD YOUR GIFT PACK",
    formSubtitle: "Complete the form below and our corporate team will send you a quote within 24 hours.",
    companyTitle: "Company information",
    packTitle: "Pack details",
    packItemsLabel: "What goes in the pack?",
    brandingTitle: "Branding and packaging",
    logoLabel: "Company logo",
    referenceTitle: "Design reference images",
    referenceDescription:
      "Show us the look you have in mind: gift box styles, item designs, colors, or packs you've seen elsewhere.",
    notesTitle: "Additional notes",
    notesPlaceholder: "Separate packs for management and staff, or ship to 3 office locations",
    submitText: "Request a quote",
    disclaimer:
      "By submitting, you agree that we may contact you regarding your inquiry. No payment is required at this stage.",
    successTitle: "Inquiry Received!",
    successMessage:
      "Thank you for your interest in Pairo corporate gifting. Our team will review your request and contact you within 24 hours with a quote.",
    minQuantity: 10,
    maxLogos: 3,
    maxReferenceImages: 10,
    packItems: [
      { label: "Leather jacket", icon: "Shirt" },
      { label: "Wallet", icon: "Wallet" },
      { label: "Card holder", icon: "CreditCard" },
      { label: "Keychain", icon: "Key" },
      { label: "Laptop sleeve", icon: "Briefcase" },
      { label: "Journal cover", icon: "Notebook" },
      { label: "Belt", icon: "Minus" },
      { label: "Something else", icon: "Plus" },
    ],
    occasions: labels(["Employee appreciation", "Client gifts", "Eid / festive", "Christmas / new year", "New joiner kit", "Event / conference", "Other"]),
    budgets: labels(["Under $50", "$50 to $100", "$100 to $200", "$200+", "Flexible"]),
    brandingStyles: labels(["Logo embossing", "Logo debossing", "Laser engraving", "Individual name engraving", "No branding"]),
    packagingOptions: labels(["Premium rigid gift box", "Branded box with your logo", "Eco kraft box", "Wooden box"]),
    leatherTypes: labels(["Full-grain cowhide", "Top-grain lambskin", "Genuine suede", "Nappa leather", "Vegan leather"]),
    countries: labels(["United States", "United Kingdom", "Canada", "Australia", "Germany", "France", "UAE", "Saudi Arabia", "Pakistan", "India", "Other"]),
    referenceTags: labels(["Gift box style", "Item design", "Color and finish", "Logo placement", "Inspiration"]),
  },
};

/**
 * Lists that are useless when empty (an empty dropdown, no steps, no item tiles). If the saved page has one of these
 * as an empty list, it is treated as "not set" so the live defaults show in the editor and on the page.
 * Optional decorations (for example the reference hint tags) are NOT listed: empty is a valid choice for them.
 */
const EMPTY_MEANS_UNSET = {
  corporate_gifting_process: ["steps"],
  corporate_gifting_form: ["packItems", "occasions", "budgets", "brandingStyles", "packagingOptions", "leatherTypes", "countries"],
};
const isUnset = (type, key, value) =>
  value === undefined || value === null || (Array.isArray(value) && value.length === 0 && (EMPTY_MEANS_UNSET[type] || []).includes(key));

/**
 * Returns the section with any missing config keys filled from SECTION_DEFAULTS.
 * Only keys that are undefined are filled: a field the admin deliberately cleared ("" or an
 * empty list they saved) is left alone. Sections without defaults are returned unchanged.
 */
export function hydrateSectionDefaults(section) {
  const defaults = section && SECTION_DEFAULTS[section.type];
  if (!defaults) return section;
  const config = { ...(section.config || {}) };
  for (const [key, value] of Object.entries(defaults)) {
    if (isUnset(section.type, key, config[key])) {
      config[key] = JSON.parse(JSON.stringify(value));
    }
  }
  return { ...section, config };
}

export function hydratePageDefaults(page) {
  if (!page || !Array.isArray(page.sections)) return page;
  return { ...page, sections: page.sections.map(hydrateSectionDefaults) };
}

/** props layered over a section's defaults; undefined/null props never override a default. */
export function withSectionDefaults(type, props = {}) {
  const merged = { ...(SECTION_DEFAULTS[type] || {}) };
  for (const [key, value] of Object.entries(props)) {
    if (!isUnset(type, key, value)) merged[key] = value;
  }
  return merged;
}
