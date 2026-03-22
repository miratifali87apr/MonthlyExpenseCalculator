import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '../lib/api';
import { formatCurrency, formatDate, COLORS, CATEGORY_LABELS, STATUS_COLORS } from '../lib/utils';
import { StatusBadge } from '../components/Badge';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function ExpensesScreen() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const queryClient = useQueryClient();

  const { data = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['expenses', month, year],
    queryFn: () => expensesApi.list({ month, year }),
  });

  async function handlePay(id: number, isPaid: boolean) {
    try {
      if (isPaid) await expensesApi.unpay(id);
      else await expensesApi.pay(id);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch {}
  }

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setMonth(m);
    setYear(y);
  }

  const totalDue = data.reduce((s, e) => s + e.amount, 0);
  const totalPaid = data.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0);

  return (
    <View style={styles.container}>
      {/* Month Selector */}
      <View style={styles.monthBar}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.monthBtn}>
          <Text style={styles.monthArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{MONTH_NAMES[month - 1]} {year}</Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.monthBtn}>
          <Text style={styles.monthArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Summary strip */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>TOTAL DUE</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalDue)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>PAID</Text>
          <Text style={[styles.summaryValue, { color: COLORS.success }]}>{formatCurrency(totalPaid)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>OUTSTANDING</Text>
          <Text style={[styles.summaryValue, { color: COLORS.danger }]}>
            {formatCurrency(totalDue - totalPaid)}
          </Text>
        </View>
      </View>

      {isLoading
        ? <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} size="large" />
        : (
          <ScrollView
            style={styles.list}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />}
          >
            {data.length === 0 && (
              <Text style={styles.empty}>No expenses for this month.</Text>
            )}
            {data.map((item) => {
              const isPaid = item.status === 'paid';
              const colors = STATUS_COLORS[item.status] ?? STATUS_COLORS.pending;
              return (
                <View key={item.id} style={[styles.row, { borderLeftColor: colors.border }]}>
                  <View style={styles.rowMain}>
                    <View style={styles.rowLeft}>
                      <Text style={styles.rowName}>{item.name}</Text>
                      <Text style={styles.rowMeta}>
                        {CATEGORY_LABELS[item.category] ?? item.category}
                        {item.property ? ` • ${item.property.name}` : ''}
                      </Text>
                      <Text style={styles.rowDate}>Due {formatDate(item.due_date)}</Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={styles.rowAmount}>{formatCurrency(item.amount)}</Text>
                      <StatusBadge status={item.status} />
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.payBtn, isPaid ? styles.payBtnPaid : styles.payBtnUnpaid]}
                    onPress={() => handlePay(item.id, isPaid)}
                  >
                    <Text style={[styles.payBtnText, isPaid && styles.payBtnTextPaid]}>
                      {isPaid ? 'Mark Unpaid' : 'Mark Paid'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        )
      }
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  monthBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  monthBtn: { padding: 8 },
  monthArrow: { fontSize: 24, color: COLORS.primary, fontWeight: '700', lineHeight: 26 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, minWidth: 130, textAlign: 'center' },
  summary: {
    flexDirection: 'row', backgroundColor: COLORS.card,
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.8, marginBottom: 4 },
  summaryValue: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  summaryDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  list: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 60, fontSize: 14 },
  row: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 14,
    marginBottom: 10, borderLeftWidth: 4,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  rowMain: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  rowLeft: { flex: 1, marginRight: 12 },
  rowName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  rowMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  rowDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  rowAmount: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  payBtn: {
    borderRadius: 10, paddingVertical: 9, alignItems: 'center',
    borderWidth: 1.5,
  },
  payBtnUnpaid: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  payBtnPaid: { backgroundColor: 'transparent', borderColor: COLORS.border },
  payBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  payBtnTextPaid: { color: COLORS.textSecondary },
});
