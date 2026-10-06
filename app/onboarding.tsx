import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Icon, type IconName } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { PrimaryButton } from '@/components/PrimaryButton';
import { setSetting } from '@/db/queries/settings';
import { saveApiKey } from '@/lib/secureKey';
import { testGeminiKey } from '@/lib/gemini';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  id: string;
  type: 'welcome' | 'features' | 'api_guide';
}

const SLIDES: Slide[] = [
  { id: '1', type: 'welcome' },
  { id: '2', type: 'features' },
  { id: '3', type: 'api_guide' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // API Key State (Slide 3)
  const [apiKey, setApiKey] = useState('');
  const [testingKey, setTestingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{ tone: 'ok' | 'error'; message: string } | null>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== currentIndex && index >= 0 && index < SLIDES.length) {
      setCurrentIndex(index);
    }
  };

  const goToSlide = (index: number) => {
    if (index < 0 || index >= SLIDES.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCurrentIndex(index);
    flatListRef.current?.scrollToOffset({
      offset: index * SCREEN_WIDTH,
      animated: true,
    });
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      goToSlide(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (apiKey.trim()) {
        try {
          await saveApiKey(apiKey.trim());
        } catch {}
      }
      await setSetting('onboarding_completed', 'true');
    } catch (e) {
      console.warn('Error saving onboarding state:', e);
    } finally {
      router.replace('/(tabs)');
    }
  };

  const handleOpenAiStudio = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await WebBrowser.openBrowserAsync('https://aistudio.google.com/app/apikey');
    } catch {}
  };

  const handleTestApiKey = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setKeyStatus({ tone: 'error', message: 'Please paste or enter your API key first.' });
      return;
    }
    setTestingKey(true);
    setKeyStatus(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await testGeminiKey(trimmed);
      await saveApiKey(trimmed, 'gemini');
      setKeyStatus({
        tone: 'ok',
        message: 'Google Gemini key verified successfully! (Free & Unlimited)',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      setKeyStatus({
        tone: 'error',
        message: err.message || 'Verification failed. Please check the key.',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setTestingKey(false);
    }
  };

  // ── Render Slide 1: Welcome ──────────────────────────────────────────────────
  const renderWelcomeSlide = () => (
    <ScrollView
      contentContainerStyle={styles.slideScroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroLogoWrap}>
        <View style={[styles.glowRing, { borderColor: colors.primary }]}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.heroLogo}
            resizeMode="contain"
          />
        </View>
      </View>

      <View style={styles.badgePill}>
        <Icon name="bolt" size={14} color="#FFFFFF" />
        <Txt variant="labelSm" style={styles.badgePillText}>
          RAPID VOCABULARY ENGINE
        </Txt>
      </View>

      <Txt variant="headlineLg" style={styles.titleText}>
        Welcome to <Txt variant="headlineLg" style={{ color: colors.primary, fontWeight: '800' }}>Trigger</Txt>
      </Txt>

      <Txt variant="bodyLg" style={styles.subtitleText}>
        Master words at lightning speed with timed flash drills, natural speech pronunciation, and smart mistake recall.
      </Txt>

      <View style={styles.welcomePillContainer}>
        <View style={[styles.miniFeaturePill, { backgroundColor: colors.containerLow, borderColor: colors.outlineVariant }]}>
          <Icon name="timer" size={18} color="primary" />
          <Txt variant="labelLg" color="text">1s - 10s Rapid Drills</Txt>
        </View>
        <View style={[styles.miniFeaturePill, { backgroundColor: colors.containerLow, borderColor: colors.outlineVariant }]}>
          <Icon name="psychology" size={18} color="primary" />
          <Txt variant="labelLg" color="text">AI Native Pronunciation</Txt>
        </View>
        <View style={[styles.miniFeaturePill, { backgroundColor: colors.containerLow, borderColor: colors.outlineVariant }]}>
          <Icon name="offline-bolt" size={18} color="primary" />
          <Txt variant="labelLg" color="text">100% Offline & Private</Txt>
        </View>
      </View>
    </ScrollView>
  );

  // ── Render Slide 2: Features ────────────────────────────────────────────────
  const renderFeaturesSlide = () => {
    const features: { icon: IconName; title: string; desc: string }[] = [
      {
        icon: 'flash-on',
        title: 'Rapid Word Triggers',
        desc: 'Train your brain with customizable fast-paced flash exposure (1 to 10 seconds) to build instant recognition.',
      },
      {
        icon: 'record-voice-over',
        title: 'AI Audio & Pronunciation',
        desc: 'Listen to native pronunciations powered by your phone speech engine with customizable voices.',
      },
      {
        icon: 'history-edu',
        title: 'Smart "Practice Again" System',
        desc: 'Missed or skipped words automatically queue into targeted review sessions so no word is left behind.',
      },
      {
        icon: 'lock',
        title: 'Local & Zero Cloud Storage',
        desc: 'All word lists, practice records, and session history remain securely on your device SQLite database.',
      },
    ];

    return (
      <ScrollView
        contentContainerStyle={styles.slideScroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeaderWrap}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryContainer }]}>
            <Icon name="auto-awesome" size={24} color="primary" />
          </View>
          <Txt variant="headlineMd" style={styles.sectionTitle}>
            Powerful Features
          </Txt>
          <Txt variant="bodyMd" style={styles.sectionSubtitle}>
            Engineered for high-retention vocabulary and spelling practice
          </Txt>
        </View>

        <View style={styles.featuresList}>
          {features.map((feat, idx) => (
            <View
              key={idx}
              style={[
                styles.featureCard,
                { backgroundColor: colors.containerLow, borderColor: colors.outlineVariant },
              ]}
            >
              <View style={[styles.featureIconWrap, { backgroundColor: colors.primary }]}>
                <Icon name={feat.icon} size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="labelLg" style={styles.featureTitle}>
                  {feat.title}
                </Txt>
                <Txt variant="bodyMd" style={styles.featureDesc}>
                  {feat.desc}
                </Txt>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  // ── Render Slide 3: API Setup Method ────────────────────────────────────────
  const renderApiGuideSlide = () => (
    <ScrollView
      contentContainerStyle={styles.slideScroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.sectionHeaderWrap}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primaryContainer }]}>
          <Icon name="auto-awesome" size={24} color="primary" />
        </View>
        <Txt variant="headlineMd" style={styles.sectionTitle}>
          AI Vocabulary Setup (Free)
        </Txt>
        <Txt variant="bodyMd" style={styles.sectionSubtitle}>
          Connect Google Gemini (100% Free) to generate infinite spelling word lists
        </Txt>
      </View>

      {/* 3 Step Guide Cards */}
      <View style={styles.stepsContainer}>
        {/* Gemini Free Button Card */}
        <View style={[styles.stepRow, { backgroundColor: colors.containerLow, borderColor: colors.outlineVariant }]}>
          <View style={[styles.stepNumberBadge, { backgroundColor: colors.primary }]}>
            <Txt variant="labelMd" style={{ color: '#FFFFFF', fontWeight: '800' }}>1</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="labelLg" color="text">Get Free Gemini Key</Txt>
            <Txt variant="bodyMd" color="textSecondary">Official free key from Google AI Studio</Txt>
          </View>
          <Pressable
            onPress={handleOpenAiStudio}
            style={({ pressed }) => [
              styles.openLinkBtn,
              { backgroundColor: colors.primaryContainer, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Icon name="open-in-new" size={16} color="primary" />
            <Txt variant="labelSm" color="primary" style={{ fontWeight: '700' }}>AI Studio</Txt>
          </Pressable>
        </View>

        <View style={[styles.stepRow, { backgroundColor: colors.containerLow, borderColor: colors.outlineVariant }]}>
          <View style={[styles.stepNumberBadge, { backgroundColor: colors.primary }]}>
            <Txt variant="labelMd" style={{ color: '#FFFFFF', fontWeight: '800' }}>2</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="labelLg" color="text">Copy Your Key</Txt>
            <Txt variant="bodyMd" color="textSecondary">Copy your key starting with <Txt variant="labelSm" style={{ color: colors.primary }}>AIzaSy...</Txt> or <Txt variant="labelSm" style={{ color: colors.primary }}>sk-or-...</Txt></Txt>
          </View>
        </View>

        <View style={[styles.stepRow, { backgroundColor: colors.containerLow, borderColor: colors.outlineVariant }]}>
          <View style={[styles.stepNumberBadge, { backgroundColor: colors.primary }]}>
            <Txt variant="labelMd" style={{ color: '#FFFFFF', fontWeight: '800' }}>3</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="labelLg" color="text">Paste & Test Below</Txt>
            <Txt variant="bodyMd" color="textSecondary">You can also skip for now.</Txt>
          </View>
        </View>
      </View>

      {/* Input Box */}
      <View style={[styles.inputBoxCard, { backgroundColor: colors.containerLow, borderColor: colors.outlineVariant }]}>
        <Txt variant="labelSm" color="textSecondary" style={{ marginBottom: 6, fontWeight: '700' }}>
          GOOGLE GEMINI API KEY (OPTIONAL)
        </Txt>
        <TextInput
          value={apiKey}
          onChangeText={(txt) => {
            setApiKey(txt);
            setKeyStatus(null);
          }}
          placeholder="AIzaSy..."
          placeholderTextColor="#888888"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={false}
          style={[
            styles.apiInput,
            {
              backgroundColor: colors.background,
              color: '#FFFFFF',
              borderColor: colors.outlineVariant,
            },
          ]}
        />

        {keyStatus && (
          <View
            style={[
              styles.statusBanner,
              {
                backgroundColor: keyStatus.tone === 'ok' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                borderColor: keyStatus.tone === 'ok' ? '#22C55E' : '#EF4444',
              },
            ]}
          >
            <Icon
              name={keyStatus.tone === 'ok' ? 'check-circle' : 'error-outline'}
              size={18}
              color={keyStatus.tone === 'ok' ? '#22C55E' : '#EF4444'}
            />
            <Txt
              variant="labelSm"
              style={{
                color: keyStatus.tone === 'ok' ? '#22C55E' : '#EF4444',
                flex: 1,
              }}
            >
              {keyStatus.message}
            </Txt>
          </View>
        )}

        {apiKey.trim().length > 0 && (
          <Pressable
            onPress={handleTestApiKey}
            disabled={testingKey}
            style={({ pressed }) => [
              styles.testKeyBtn,
              {
                backgroundColor: colors.primaryContainer,
                borderColor: colors.primary,
                opacity: pressed || testingKey ? 0.7 : 1,
              },
            ]}
          >
            <Icon name={testingKey ? 'hourglass-empty' : 'sync'} size={16} color="primary" />
            <Txt variant="labelMd" color="primary" style={{ fontWeight: '700' }}>
              {testingKey ? 'Testing Connection...' : 'Verify & Save Key'}
            </Txt>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Bar: Skip Button */}
      <View style={styles.topBar}>
        <View style={styles.brandTitleWrap}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.topLogo}
            resizeMode="contain"
          />
          <Txt variant="labelLg" style={{ fontWeight: '800', letterSpacing: 1.5, color: colors.text }}>
            TRIGGER
          </Txt>
        </View>

        {currentIndex < SLIDES.length - 1 ? (
          <Pressable
            onPress={handleFinish}
            style={({ pressed }) => [
              styles.skipBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Txt variant="labelMd" color="textSecondary">
              Skip
            </Txt>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Horizontal Carousel */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        onMomentumScrollEnd={handleScroll}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_WIDTH }}>
            {item.type === 'welcome' && renderWelcomeSlide()}
            {item.type === 'features' && renderFeaturesSlide()}
            {item.type === 'api_guide' && renderApiGuideSlide()}
          </View>
        )}
      />

      {/* Bottom Bar: Dots & Navigation Controls */}
      <View style={styles.bottomBar}>
        {/* Pagination Dots */}
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, idx) => {
            const isActive = idx === currentIndex;
            return (
              <Pressable
                key={idx}
                onPress={() => goToSlide(idx)}
                style={[
                  styles.dot,
                  {
                    width: isActive ? 24 : 8,
                    backgroundColor: isActive ? colors.primary : colors.outlineVariant,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Action Button */}
        <View style={styles.actionRow}>
          {currentIndex > 0 && (
            <Pressable
              onPress={() => goToSlide(currentIndex - 1)}
              style={({ pressed }) => [
                styles.backBtn,
                {
                  borderColor: colors.outlineVariant,
                  backgroundColor: colors.containerLow,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Icon name="arrow-back" size={20} color="text" />
            </Pressable>
          )}

          <PrimaryButton
            label={currentIndex === SLIDES.length - 1 ? 'Start Practicing' : 'Next'}
            icon={currentIndex === SLIDES.length - 1 ? 'check' : 'arrow-forward'}
            onPress={handleNext}
            style={currentIndex > 0 ? { flex: 1 } : { width: '100%' }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  brandTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topLogo: {
    width: 28,
    height: 28,
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  slideScroll: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 24,
    alignItems: 'center',
  },
  heroLogoWrap: {
    marginTop: 10,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(122, 20, 40, 0.08)',
  },
  heroLogo: {
    width: 100,
    height: 100,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7A1428',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 14,
  },
  badgePillText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.8,
    fontSize: 11,
  },
  titleText: {
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitleText: {
    textAlign: 'center',
    color: '#A0A0A0',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  welcomePillContainer: {
    width: '100%',
    gap: 10,
  },
  miniFeaturePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  sectionHeaderWrap: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 6,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  sectionSubtitle: {
    textAlign: 'center',
    color: '#9E9E9E',
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  featuresList: {
    width: '100%',
    gap: 12,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontWeight: '700',
    marginBottom: 2,
  },
  featureDesc: {
    color: '#8E8E93',
    lineHeight: 18,
  },
  stepsContainer: {
    width: '100%',
    gap: 10,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  stepNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  inputBoxCard: {
    width: '100%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  apiInput: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
  },
  testKeyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 14,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
