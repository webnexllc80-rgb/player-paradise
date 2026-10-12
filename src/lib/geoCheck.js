export function isGeoAllowed(req) {
  if (process.env.BYPASS_GEO_LOCK === 'true' || process.env.NODE_ENV === 'development') {
    return true;
  }
  // In production, can check headers like cf-ipcountry or x-vercel-ip-country
  const country = req.headers?.get?.('cf-ipcountry') || req.headers?.get?.('x-country-code') || 'US';
  return country === 'US';
}
