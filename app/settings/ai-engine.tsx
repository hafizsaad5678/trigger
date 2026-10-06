import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { ErrorModal } from '@/components/ErrorModal';
import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Txt } from '@/components/Txt';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { testGeminiKey } from '@/lib/gemini';
import { deleteApiKey, getActiveProvider, getApiKey, saveApiKey, type AiProvider } from '@/lib/secureKey';
import { speakWord } from '@/lib/tts';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type Busy = 'save' | 'speech' | null;
type Feedback = { tone: 'ok' | 'error'; text: string } | null;

function maskKey(key: string) {
  return key.length > 8 ? `${key.slice(0, 6)}…${key.slice(-4)}` : '••••••••';
}

export default function AiEngineScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme()];

  // User manually selects provider — no auto-detect confusion
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>('gemini');
  const [keyInput, setKeyInput] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [savedProvider, setSavedProvider] = useState<AiProvider>('gemini');
  const [changingKey, setChangingKey] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [deleteModal, setDeleteModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const activeProv = await getActiveProvider().catch(() => 'gemini' as AiProvider);
        setSelectedProvider(activeProv);
        setSavedProvider(activeProv);

        const k = await getApiKey(activeProv).catch(() => null);
        setSavedKey(k?.trim() || null);
        setKeyInput('');
        setChangingKey(false);
        setFeedback(null);
      })();
    }, [])
  );

  const handleSaveKey = async () => {
    const key = keyInput.trim();
    if (!key) {
      setFeedback({ tone: 'error', text: 'API key paste karein.' });
      return;
    }
    setBusy('save');
    setFeedback(null);

    try {
      await testGeminiKey(key);
      await saveApiKey(key, 'gemini');
      setSavedKey(key);
      setSavedProvider(selectedProvider);
      setKeyInput('');
      setChangingKey(false);
      setFeedback({ tone: 'ok', text: '✓ Google Gemini key save ho gayi!' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    } catch (err: any) {
      const msg = err?.message || 'Key verify nahi ho saki.';
      setFeedback({ tone: 'error', text: msg });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
    } finally {
      setBusy(null);
    }
  };

  const doDeleteKey = async () => {
    await deleteApiKey('gemini').catch(() => { });
    setSavedKey(null);
    setKeyInput('');
    setChangingKey(false);
    setFeedback(null);
  };

  const handleTestSpeech = async () => {
    setBusy('speech');
    try {
      await speakWord('Accommodation', 1.0, 'en-GB');
    } finally {
      setTimeout(() => setBusy(null), 1500);
    }
  };

  const inputState = savedKey && !changingKey;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="AI Engine" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* API Key Section */}
        <Txt variant="labelSm" color="textSecondary" style={styles.label}>API KEY</Txt>
        <Card style={styles.card}>

          {inputState ? (
            /* ── Saved state ─────────────────────────────── */
            <>
              <View style={styles.savedRow}>
                <View style={[styles.iconBadge, { backgroundColor: colors.primaryContainer }]}>
                  <Icon name="key" size={18} color="primary" />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="labelLg" color="text">{maskKey(savedKey)}</Txt>
                  <Txt variant="bodyMd" color="textSecondary" style={{ marginTop: 2 }}>
                    Google Gemini (Free) · Secure
                  </Txt>
                </View>
                <View style={[styles.okDot, { backgroundColor: '#22c55e' }]} />
              </View>
              <View style={styles.btnRow}>
                <PrimaryButton
                  label="Change"
                  variant="secondary"
                  icon="edit"
                  onPress={() => { setChangingKey(true); setFeedback(null); }}
                  style={styles.halfBtn}
                />
                <PrimaryButton
                  label="Remove"
                  variant="danger"
                  icon="delete-outline"
                  onPress={() => setDeleteModal(true)}
                  style={styles.halfBtn}
                />
              </View>
            </>
          ) : (
            /* ── Input state ─────────────────────────────── */
            <>
              <View style={styles.providerRow}>
                <View
                  style={[
                    styles.providerBtn,
                    { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
                  ]}
                >
                  <Icon name="auto-awesome" size={16} color="primary" />
                  <View>
                    <Txt variant="labelMd" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                      Google Gemini
                    </Txt>
                    <Txt variant="labelSm" style={{ color: '#22c55e', fontSize: 10, fontWeight: '700' }}>FREE</Txt>
                  </View>
                  <Icon name="check-circle" size={16} color="primary" />
                </View>
              </View>

              {/* Key Input */}
              <TextInput
                style={[styles.input, {
                  backgroundColor: colors.background,
                  color: '#FFFFFF',
                  borderColor: colors.outlineVariant,
                }]}
                placeholder="AIzaSy... (Google AI Studio key)"
                placeholderTextColor={colors.outline}
                value={keyInput}
                onChangeText={(t) => { setKeyInput(t); setFeedback(null); }}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.btnRow}>
                <PrimaryButton
                  label={busy === 'save' ? 'Saving...' : 'Verify & Save'}
                  icon={busy === 'save' ? undefined : 'save'}
                  disabled={busy !== null || !keyInput.trim()}
                  onPress={handleSaveKey}
                  style={{ flex: 1 }}
                />
                {changingKey && (
                  <PrimaryButton
                    label="Cancel"
                    variant="ghost"
                    onPress={() => { setChangingKey(false); setKeyInput(''); setFeedback(null); }}
                    style={styles.halfBtn}
                  />
                )}
              </View>
            </>
          )}

          {feedback && (
            <Text style={[styles.feedback, { color: feedback.tone === 'ok' ? '#22c55e' : colors.error }]}>
              {feedback.text}
            </Text>
          )}
        </Card>

        {/* Speech Test */}
        <Txt variant="labelSm" color="textSecondary" style={styles.label}>PRONUNCIATION TEST</Txt>
        <Card style={styles.card}>
          <Txt variant="bodyMd" color="textSecondary" style={{ marginBottom: 12 }}>
            Phone ki offline speech engine se pronunciation test karein.
          </Txt>
          <PrimaryButton
            label={busy === 'speech' ? 'Playing...' : 'Play Sample'}
            variant="secondary"
            icon="volume-up"
            disabled={busy !== null}
            onPress={handleTestSpeech}
          />
        </Card>
      </ScrollView>

      <ErrorModal
        visible={deleteModal}
        title="API Key Remove Karen?"
        message="Hataney ke baad AI word generation offline bank par fallback karega."
        iconName="delete-outline"
        confirmLabel="Remove"
        confirmDanger
        onConfirm={doDeleteKey}
        onClose={() => setDeleteModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 48, gap: 4 },
  label: { letterSpacing: 0.8, fontWeight: '700', marginTop: 16, marginBottom: 6, marginLeft: 2 },
  card: { padding: 14, borderRadius: 16, marginBottom: 4 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconBadge: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  okDot: { width: 10, height: 10, borderRadius: 5 },
  providerRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  providerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5,
  },
  input: {
    minHeight: 48, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, fontSize: 14, fontFamily: 'Inter_400Regular',
  },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  halfBtn: { flex: 1 },
  feedback: { fontSize: 13, marginTop: 10, fontFamily: 'Inter_500Medium' },
});
