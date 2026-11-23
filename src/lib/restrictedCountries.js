// Countries the store explicitly refuses to ship to / serve. Shared between the checkout
// page (so the shopper gets immediate, friendly feedback) and the server-side order-creation
// chokepoint (so the restriction can't be bypassed by skipping the UI).
export const RESTRICTED_COUNTRIES = [
  { name: "Israel", isoCode: "IL" },
];

export function isRestrictedCountry(country, countryCode) {
  const code = (countryCode || "").trim().toUpperCase();
  const name = (country || "").trim().toLowerCase();
  return RESTRICTED_COUNTRIES.some(
    (c) => c.isoCode === code || c.name.toLowerCase() === name
  );
}

export const RESTRICTED_COUNTRY_MESSAGE =
  "We're sorry — we do not currently ship to or process orders for this country. If you believe this is a mistake, please contact our support team.";
