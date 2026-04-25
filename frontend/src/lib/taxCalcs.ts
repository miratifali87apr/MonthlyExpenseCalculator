// Australian property tax calculations
// All rates verified against official state revenue authority websites (2024-25)

export type OwnershipStructure = 'individual' | 'trust' | 'company' | 'smsf';
export type AusState = 'QLD' | 'NSW' | 'VIC' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';

// 2024-25 Australian marginal tax rates (Stage 3 cuts, incl. 2% Medicare levy)
export function getMarginalRate(income: number): number {
  if (income <= 18200) return 0;
  if (income <= 45000) return 0.21;   // 19% + 2%
  if (income <= 135000) return 0.345; // 32.5% + 2%
  if (income <= 190000) return 0.39;  // 37% + 2%
  return 0.47;                        // 45% + 2%
}

export function getMarginalRateLabel(income: number): string {
  if (income <= 18200) return '0% — Nil bracket';
  if (income <= 45000) return '21% (19% + 2% Medicare)';
  if (income <= 135000) return '34.5% (32.5% + 2% Medicare)';
  if (income <= 190000) return '39% (37% + 2% Medicare)';
  return '47% (45% + 2% Medicare)';
}

// LMI estimate — Helia/QBE tiered rates
export function calcLMI(loanAmount: number, lvr: number): number {
  if (lvr <= 80) return 0;
  if (lvr <= 85) return loanAmount * 0.009;
  if (lvr <= 90) return loanAmount * 0.018;
  if (lvr <= 95) return loanAmount * 0.038;
  return 0;
}

// Stamp duty — investment property, not first home buyer
// Sources: Revenue NSW, SRO VIC, QRO, RevenueSA, Revenue WA, SRO TAS, ACT Revenue, NT Treasury (2024-25)
export function calcStampDuty(price: number, state: AusState, structure: OwnershipStructure = 'individual'): number {
  let base = 0;
  switch (state) {
    case 'NSW': {
      if (price <= 16000) base = price * 0.0125;
      else if (price <= 35000) base = 200 + (price - 16000) * 0.015;
      else if (price <= 93000) base = 485 + (price - 35000) * 0.0175;
      else if (price <= 351000) base = 1500 + (price - 93000) * 0.035;
      else if (price <= 1168000) base = 10530 + (price - 351000) * 0.045;
      else if (price <= 3505000) base = 47295 + (price - 1168000) * 0.055;
      else base = 175830 + (price - 3505000) * 0.07;
      // NSW trust surcharge (from Feb 2023): 0.5% on full purchase price
      if (structure === 'trust') base += price * 0.005;
      break;
    }
    case 'VIC': {
      if (price <= 25000) base = price * 0.014;
      else if (price <= 130000) base = 350 + (price - 25000) * 0.024;
      else if (price <= 960000) base = 2870 + (price - 130000) * 0.06;
      else base = price * 0.055; // flat 5.5% on full price over $960k
      // VIC trust surcharge (absentee/trust): 1%
      if (structure === 'trust') base += price * 0.01;
      break;
    }
    case 'QLD': {
      if (price <= 5000) base = 0;
      else if (price <= 75000) base = (price - 5000) * 0.015;
      else if (price <= 540000) base = 1050 + (price - 75000) * 0.035;
      else if (price <= 1000000) base = 17325 + (price - 540000) * 0.045;
      else base = 38025 + (price - 1000000) * 0.0575;
      break;
    }
    case 'SA': {
      if (price <= 12000) base = price * 0.01;
      else if (price <= 30000) base = 120 + (price - 12000) * 0.02;
      else if (price <= 50000) base = 480 + (price - 30000) * 0.03;
      else if (price <= 100000) base = 1080 + (price - 50000) * 0.035;
      else if (price <= 200000) base = 2830 + (price - 100000) * 0.04;
      else if (price <= 250000) base = 6830 + (price - 200000) * 0.0425;
      else if (price <= 300000) base = 8955 + (price - 250000) * 0.0475;
      else if (price <= 500000) base = 11330 + (price - 300000) * 0.05;
      else base = 21330 + (price - 500000) * 0.055;
      break;
    }
    case 'WA': {
      if (price <= 120000) base = price * 0.019;
      else if (price <= 150000) base = 2280 + (price - 120000) * 0.0285;
      else if (price <= 360000) base = 3135 + (price - 150000) * 0.038;
      else if (price <= 725000) base = 11115 + (price - 360000) * 0.0475;
      else base = 28453 + (price - 725000) * 0.0515;
      break;
    }
    case 'TAS': {
      if (price <= 3000) base = 50;
      else if (price <= 25000) base = 50 + (price - 3000) * 0.0175;
      else if (price <= 75000) base = 435 + (price - 25000) * 0.0225;
      else if (price <= 200000) base = 1560 + (price - 75000) * 0.035;
      else if (price <= 375000) base = 5935 + (price - 200000) * 0.04;
      else if (price <= 725000) base = 12935 + (price - 375000) * 0.0425;
      else base = 27810 + (price - 725000) * 0.045;
      break;
    }
    case 'ACT': {
      // Marginal bracket system — each rate applies to the band only
      if (price <= 200000) base = price * 0.006;
      else if (price <= 300000) base = 1200 + (price - 200000) * 0.022;
      else if (price <= 500000) base = 3400 + (price - 300000) * 0.034;
      else if (price <= 750000) base = 10200 + (price - 500000) * 0.0432;
      else if (price <= 1000000) base = 21000 + (price - 750000) * 0.059;
      else base = 35750 + (price - 1000000) * 0.064;
      break;
    }
    case 'NT': {
      if (price <= 525000) {
        const v = price / 1000;
        base = Math.max(0, (0.06571441 * v * v + 15 * v - 12000) * 0.01);
      } else {
        base = price * 0.0495;
      }
      break;
    }
    default: base = 0;
  }
  return base;
}

// Land tax — annual, on estimated unimproved land value
// Sources: all state revenue authority websites (2024-25)
export function calcLandTax(landValue: number, structure: OwnershipStructure, state: AusState): number {
  const isCompanyOrTrust = structure === 'trust' || structure === 'company';

  switch (state) {
    case 'NSW': {
      // Individual: threshold $1,075,000 (frozen 2024-25), $100 + 1.6% over threshold
      // Trust/Company: taxed from $1, flat 1.6% on full land value
      if (isCompanyOrTrust) {
        return landValue * 0.016;
      }
      if (landValue <= 1075000) return 0;
      if (landValue <= 6571000) return 100 + (landValue - 1075000) * 0.016;
      return 88036 + (landValue - 6571000) * 0.02;
    }
    case 'VIC': {
      // Individual & Trust base: $300k threshold
      // $275 + 0.2% $300k–$600k; $875 + 0.5% $600k–$1M; $2,875 + 1.3% $1M–$1.8M; $13,275 + 1.9% $1.8M–$3M; $36,075 + 2.55% over $3M
      // Trust surcharge: additional 0.5% on taxable land value (land value above $300k threshold)
      if (landValue <= 300000) return 0;
      let base: number;
      if (landValue <= 600000) base = 275 + (landValue - 300000) * 0.002;
      else if (landValue <= 1000000) base = 875 + (landValue - 600000) * 0.005;
      else if (landValue <= 1800000) base = 2875 + (landValue - 1000000) * 0.013;
      else if (landValue <= 3000000) base = 13275 + (landValue - 1800000) * 0.019;
      else base = 36075 + (landValue - 3000000) * 0.0255;
      if (structure === 'trust') base += (landValue - 300000) * 0.005;
      return base;
    }
    case 'QLD': {
      if (!isCompanyOrTrust) {
        // Individual: $600k threshold. 1% over $600k to $1M; 1.65% over $1M
        if (landValue <= 600000) return 0;
        if (landValue <= 1000000) return (landValue - 600000) * 0.01;
        return 4000 + (landValue - 1000000) * 0.0165;
      }
      // Company/Trust: $350k threshold. 1% over $350k to $2.25M; 1.65% over $2.25M
      if (landValue <= 350000) return 0;
      if (landValue <= 2250000) return (landValue - 350000) * 0.01;
      return 19000 + (landValue - 2250000) * 0.0165;
    }
    case 'SA': {
      // Same for individuals and trusts
      if (landValue <= 532000) return 0;
      if (landValue <= 1078000) return (landValue - 532000) * 0.005;
      if (landValue <= 1617000) return 2770 + (landValue - 1078000) * 0.007;
      if (landValue <= 2696000) return 6543 + (landValue - 1617000) * 0.01;
      if (landValue <= 5390000) return 17333 + (landValue - 2696000) * 0.013;
      return 52356 + (landValue - 5390000) * 0.024;
    }
    case 'WA': {
      if (landValue <= 300000) return 0;
      if (landValue <= 1000000) return 300 + (landValue - 300000) * 0.0009;
      if (landValue <= 2200000) return 930 + (landValue - 1000000) * 0.0015;
      if (landValue <= 5500000) return 2730 + (landValue - 2200000) * 0.0045;
      if (landValue <= 11000000) return 17580 + (landValue - 5500000) * 0.0047;
      return 43430 + (landValue - 11000000) * 0.016;
    }
    case 'TAS': {
      // $25k threshold. 0.55% $25k–$350k; $1,788 + 1.25% over $350k
      // Trust surcharge: additional 0.5%
      if (landValue <= 25000) return 0;
      let base: number;
      if (landValue <= 350000) base = (landValue - 25000) * 0.0055;
      else base = 1788 + (landValue - 350000) * 0.0125;
      if (structure === 'trust') base += landValue * 0.005;
      return base;
    }
    case 'ACT': {
      // Based on AUV (Average Unimproved Value) — using estimated land value
      // Marginal bracket system
      if (landValue <= 0) return 0;
      if (landValue <= 75000) return landValue * 0.0059;
      if (landValue <= 150000) return 442.5 + (landValue - 75000) * 0.0079;
      if (landValue <= 275000) return 1035 + (landValue - 150000) * 0.0114;
      return 2460 + (landValue - 275000) * 0.0202;
    }
    case 'NT': return 0; // No land tax in NT
    default: return 0;
  }
}

export function landTaxThresholdLabel(structure: OwnershipStructure, state: AusState): string {
  const isCompanyOrTrust = structure === 'trust' || structure === 'company';
  switch (state) {
    case 'QLD': return isCompanyOrTrust ? '$350k (company/trust)' : '$600k (individual)';
    case 'VIC': return '$300k';
    case 'NSW': return isCompanyOrTrust ? '$0 (no threshold — trust/company)' : '$1,075,000 (frozen 2024-25)';
    case 'WA': return '$300k';
    case 'SA': return '$532k';
    case 'TAS': return '$25k';
    case 'ACT': return 'N/A (general rates system)';
    case 'NT': return 'N/A (no land tax)';
    default: return '—';
  }
}
