/** Supported home / search markets for geo packs and UI labels. */
export const HOME_COUNTRY_OPTIONS = [
  { code: 'US', label: 'United States' },
  { code: 'CA', label: 'Canada' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'IE', label: 'Ireland' },
  { code: 'AU', label: 'Australia' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'ES', label: 'Spain' },
  { code: 'IT', label: 'Italy' },
  { code: 'SE', label: 'Sweden' },
  { code: 'IN', label: 'India' },
  { code: 'SG', label: 'Singapore' },
  { code: 'JP', label: 'Japan' },
  { code: 'BR', label: 'Brazil' },
  { code: 'MX', label: 'Mexico' },
] as const;

export type HomeCountryCode = (typeof HOME_COUNTRY_OPTIONS)[number]['code'];

const METRIC_COUNTRIES = new Set([
  'CA',
  'GB',
  'IE',
  'AU',
  'NZ',
  'DE',
  'FR',
  'NL',
  'ES',
  'IT',
  'SE',
  'IN',
  'SG',
  'JP',
  'BR',
  'MX',
]);

/** ISO 3166-1 alpha-2 → display currency (floors are not auto-converted). */
const CURRENCY_BY_COUNTRY: Record<string, string> = {
  US: 'USD',
  CA: 'CAD',
  GB: 'GBP',
  IE: 'EUR',
  AU: 'AUD',
  NZ: 'NZD',
  DE: 'EUR',
  FR: 'EUR',
  NL: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  SE: 'SEK',
  IN: 'INR',
  SG: 'SGD',
  JP: 'JPY',
  BR: 'BRL',
  MX: 'MXN',
};

export function normalizeHomeCountry(code: string | null | undefined): string {
  const c = String(code ?? 'US')
    .trim()
    .toUpperCase();
  if (c === 'UK') return 'GB';
  return c || 'US';
}

export function isMetricCountry(country: string | null | undefined): boolean {
  return METRIC_COUNTRIES.has(normalizeHomeCountry(country));
}

export function defaultRadiusUnit(country: string | null | undefined): 'mi' | 'km' {
  return isMetricCountry(country) ? 'km' : 'mi';
}

export function currencyForCountry(country: string | null | undefined): string {
  const c = normalizeHomeCountry(country);
  return CURRENCY_BY_COUNTRY[c] || 'USD';
}

export type GeoUiLabels = {
  postalPlaceholder: string;
  radiusPlaceholder: string;
  postalHint: string;
  regionsLabel: string;
  regionsPlaceholder: string;
  workAuthPlaceholder: string;
  geoHint: string;
  geoRequiredMessage: string;
};

/** Labels driven by homeCountry (not UI culture alone). */
export function geoLabelsForCountry(country: string | null | undefined): GeoUiLabels {
  const c = normalizeHomeCountry(country);
  const metricBase: GeoUiLabels = {
    postalPlaceholder: 'Postal code',
    radiusPlaceholder: 'km',
    postalHint: "Add each postal code you'd commute to for onsite/hybrid checks.",
    regionsLabel:
      'Where you can work from for remote roles (country or region codes, e.g. DE, NL, EU)',
    regionsPlaceholder: `${c}, EU`,
    workAuthPlaceholder: 'e.g. citizen / right to work, sponsorship status',
    geoHint:
      'Required for Scan — set at least one of: a commute postal code, remote-eligible regions, or Remote only.',
    geoRequiredMessage:
      'Geography required for Scan: add a postal code, remote regions, or turn on Remote only in Options.',
  };

  if (c === 'US') {
    return {
      postalPlaceholder: 'ZIP',
      radiusPlaceholder: 'miles',
      postalHint: "Add each ZIP you'd commute to for onsite/hybrid checks.",
      regionsLabel:
        'Where you can work from for remote roles (US states, provinces, or country codes, e.g. TX, CA, GB)',
      regionsPlaceholder: 'TX, PA',
      workAuthPlaceholder: 'e.g. US citizen, no sponsorship needed',
      geoHint:
        'Required for Scan — set at least one of: a commute ZIP, remote-eligible regions, or Remote only. Without geography intent, scanning is blocked.',
      geoRequiredMessage:
        'Geography required for Scan: add a ZIP, remote regions, or turn on Remote only in Options.',
    };
  }
  if (c === 'CA') {
    return {
      ...metricBase,
      regionsLabel:
        'Where you can work from for remote roles (provinces or countries, e.g. ON, BC, CA, US)',
      regionsPlaceholder: 'ON, BC',
      workAuthPlaceholder: 'e.g. Canadian citizen / PR, no sponsorship needed',
    };
  }
  if (c === 'GB' || c === 'IE') {
    const isIe = c === 'IE';
    return {
      ...metricBase,
      postalPlaceholder: 'Postcode',
      postalHint: "Add each postcode you'd commute to for onsite/hybrid checks.",
      regionsLabel:
        'Where you can work from for remote roles (nations or countries, e.g. GB, ENG, IE, EU)',
      regionsPlaceholder: isIe ? 'IE, EU' : 'GB, ENG',
      workAuthPlaceholder: isIe
        ? 'e.g. EU/EEA citizen, Irish citizen, right to work in Ireland'
        : 'e.g. British citizen, settled status, right to work in the UK',
      geoHint:
        'Required for Scan — set at least one of: a commute postcode, remote-eligible regions, or Remote only.',
      geoRequiredMessage:
        'Geography required for Scan: add a postcode, remote regions, or turn on Remote only in Options.',
    };
  }
  if (c === 'AU' || c === 'NZ') {
    return {
      ...metricBase,
      postalPlaceholder: 'Postcode',
      postalHint: "Add each postcode you'd commute to for onsite/hybrid checks.",
      regionsLabel:
        'Where you can work from for remote roles (states/territories or countries, e.g. NSW, VIC, AU)',
      regionsPlaceholder: c === 'NZ' ? 'NZ, AU' : 'NSW, VIC',
      workAuthPlaceholder: 'e.g. citizen / permanent resident, no sponsorship needed',
      geoHint:
        'Required for Scan — set at least one of: a commute postcode, remote-eligible regions, or Remote only.',
      geoRequiredMessage:
        'Geography required for Scan: add a postcode, remote regions, or turn on Remote only in Options.',
    };
  }
  return {
    ...metricBase,
    radiusPlaceholder: isMetricCountry(c) ? 'km' : 'miles',
  };
}

/** ISO countries commonly treated as EU for residency allow-lists. */
export const EU_MEMBER_CODES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
]);

/** Western Europe blob used in some multi-country JDs (WEU). */
export const WEU_CODES = new Set([
  'AT',
  'BE',
  'DK',
  'FI',
  'FR',
  'DE',
  'IE',
  'IT',
  'LU',
  'NL',
  'PT',
  'ES',
  'SE',
  'GB',
  'UK',
  'CH',
  'NO',
]);
