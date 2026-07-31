export type BBox = {
  south: number;
  west: number;
  north: number;
  east: number;
  label: string;
};

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "LeadMatrix/1.0 (lead-generation)" },
    });
  } finally {
    clearTimeout(timer);
  }
}

// Clamp a bounding box so a single Overpass query stays fast (~ up to ~40km span).
function clampBBox(south: number, west: number, north: number, east: number) {
  const maxSpan = 0.6; // ~66km
  let latSpan = north - south;
  let lonSpan = east - west;
  const cLat = (north + south) / 2;
  const cLon = (east + west) / 2;
  if (latSpan <= 0 || latSpan > maxSpan) latSpan = maxSpan;
  if (lonSpan <= 0 || lonSpan > maxSpan) lonSpan = maxSpan;
  return {
    south: cLat - latSpan / 2,
    north: cLat + latSpan / 2,
    west: cLon - lonSpan / 2,
    east: cLon + lonSpan / 2,
  };
}

/**
 * Geocode a free-text location into a bounding box using the free Photon API
 * (OpenStreetMap data, no API key required).
 */
export async function geocode(location: string): Promise<BBox | null> {
  const q = location.trim();
  if (!q) return null;

  try {
    const res = await fetchWithTimeout(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`,
      15000,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data?.features?.[0];
    if (!feature) return null;

    const props = feature.properties ?? {};
    const coords = feature.geometry?.coordinates;
    const parts = [props.name, props.city, props.state, props.country].filter(Boolean);
    const label = parts.length ? parts.join(", ") : q;

    // Photon returns [minLon, maxLat, maxLon, minLat] as `extent` for areas.
    if (Array.isArray(props.extent) && props.extent.length === 4) {
      const [minLon, maxLat, maxLon, minLat] = props.extent as number[];
      const box = clampBBox(minLat, minLon, maxLat, maxLon);
      return { ...box, label };
    }

    if (Array.isArray(coords) && coords.length === 2) {
      const [lon, lat] = coords as number[];
      const pad = 0.18; // ~20km radius fallback
      return {
        south: lat - pad,
        west: lon - pad,
        north: lat + pad,
        east: lon + pad,
        label,
      };
    }

    return null;
  } catch {
    return null;
  }
}
