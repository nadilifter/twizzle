/**
 * US state-level base sales tax rates (2026).
 *
 * These are state-level rates only and do NOT include local/county surtaxes.
 * Organizations should adjust the rate for their specific jurisdiction.
 * States with 0 have no state-level sales tax.
 */
const US_STATE_TAX_RATES: Record<string, number> = {
  AL: 0.04,
  AK: 0,
  AZ: 0.056,
  AR: 0.065,
  CA: 0.0725,
  CO: 0.029,
  CT: 0.0635,
  DE: 0,
  FL: 0.06,
  GA: 0.04,
  HI: 0.04,
  ID: 0.06,
  IL: 0.0625,
  IN: 0.07,
  IA: 0.06,
  KS: 0.065,
  KY: 0.06,
  LA: 0.0445,
  ME: 0.055,
  MD: 0.06,
  MA: 0.0625,
  MI: 0.06,
  MN: 0.06875,
  MS: 0.07,
  MO: 0.04225,
  MT: 0,
  NE: 0.055,
  NV: 0.0685,
  NH: 0,
  NJ: 0.06625,
  NM: 0.04875,
  NY: 0.04,
  NC: 0.0475,
  ND: 0.05,
  OH: 0.0575,
  OK: 0.045,
  OR: 0,
  PA: 0.06,
  RI: 0.07,
  SC: 0.06,
  SD: 0.045,
  TN: 0.07,
  TX: 0.0625,
  UT: 0.061,
  VT: 0.06,
  VA: 0.053,
  WA: 0.065,
  WV: 0.06,
  WI: 0.05,
  WY: 0.04,
  DC: 0.06,
};

/**
 * Canadian provincial sales tax rates (combined GST/HST/PST where applicable).
 */
const CA_PROVINCE_TAX_RATES: Record<string, number> = {
  AB: 0.05,
  BC: 0.12,
  MB: 0.12,
  NB: 0.15,
  NL: 0.15,
  NS: 0.15,
  NT: 0.05,
  NU: 0.05,
  ON: 0.13,
  PE: 0.15,
  QC: 0.14975,
  SK: 0.11,
  YT: 0.05,
};

/**
 * Get the default state/provincial sales tax rate for a given region code.
 * Returns 0 if the code is not recognized.
 */
export function getDefaultTaxRate(
  stateOrProvinceCode: string | null | undefined,
  country?: string | null
): number {
  if (!stateOrProvinceCode) return 0;
  const code = stateOrProvinceCode.toUpperCase().trim();

  if (country?.toUpperCase() === "CA") {
    return CA_PROVINCE_TAX_RATES[code] ?? 0;
  }

  return US_STATE_TAX_RATES[code] ?? CA_PROVINCE_TAX_RATES[code] ?? 0;
}
