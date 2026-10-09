import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { ErrorModal } from '@/components/ErrorModal';
import { Icon, IconName } from '@/components/Icon';
import { SoundBars } from '@/components/SoundBars';
import { Txt } from '@/components/Txt';
import { Colors, Shadows } from '@/constants/theme';
import { MONO } from '@/constants/typography';
import { createSession } from '@/db/queries/sessions';
import { getSetting } from '@/db/queries/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatClock } from '@/lib/format';
import { getApiKey } from '@/lib/secureKey';
import { runSession, type CancelToken } from '@/lib/sessionRunner';
import { stopSpeech } from '@/lib/tts';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const logo = require('../../assets/images/logo.png');

export default function ActiveSessionScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme()];
  const params = useLocalSearchParams<{
    category: string;
    difficulty: string;
    durationSec: string;
    intervalSec: string;
    accent: string;
    voiceId?: string;
    speechRate: string;
    customCategory?: string;
    retestWords?: string; // JSON stringified string[]
  }>();

  const durationSec = parseInt(params.durationSec ?? '600', 10);
  const intervalSec = parseInt(params.intervalSec ?? '10', 10);
  const speechRate = parseFloat(params.speechRate ?? '1');
  const retestWords = params.retestWords ? (JSON.parse(params.retestWords) as string[]) : undefined;

  const categoryLabel = retestWords
    ? 'Retest'
    : params.category === 'Custom'
      ? params.customCategory?.trim() || 'Custom'
      : params.category;
  const difficultyLabel = retestWords ? 'Review' : params.difficulty;

  const [timeRemainingSec, setTimeRemainingSec] = useState(durationSec);
  const [nextWordInSec, setNextWordInSec] = useState(0);
  const [spokenCount, setSpokenCount] = useState(0);
  const [replaysLeft, setReplaysLeft] = useState(1);
  const insets = useSafeAreaInsets();
  const [isPaused, setIsPaused] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [endConfirmModal, setEndConfirmModal] = useState(false);
  const [startErrorModal, setStartErrorModal] = useState(false);

  const tokenRef = useRef<CancelToken>({ cancelRequested: false, paused: false, replayRequested: false });
  const noticeRef = useRef<string>('');

  const estimatedWords = retestWords ? retestWords.length : Math.max(1, Math.floor(durationSec / intervalSec));

  const handleEndEarly = () => {
    setEndConfirmModal(true);
  };

  const sessionIdRef = useRef<number | null>(null);
  const finishedRef = useRef(false);

  const confirmEndEarly = () => {
    tokenRef.current.cancelRequested = true;
    tokenRef.current.paused = false;
    // If the runner is stuck (e.g. waiting on the network), leave the screen anyway
    setTimeout(() => {
      if (finishedRef.current || sessionIdRef.current == null) return;
      finishedRef.current = true;
      deactivateKeepAwake('session');
      router.replace({
        pathname: '/session/done',
        params: { sessionId: String(sessionIdRef.current), totalWords: String(spokenCount), durationActualSec: '1', error: '', notice: noticeRef.current },
      });
    }, 2500);
  };

  // Hardware back asks before ending the session
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleEndEarly();
      return true;
    });
    return () => sub.remove();
  }, []);

  // Create the session and run it as soon as the screen opens
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [apiKey, model] = await Promise.all([getApiKey(), getSetting('model')]);
        const sid = await createSession(
          durationSec,
          intervalSec,
          retestWords ? 'Retest Session' : categoryLabel,
          difficultyLabel
        );
        sessionIdRef.current = sid;
        setStarted(true);
        await activateKeepAwakeAsync('session').catch(() => { });

        await runSession(
          {
            sessionId: sid,
            durationSec,
            intervalSec,
            category: params.category,
            difficulty: params.difficulty,
            customCategoryText: params.customCategory,
            accent: params.accent,
            voiceId: params.voiceId || undefined,
            speechRate,
            apiKey: apiKey || undefined,
            model: model || undefined,
            words: retestWords,
          },
          tokenRef.current,
          {
            onTick: (rem, nxt) => {
              if (active) {
                setTimeRemainingSec(rem);
                setNextWordInSec(nxt);
              }
            },
            onWordSpoken: (pos) => {
              if (active) setSpokenCount(pos);
            },
            onReplaysLeft: (left) => {
              if (active) setReplaysLeft(left);
            },
            onNotice: (msg) => {
              noticeRef.current = msg;
              if (active) setNotice(msg);
            },
            onFinished: (result) => {
              if (!active || finishedRef.current) return;
              finishedRef.current = true;
              deactivateKeepAwake('session');
              router.replace({
                pathname: '/session/done',
                params: {
                  sessionId: String(sid),
                  totalWords: String(result.totalWords),
                  durationActualSec: String(result.durationActualSec),
                  error: result.error ?? '',
                  notice: noticeRef.current,
                },
              });
            },
          }
        );
      } catch (e) {
        console.error('Session start failed:', e);
        deactivateKeepAwake('session');
        setStartErrorModal(true);
        router.back();
      }
    })();
    return () => {
      active = false;
      tokenRef.current.cancelRequested = true;
      stopSpeech().catch(() => { });
      deactivateKeepAwake('session');
    };
    // The session is started exactly once for the params this screen was opened with
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTogglePause = () => {
    const next = !isPaused;
    setIsPaused(next);
    tokenRef.current.paused = next;
  };

  const handleRequestReplay = () => {
    if (replaysLeft > 0 && !isPaused) tokenRef.current.replayRequested = true;
  };

  const progress = Math.max(0, Math.min(1, 1 - nextWordInSec / (intervalSec || 1)));
  const dictating = !isPaused && nextWordInSec > intervalSec - 3;
  const noReplays = replaysLeft === 0;

  if (!started) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <AppHeader title="Active Dictation Session" onBack={() => router.back()} />
        <View style={styles.center}>
          <Txt variant="bodyMd" color="textSecondary">
            Preparing session…
          </Txt>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Active Dictation Session" onBack={handleEndEarly} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 110 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Meta bar */}
        <View style={[styles.metaBar, { backgroundColor: colors.containerLow }, Shadows.sm]}>
          <View style={styles.metaLeft}>
            <Image source={logo} style={styles.metaLogo} resizeMode="contain" />
            <Txt variant="labelSm" color="textSecondary" numberOfLines={1} style={styles.flex}>
              {categoryLabel} · {difficultyLabel} · {intervalSec}s Interval
            </Txt>
          </View>
          <View style={styles.metaRight}>
            <View style={[styles.dot, { backgroundColor: isPaused ? colors.outline : colors.secondary }]} />
            <Txt variant="labelSm" color={isPaused ? 'textSecondary' : 'secondary'} style={styles.semibold}>
              {isPaused ? 'Paused' : 'Active'}
            </Txt>
          </View>
        </View>

        {/* Metric pills */}
        <View style={styles.pills}>
          <MetricPill icon="schedule" label="Session" value={`${formatClock(durationSec)} total`} />
          <MetricPill icon="speed" label="Pacing" value={`${intervalSec}s pace`} />
          <MetricPill icon="format-list-numbered" label="Progress" value={`${spokenCount} / ${estimatedWords}`} accent />
        </View>

        {/* Focal card */}
        <Card radius={24} padding={24} elevation="md" style={styles.focal}>
          <Txt
            variant="displayLg"
            style={[styles.timer, { fontFamily: MONO, opacity: isPaused ? 0.6 : 1 }]}
          >
            {formatClock(timeRemainingSec)}
          </Txt>
          <Txt variant="labelSm" color="textSecondary" style={styles.upper}>
            Session Remaining
          </Txt>


          <View style={styles.controlRow}>
            <Pressable
              onPress={handleTogglePause}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.controlBtn,
                { backgroundColor: isPaused ? colors.secondary : colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Icon name={isPaused ? 'play-arrow' : 'pause'} size={18} color={isPaused ? colors.onSecondary : colors.onPrimary} />
              <Txt variant="labelSm" numberOfLines={2} color={isPaused ? colors.onSecondary : colors.onPrimary} style={[styles.semibold, styles.controlText]}>
                {isPaused ? 'Resume Practice' : 'Pause Practice'}
              </Txt>
            </Pressable>
            <Pressable
              onPress={handleEndEarly}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.controlBtn,
                { backgroundColor: colors.container, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Icon name="stop-circle" size={18} color="#FFFFFF" />
              <Txt variant="labelSm" numberOfLines={2} color="#FFFFFF" style={[styles.semibold, styles.controlText]}>
                End & Review Word List
              </Txt>
            </Pressable>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: colors.secondaryContainer }]}>
            <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
            <Txt variant="labelMd" color="onSecondaryContainer" style={styles.semibold}>
              {isPaused ? 'Paused' : dictating ? 'Audio Dictating...' : 'Write it down'}
            </Txt>
          </View>

          {/* Replay */}
          <Pressable
            onPress={handleRequestReplay}
            disabled={noReplays || isPaused}
            accessibilityRole="button"
            accessibilityLabel="Replay the current word"
            style={({ pressed }) => [styles.replayWrap, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
          >
            <View style={[styles.glow, { backgroundColor: colors.primaryFixedDim }]} />
            <View
              style={[
                styles.replay,
                { backgroundColor: colors.primaryContainer, opacity: noReplays || isPaused ? 0.6 : 1 },
                Shadows.md,
              ]}
            >
              <Icon name="volume-up" size={36} color="onPrimary" />
              <Txt variant="labelSm" color={colors.primaryFixed} style={styles.replayLabel}>
                Replay
              </Txt>
            </View>
          </Pressable>
          <View style={styles.repeatRow}>
            <Icon name="replay" size={16} color={noReplays ? 'error' : 'primary'} />
            <Txt variant="labelMd" color={noReplays ? 'error' : 'textSecondary'}>
              {noReplays ? 'No repeats remaining for this word' : 'Tap to repeat audio (1 repeat left)'}
            </Txt>
          </View>

          {/* Next word interval */}
          <View style={[styles.intervalBox, { backgroundColor: colors.containerLow }]}>
            <View style={styles.intervalHead}>
              <View style={styles.intervalLabel}>
                <Icon name="hourglass-top" size={18} color="secondary" />
                <Txt variant="labelMd" style={styles.semibold}>
                  Next Word Interval
                </Txt>
              </View>
              <Txt variant="labelMd" color="primary" style={styles.bold}>
                {Math.ceil(nextWordInSec)}s
              </Txt>
            </View>
            <View style={[styles.track, { backgroundColor: colors.containerHighest }]}>
              <View
                style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.primary }]}
              />
            </View>
          </View>
        </Card>

        {notice && (
          <Card tone="container" radius={16} padding={14} elevation="none">
            <Txt variant="labelMd" color="textSecondary">
              {notice}
            </Txt>
          </Card>
        )}

        {/* Pen & paper notice */}
        <Card tone="container" radius={16} padding={14} elevation="none" style={styles.noticeRow}>
          <View style={[styles.noticeIcon, { backgroundColor: colors.card }, Shadows.sm]}>
            <Icon name="edit-note" size={20} color="primary" />
          </View>
          <View style={styles.flex}>
            <Txt variant="labelMd" style={styles.semibold}>
              Write directly on your answer sheet
            </Txt>
            <Txt variant="bodyMd" color="textSecondary" style={styles.noticeBody}>
              Word spellings are strictly hidden during live practice to test auditory recall. Full transcript reveals
              upon session finish.
            </Txt>
          </View>
        </Card>

        {/* Acoustic channel */}
        <Card radius={16} padding={12} style={styles.channel}>
          <Txt variant="labelSm" color="textSecondary">
            Acoustic Audio Channel
          </Txt>
          <SoundBars active={!isPaused} />
        </Card>

      </ScrollView>

      {/* End session confirm */}
      <ErrorModal
        visible={endConfirmModal}
        title="End Session?"
        message="Finish now and see the full word list. Words spoken so far are saved."
        iconName="stop-circle"
        confirmLabel="End & Review"
        confirmDanger
        onConfirm={confirmEndEarly}
        onClose={() => setEndConfirmModal(false)}
      />

      {/* Session start error */}
      <ErrorModal
        visible={startErrorModal}
        title="Session Error"
        message="Could not start the session. Please try again."
        iconName="error-outline"
        onClose={() => setStartErrorModal(false)}
      />
    </View>
  );
}

function MetricPill(props: { icon: IconName; label: string; value: string; accent?: boolean }) {
  const colors = Colors[useColorScheme()];
  return (
    <View style={[styles.metric, { backgroundColor: colors.card }, Shadows.sm]}>
      <View style={styles.metricHead}>
        <Icon name={props.icon} size={15} color="textSecondary" />
        <Txt variant="labelSm" color="textSecondary">
          {props.label}
        </Txt>
      </View>
      <Txt variant="labelLg" color={props.accent ? 'primary' : 'text'} style={props.accent && styles.bold}>
        {props.value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  flex: { flex: 1 },
  controlRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 16, marginBottom: 8 },
  controlText: { flexShrink: 1, textAlign: 'center' },
  controlBtn: { flex: 1, minHeight: 52, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  stickyActions: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 12 },
  semibold: { fontFamily: 'Inter_600SemiBold' },
  bold: { fontFamily: 'Inter_700Bold' },
  upper: { textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 2 },
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  metaLogo: { width: 24, height: 24 },
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pills: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  metric: { flex: 1, padding: 10, borderRadius: 12, alignItems: 'center', gap: 2 },
  metricHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  focal: { alignItems: 'center' },
  timer: { fontSize: 44, lineHeight: 52, letterSpacing: 0 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    marginTop: 12,
    marginBottom: 20,
  },
  replayWrap: { width: 144, height: 144, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 144, height: 144, borderRadius: 72, opacity: 0.3 },
  replay: { width: 128, height: 128, borderRadius: 64, alignItems: 'center', justifyContent: 'center' },
  replayLabel: { marginTop: 4 },
  repeatRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  intervalBox: { alignSelf: 'stretch', padding: 14, borderRadius: 16, marginTop: 20 },
  intervalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  intervalLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  track: { height: 8, borderRadius: 9999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 9999 },
  noticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  noticeIcon: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  noticeBody: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  channel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  actions: { gap: 10, paddingTop: 4 },
  pauseButton: { height: 52 },
});
