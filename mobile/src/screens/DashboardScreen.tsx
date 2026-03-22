import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, expensesApi } from '../lib/api';
import { formatCurrency, formatDate, COLORS, STATUS_COLORS } from '../lib/utils';
import { MetricCard } from '../components/Card';
import { StatusBadge } from '../components/Badge';

export function DashboardScreen() {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.getSummary,
  });

  const [generating, setGenerating] = React.useState(false);

  async function handleGenerateBills() {
    setGenerating(true);
    try {
      await expensesApi.generateUpcoming();
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    } finally {
      setGenerating(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  const netPositive = (data?.net_cashflow ?? 0) >= 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />}
    >
      {/* Header gradient card */}
      <LinearGradient colors={['#6d28d9', '#4f46e5']} style={styles.headerCard}>
        <Text style={styles.headerLabel}>NET CASHFLOW THIS MONTH</Text>
        <Text style={[styles.headerAmount, { color: netPositive ? '#a7f3d0' : '#fca5a5' }]}>
          {formatCurrency(data?.net_cashflow ?? 0)}
        </Text>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerSub}>Income</Text>
            <Text style={styles.headerSubVal}>{formatCurrency(data?.total_monthly_income ?? 0)}</Text>
          </View>
          <View style={styles.headerDivider} />
          <View>
            <Text style={styles.headerSub}>Expenses</Text>
            <Text style={styles.headerSubVal}>{formatCurrency(data?.total_monthly_expenses ?? 0)}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* Quick metrics */}
        <View style={styles.metricsRow}>
          <MetricCard
            label="Overdue"
            value={String(data?.overdue_items?.length ?? 0)}
            accent={COLORS.danger}
            valueColor={data?.overdue_items?.length ? COLORS.danger : COLORS.success}
            sub="items"
          />
          <View style={styles.metricGap} />
          <MetricCard
            label="Due 7 Days"
            value={String(data?.upcoming_7_days?.length ?? 0)}
            accent={COLORS.warning}
            valueColor={COLORS.warning}
            sub="items"
          />
          <View style={styles.metricGap} />
          <MetricCard
            label="Reimbursements"
            value={String(data?.pending_reimbursements?.length ?? 0)}
            accent={COLORS.accent}
            valueColor={COLORS.accent}
            sub="pending"
          />
        </View>

        {/* Generate bills button */}
        <TouchableOpacity style={styles.generateBtn} onPress={handleGenerateBills} disabled={generating}>
          {generating
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.generateBtnText}>⚡  Generate Monthly Bills</Text>
          }
        </TouchableOpacity>

        {/* Overdue */}
        {(data?.overdue_items?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overdue</Text>
            {data!.overdue_items.map((item) => (
              <View key={item.id} style={[styles.expenseRow, { borderLeftColor: COLORS.danger }]}>
                <View style={styles.expenseLeft}>
                  <Text style={styles.expenseName}>{item.name}</Text>
                  <Text style={styles.expenseDate}>Due {formatDate(item.due_date)}</Text>
                </View>
                <View style={styles.expenseRight}>
                  <Text style={styles.expenseAmount}>{formatCurrency(item.amount)}</Text>
                  <StatusBadge status={item.status} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Due this week */}
        {(data?.upcoming_7_days?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Due This Week</Text>
            {data!.upcoming_7_days.map((item) => (
              <View key={item.id} style={[styles.expenseRow, { borderLeftColor: COLORS.warning }]}>
                <View style={styles.expenseLeft}>
                  <Text style={styles.expenseName}>{item.name}</Text>
                  <Text style={styles.expenseDate}>Due {formatDate(item.due_date)}</Text>
                </View>
                <View style={styles.expenseRight}>
                  <Text style={styles.expenseAmount}>{formatCurrency(item.amount)}</Text>
                  <StatusBadge status={item.status} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Pending reimbursements */}
        {(data?.pending_reimbursements?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Reimbursements</Text>
            {data!.pending_reimbursements.map((item) => (
              <View key={item.id} style={[styles.expenseRow, { borderLeftColor: COLORS.accent }]}>
                <View style={styles.expenseLeft}>
                  <Text style={styles.expenseName}>{item.name}</Text>
                  <Text style={styles.expenseDate}>{item.type}</Text>
                </View>
                <View style={styles.expenseRight}>
                  <Text style={[styles.expenseAmount, { color: COLORS.success }]}>
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  loadingText: { marginTop: 12, color: COLORS.textMuted, fontSize: 14 },
  headerCard: {
    margin: 16, borderRadius: 24, padding: 24,
    shadowColor: '#6d28d9', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
  },
  headerLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  headerAmount: { fontSize: 42, fontWeight: '900', marginTop: 4, marginBottom: 16, letterSpacing: -1 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  headerSubVal: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 24 },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  metricsRow: { flexDirection: 'row', marginBottom: 12 },
  metricGap: { width: 8 },
  generateBtn: {
    backgroundColor: COLORS.dark, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginBottom: 20,
  },
  generateBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },
  expenseRow: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8, borderLeftWidth: 4,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  expenseLeft: { flex: 1, marginRight: 12 },
  expenseName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  expenseDate: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  expenseRight: { alignItems: 'flex-end', gap: 4 },
  expenseAmount: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
});
