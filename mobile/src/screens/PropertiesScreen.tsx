import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { propertiesApi } from '../lib/api';
import { formatCurrency, COLORS } from '../lib/utils';

export function PropertiesScreen() {
  const { data = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['properties'],
    queryFn: propertiesApi.list,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />}
    >
      <View style={styles.content}>
        {data.length === 0 && (
          <Text style={styles.empty}>No properties added yet.</Text>
        )}
        {data.map((prop) => {
          const weeklyRent = prop.weekly_rent ?? 0;
          const annualRent = weeklyRent * 52;
          const loanAmount = prop.loan_amount ?? 0;
          const purchasePrice = prop.purchase_price ?? 0;
          const lvr = purchasePrice > 0 ? (loanAmount / purchasePrice) * 100 : 0;
          const grossYield = purchasePrice > 0 ? (annualRent / purchasePrice) * 100 : 0;

          return (
            <View key={prop.id} style={styles.card}>
              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={styles.iconWrap}>
                  <Text style={styles.icon}>🏠</Text>
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.propName}>{prop.name}</Text>
                  {prop.address && <Text style={styles.propAddress}>{prop.address}</Text>}
                </View>
              </View>

              {/* Metrics */}
              <View style={styles.metricsGrid}>
                {purchasePrice > 0 && (
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>PURCHASE PRICE</Text>
                    <Text style={styles.metricValue}>{formatCurrency(purchasePrice)}</Text>
                  </View>
                )}
                {loanAmount > 0 && (
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>LOAN</Text>
                    <Text style={styles.metricValue}>{formatCurrency(loanAmount)}</Text>
                  </View>
                )}
                {weeklyRent > 0 && (
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>WEEKLY RENT</Text>
                    <Text style={[styles.metricValue, { color: COLORS.success }]}>
                      {formatCurrency(weeklyRent)}/wk
                    </Text>
                  </View>
                )}
                {grossYield > 0 && (
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>GROSS YIELD</Text>
                    <Text style={[
                      styles.metricValue,
                      { color: grossYield >= 5 ? COLORS.success : grossYield >= 3.5 ? COLORS.warning : COLORS.danger }
                    ]}>
                      {grossYield.toFixed(2)}%
                    </Text>
                  </View>
                )}
                {lvr > 0 && (
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>LVR</Text>
                    <Text style={[styles.metricValue, { color: lvr > 80 ? COLORS.danger : COLORS.textPrimary }]}>
                      {lvr.toFixed(1)}%
                    </Text>
                  </View>
                )}
                {prop.pm_fee_pct != null && (
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>PM FEE</Text>
                    <Text style={styles.metricValue}>{prop.pm_fee_pct}%</Text>
                  </View>
                )}
              </View>

              {/* Water flag */}
              <View style={[
                styles.waterBadge,
                { backgroundColor: prop.tenant_liable_for_water ? '#ecfdf5' : '#fef2f2' }
              ]}>
                <Text style={[
                  styles.waterText,
                  { color: prop.tenant_liable_for_water ? COLORS.success : COLORS.danger }
                ]}>
                  {prop.tenant_liable_for_water ? '✓ Tenant liable for water' : '✗ Owner pays water'}
                </Text>
              </View>
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
  content: { padding: 16 },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 60, fontSize: 14 },
  card: {
    backgroundColor: COLORS.card, borderRadius: 20, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#f5f3ff', alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  icon: { fontSize: 22 },
  cardHeaderText: { flex: 1 },
  propName: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  propAddress: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  metric: {
    minWidth: '45%', flex: 1,
    backgroundColor: COLORS.bg, borderRadius: 10,
    padding: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  metricLabel: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.8, marginBottom: 4 },
  metricValue: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  waterBadge: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  waterText: { fontSize: 12, fontWeight: '600' },
});
