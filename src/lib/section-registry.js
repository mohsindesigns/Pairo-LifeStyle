import dynamic from "next/dynamic";

export const SECTION_REGISTRY = {
  hero_slider: dynamic(() => import("@/components/home/Hero")),
  product_grid: dynamic(() => import("@/components/home/ProductSection")),
  feature_marquee: dynamic(() => import("@/components/home/FeatureMarquee")),
  banner_feature: dynamic(() => import("@/components/home/FeaturedBanner")),
  category_showcase: dynamic(() => import("@/components/home/CategoryBanner")),
  blog_grid: dynamic(() => import("@/components/home/BlogSection")),
  testimonials: dynamic(() => import("@/components/home/Testimonials")),
  about_hero: dynamic(() => import("@/components/sections/AboutHero")),
  story_section: dynamic(() => import("@/components/sections/StorySection")),
  studio_gallery: dynamic(() => import("@/components/sections/StudioGallery")),
  promise_section: dynamic(() => import("@/components/sections/PromiseSection")),
  cta_section: dynamic(() => import("@/components/sections/CTASection")),
  contact_hero: dynamic(() => import("@/components/sections/ContactHero")),
  contact_section: dynamic(() => import("@/components/sections/ContactSection")),
  rich_text: dynamic(() => import("@/components/sections/RichTextSection")),
  // Custom Jacket Page
  custom_jacket_hero: dynamic(() => import("@/components/sections/CustomJacketHero")),
  custom_jacket_process: dynamic(() => import("@/components/sections/CustomJacketProcess")),
  custom_jacket_form: dynamic(() => import("@/components/sections/CustomJacketForm")),
  // Gallery Page
  gallery_hero: dynamic(() => import("@/components/sections/GalleryHero")),
  gallery_grid: dynamic(() => import("@/components/sections/GalleryGrid")),
  // Size Chart Page
  size_chart_hero: dynamic(() => import("@/components/sections/SizeChartHero")),
  size_chart_display: dynamic(() => import("@/components/sections/SizeChartDisplay")),
  // Blog Page
  blog_hero: dynamic(() => import("@/components/sections/BlogHero")),
};

export const getSectionComponent = (type) => {
  return SECTION_REGISTRY[type] || null;
};

