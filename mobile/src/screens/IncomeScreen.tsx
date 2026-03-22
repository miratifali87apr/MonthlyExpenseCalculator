import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { incomeApi } from '../lib/api';
import { formatCurrency, formatDate, COLORS } from '../lib/utils';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const TYPE_COLORS: Record<string, string> = {
  salary: '#6d28d9', rental: '#059669', reimbursement: '#d97706', other: '#475569',
};

export function IncomeScreen() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const queryClient = useQueryClient();

  const { data = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['income', month, year],
    queryFn: () => incomeApi.list({ month, year }),
  });

  async function handleReceive(id: number) {
    try {
      await incomeApi.receive(id);
      queryClient.invalidateQueries({ queryKey: ['income'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch {}
  }

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setMonth(m); setYear(y);
  }

  const totalIncome = data.reduce((s, i) => s + i.amount, 0);
  const received = data.filter(i => i.received_date).reduce((s, i) => s + i.amount, 0);

  return (
    <View style={styles.container}>
      <View style={styles.monthBar}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.monthBtn}>
          <Text style={styles.monthArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{MONTH_NAMES[month - 1]} {year}</Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.monthBtn}>
          <Text style={styles.monthArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>TOTAL</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalIncome)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>RECEIVED</Text>
          <Text style={[styles.summaryValue, { color: COLORS.success }]}>{formatCurrency(received)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>PENDING</Text>
          <Text style={[styles.summaryValue, { color: COLORS.warning }]}>{formatCurrency(totalIncome - received)}</Text>
        </View>
      </View>

      {isLoading
        ? <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} size="large" />
        : (
          <ScrollView
            style={styles.list}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />}
          >
            {data.length === 0 && <Text style={styles.empty}>No income for this month.</Text>}
            {data.map((item) => {
              const isReceived = !!item.received_date;
              const accentColor = TYPE_COLORS[item.type] ?? COLORS.textMuted;
              return (
                <View key={item.id} style={[styles.row, { borderLeftColor: accentColor }]}>
                  <View style={styles.rowMain}>
                    <View style={styles.rowLeft}>
                      <Text style={styles.rowName}>{item.name}</Text>
                      <View style={styles.typePill}>
                        <View style={[styles.typeDot, { backgroundColor: accentColor }]} />
                        <Text style={styles.rowMeta}>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}</Text>
                      </View>
                      {item.expected_date && (
                        <Text style={styles.rowDate}>Expected {formatDate(item.expected_date)}</Text>
                      )}
                      {item.received_date && (
                        <Text style={[styles.rowDate, { color: COLORS.success }]}>
                          Received {formatDate(item.received_date)}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.rowAmount, { color: COLORS.success }]}>
                      {formatCurrency(item.amount)}
                    </Text>
                  </View>
                  {!isReceived && (
                    <TouchableOpacity style={styles.receiveBtn} onPress={() => handleReceive(item.id)}>
                      <Text style={styles.receiveBtnText}>Mark Received</Text>
                    </TouchableOpacity>
                  )}
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
    paddingVertical: 14, backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
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
  rowMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  rowLeft: { flex: 1, marginRight: 12 },
  rowName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeDot: { width: 8, height: 8, borderRadius: 4 },
  rowMeta: { fontSize: 12, color: COLORS.textMuted },
  rowDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  rowAmount: { fontSize: 18, fontWeight: '900' },
  receiveBtn: {
    backgroundColor: COLORS.success, borderRadius: 10,
    paddingVertical: 9, alignItems: 'center',
  },
  receiveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
