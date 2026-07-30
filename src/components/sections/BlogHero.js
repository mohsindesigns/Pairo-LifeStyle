// src/components/sections/BlogHero.js
// Used by the page builder; the /blog page reads config directly from DB.
export default function BlogHero({ config = {} }) {
  const badge = config.badge || "Pairo Archive & Journal";
  const heading = config.heading || "Editorial Stories";
  const subheading = config.subheading || "";
  const editionLabel = config.editionLabel || "VOLUME 2026 // EDITION 0.1";

  return (
    <section className="pt-14 pb-8 border-b border-black/[0.06]">
      <div className="container mx-auto px-2 sm:px-4 md:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1.5 max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-400">
              {badge}
            </p>
            <h1 className="text-[24px] md:text-[36px] font-bold heading-font tracking-tight text-black leading-none">
              {heading}
            </h1>
            {subheading && (
              <p className="text-[13px] text-neutral-500 leading-relaxed max-w-lg">
                {subheading}
              </p>
            )}
          </div>
          <div className="text-right">
            <span className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase block">
              {editionLabel}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
