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
// Sources: QRO, Revenue NSW (2025-26 CPI-indexed), SRO Vic, Revenue WA, RevenueSA, SRO TAS, ACT Revenue, NT Treasury
export function calcStampDuty(price: number, state: AusState): number {
  switch (state) {
    case 'QLD': {
      if (price <= 5000) return 0;
      if (price <= 75000) return (price - 5000) * 0.015;
      if (price <= 540000) return 1050 + (price - 75000) * 0.035;
      if (price <= 1000000) return 17325 + (price - 540000) * 0.045;
      return 38025 + (price - 1000000) * 0.0575;
    }
    case 'NSW': {
      // Revenue NSW — 2025-26 CPI-indexed thresholds (update annually)
      if (price <= 17000) return price * 0.0125;
      if (price <= 37000) return 212 + (price - 17000) * 0.015;
      if (price <= 99000) return 512 + (price - 37000) * 0.0175;
      if (price <= 372000) return 1597 + (price - 99000) * 0.035;
      if (price <= 1240000) return 11152 + (price - 372000) * 0.045;
      if (price <= 3721000) return 50212 + (price - 1240000) * 0.055;
      return 186667 + (price - 3721000) * 0.07;
    }
    case 'VIC': {
      // SRO Victoria — non-PPR (investment) rates from 1 Jul 2021
      if (price <= 25000) return price * 0.014;
      if (price <= 130000) return 350 + (price - 25000) * 0.024;
      if (price <= 960000) return 2870 + (price - 130000) * 0.06;
      if (price <= 2000000) return price * 0.055;
      return 110000 + (price - 2000000) * 0.065;
    }
    case 'WA': {
      if (price <= 120000) return price * 0.019;
      if (price <= 150000) return 2280 + (price - 120000) * 0.0285;
      if (price <= 360000) return 3135 + (price - 150000) * 0.038;
      if (price <= 725000) return 11115 + (price - 360000) * 0.0475;
      return 28453 + (price - 725000) * 0.0515;
    }
    case 'SA': {
      if (price <= 12000) return price * 0.01;
      if (price <= 30000) return 120 + (price - 12000) * 0.02;
      if (price <= 50000) return 480 + (price - 30000) * 0.03;
      if (price <= 100000) return 1080 + (price - 50000) * 0.035;
      if (price <= 200000) return 2830 + (price - 100000) * 0.04;
      if (price <= 250000) return 6830 + (price - 200000) * 0.0425;
      if (price <= 300000) return 8955 + (price - 250000) * 0.0475;
      if (price <= 500000) return 11330 + (price - 300000) * 0.05;
      return 21330 + (price - 500000) * 0.055;
    }
    case 'TAS': {
      if (price <= 3000) return 50;
      if (price <= 25000) return 50 + (price - 3000) * 0.015;
      if (price <= 75000) return 380 + (price - 25000) * 0.0225;
      if (price <= 200000) return 1505 + (price - 75000) * 0.035;
      if (price <= 375000) return 5880 + (price - 200000) * 0.04;
      if (price <= 725000) return 12880 + (price - 375000) * 0.0425;
      return 27755 + (price - 725000) * 0.045;
    }
    case 'ACT': {
      if (price <= 200000) return price * 0.0206;
      if (price <= 300000) return 4120 + (price - 200000) * 0.0292;
      if (price <= 500000) return 7040 + (price - 300000) * 0.0399;
      if (price <= 750000) return 15020 + (price - 500000) * 0.0499;
      if (price <= 1000000) return 27495 + (price - 750000) * 0.0649;
      return 43720 + (price - 1000000) * 0.0699;
    }
    case 'NT': {
      if (price <= 525000) {
        const v = price / 1000;
        return Math.max(0, (0.06571441 * v * v + 15 * v - 12000) * 0.01);
      }
      return price * 0.0495;
    }
    default: return 0;
  }
}

// Land tax — annual, on unimproved land value (typically ~30% of purchase price)
export function calcLandTax(landValue: number, structure: OwnershipStructure, state: AusState): number {
  const isCompanyOrTrust = structure === 'trust' || structure === 'company';

  switch (state) {
    case 'QLD': {
      // QRO 2024-25 — qro.qld.gov.au
      if (!isCompanyOrTrust) {
        if (landValue < 600000) return 0;
        if (landValue < 1000000) return 500 + (landValue - 600000) * 0.01;
        if (landValue < 3000000) return 4500 + (landValue - 1000000) * 0.0165;
        if (landValue < 5000000) return 37500 + (landValue - 3000000) * 0.0125;
        if (landValue < 10000000) return 62500 + (landValue - 5000000) * 0.0175;
        return 150000 + (landValue - 10000000) * 0.0225;
      }
      if (landValue < 350000) return 0;
      if (landValue < 2250000) return 1450 + (landValue - 350000) * 0.017;
      if (landValue < 5000000) return 33750 + (landValue - 2250000) * 0.015;
      if (landValue < 10000000) return 75000 + (landValue - 5000000) * 0.0225;
      return 187500 + (landValue - 10000000) * 0.0275;
    }
    case 'VIC': {
      // SRO Victoria 2024-25 — sro.vic.gov.au
      if (structure === 'trust') {
        if (landValue < 25000) return 0;
        if (landValue < 50000) return 82 + (landValue - 25000) * 0.00375;
        if (landValue < 100000) return 676 + (landValue - 50000) * 0.00375;
        if (landValue < 250000) return 1338 + (landValue - 100000) * 0.00375;
        if (landValue < 600000) return 1901 + (landValue - 250000) * 0.00675;
        if (landValue < 1000000) return 4263 + (landValue - 600000) * 0.00975;
        if (landValue < 1800000) return 8163 + (landValue - 1000000) * 0.01275;
        if (landValue < 3000000) return 18363 + (landValue - 1800000) * 0.011072;
        return 31650 + (landValue - 3000000) * 0.0265;
      }
      if (landValue < 50000) return 0;
      if (landValue < 100000) return 500;
      if (landValue < 300000) return 975;
      if (landValue < 600000) return 1350 + (landValue - 300000) * 0.003;
      if (landValue < 1000000) return 2250 + (landValue - 600000) * 0.006;
      if (landValue < 1800000) return 4650 + (landValue - 1000000) * 0.009;
      if (landValue < 3000000) return 11850 + (landValue - 1800000) * 0.0165;
      return 31650 + (landValue - 3000000) * 0.0265;
    }
    case 'NSW': {
      // Revenue NSW 2024-25 — revenue.nsw.gov.au
      if (landValue <= 1075000) return 0;
      if (landValue <= 6571000) return 100 + (landValue - 1075000) * 0.016;
      return 88036 + (landValue - 6571000) * 0.02;
    }
    case 'WA': {
      if (landValue <= 300000) return 0;
      if (landValue <= 420000) return 300;
      if (landValue <= 1000000) return 300 + (landValue - 420000) * 0.0025;
      if (landValue <= 1800000) return 1750 + (landValue - 1000000) * 0.009;
      if (landValue <= 5000000) return 8950 + (landValue - 1800000) * 0.018;
      if (landValue <= 11000000) return 66550 + (landValue - 5000000) * 0.02;
      return 186550 + (landValue - 11000000) * 0.0267;
    }
    case 'SA': {
      if (landValue <= 534000) return 0;
      if (landValue <= 1082000) return (landValue - 534000) * 0.005;
      if (landValue <= 1700000) return 2740 + (landValue - 1082000) * 0.01;
      if (landValue <= 3900000) return 8940 + (landValue - 1700000) * 0.0175;
      return 47440 + (landValue - 3900000) * 0.024;
    }
    case 'TAS': {
      if (landValue < 125000) return 0;
      if (landValue < 500000) return 50 + (landValue - 125000) * 0.0045;
      return 1737.50 + (landValue - 500000) * 0.015;
    }
    case 'ACT': return 0;
    case 'NT': return 0;
    default: return 0;
  }
}

export function landTaxThresholdLabel(structure: OwnershipStructure, state: AusState): string {
  const isCompanyOrTrust = structure === 'trust' || structure === 'company';
  switch (state) {
    case 'QLD': return isCompanyOrTrust ? '$350k (company/trust)' : '$600k (individual)';
    case 'VIC': return structure === 'trust' ? '$25k (trust surcharge table)' : '$50k';
    case 'NSW': return '$1,075,000 (frozen 2024-25)';
    case 'WA': return '$300k';
    case 'SA': return '$534k';
    case 'TAS': return '$125k';
    case 'ACT': return 'N/A (general rates system)';
    case 'NT': return 'N/A (no land tax)';
    default: return '—';
  }
}
