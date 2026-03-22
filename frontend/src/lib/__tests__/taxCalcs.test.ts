import {
  calcStampDuty,
  calcLandTax,
  calcLMI,
  getMarginalRate,
  getMarginalRateLabel,
} from '../taxCalcs';

// Helper for rounding to nearest dollar (stamp duty is often rounded)
function round(n: number) { return Math.round(n); }

// ─── LMI ─────────────────────────────────────────────────────────────────────

describe('calcLMI', () => {
  it('returns 0 for LVR <= 80%', () => {
    expect(calcLMI(500000, 80)).toBe(0);
    expect(calcLMI(500000, 70)).toBe(0);
  });

  it('applies 0.9% for LVR 81-85%', () => {
    expect(calcLMI(500000, 85)).toBe(4500);
  });

  it('applies 1.8% for LVR 86-90%', () => {
    expect(calcLMI(400000, 90)).toBeCloseTo(7200, 2);
  });

  it('applies 3.8% for LVR 91-95%', () => {
    expect(calcLMI(400000, 95)).toBe(15200);
  });
});

// ─── Marginal Tax Rates ───────────────────────────────────────────────────────

describe('getMarginalRate', () => {
  it('returns 0% for income <= $18,200', () => {
    expect(getMarginalRate(0)).toBe(0);
    expect(getMarginalRate(18200)).toBe(0);
  });

  it('returns 21% (19%+Medicare) for $18,201-$45,000', () => {
    expect(getMarginalRate(18201)).toBe(0.21);
    expect(getMarginalRate(45000)).toBe(0.21);
  });

  it('returns 34.5% for $45,001-$135,000', () => {
    expect(getMarginalRate(45001)).toBe(0.345);
    expect(getMarginalRate(100000)).toBe(0.345);
    expect(getMarginalRate(135000)).toBe(0.345);
  });

  it('returns 39% for $135,001-$190,000', () => {
    expect(getMarginalRate(135001)).toBe(0.39);
    expect(getMarginalRate(190000)).toBe(0.39);
  });

  it('returns 47% for income > $190,000', () => {
    expect(getMarginalRate(190001)).toBe(0.47);
    expect(getMarginalRate(500000)).toBe(0.47);
  });
});

describe('getMarginalRateLabel', () => {
  it('returns correct label for each bracket', () => {
    expect(getMarginalRateLabel(10000)).toBe('0% — Nil bracket');
    expect(getMarginalRateLabel(30000)).toBe('21% (19% + 2% Medicare)');
    expect(getMarginalRateLabel(80000)).toBe('34.5% (32.5% + 2% Medicare)');
    expect(getMarginalRateLabel(150000)).toBe('39% (37% + 2% Medicare)');
    expect(getMarginalRateLabel(200000)).toBe('47% (45% + 2% Medicare)');
  });
});

// ─── Stamp Duty ───────────────────────────────────────────────────────────────

describe('calcStampDuty — QLD', () => {
  it('returns 0 for price <= $5,000', () => {
    expect(calcStampDuty(5000, 'QLD')).toBe(0);
  });

  it('correct duty at $500k (between $75k-$540k bracket)', () => {
    // 1050 + (500000 - 75000) * 0.035 = 1050 + 14875 = 15925
    expect(round(calcStampDuty(500000, 'QLD'))).toBe(15925);
  });

  it('correct duty at $750k (between $540k-$1M bracket)', () => {
    // 17325 + (750000 - 540000) * 0.045 = 17325 + 9450 = 26775
    expect(round(calcStampDuty(750000, 'QLD'))).toBe(26775);
  });

  it('correct duty at $1.5M (above $1M)', () => {
    // 38025 + (1500000 - 1000000) * 0.0575 = 38025 + 28750 = 66775
    expect(round(calcStampDuty(1500000, 'QLD'))).toBe(66775);
  });
});

describe('calcStampDuty — NSW (2025-26 CPI-indexed)', () => {
  it('correct duty at $17k boundary', () => {
    expect(round(calcStampDuty(17000, 'NSW'))).toBe(round(17000 * 0.0125)); // 212
  });

  it('correct duty at $500k', () => {
    // 11152 + (500000 - 372000) * 0.045 = 11152 + 5760 = 16912
    expect(round(calcStampDuty(500000, 'NSW'))).toBe(16912);
  });

  it('correct duty at $1M', () => {
    // 11152 + (1000000 - 372000) * 0.045 = 11152 + 28260 = 39412
    expect(round(calcStampDuty(1000000, 'NSW'))).toBe(39412);
  });

  it('correct duty at $2M (above $1.24M threshold)', () => {
    // 50212 + (2000000 - 1240000) * 0.055 = 50212 + 41800 = 92012
    expect(round(calcStampDuty(2000000, 'NSW'))).toBe(92012);
  });

  it('correct duty at $4M (premium above $3.721M)', () => {
    // 186667 + (4000000 - 3721000) * 0.07 = 186667 + 19530 = 206197
    expect(round(calcStampDuty(4000000, 'NSW'))).toBe(206197);
  });
});

describe('calcStampDuty — VIC', () => {
  it('flat 5.5% of total value for $960k-$2M', () => {
    expect(calcStampDuty(1000000, 'VIC')).toBe(55000);
    expect(calcStampDuty(1500000, 'VIC')).toBe(82500);
  });

  it('correct duty just above $2M', () => {
    // 110000 + (2100000 - 2000000) * 0.065 = 110000 + 6500 = 116500
    expect(round(calcStampDuty(2100000, 'VIC'))).toBe(116500);
  });

  it('correct duty at $500k (in the 6% bracket $130k-$960k)', () => {
    // 2870 + (500000 - 130000) * 0.06 = 2870 + 22200 = 25070
    expect(round(calcStampDuty(500000, 'VIC'))).toBe(25070);
  });
});

describe('calcStampDuty — WA', () => {
  it('returns 1.9% for price up to $120k', () => {
    expect(round(calcStampDuty(100000, 'WA'))).toBe(1900);
  });

  it('correct duty at $500k', () => {
    // 11115 + (500000 - 360000) * 0.0475 = 11115 + 6650 = 17765
    expect(round(calcStampDuty(500000, 'WA'))).toBe(17765);
  });
});

describe('calcStampDuty — TAS', () => {
  it('returns $50 for price <= $3,000', () => {
    expect(calcStampDuty(1000, 'TAS')).toBe(50);
    expect(calcStampDuty(3000, 'TAS')).toBe(50);
  });

  it('correct duty at $300k', () => {
    // 5880 + (300000 - 200000) * 0.04 = 5880 + 4000 = 9880
    expect(round(calcStampDuty(300000, 'TAS'))).toBe(9880);
  });
});

// ─── Land Tax ─────────────────────────────────────────────────────────────────

describe('calcLandTax — QLD individual', () => {
  it('returns 0 below $600k threshold', () => {
    expect(calcLandTax(500000, 'individual', 'QLD')).toBe(0);
    expect(calcLandTax(599999, 'individual', 'QLD')).toBe(0);
  });

  it('correct tax at $800k (first bracket $600k-$1M, 1%)', () => {
    // 500 + (800000 - 600000) * 0.01 = 500 + 2000 = 2500
    expect(calcLandTax(800000, 'individual', 'QLD')).toBe(2500);
  });

  it('correct tax at $2M (bracket $1M-$3M, 1.65%)', () => {
    // 4500 + (2000000 - 1000000) * 0.0165 = 4500 + 16500 = 21000
    expect(calcLandTax(2000000, 'individual', 'QLD')).toBe(21000);
  });

  it('SMSF treated same as individual for QLD', () => {
    expect(calcLandTax(800000, 'smsf', 'QLD')).toBe(2500);
  });
});

describe('calcLandTax — QLD company/trust', () => {
  it('returns 0 below $350k threshold', () => {
    expect(calcLandTax(300000, 'trust', 'QLD')).toBe(0);
    expect(calcLandTax(300000, 'company', 'QLD')).toBe(0);
  });

  it('correct tax at $1M (bracket $350k-$2.25M, 1.7%)', () => {
    // 1450 + (1000000 - 350000) * 0.017 = 1450 + 11050 = 12500
    expect(calcLandTax(1000000, 'trust', 'QLD')).toBe(12500);
  });

  it('correct tax at $3M (bracket $2.25M-$5M, 1.5%)', () => {
    // 33750 + (3000000 - 2250000) * 0.015 = 33750 + 11250 = 45000
    expect(calcLandTax(3000000, 'company', 'QLD')).toBe(45000);
  });
});

describe('calcLandTax — VIC individual', () => {
  it('returns 0 below $50k threshold', () => {
    expect(calcLandTax(49999, 'individual', 'VIC')).toBe(0);
  });

  it('returns flat $500 for $50k-$100k', () => {
    expect(calcLandTax(50000, 'individual', 'VIC')).toBe(500);
    expect(calcLandTax(99999, 'individual', 'VIC')).toBe(500);
  });

  it('returns flat $975 for $100k-$300k', () => {
    expect(calcLandTax(100000, 'individual', 'VIC')).toBe(975);
    expect(calcLandTax(299999, 'individual', 'VIC')).toBe(975);
  });

  it('correct tax at $500k (bracket $300k-$600k, 0.3%)', () => {
    // 1350 + (500000 - 300000) * 0.003 = 1350 + 600 = 1950
    expect(calcLandTax(500000, 'individual', 'VIC')).toBe(1950);
  });
});

describe('calcLandTax — VIC trust (surcharge table)', () => {
  it('returns 0 below $25k', () => {
    expect(calcLandTax(24999, 'trust', 'VIC')).toBe(0);
  });

  it('trust has lower threshold than individual (kicks in at $25k vs $50k)', () => {
    expect(calcLandTax(30000, 'trust', 'VIC')).toBeGreaterThan(0);
    expect(calcLandTax(30000, 'individual', 'VIC')).toBe(0);
  });

  it('trust pays more than individual on same land value', () => {
    const landValue = 500000;
    expect(calcLandTax(landValue, 'trust', 'VIC')).toBeGreaterThan(
      calcLandTax(landValue, 'individual', 'VIC')
    );
  });
});

describe('calcLandTax — NSW', () => {
  it('returns 0 below $1,075,000 threshold', () => {
    expect(calcLandTax(1000000, 'individual', 'NSW')).toBe(0);
    expect(calcLandTax(1075000, 'individual', 'NSW')).toBe(0);
  });

  it('correct tax at $2M', () => {
    // 100 + (2000000 - 1075000) * 0.016 = 100 + 14800 = 14900
    expect(calcLandTax(2000000, 'individual', 'NSW')).toBe(14900);
  });

  it('correct premium tax above $6,571,000', () => {
    // 88036 + (7000000 - 6571000) * 0.02 = 88036 + 8580 = 96616
    expect(round(calcLandTax(7000000, 'individual', 'NSW'))).toBe(96616);
  });

  it('NSW does not vary by ownership structure', () => {
    const lv = 2000000;
    expect(calcLandTax(lv, 'individual', 'NSW')).toBe(calcLandTax(lv, 'trust', 'NSW'));
    expect(calcLandTax(lv, 'individual', 'NSW')).toBe(calcLandTax(lv, 'company', 'NSW'));
  });
});

describe('calcLandTax — WA', () => {
  it('returns 0 below $300k', () => {
    expect(calcLandTax(299999, 'individual', 'WA')).toBe(0);
  });

  it('returns flat $300 for $300k-$420k', () => {
    expect(calcLandTax(300001, 'individual', 'WA')).toBe(300);
    expect(calcLandTax(420000, 'individual', 'WA')).toBe(300);
  });

  it('correct tax at $600k', () => {
    // 300 + (600000 - 420000) * 0.0025 = 300 + 450 = 750
    expect(calcLandTax(600000, 'individual', 'WA')).toBe(750);
  });
});

describe('calcLandTax — TAS', () => {
  it('returns 0 below $125k', () => {
    expect(calcLandTax(124999, 'individual', 'TAS')).toBe(0);
  });

  it('correct tax at $300k', () => {
    // 50 + (300000 - 125000) * 0.0045 = 50 + 787.50 = 837.50
    expect(calcLandTax(300000, 'individual', 'TAS')).toBeCloseTo(837.50, 2);
  });

  it('correct tax at $500k (boundary)', () => {
    // 50 + (500000 - 125000) * 0.0045 = 50 + 1687.50 = 1737.50
    expect(calcLandTax(500000, 'individual', 'TAS')).toBe(1737.50);
  });

  it('correct tax at $600k (above $500k, 1.5% rate)', () => {
    // 1737.50 + (600000 - 500000) * 0.015 = 1737.50 + 1500 = 3237.50
    expect(calcLandTax(600000, 'individual', 'TAS')).toBe(3237.50);
  });
});

describe('calcLandTax — ACT and NT', () => {
  it('ACT returns 0 (uses general rates system, no separate land tax)', () => {
    expect(calcLandTax(1000000, 'individual', 'ACT')).toBe(0);
    expect(calcLandTax(5000000, 'trust', 'ACT')).toBe(0);
  });

  it('NT returns 0 (no land tax)', () => {
    expect(calcLandTax(1000000, 'individual', 'NT')).toBe(0);
    expect(calcLandTax(5000000, 'company', 'NT')).toBe(0);
  });
});

// ─── Cross-state sanity checks ─────────────────────────────────────────────────

describe('stamp duty — all states return positive values for typical property prices', () => {
  const states = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT'] as const;
  const price = 650000;

  states.forEach((state) => {
    it(`${state} returns positive stamp duty for $650k purchase`, () => {
      expect(calcStampDuty(price, state)).toBeGreaterThan(0);
    });
  });
});

describe('land tax — bracket continuity (no sudden drops between brackets)', () => {
  it('QLD individual tax is strictly increasing', () => {
    const vals = [600001, 800000, 1000001, 2000000, 3000001, 5000001, 10000001];
    for (let i = 1; i < vals.length; i++) {
      expect(calcLandTax(vals[i], 'individual', 'QLD')).toBeGreaterThan(
        calcLandTax(vals[i - 1], 'individual', 'QLD')
      );
    }
  });

  it('NSW tax is strictly increasing above threshold', () => {
    const vals = [1075001, 2000000, 4000000, 7000000];
    for (let i = 1; i < vals.length; i++) {
      expect(calcLandTax(vals[i], 'individual', 'NSW')).toBeGreaterThan(
        calcLandTax(vals[i - 1], 'individual', 'NSW')
      );
    }
  });

  it('VIC individual tax is non-decreasing', () => {
    const vals = [50000, 100000, 300000, 600000, 1000000, 1800000, 3000000];
    for (let i = 1; i < vals.length; i++) {
      expect(calcLandTax(vals[i], 'individual', 'VIC')).toBeGreaterThanOrEqual(
        calcLandTax(vals[i - 1], 'individual', 'VIC')
      );
    }
  });
});
