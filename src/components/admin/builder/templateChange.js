/**
 * Pure helper for switching a page's template in the editor.
 * Returns the template defaults, which current sections would be kept or removed
 * if the user keeps their sections, and the display names of removed section types.
 */
export function planTemplateChange(registry, schemas, nextTemplate, currentSections = [], makeId = () => Math.random().toString(36).slice(2, 11)) {
  const templateConfig = registry[nextTemplate] || registry.default;
  const defaults = (templateConfig.defaultSections || []).map((s, i) => ({
    id: makeId(),
    type: s.type,
    enabled: true,
    order: i,
    config: JSON.parse(JSON.stringify(s.config || {}))
  }));
  const allowed = Array.isArray(templateConfig.allowedSections) ? templateConfig.allowedSections : null;
  const sections = Array.isArray(currentSections) ? currentSections : [];
  const kept = sections
    .filter(s => !allowed || allowed.includes(s.type))
    .map((s, i) => ({ ...s, order: i }));
  const removed = allowed ? sections.filter(s => !allowed.includes(s.type)) : [];
  const removedNames = [...new Set(removed.map(s => schemas[s.type]?.name || s.type))];
  return { templateConfig, defaults, kept, removed, removedNames };
}
