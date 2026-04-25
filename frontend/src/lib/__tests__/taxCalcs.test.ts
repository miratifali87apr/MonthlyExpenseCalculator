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

describe('calcStampDuty — NSW (spec brackets: $16k/$35k/$93k/$351k/$1.168M/$3.505M)', () => {
  it('correct duty at $17k (straddles $16k boundary)', () => {
    // 200 + (17000 - 16000) * 0.015 = 200 + 15 = 215
    expect(round(calcStampDuty(17000, 'NSW'))).toBe(215);
  });

  it('correct duty at $500k', () => {
    // 10530 + (500000 - 351000) * 0.045 = 10530 + 6705 = 17235
    expect(round(calcStampDuty(500000, 'NSW'))).toBe(17235);
  });

  it('correct duty at $1M', () => {
    // 10530 + (1000000 - 351000) * 0.045 = 10530 + 29205 = 39735
    expect(round(calcStampDuty(1000000, 'NSW'))).toBe(39735);
  });

  it('correct duty at $2M (above $1.168M threshold)', () => {
    // 47295 + (2000000 - 1168000) * 0.055 = 47295 + 45760 = 93055
    expect(round(calcStampDuty(2000000, 'NSW'))).toBe(93055);
  });

  it('correct duty at $4M (premium above $3.505M)', () => {
    // 175830 + (4000000 - 3505000) * 0.07 = 175830 + 34650 = 210480
    expect(round(calcStampDuty(4000000, 'NSW'))).toBe(210480);
  });

  it('NSW trust adds 0.5% surcharge on full price', () => {
    const base = calcStampDuty(500000, 'NSW', 'individual');
    const trust = calcStampDuty(500000, 'NSW', 'trust');
    expect(round(trust - base)).toBe(2500); // 0.5% of $500k
  });
});

describe('calcStampDuty — VIC', () => {
  it('flat 5.5% of total value for $960k and above', () => {
    expect(calcStampDuty(1000000, 'VIC')).toBe(55000);
    expect(calcStampDuty(1500000, 'VIC')).toBe(82500);
    // At $2.1M: flat 5.5%
    expect(round(calcStampDuty(2100000, 'VIC'))).toBe(115500);
  });

  it('correct duty at $500k (in the 6% bracket $130k-$960k)', () => {
    // 2870 + (500000 - 130000) * 0.06 = 2870 + 22200 = 25070
    expect(round(calcStampDuty(500000, 'VIC'))).toBe(25070);
  });

  it('VIC trust adds 1% surcharge on full price', () => {
    const base = calcStampDuty(500000, 'VIC', 'individual');
    const trust = calcStampDuty(500000, 'VIC', 'trust');
    expect(round(trust - base)).toBe(5000); // 1% of $500k
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
    // 5935 + (300000 - 200000) * 0.04 = 5935 + 4000 = 9935
    expect(round(calcStampDuty(300000, 'TAS'))).toBe(9935);
  });
});

// ─── Land Tax ─────────────────────────────────────────────────────────────────

describe('calcLandTax — QLD individual', () => {
  it('returns 0 below $600k threshold', () => {
    expect(calcLandTax(500000, 'individual', 'QLD')).toBe(0);
    expect(calcLandTax(599999, 'individual', 'QLD')).toBe(0);
  });

  it('correct tax at $800k (1% × excess over $600k)', () => {
    // (800000 - 600000) * 0.01 = 2000
    expect(calcLandTax(800000, 'individual', 'QLD')).toBe(2000);
  });

  it('correct tax at $2M (bracket $1M+, 1.65%)', () => {
    // 4000 + (2000000 - 1000000) * 0.0165 = 4000 + 16500 = 20500
    expect(calcLandTax(2000000, 'individual', 'QLD')).toBe(20500);
  });

  it('SMSF treated same as individual for QLD', () => {
    expect(calcLandTax(800000, 'smsf', 'QLD')).toBe(2000);
  });
});

describe('calcLandTax — QLD company/trust', () => {
  it('returns 0 below $350k threshold', () => {
    expect(calcLandTax(300000, 'trust', 'QLD')).toBe(0);
    expect(calcLandTax(300000, 'company', 'QLD')).toBe(0);
  });

  it('correct tax at $1M (bracket $350k-$2.25M, 1%)', () => {
    // (1000000 - 350000) * 0.01 = 6500
    expect(calcLandTax(1000000, 'trust', 'QLD')).toBe(6500);
  });

  it('correct tax at $3M (bracket $2.25M+, 1.65%)', () => {
    // 19000 + (3000000 - 2250000) * 0.0165 = 19000 + 12375 = 31375
    expect(calcLandTax(3000000, 'company', 'QLD')).toBe(31375);
  });
});

describe('calcLandTax — VIC individual', () => {
  it('returns 0 at or below $300k threshold', () => {
    expect(calcLandTax(49999, 'individual', 'VIC')).toBe(0);
    expect(calcLandTax(100000, 'individual', 'VIC')).toBe(0);
    expect(calcLandTax(300000, 'individual', 'VIC')).toBe(0);
  });

  it('correct tax at $500k (bracket $300k-$600k)', () => {
    // 275 + (500000 - 300000) * 0.002 = 275 + 400 = 675
    expect(calcLandTax(500000, 'individual', 'VIC')).toBe(675);
  });

  it('correct tax at $1M (bracket $600k-$1M)', () => {
    // 875 + (1000000 - 600000) * 0.005 = 875 + 2000 = 2875
    expect(calcLandTax(1000000, 'individual', 'VIC')).toBe(2875);
  });

  it('correct tax at $2M (bracket $1M-$1.8M boundary → $1.8M-$3M)', () => {
    // 13275 + (2000000 - 1800000) * 0.019 = 13275 + 3800 = 17075
    expect(calcLandTax(2000000, 'individual', 'VIC')).toBe(17075);
  });
});

describe('calcLandTax — VIC trust (0.5% surcharge above $300k threshold)', () => {
  it('returns 0 at or below $300k threshold (same threshold as individual)', () => {
    expect(calcLandTax(300000, 'trust', 'VIC')).toBe(0);
  });

  it('trust pays more than individual on same land value above $300k', () => {
    const landValue = 500000;
    expect(calcLandTax(landValue, 'trust', 'VIC')).toBeGreaterThan(
      calcLandTax(landValue, 'individual', 'VIC')
    );
  });

  it('trust surcharge is 0.5% of taxable value (landValue - $300k)', () => {
    const landValue = 600000;
    const individual = calcLandTax(landValue, 'individual', 'VIC');
    const trust = calcLandTax(landValue, 'trust', 'VIC');
    // surcharge = (600000 - 300000) * 0.005 = 1500
    expect(round(trust - individual)).toBe(1500);
  });
});

describe('calcLandTax — NSW', () => {
  it('returns 0 below $1,075,000 threshold (individual)', () => {
    expect(calcLandTax(1000000, 'individual', 'NSW')).toBe(0);
    expect(calcLandTax(1075000, 'individual', 'NSW')).toBe(0);
  });

  it('correct tax at $2M (individual)', () => {
    // 100 + (2000000 - 1075000) * 0.016 = 100 + 14800 = 14900
    expect(calcLandTax(2000000, 'individual', 'NSW')).toBe(14900);
  });

  it('correct premium tax above $6,571,000 (individual)', () => {
    // 88036 + (7000000 - 6571000) * 0.02 = 88036 + 8580 = 96616
    expect(round(calcLandTax(7000000, 'individual', 'NSW'))).toBe(96616);
  });

  it('NSW trust/company taxed from $1 (no threshold) at 1.6% flat', () => {
    // trust at $2M: 2000000 * 0.016 = 32000
    expect(calcLandTax(2000000, 'trust', 'NSW')).toBe(32000);
    expect(calcLandTax(2000000, 'company', 'NSW')).toBe(32000);
    // trust pays more than individual (no threshold vs $1.075M threshold)
    expect(calcLandTax(2000000, 'trust', 'NSW')).toBeGreaterThan(calcLandTax(2000000, 'individual', 'NSW'));
  });
});

describe('calcLandTax — WA', () => {
  it('returns 0 at or below $300k', () => {
    expect(calcLandTax(299999, 'individual', 'WA')).toBe(0);
    expect(calcLandTax(300000, 'individual', 'WA')).toBe(0);
  });

  it('starts at $300 base just above $300k', () => {
    // 300 + (300001 - 300000) * 0.0009 = 300.0009 (approx $300)
    expect(calcLandTax(300001, 'individual', 'WA')).toBeCloseTo(300, 0);
  });

  it('correct tax at $600k', () => {
    // 300 + (600000 - 300000) * 0.0009 = 300 + 270 = 570
    expect(calcLandTax(600000, 'individual', 'WA')).toBeCloseTo(570, 0);
  });

  it('correct tax at $1.5M (in $1M-$2.2M bracket)', () => {
    // 930 + (1500000 - 1000000) * 0.0015 = 930 + 750 = 1680
    expect(calcLandTax(1500000, 'individual', 'WA')).toBeCloseTo(1680, 0);
  });
});

describe('calcLandTax — TAS', () => {
  it('returns 0 at or below $25k threshold', () => {
    expect(calcLandTax(25000, 'individual', 'TAS')).toBe(0);
  });

  it('correct tax at $200k (bracket $25k-$350k, 0.55%)', () => {
    // (200000 - 25000) * 0.0055 = 175000 * 0.0055 = 962.50
    expect(calcLandTax(200000, 'individual', 'TAS')).toBeCloseTo(962.50, 2);
  });

  it('correct tax at $400k (above $350k, 1.25%)', () => {
    // 1788 + (400000 - 350000) * 0.0125 = 1788 + 625 = 2413
    expect(calcLandTax(400000, 'individual', 'TAS')).toBeCloseTo(2413, 0);
  });

  it('trust pays 0.5% surcharge on land value', () => {
    const lv = 400000;
    const individual = calcLandTax(lv, 'individual', 'TAS');
    const trust = calcLandTax(lv, 'trust', 'TAS');
    // surcharge = 400000 * 0.005 = 2000
    expect(round(trust - individual)).toBe(2000);
  });
});

describe('calcLandTax — ACT', () => {
  it('ACT calculates land tax using AUV bracket system', () => {
    // $0 land value → 0
    expect(calcLandTax(0, 'individual', 'ACT')).toBe(0);
    // $75k: 75000 * 0.0059 = 442.50
    expect(calcLandTax(75000, 'individual', 'ACT')).toBeCloseTo(442.5, 1);
    // Above $75k should be greater
    expect(calcLandTax(200000, 'individual', 'ACT')).toBeGreaterThan(calcLandTax(75000, 'individual', 'ACT'));
  });
});

describe('calcLandTax — NT', () => {
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
    const vals = [600001, 800000, 1000001, 2000000, 3000001];
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
    const vals = [300001, 600000, 1000000, 1800000, 3000000];
    for (let i = 1; i < vals.length; i++) {
      expect(calcLandTax(vals[i], 'individual', 'VIC')).toBeGreaterThanOrEqual(
        calcLandTax(vals[i - 1], 'individual', 'VIC')
      );
    }
  });
});
