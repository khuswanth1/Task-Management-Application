// Google Fonts Developer API integration.
// Requires VITE_GOOGLE_FONTS_API_KEY (see .env.example) — falls back to null
// (caller should use a curated static list) when no key is configured.

const FONT_LIST_CACHE_KEY = "google_fonts_list_cache_v1";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function fetchGoogleFontFamilies() {
  try {
    const cached = localStorage.getItem(FONT_LIST_CACHE_KEY);
    if (cached) {
      const { timestamp, fonts } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL_MS && Array.isArray(fonts) && fonts.length > 0) {
        return fonts;
      }
    }
  } catch {
    // Corrupt cache entry — ignore and refetch.
  }

  try {
    const res = await fetch("/api/fonts");
    if (!res.ok) {
      throw new Error(`Backend Fonts API request failed: ${res.status}`);
    }
    const data = await res.json();
    
    // Check if the backend returned an error directly
    if (data.error) {
       console.error("Backend returned error:", data.error);
       return null;
    }

    const fonts = (data.items || []).map((item) => ({
      family: item.family,
      category: item.category,
      variants: item.variants,
    }));

    try {
      localStorage.setItem(FONT_LIST_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), fonts }));
    } catch {
      // Storage full/unavailable — non-fatal, just skip caching.
    }

    return fonts;
  } catch (err) {
    console.error("Failed to fetch fonts from backend:", err);
    return null;
  }
}

// Fonts already loaded statically in index.html — no need to re-fetch these.
const PRELOADED_FONTS = new Set([
  "Inter", "Roboto", "Outfit", "Poppins", "Montserrat",
  "Playfair Display", "Lora", "Caveat", "Fira Mono",
]);

const dynamicallyLoadedFonts = new Set(PRELOADED_FONTS);
const previewLoadedFonts = new Set(PRELOADED_FONTS);

const CATEGORY_FALLBACK = {
  serif: "serif",
  monospace: "monospace",
  handwriting: "cursive",
  display: "sans-serif",
  "sans-serif": "sans-serif",
};

const primaryFamily = (fontFamily) =>
  (fontFamily || "").split(",")[0].trim().replace(/^['"]|['"]$/g, "");

const familyParam = (name) => encodeURIComponent(name).replace(/%20/g, "+");

function cachedFontInfo(name) {
  try {
    const { fonts } = JSON.parse(localStorage.getItem(FONT_LIST_CACHE_KEY) || "{}");
    return Array.isArray(fonts) ? fonts.find((f) => f.family === name) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * CSS font-family value for a Google font: quoted (names like "M PLUS 1p" are invalid
 * unquoted) and followed by a generic fallback matching the font's category.
 */
export function cssFontStack(fontFamily) {
  const name = primaryFamily(fontFamily);
  if (!name) return "'Inter', sans-serif";
  const fallback = CATEGORY_FALLBACK[cachedFontInfo(name)?.category] || "sans-serif";
  return `"${name.replace(/"/g, "")}", ${fallback}`;
}

/** Numeric weights (100–900) the font really has; Google rejects requests for missing ones. */
function availableWeights(variants) {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  const weights = new Set();
  for (const v of variants) {
    if (v === "regular" || v === "italic") weights.add(400);
    const m = /^(\d{3})/.exec(v);
    if (m) weights.add(Number(m[1]));
  }
  return weights.size ? [...weights].sort((a, b) => a - b) : null;
}

function addStylesheet(href) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

// Injects a <link> for the given font-family value (e.g. "'Fira Mono', monospace")
// so it actually renders wherever it's used, not just in fonts already in index.html.
export async function ensureFontLoaded(fontFamily) {
  const primary = primaryFamily(fontFamily);
  if (!primary || dynamicallyLoadedFonts.has(primary)) return;
  dynamicallyLoadedFonts.add(primary);

  // Variant list comes from the (cached) Google Fonts catalog served by the backend
  let info = cachedFontInfo(primary);
  if (!info) info = (await fetchGoogleFontFamilies())?.find((f) => f.family === primary);
  const weights = availableWeights(info?.variants);

  // Without known weights, ask for the family alone (always valid, regular weight)
  const spec = weights && !(weights.length === 1 && weights[0] === 400) ? `:wght@${weights.join(";")}` : "";
  addStylesheet(`https://fonts.googleapis.com/css2?family=${familyParam(primary)}${spec}&display=swap`);
}

/** Loads only the glyphs of the font's own name — a tiny request, used for picker previews. */
export function loadFontPreview(name) {
  if (!name || previewLoadedFonts.has(name) || dynamicallyLoadedFonts.has(name)) return;
  previewLoadedFonts.add(name);
  addStylesheet(`https://fonts.googleapis.com/css2?family=${familyParam(name)}&text=${encodeURIComponent(name)}&display=swap`);
}
