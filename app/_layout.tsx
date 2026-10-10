import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { initializeDb } from '@/db/client';
import { getSetting } from '@/db/queries/settings';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const segments = useSegments();

  const [dbState, setDbState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(true);

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    initializeDb()
      .then(async () => {
        setDbState('ready');
        try {
          const completed = await getSetting('onboarding_completed');
          const onboarded = completed === 'true';
          setIsOnboarded(onboarded);
          setOnboardingChecked(true);
        } catch {
          setOnboardingChecked(true);
        }
      })
      .catch((error) => {
        console.error('DB init failed:', error);
        setDbState('error');
        setOnboardingChecked(true);
      });
  }, []);

  const [initialCheckDone, setInitialCheckDone] = useState(false);

  // Handle first-time launch navigation to /onboarding only once
  useEffect(() => {
    if (!onboardingChecked || dbState !== 'ready' || initialCheckDone) return;
    
    setInitialCheckDone(true);
    if (!isOnboarded) {
      router.replace('/onboarding');
    }
  }, [onboardingChecked, isOnboarded, dbState, initialCheckDone]);

  // Branded Loading / Splash Screen
  if (dbState !== 'ready' || !onboardingChecked || (!fontsLoaded && !fontError)) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <View style={[styles.glowRing, { borderColor: colors.primary }]}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.loadingLogo}
            resizeMode="contain"
          />
        </View>

        <Text
          style={[
            styles.brandTitle,
            { color: colors.text },
          ]}
        >
          TRIGGER
        </Text>

        <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>
          Rapid Vocabulary & Spelling Engine
        </Text>

        {dbState === 'loading' || (!fontsLoaded && !fontError) || !onboardingChecked ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 28 }} />
        ) : (
          <Text style={{ color: colors.error, fontSize: 14, textAlign: 'center', marginTop: 20 }}>
            The local database could not be opened. Please restart the app.
          </Text>
        )}
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="session/active" options={{ headerShown: false }} />
        <Stack.Screen name="session/done" options={{ headerShown: false }} />
        <Stack.Screen name="session/spellcheck" options={{ headerShown: false }} />
        <Stack.Screen name="session/[id]" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  glowRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(122, 20, 40, 0.08)',
    marginBottom: 20,
  },
  loadingLogo: {
    width: 80,
    height: 80,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 6,
  },
  brandSubtitle: {
    fontSize: 13,
    letterSpacing: 0.5,
    opacity: 0.8,
  },
});
