import React from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { recurringApi } from '../lib/api';
import { formatCurrency, COLORS, CATEGORY_LABELS } from '../lib/utils';

const FREQ_LABELS: Record<string, string> = {
  monthly: 'Monthly', quarterly: 'Quarterly',
  weekly: 'Weekly', fortnightly: 'Fortnightly', ad_hoc: 'Ad Hoc',
};

const FREQ_COLORS: Record<string, string> = {
  monthly: '#6d28d9', quarterly: '#d97706',
  weekly: '#059669', fortnightly: '#0891b2', ad_hoc: '#64748b',
};

function monthlyEquivalent(amount: number, freq: string): number {
  if (freq === 'monthly') return amount;
  if (freq === 'quarterly') return amount / 3;
  if (freq === 'weekly') return (amount * 52) / 12;
  if (freq === 'fortnightly') return (amount * 26) / 12;
  return 0;
}

export function RecurringScreen() {
  const { data = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['recurring'],
    queryFn: recurringApi.list,
  });

  const active = data.filter(t => t.is_active);
  const totalMonthly = active.reduce((s, t) => s + monthlyEquivalent(t.amount, t.frequency), 0);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />}
    >
      {/* Total strip */}
      <View style={styles.totalStrip}>
        <View>
          <Text style={styles.totalLabel}>TOTAL MONTHLY COMMITMENTS</Text>
          <Text style={styles.totalValue}>{formatCurrency(totalMonthly)}/mo</Text>
        </View>
        <View>
          <Text style={styles.totalLabel}>ACTIVE TEMPLATES</Text>
          <Text style={[styles.totalValue, { color: COLORS.primary, textAlign: 'right' }]}>
            {active.length}
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        {data.length === 0 && <Text style={styles.empty}>No recurring templates found.</Text>}

        {data.map((t) => {
          const monthly = monthlyEquivalent(t.amount, t.frequency);
          const freqColor = FREQ_COLORS[t.frequency] ?? COLORS.textMuted;
          return (
            <View key={t.id} style={[styles.row, !t.is_active && styles.rowInactive]}>
              <View style={styles.rowTop}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowName}>{t.name}</Text>
                  <Text style={styles.rowCategory}>{CATEGORY_LABELS[t.category] ?? t.category}</Text>
                  {t.property && <Text style={styles.rowProp}>{t.property.name}</Text>}
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowAmount}>{formatCurrency(t.amount)}</Text>
                  <View style={[styles.freqBadge, { backgroundColor: freqColor + '18', borderColor: freqColor + '40' }]}>
                    <Text style={[styles.freqText, { color: freqColor }]}>{FREQ_LABELS[t.frequency]}</Text>
                  </View>
                </View>
              </View>
              {monthly > 0 && t.frequency !== 'monthly' && (
                <Text style={styles.monthlyEq}>≈ {formatCurrency(monthly)}/mo</Text>
              )}
              {!t.is_active && <Text style={styles.inactiveLabel}>INACTIVE</Text>}
            </View>
          );
        })}
        <View style={{ height: 24 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  totalStrip: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.dark, paddingHorizontal: 20, paddingVertical: 16,
  },
  totalLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.8, marginBottom: 4 },
  totalValue: { fontSize: 20, fontWeight: '900', color: '#fff' },
  content: { padding: 16 },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 60, fontSize: 14 },
  row: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  rowInactive: { opacity: 0.5 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rowLeft: { flex: 1, marginRight: 12 },
  rowName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  rowCategory: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  rowProp: { fontSize: 11, color: COLORS.primary, marginTop: 2, fontWeight: '600' },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  rowAmount: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  freqBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  freqText: { fontSize: 10, fontWeight: '700' },
  monthlyEq: { fontSize: 11, color: COLORS.textMuted, marginTop: 6 },
  inactiveLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginTop: 6, letterSpacing: 0.8 },
});
