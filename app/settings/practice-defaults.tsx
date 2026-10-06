import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { DropdownPicker, type DropdownOption } from '@/components/DropdownPicker';
import { ErrorModal } from '@/components/ErrorModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Segmented } from '@/components/Segmented';
import { TextSourceInput } from '@/components/TextSourceInput';
import { Txt } from '@/components/Txt';
import { VoicePicker } from '@/components/VoicePicker';
import { Colors, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getSetting, setSetting } from '@/db/queries/settings';
import { categoryIcon } from '@/lib/categoryMeta';
import {
  CADENCE_RATES,
  CATEGORIES,
  DEFAULT_ACCENT,
  DEFAULT_CATEGORY,
  DEFAULT_DIFFICULTY,
  DEFAULT_DURATION_MIN,
  DEFAULT_INTERVAL_SEC,
  DEFAULT_SPEECH_RATE,
  DIFFICULTIES,
  DURATIONS,
  INTERVALS,
  SPEECH_RATES,
} from '@/lib/constants';

export default function PracticeDefaultsScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme()];

  const [defaultCategory, setDefaultCategory] = useState<string>(DEFAULT_CATEGORY);
  const [customCategory, setCustomCategory] = useState<string>('');
  const [customText, setCustomText] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>(DEFAULT_DIFFICULTY);
  const [defaultDuration, setDefaultDuration] = useState<number>(DEFAULT_DURATION_MIN);
  const [defaultInterval, setDefaultInterval] = useState<number>(DEFAULT_INTERVAL_SEC);
  const [accent, setAccent] = useState<string>(DEFAULT_ACCENT);
  const [voiceId, setVoiceId] = useState<string | undefined>(undefined);
  const [speechRate, setSpeechRate] = useState<number>(DEFAULT_SPEECH_RATE);
  const [saving, setSaving] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [errorModal, setErrorModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [cat, diff, dur, interval, acc, voice, rate, customCat, customTxt] = await Promise.all([
          getSetting('defaultCategory'),
          getSetting('difficulty'),
          getSetting('defaultDuration'),
          getSetting('defaultInterval'),
          getSetting('accent'),
          getSetting('voiceId'),
          getSetting('speechRate'),
          getSetting('customCategory'),
          getSetting('customText'),
        ]);
        if (cat) setDefaultCategory(cat);
        if (diff) setDifficulty(diff);
        if (dur) setDefaultDuration(parseInt(dur, 10) || DEFAULT_DURATION_MIN);
        if (interval) setDefaultInterval(parseInt(interval, 10) || DEFAULT_INTERVAL_SEC);
        if (acc) setAccent(acc);
        if (voice) setVoiceId(voice || undefined);
        if (rate) setSpeechRate(parseFloat(rate) || DEFAULT_SPEECH_RATE);
        if (customCat) setCustomCategory(customCat);
        if (customTxt) setCustomText(customTxt);
      })();
    }, [])
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        setSetting('defaultCategory', defaultCategory),
        setSetting('difficulty', difficulty),
        setSetting('defaultDuration', String(defaultDuration)),
        setSetting('defaultInterval', String(defaultInterval)),
        setSetting('accent', accent),
        setSetting('voiceId', voiceId ?? ''),
        setSetting('speechRate', String(speechRate)),
        setSetting('customCategory', customCategory.trim()),
        setSetting('customText', customText),
      ]);
      setSuccessModal(true);
    } catch {
      setErrorModal(true);
    } finally {
      setSaving(false);
    }
  };

  const categoryOptions: DropdownOption[] = CATEGORIES.map((c) => ({
    label: c,
    value: c,
    icon: categoryIcon(c),
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Practice Defaults" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Category */}
        <Txt variant="labelSm" color="textSecondary" style={styles.sectionLabel}>
          TARGET VOCABULARY
        </Txt>
        <Card style={styles.card}>
          <DropdownPicker
            options={categoryOptions}
            selectedValue={defaultCategory}
            onSelect={setDefaultCategory}
            modalTitle="Default Vocabulary Domain"
            placeholder="Select default domain"
          />
          {defaultCategory === 'Custom' && (
            <TextInput
              style={[styles.input, { backgroundColor: colors.containerLow, color: colors.text, borderColor: colors.outlineVariant }]}
              placeholder="e.g. Legal terminology, Environment"
              placeholderTextColor={colors.outline}
              value={customCategory}
              onChangeText={setCustomCategory}
            />
          )}
          {defaultCategory === 'My Text' && (
            <TextSourceInput value={customText} onChange={setCustomText} />
          )}
        </Card>

        {/* Difficulty */}
        <Txt variant="labelSm" color="textSecondary" style={styles.sectionLabel}>
          DIFFICULTY LEVEL
        </Txt>
        <Card style={styles.card}>
          <Segmented
            options={DIFFICULTIES}
            selected={difficulty as (typeof DIFFICULTIES)[number]}
            onSelect={setDifficulty}
          />
        </Card>

        {/* Duration */}
        <Txt variant="labelSm" color="textSecondary" style={styles.sectionLabel}>
          SESSION DURATION
        </Txt>
        <Card style={styles.card}>
          <View style={styles.chips}>
            {DURATIONS.map((m) => (
              <Chip
                key={m}
                label={`${m} min`}
                selected={defaultDuration === m}
                onPress={() => setDefaultDuration(m)}
              />
            ))}
          </View>
        </Card>

        {/* Interval */}
        <Txt variant="labelSm" color="textSecondary" style={styles.sectionLabel}>
          INTERVAL BETWEEN WORDS
        </Txt>
        <Card style={styles.card}>
          <View style={styles.chips}>
            {INTERVALS.map((s) => (
              <Chip
                key={s}
                label={`${s} sec`}
                selected={defaultInterval === s}
                onPress={() => setDefaultInterval(s)}
              />
            ))}
          </View>
        </Card>

        {/* Playback speed */}
        <Txt variant="labelSm" color="textSecondary" style={styles.sectionLabel}>
          PLAYBACK SPEED
        </Txt>
        <Card style={styles.card}>
          <View style={styles.chips}>
            {SPEECH_RATES.map((r) => (
              <Chip
                key={r}
                label={`${r}x`}
                selected={speechRate === r}
                onPress={() => setSpeechRate(r)}
              />
            ))}
          </View>
        </Card>

        {/* Voice & Accent */}
        <Txt variant="labelSm" color="textSecondary" style={styles.sectionLabel}>
          ACCENT & VOICE
        </Txt>
        <Card style={styles.card}>
          <VoicePicker
            accent={accent}
            voiceId={voiceId}
            speechRate={speechRate}
            onChange={(next) => {
              setAccent(next.accent);
              setVoiceId(next.voiceId);
            }}
          />
        </Card>

        <PrimaryButton
          label={saving ? 'Saving…' : 'Save Defaults'}
          onPress={handleSave}
          disabled={saving}
          style={styles.saveBtn}
        />
      </ScrollView>

      {/* Success Modal */}
      <ErrorModal
        visible={successModal}
        title="Settings Saved"
        iconName="check-circle"
        actionLabel="Done"
        onClose={() => {
          setSuccessModal(false);
          router.back();
        }}
      />

      {/* Error Modal */}
      <ErrorModal
        visible={errorModal}
        title="Save Failed"
        onClose={() => setErrorModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 48, gap: 4 },
  sectionLabel: {
    letterSpacing: 0.8,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 6,
    marginLeft: 2,
  },
  card: { padding: 14, borderRadius: 16, marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginTop: 10,
  },
  saveBtn: { marginTop: 20 },
});
