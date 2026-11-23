/**
 * IP Pinpoint Geolocation Service
 * Resolves IP addresses into city, state/region, county, country, postal code, coordinates, and ISP.
 */

const ipCache = new Map();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

export function isPrivateOrLocalIp(ip) {
  if (!ip || typeof ip !== 'string') return true;
  const clean = ip.trim().toLowerCase();
  if (
    clean === '127.0.0.1' ||
    clean === '::1' ||
    clean === 'localhost' ||
    clean === 'unknown' ||
    clean === '' ||
    clean.startsWith('10.') ||
    clean.startsWith('192.168.') ||
    clean.startsWith('169.254.') ||
    clean.startsWith('fc00:') ||
    clean.startsWith('fe80:')
  ) {
    return true;
  }
  // 172.16.0.0 – 172.31.255.255
  if (clean.startsWith('172.')) {
    const parts = clean.split('.');
    if (parts.length >= 2) {
      const second = parseInt(parts[1], 10);
      if (second >= 16 && second <= 31) return true;
    }
  }
  return false;
}

/**
 * Resolves full geolocation details for an IP address.
 * @param {string} ip
 * @returns {Promise<{
 *   ip: string,
 *   city: string,
 *   state: string,
 *   county: string,
 *   country: string,
 *   countryCode: string,
 *   postal: string,
 *   lat: number | null,
 *   lon: number | null,
 *   mapsUrl: string | null,
 *   isp: string,
 *   timezone: string,
 *   isLocal?: boolean
 * } | null>}
 */
export async function resolveIpLocation(ip) {
  if (!ip || typeof ip !== 'string') return null;
  const cleanIp = ip.split(',')[0].trim();

  // Check cache
  const cached = ipCache.get(cleanIp);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Handle local / private addresses
  if (isPrivateOrLocalIp(cleanIp)) {
    const localResult = {
      ip: cleanIp,
      city: 'Local Network / Development',
      state: 'Local',
      county: 'Local Host',
      country: 'Localhost',
      countryCode: 'LOC',
      postal: 'N/A',
      lat: null,
      lon: null,
      mapsUrl: null,
      isp: 'Local / Internal',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      isLocal: true,
    };
    return localResult;
  }

  try {
    let baseGeo = null;

    // Primary: ipwho.is (fast HTTPS, rich detail, no auth)
    try {
      const res = await fetch(`https://ipwho.is/${encodeURIComponent(cleanIp)}`, {
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          baseGeo = {
            ip: cleanIp,
            city: data.city || '',
            state: data.region || '',
            county: '',
            country: data.country || '',
            countryCode: data.country_code || '',
            postal: data.postal || '',
            lat: typeof data.latitude === 'number' ? data.latitude : null,
            lon: typeof data.longitude === 'number' ? data.longitude : null,
            isp: data.connection?.isp || data.connection?.org || '',
            timezone: data.timezone?.id || '',
          };
        }
      }
    } catch {
      // Fallback below
    }

    // Secondary fallback: ip-api.com
    if (!baseGeo) {
      try {
        const res = await fetch(
          `http://ip-api.com/json/${encodeURIComponent(cleanIp)}?fields=status,message,country,countryCode,regionName,city,district,zip,lat,lon,timezone,isp`,
          { signal: AbortSignal.timeout(3500) }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success') {
            baseGeo = {
              ip: cleanIp,
              city: data.city || '',
              state: data.regionName || '',
              county: data.district || '',
              country: data.country || '',
              countryCode: data.countryCode || '',
              postal: data.zip || '',
              lat: typeof data.lat === 'number' ? data.lat : null,
              lon: typeof data.lon === 'number' ? data.lon : null,
              isp: data.isp || '',
              timezone: data.timezone || '',
            };
          }
        }
      } catch {
        // Continue
      }
    }

    if (!baseGeo) return null;

    // Pinpoint County / District resolution via reverse geocoding if lat/lon available
    if (baseGeo.lat !== null && baseGeo.lon !== null && (!baseGeo.county || baseGeo.county.trim() === '')) {
      try {
        const geoRes = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${baseGeo.lat}&longitude=${baseGeo.lon}&localityLanguage=en`,
          { signal: AbortSignal.timeout(2500) }
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          const adminList = geoData.localityInfo?.administrative || [];

          // Look for an administrative entity tagged as county or adminLevel 6
          const countyEntity = adminList.find(
            (a) =>
              (a.description && a.description.toLowerCase().includes('county')) ||
              (a.name && a.name.toLowerCase().includes('county')) ||
              a.adminLevel === 6
          );

          if (countyEntity?.name) {
            baseGeo.county = countyEntity.name;
          } else if (geoData.locality) {
            baseGeo.county = geoData.locality;
          }
        }
      } catch {
        // Non-fatal: baseGeo still valid
      }
    }

    if (baseGeo.lat !== null && baseGeo.lon !== null) {
      baseGeo.mapsUrl = `https://www.google.com/maps?q=${baseGeo.lat},${baseGeo.lon}`;
    } else {
      baseGeo.mapsUrl = null;
    }

    // Cache result
    ipCache.set(cleanIp, { timestamp: Date.now(), data: baseGeo });
    return baseGeo;
  } catch (err) {
    console.error(`[resolveIpLocation Error for ${cleanIp}]`, err);
    return null;
  }
}
