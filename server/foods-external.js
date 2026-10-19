// External food databases, normalised to the local foods shape (per 100 g).
//  • USDA FoodData Central — ~400k foods incl. full micronutrient panels (free API key; DEMO_KEY is rate-limited)
//  • Open Food Facts       — ~3M packaged products worldwide, barcode lookup, NOVA group (no key)

const USDA_NUM = { 208: 'kcal', 203: 'protein', 205: 'carbs', 204: 'fat', 291: 'fiber', 269: 'sugar', 606: 'satfat',
  307: 'sodium', 306: 'potassium', 301: 'calcium', 303: 'iron', 401: 'vitc' };
const USDA_MICROS = { 320: 'Vitamin A (µg RAE)', 328: 'Vitamin D (µg)', 323: 'Vitamin E (mg)', 430: 'Vitamin K (µg)', 418: 'Vitamin B12 (µg)',
  415: 'Vitamin B6 (mg)', 435: 'Folate (µg DFE)', 404: 'Thiamin (mg)', 405: 'Riboflavin (mg)', 406: 'Niacin (mg)', 304: 'Magnesium (mg)',
  309: 'Zinc (mg)', 305: 'Phosphorus (mg)', 317: 'Selenium (µg)', 312: 'Copper (mg)', 601: 'Cholesterol (mg)', 645: 'MUFA (g)', 646: 'PUFA (g)', 605: 'Trans fat (g)' };

export async function searchUsda(q, apiKey) {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(q)}&pageSize=25&dataType=${encodeURIComponent('Foundation,SR Legacy,Survey (FNDDS),Branded')}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`USDA search failed (${r.status}). Check your API key in Settings.`);
  const j = await r.json();
  return (j.foods || []).map((f) => {
    const out = { name: titleCase(f.description), category: f.foodCategory || 'USDA', cuisine: 'Global', source: 'usda', ext_id: String(f.fdcId),
      serving_name: '100 g', serving_g: 100, micros: {}, brand: f.brandOwner || null, barcode: f.gtinUpc || null };
    if (f.servingSize && /g|ml/i.test(f.servingSizeUnit || '')) { out.serving_g = f.servingSize; out.serving_name = f.householdServingFullText || `${f.servingSize} g`; }
    for (const n of f.foodNutrients || []) {
      const num = Number(n.nutrientNumber);
      if (USDA_NUM[num]) {
        // energy may come in kJ (268) — we only read 208 kcal
        out[USDA_NUM[num]] = n.value;
      } else if (USDA_MICROS[num]) out.micros[USDA_MICROS[num]] = n.value;
    }
    return out;
  }).filter((f) => f.kcal != null);
}

function mapOff(p) {
  const n = p.nutriments || {};
  const g = (k) => (n[`${k}_100g`] != null ? Number(n[`${k}_100g`]) : null);
  const mg = (k) => (g(k) != null ? g(k) * 1000 : null);
  return {
    name: [p.product_name, p.brands?.split(',')[0]].filter(Boolean).join(' — ') || 'Unnamed product',
    category: p.categories_tags?.[0]?.replace(/^en:/, '').replace(/-/g, ' ') || 'Packaged', cuisine: 'Global',
    serving_name: p.serving_size || '100 g', serving_g: Number(p.serving_quantity) || 100,
    kcal: g('energy-kcal') ?? (g('energy') != null ? g('energy') / 4.184 : null), protein: g('proteins'), carbs: g('carbohydrates'), fat: g('fat'),
    fiber: g('fiber'), sugar: g('sugars'), satfat: g('saturated-fat'), sodium: mg('sodium'), potassium: mg('potassium'),
    calcium: mg('calcium'), iron: mg('iron'), vitc: mg('vitamin-c'), nova: p.nova_group || null,
    barcode: p.code, source: 'off', ext_id: p.code, image: p.image_small_url || null,
  };
}

export async function searchOff(q) {
  const r = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25`,
    { headers: { 'user-agent': 'LifeOS-Health/0.1 (personal use)' } });
  if (!r.ok) throw new Error(`Open Food Facts search failed (${r.status})`);
  const j = await r.json();
  return (j.products || []).map(mapOff).filter((f) => f.kcal != null);
}

export async function barcodeOff(code) {
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`, { headers: { 'user-agent': 'LifeOS-Health/0.1 (personal use)' } });
  if (!r.ok) return null;
  const j = await r.json();
  return j.status === 1 ? mapOff(j.product) : null;
}

const titleCase = (s = '') => s.toLowerCase().replace(/(^|[\s,(])\w/g, (m) => m.toUpperCase());
