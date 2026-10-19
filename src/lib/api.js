async function req(method, url, body, isForm) {
  const r = await fetch(url, {
    method,
    headers: body && !isForm ? { 'content-type': 'application/json' } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `${r.status} ${r.statusText}`);
  return j;
}
const qs = (o = {}) => { const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== '')); return p.toString() ? `?${p}` : ''; };

export const api = {
  list: (table, q) => req('GET', `/api/t/${table}${qs(q)}`),
  add: (table, row) => req('POST', `/api/t/${table}`, row),
  update: (table, id, row) => req('PUT', `/api/t/${table}/${id}`, row),
  remove: (table, id) => req('DELETE', `/api/t/${table}/${encodeURIComponent(id)}`),
  removeEntry: (metric, date) => req('POST', '/api/entries/delete', { metric, date }),
  bundle: (from) => req('GET', `/api/bundle${qs({ from })}`),
  settings: () => req('GET', '/api/settings'),
  saveSettings: (obj) => req('PUT', '/api/settings', obj),
  searchFoods: (q) => req('GET', `/api/foods/search${qs({ q })}`),
  externalFoods: (q, source) => req('GET', `/api/foods/external${qs({ q, source })}`),
  barcode: (code) => req('GET', `/api/foods/barcode/${encodeURIComponent(code)}`),
  saveFood: (f) => req('POST', '/api/foods/save', f),
  importFoodsCsv: (body) => req('POST', '/api/foods/import-csv', body),
  foodStats: () => req('GET', '/api/foods/stats'),
  uploadPhoto: (form) => req('POST', '/api/photos', form, true),
  ingestSources: () => req('GET', '/api/ingest/sources'),
  ingestSample: (s) => req('GET', `/api/ingest/sample/${s}`),
  ingest: (s, payload) => req('POST', `/api/ingest/${s}`, payload),
  ingestAppleXml: (form) => req('POST', '/api/ingest/apple-health/upload', form, true),
  googleFitSync: (days) => req('POST', '/api/integrations/google-fit/sync', { days }),
  demo: () => req('POST', '/api/demo'),
  reset: (keepFoods) => req('POST', '/api/reset', { keepFoods }),
  importAll: (data) => req('POST', '/api/import', data),
};
