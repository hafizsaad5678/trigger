import React, { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { DropdownPicker, type DropdownOption } from '@/components/DropdownPicker';
import { Icon, type IconName } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Segmented } from '@/components/Segmented';
import { TextSourceInput } from '@/components/TextSourceInput';
import { Txt } from '@/components/Txt';
import { VoicePicker } from '@/components/VoicePicker';
import { ErrorModal } from '@/components/ErrorModal';
import { Colors, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getSetting, setSetting } from '@/db/queries/settings';
import { categoryIcon } from '@/lib/categoryMeta';
import {
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

interface PracticeMode {
  id: string;
  title: string;
  subtitle: string;
  iconName: IconName;
  tag: string;
  isAvailable: boolean;
}

const PRACTICE_MODES: PracticeMode[] = [
  {
    id: 'writing',
    title: 'Writing Practice',
    subtitle: 'Spelling drills, timed writing & vocal word triggers',
    iconName: 'edit-note',
    tag: 'Available',
    isAvailable: true,
  },
  {
    id: 'speaking',
    title: 'Speaking & Pronunciation',
    subtitle: 'Vocal repetition & AI phonetic accuracy assessment',
    iconName: 'record-voice-over',
    tag: 'Coming Soon',
    isAvailable: false,
  },
  {
    id: 'listening',
    title: 'Listening & Dictation',
    subtitle: 'Audio comprehension & cadence timing challenges',
    iconName: 'headphones',
    tag: 'Coming Soon',
    isAvailable: false,
  },
  {
    id: 'recall',
    title: 'Speed Recall',
    subtitle: 'Rapid flashcard reaction drills & spaced testing',
    iconName: 'bolt',
    tag: 'Coming Soon',
    isAvailable: false,
  },
];

export default function PracticeTabScreen() {
  const colors = Colors[useColorScheme()];

  // Active viewing mode: null (shows 4 cards) or mode ID (shows settings)
  const [activeSettingsMode, setActiveSettingsMode] = useState<string | null>(null);
  const [comingSoonModal, setComingSoonModal] = useState<PracticeMode | null>(null);

  // Settings state
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
  const [savedModal, setSavedModal] = useState(false);
  const [saveErrorModal, setSaveErrorModal] = useState(false);

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

  const handleCardPress = (mode: PracticeMode) => {
    if (mode.isAvailable) {
      setActiveSettingsMode(mode.id);
    } else {
      setComingSoonModal(mode);
    }
  };

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
      setSavedModal(true);
    } catch {
      setSaveErrorModal(true);
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
      {activeSettingsMode ? (
        <AppHeader
          title="Writing Practice Settings"
          onBack={() => setActiveSettingsMode(null)}
        />
      ) : (
        <AppHeader title="Practice Hub" />
      )}

      {/* ── COMING SOON MODAL DIALOG ──────────────────────────────── */}
      <Modal
        visible={comingSoonModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setComingSoonModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.outlineVariant }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: colors.primaryContainer }]}>
              <Icon name={comingSoonModal?.iconName || 'rocket-launch'} size={28} color="primary" />
            </View>

            <Txt variant="headlineMd" color="text" style={styles.modalTitle}>
              {comingSoonModal?.title}
            </Txt>

            <Txt variant="labelSm" color="textSecondary" style={styles.modalDesc}>
              {comingSoonModal?.subtitle}
            </Txt>

            <View style={[styles.comingSoonTag, { backgroundColor: colors.containerHigh }]}>
              <Icon name="construction" size={14} color="primary" />
              <Txt variant="labelSm" style={{ color: colors.primary, fontWeight: '700' }}>
                Under Development · Coming Soon
              </Txt>
            </View>

            <PrimaryButton
              label="Got It"
              onPress={() => setComingSoonModal(null)}
              style={styles.modalBtn}
            />
          </View>
        </View>
      </Modal>

      {/* ── 1. MAIN CARD LIST VIEW (When no settings active) ───────── */}
      {!activeSettingsMode ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Txt variant="labelSm" color="textSecondary" style={styles.sectionLabel}>
            SELECT PRACTICE MODULE
          </Txt>

          <View style={styles.cardsList}>
            {PRACTICE_MODES.map((mode) => (
              <Pressable
                key={mode.id}
                onPress={() => handleCardPress(mode)}
                style={({ pressed }) => [
                  styles.practiceCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: mode.isAvailable ? colors.primary : colors.outlineVariant,
                    opacity: pressed ? 0.85 : 1,
                  },
                  mode.isAvailable ? Shadows.md : Shadows.sm,
                ]}
              >
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.cardIconWrap,
                      {
                        backgroundColor: mode.isAvailable ? colors.primary : colors.containerLow,
                      },
                    ]}
                  >
                    <Icon
                      name={mode.iconName}
                      size={22}
                      color={mode.isAvailable ? '#FFFFFF' : colors.textSecondary}
                    />
                  </View>

                  <View
                    style={[
                      styles.tagBadge,
                      {
                        backgroundColor: mode.isAvailable ? colors.primaryContainer : colors.containerLow,
                        borderColor: mode.isAvailable ? colors.primary : colors.outlineVariant,
                      },
                    ]}
                  >
                    <Txt
                      variant="labelSm"
                      style={{
                        fontSize: 10,
                        fontWeight: '700',
                        color: mode.isAvailable ? colors.onPrimaryContainer : colors.textSecondary,
                      }}
                    >
                      {mode.tag}
                    </Txt>
                  </View>
                </View>

                <Txt variant="headlineMd" color="text" style={styles.cardTitle}>
                  {mode.title}
                </Txt>

                <Txt variant="labelSm" color="textSecondary" style={styles.cardSubtitle}>
                  {mode.subtitle}
                </Txt>

                <View style={styles.cardFooter}>
                  <Txt
                    variant="labelSm"
                    style={{
                      color: mode.isAvailable ? colors.primary : colors.textSecondary,
                      fontWeight: '600',
                    }}
                  >
                    {mode.isAvailable ? 'Configure Settings →' : 'Feature Preview'}
                  </Txt>
                  <Icon
                    name={mode.isAvailable ? 'arrow-forward' : 'lock-outline'}
                    size={16}
                    color={mode.isAvailable ? colors.primary : colors.outline}
                  />
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : (
        /* ── 2. WRITING PRACTICE SETTINGS VIEW (Opened on click) ──── */
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable
            onPress={() => setActiveSettingsMode(null)}
            style={({ pressed }) => [
              styles.backNavRow,
              { backgroundColor: colors.card, borderColor: colors.outlineVariant, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Icon name="arrow-back" size={18} color="primary" />
            <Txt variant="labelMd" color="primary">
              Back to Practice Modules
            </Txt>
          </Pressable>

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
                style={[
                  styles.input,
                  { backgroundColor: colors.containerLow, color: colors.text, borderColor: colors.outlineVariant },
                ]}
                placeholder="e.g. Academic, Environment"
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
            label={saving ? 'Saving…' : 'Save Writing Settings'}
            onPress={handleSave}
            disabled={saving}
            style={styles.saveBtn}
          />
        </ScrollView>
      )}

      {/* Save success */}
      <ErrorModal
        visible={savedModal}
        title="Saved!"
        message="Writing Practice defaults have been saved."
        iconName="check-circle"
        onClose={() => setSavedModal(false)}
      />

      {/* Save error */}
      <ErrorModal
        visible={saveErrorModal}
        title="Save Failed"
        message="Failed to save settings. Please try again."
        iconName="error-outline"
        onClose={() => setSaveErrorModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 110, gap: 4 },
  sectionLabel: {
    letterSpacing: 0.8,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 6,
    marginLeft: 2,
  },
  cardsList: {
    gap: 12,
    marginTop: 4,
  },
  practiceCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  backNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
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

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    textAlign: 'center',
    fontSize: 17,
  },
  modalDesc: {
    textAlign: 'center',
    lineHeight: 18,
    opacity: 0.8,
  },
  comingSoonTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  modalBtn: {
    width: '100%',
    marginTop: 6,
  },
});
