// Pure helpers for duplicating shipping config records (no DB / Next imports, unit-tested in
// src/__tests__/admin-settings-shipping-copy.test.js). Copies are always created Inactive so a
// duplicate never changes what customers see at checkout until an admin switches it on.

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

export function copyName(name, fallback) {
  return `${String(name || "").trim() || fallback} (Copy)`;
}

export function buildZoneCopy(zone, sortOrder) {
  return {
    name: copyName(zone.name, "Shipping zone"),
    description: zone.description || "",
    priority: zone.priority ?? 0,
    sortOrder,
    status: "Inactive",
    matchRules: clone(zone.matchRules) || [],
  };
}

/** zoneId: where the copy goes; keepName: true when copying a zone's methods along with it. */
export function buildMethodCopy(method, zoneId, { keepName = false } = {}) {
  return {
    zoneId,
    name: keepName ? method.name : copyName(method.name, "Shipping method"),
    description: method.description || "",
    provider: method.provider,
    settings: clone(method.settings) || {},
    conditions: clone(method.conditions) || [],
    // Methods copied together with their zone keep their status: the new zone itself is
    // Inactive, so nothing reaches checkout until the zone is switched on.
    status: keepName ? method.status || "Active" : "Inactive",
    sortOrder: method.sortOrder ?? 0,
    activeFrom: method.activeFrom || null,
    activeUntil: method.activeUntil || null,
  };
}

export function buildPickupCopy(loc, sortOrder) {
  return {
    name: copyName(loc.name, "Pickup location"),
    instructions: loc.instructions || "",
    address: { street: "", city: "", state: "", zip: "", country: "", ...(clone(loc.address) || {}) },
    phone: loc.phone || "",
    email: loc.email || "",
    operatingHours: clone(loc.operatingHours) || [],
    status: "Inactive",
    sortOrder,
  };
}

export const isCatchAllZone = (zone) => (zone?.matchRules?.length ?? 0) === 0;
