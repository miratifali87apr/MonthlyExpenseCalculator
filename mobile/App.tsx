import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './src/lib/supabase';
import { COLORS } from './src/lib/utils';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { ExpensesScreen } from './src/screens/ExpensesScreen';
import { IncomeScreen } from './src/screens/IncomeScreen';
import { PropertiesScreen } from './src/screens/PropertiesScreen';
import { RecurringScreen } from './src/screens/RecurringScreen';

const Tab = createBottomTabNavigator();
const queryClient = new QueryClient();

type TabIconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { active: TabIconName; inactive: TabIconName }> = {
  Dashboard:  { active: 'grid',           inactive: 'grid-outline' },
  Expenses:   { active: 'card',           inactive: 'card-outline' },
  Income:     { active: 'trending-up',    inactive: 'trending-up-outline' },
  Properties: { active: 'home',           inactive: 'home-outline' },
  Recurring:  { active: 'refresh-circle', inactive: 'refresh-circle-outline' },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const name = focused ? icons?.active : icons?.inactive;
          return <Ionicons name={name ?? 'ellipse-outline'} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: {
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
        headerTintColor: COLORS.primary,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Expenses" component={ExpensesScreen} />
      <Tab.Screen name="Income" component={IncomeScreen} />
      <Tab.Screen name="Properties" component={PropertiesScreen} />
      <Tab.Screen name="Recurring" component={RecurringScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      queryClient.clear();
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.splash}>
        <View style={styles.splashLogoWrap}>
          <Text style={styles.splashLogo}>$</Text>
        </View>
        <Text style={styles.splashTitle}>Finance Tracker</Text>
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          {session ? <MainTabs /> : <LoginScreen />}
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1, backgroundColor: '#0f172a',
    justifyContent: 'center', alignItems: 'center',
  },
  splashLogoWrap: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  splashLogo: { fontSize: 36, fontWeight: '900', color: '#fff' },
  splashTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 16 },
});
