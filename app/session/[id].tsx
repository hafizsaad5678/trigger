import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Txt } from '@/components/Txt';
import { ErrorModal } from '@/components/ErrorModal';
import { Colors, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DEFAULT_ACCENT, DEFAULT_DURATION_MIN, DEFAULT_INTERVAL_SEC, DEFAULT_SPEECH_RATE } from '@/lib/constants';
import { formatDurationLabel, formatMonthDay } from '@/lib/format';
import { spellingHint } from '@/lib/spellingHints';
import { speakWord } from '@/lib/tts';
import { getSetting } from '@/db/queries/settings';
import {
  deleteSession,
  getSession,
  getSessionWords,
  setWordMark,
  type SpokenWordItem,
} from '@/db/queries/sessions';

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;
type Mark = 'correct' | 'retest';

export default function SessionWordsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const router = useRouter();
  const colors = Colors[useColorScheme()];

  const [session, setSession] = useState<Session | null>(null);
  const [words, setWords] = useState<SpokenWordItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [deleteModal, setDeleteModal] = useState(false);
  const [exportErrorModal, setExportErrorModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, w] = await Promise.all([getSession(sessionId), getSessionWords(sessionId)]);
      setSession(s);
      setWords(w);
    } catch (e) {
      console.warn('Failed to load session:', e);
    } finally {
      setLoaded(true);
    }
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const playWord = async (word: string) => {
    const [rate, accent, voice] = await Promise.all([
      getSetting('speechRate'),
      getSetting('accent'),
      getSetting('voiceId'),
    ]);
    await speakWord(word, parseFloat(rate ?? '') || DEFAULT_SPEECH_RATE, accent || DEFAULT_ACCENT, voice || undefined);
  };

  const toggleMark = async (item: SpokenWordItem, mark: Mark) => {
    const next = item.mark === mark ? null : mark;
    setWords((prev) => prev.map((w) => (w.id === item.id ? { ...w, mark: next } : w)));
    try {
      await setWordMark(sessionId, item.position, next);
    } catch {
      load();
    }
  };

  const confirmDelete = () => {
    setDeleteModal(true);
  };

  const doDelete = async () => {
    await deleteSession(sessionId);
    router.back();
  };

  const exportList = async () => {
    if (!session) return;
    const lines = words.map((w) => {
      const tag = w.mark === 'correct' ? ' [correct]' : w.mark === 'retest' ? ' [retest]' : '';
      return `${String(w.position).padStart(2, '0')}. ${w.word}${tag}`;
    });
    const message = `${session.category} (${session.difficulty}) - ${formatMonthDay(session.startedAt)}\n\n${lines.join('\n')}`;
    try {
      await Share.share({ message, title: 'Word list' });
    } catch {
      setExportErrorModal(true);
    }
  };

  // Drill only the words marked "Retest", straight away, with the saved voice defaults
  const startRetest = async () => {
    const retestWords = words.filter((w) => w.mark === 'retest').map((w) => w.word);
    if (retestWords.length === 0) return;
    const [dur, interval, accent, voice, rate] = await Promise.all([
      getSetting('defaultDuration'),
      getSetting('defaultInterval'),
      getSetting('accent'),
      getSetting('voiceId'),
      getSetting('speechRate'),
    ]);
    const intervalSec = parseInt(interval ?? '', 10) || DEFAULT_INTERVAL_SEC;
    // Long enough to speak every retest word once
    const durationSec = Math.max((parseInt(dur ?? '', 10) || DEFAULT_DURATION_MIN) * 60, retestWords.length * intervalSec);
    router.push({
      pathname: '/session/active',
      params: {
        category: 'Retest Session',
        difficulty: 'Review',
        durationSec: String(durationSec),
        intervalSec: String(intervalSec),
        accent: accent || DEFAULT_ACCENT,
        voiceId: voice ?? '',
        speechRate: String(parseFloat(rate ?? '') || DEFAULT_SPEECH_RATE),
        customCategory: '',
        retestWords: JSON.stringify(retestWords),
      },
    });
  };

  const retestCount = words.filter((w) => w.mark === 'retest').length;
  const reviewed = words.filter((w) => w.mark !== null).length;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/history' as never));

  if (loaded && !session) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <AppHeader title="Word List Details" onBack={back} />
        <View style={styles.center}>
          <Txt variant="bodyMd" color="textSecondary">
            This session no longer exists.
          </Txt>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Word List Details" onBack={back} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Back link + mode pill */}
        <View style={styles.topRow}>
          <Pressable onPress={back} style={styles.backLink} accessibilityRole="button">
            <Icon name="chevron-left" size={20} color="primary" />
            <Txt variant="labelLg" color="primary">
              Word Lists
            </Txt>
          </Pressable>
          <View style={[styles.modePill, { backgroundColor: colors.container }]}>
            <Txt variant="labelSm" color="textSecondary" style={styles.upper}>
              Self-Check
            </Txt>
          </View>
        </View>

        {session && (
          <Card>
            <View style={styles.summaryTop}>
              <Txt variant="labelMd" color="primary" style={styles.semibold}>
                Session — {formatMonthDay(session.startedAt)}
              </Txt>
              <View style={[styles.levelPill, { backgroundColor: colors.secondaryContainer }]}>
                <View style={[styles.levelDot, { backgroundColor: colors.secondary }]} />
                <Txt variant="labelSm" color="secondary" style={styles.medium}>
                  {session.difficulty}
                </Txt>
              </View>
            </View>
            <Txt variant="headlineMd" style={styles.summaryTitle}>
              {session.category}
            </Txt>
            <View style={styles.meta}>
              <MetaItem icon="schedule" text={formatDurationLabel(session.durationActualSec ?? session.durationPlannedSec)} />
              <Txt variant="labelMd" color="outlineVariant">
                •
              </Txt>
              <MetaItem icon="timer" text={`every ${session.intervalSec}s`} />
              <Txt variant="labelMd" color="outlineVariant">
                •
              </Txt>
              <MetaItem icon="format-list-numbered" text={`${words.length} words total`} />
            </View>

            <View style={[styles.tracker, { backgroundColor: colors.containerLow }]}>
              <View style={styles.trackerLeft}>
                <View style={[styles.trackerIcon, { backgroundColor: colors.primaryContainer }]}>
                  <Icon name="fact-check" size={16} color="onPrimary" />
                </View>
                <View>
                  <Txt variant="labelSm" color="textSecondary">
                    Review Status
                  </Txt>
                  <Txt variant="labelLg">
                    <Txt variant="labelLg" color="error" style={styles.bold}>
                      {retestCount}
                    </Txt>{' '}
                    marked for retest
                  </Txt>
                </View>
              </View>
              <View style={[styles.reviewed, { backgroundColor: colors.container }]}>
                <Txt variant="labelSm" style={styles.semibold}>
                  {reviewed}/{words.length} reviewed
                </Txt>
              </View>
            </View>
          </Card>
        )}

        {/* Words header */}
        <View style={styles.wordsHeader}>
          <View style={styles.wordsTitle}>
            <Txt variant="headlineMd">Session Words</Txt>
            <Txt variant="labelMd" color="textSecondary">
              ({words.length} shown)
            </Txt>
          </View>
          <Pressable onPress={() => setShowDetails((v) => !v)} style={styles.toggle} hitSlop={8}>
            <Icon name="unfold-more" size={16} color="primary" />
            <Txt variant="labelMd" color="primary">
              Toggle Details
            </Txt>
          </Pressable>
        </View>

        {/* Word cards */}
        <View style={styles.words}>
          {words.map((item) => {
            const hint = showDetails ? spellingHint(item.word) : null;
            return (
              <View key={item.id} style={[styles.wordCard, { backgroundColor: colors.card }, Shadows.sm]}>
                <View style={styles.wordRow}>
                  <View style={styles.wordLeft}>
                    <Txt variant="labelMd" color="textSecondary" style={styles.position}>
                      {String(item.position).padStart(2, '0')}
                    </Txt>
                    <Txt variant="headlineMd" style={styles.word} numberOfLines={1}>
                      {item.word}
                    </Txt>
                    <Pressable
                      onPress={() => playWord(item.word)}
                      accessibilityRole="button"
                      accessibilityLabel={`Play ${item.word}`}
                      style={[styles.play, { backgroundColor: colors.containerLow }]}
                    >
                      <Icon name="volume-up" size={18} color="primary" />
                    </Pressable>
                  </View>

                  <View style={[styles.marks, { backgroundColor: colors.containerLow }]}>
                    <MarkButton
                      label="Correct"
                      icon="check-circle"
                      active={item.mark === 'correct'}
                      activeBg={colors.secondary}
                      activeFg={colors.onSecondary}
                      onPress={() => toggleMark(item, 'correct')}
                    />
                    <MarkButton
                      label="Retest"
                      icon="cancel"
                      active={item.mark === 'retest'}
                      activeBg={colors.error}
                      activeFg={colors.onError}
                      onPress={() => toggleMark(item, 'retest')}
                    />
                  </View>
                </View>

                {hint && (
                  <View style={[styles.hint, { backgroundColor: colors.containerLow }]}>
                    <Icon name={hint.icon} size={18} color="primary" />
                    <Txt variant="bodyMd" color="textSecondary" style={styles.flex}>
                      {hint.parts.map((part, i) => (
                        <Txt
                          key={i}
                          variant="bodyMd"
                          color={part.highlight ? 'error' : 'textSecondary'}
                          style={part.highlight && styles.semibold}
                        >
                          {part.text}
                        </Txt>
                      ))}
                    </Txt>
                  </View>
                )}
              </View>
            );
          })}
          {loaded && words.length === 0 && (
            <Txt variant="bodyMd" color="textSecondary" style={styles.centerText}>
              No words were spoken in this session.
            </Txt>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <PrimaryButton
            label="Launch Spelling & Writing Quiz"
            icon="spellcheck"
            variant="primary"
            size="md"
            onPress={() =>
              router.push({
                pathname: '/session/spellcheck',
                params: { sessionId: String(sessionId) },
              })
            }
            disabled={words.length === 0}
          />
          {retestCount > 0 && (
            <PrimaryButton
              label={`Retest Misspelled Words (${retestCount})`}
              icon="fitness-center"
              variant="primaryContainer"
              size="md"
              onPress={startRetest}
              style={styles.retestButton}
            />
          )}
          <PrimaryButton
            label="Export Word List"
            icon="download"
            variant="secondary"
            size="md"
            onPress={exportList}
            disabled={words.length === 0}
          />
          <PrimaryButton label="Delete Session" icon="delete" variant="dangerSoft" size="sm" onPress={confirmDelete} />
        </View>
      </ScrollView>

      {/* Delete session confirm */}
      <ErrorModal
        visible={deleteModal}
        title="Delete Session?"
        message="Delete this session and its word list? This cannot be undone."
        iconName="delete-outline"
        confirmLabel="Delete"
        confirmDanger
        onConfirm={doDelete}
        onClose={() => setDeleteModal(false)}
      />

      {/* Export error */}
      <ErrorModal
        visible={exportErrorModal}
        title="Export Failed"
        message="Could not share the word list. Please try again."
        iconName="error-outline"
        onClose={() => setExportErrorModal(false)}
      />
    </View>
  );
}

function MetaItem(props: { icon: React.ComponentProps<typeof Icon>['name']; text: string }) {
  return (
    <View style={styles.metaItem}>
      <Icon name={props.icon} size={16} color="primary" />
      <Txt variant="labelMd" color="textSecondary">
        {props.text}
      </Txt>
    </View>
  );
}

function MarkButton(props: {
  label: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  active: boolean;
  activeBg: string;
  activeFg: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: props.active }}
      style={[styles.mark, props.active && { backgroundColor: props.activeBg }, props.active && Shadows.sm]}
    >
      <Icon name={props.icon} size={16} color={props.active ? props.activeFg : 'textSecondary'} />
      <Txt
        variant="labelMd"
        color={props.active ? props.activeFg : 'textSecondary'}
        style={props.active && styles.bold}
      >
        {props.label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  flex: { flex: 1 },
  semibold: { fontFamily: 'Inter_600SemiBold' },
  medium: { fontFamily: 'Inter_500Medium' },
  bold: { fontFamily: 'Inter_700Bold' },
  upper: { textTransform: 'uppercase', letterSpacing: 0.8 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 8,
  },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -8, paddingVertical: 4, paddingHorizontal: 8 },
  modePill: { borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  levelPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 },
  levelDot: { width: 6, height: 6, borderRadius: 3 },
  summaryTitle: { marginBottom: 4 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tracker: {
    marginTop: 12,
    padding: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trackerIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  reviewed: { borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4 },
  ruleCard: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ruleIcon: { width: 80, height: 80, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  ruleTitle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  selfCheck: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderRadius: 12, padding: 16, marginBottom: 24 },
  selfCheckIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  wordsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  wordsTitle: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  words: { gap: 8, marginBottom: 32 },
  wordCard: { borderRadius: 12, padding: 16 },
  wordRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  wordLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  position: { width: 20, textAlign: 'right', opacity: 0.7 },
  word: { flexShrink: 1 },
  play: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  marks: { flexDirection: 'row', borderRadius: 8, padding: 2 },
  mark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    minHeight: 32,
  },
  hint: { marginTop: 8, borderRadius: 8, padding: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  actions: { gap: 8 },
  retestButton: { height: 52 },
});
