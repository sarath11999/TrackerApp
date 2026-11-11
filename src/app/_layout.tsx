import '@/lib/notifications'; // registers the foreground notification handler
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform, UIManager } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ReminderSync } from '@/components/ReminderSync';
import { migrate } from '@/db/schema';
import { adaptExpoDb, AppProvider, useColors } from '@/state/AppContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function ThemedStack() {
  const c = useColors();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.background).catch(() => undefined);
  }, [c.background]);
  return (
    <>
      <StatusBar style={c.dark ? 'light' : 'dark'} />
      <ReminderSync />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.background },
          headerTintColor: c.tint,
          headerTitleStyle: { color: c.text },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: c.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="day/[date]" options={{ title: 'Day' }} />
        <Stack.Screen name="expense" options={{ presentation: 'modal', title: 'Expense', headerStyle: { backgroundColor: c.card }, contentStyle: { backgroundColor: c.card } }} />
        <Stack.Screen name="weight" options={{ title: 'Weight' }} />
        <Stack.Screen name="goals" options={{ title: 'Daily Goals' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="trackerapp.db" onInit={(db) => migrate(adaptExpoDb(db))}>
        <AppProvider>
          <ThemedStack />
        </AppProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
