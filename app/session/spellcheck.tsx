import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Txt } from '@/components/Txt';
import { Colors, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { speakWord } from '@/lib/tts';
import { DEFAULT_ACCENT, DEFAULT_SPEECH_RATE } from '@/lib/constants';
import { getSetting } from '@/db/queries/settings';
import {
  getSession,
  getSessionWords,
  setWordMark,
  type SpokenWordItem,
} from '@/db/queries/sessions';

interface WordCheckResult {
  wordId: number;
  original: string;
  userTyped: string;
  isCorrect: boolean;
}

export default function WritingSpellCheckScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme()];
  const { sessionId: rawSessionId } = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = parseInt(rawSessionId ?? '0', 10);

  const [words, setWords] = useState<SpokenWordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userInputs, setUserInputs] = useState<Record<number, string>>({});
  const [results, setResults] = useState<WordCheckResult[] | null>(null);
  const [savingResults, setSavingResults] = useState(false);

  useEffect(() => {
    async function loadWords() {
      try {
        if (sessionId) {
          const list = await getSessionWords(sessionId);
          setWords(list);
        }
      } catch (err) {
        console.warn('Error loading words for spell check:', err);
      } finally {
        setLoading(false);
      }
    }
    loadWords();
  }, [sessionId]);

  const handleInputChange = (wordId: number, text: string) => {
    setUserInputs((prev) => ({
      ...prev,
      [wordId]: text,
    }));
  };

  const handleHearWord = async (word: string) => {
    try {
      const [rate, accent, voice] = await Promise.all([
        getSetting('speechRate'),
        getSetting('accent'),
        getSetting('voiceId'),
      ]);
      const speechRate = rate ? parseFloat(rate) : DEFAULT_SPEECH_RATE;
      const accentVal = accent || DEFAULT_ACCENT;
      await speakWord(word, {
        accent: accentVal,
        rate: speechRate,
        voiceId: voice || undefined,
      });
    } catch (e) {
      console.warn('Play word error:', e);
    }
  };

  const handleGradeQuiz = async () => {
    setSavingResults(true);
    const calculatedResults: WordCheckResult[] = words.map((w) => {
      const typed = (userInputs[w.id] ?? '').trim().toLowerCase();
      const target = w.word.trim().toLowerCase();
      const isCorrect = typed === target;
      return {
        wordId: w.id,
        original: w.word,
        userTyped: userInputs[w.id] ?? '',
        isCorrect,
      };
    });

    setResults(calculatedResults);

    // Save marks to database so retesting tracks accurately
    try {
      await Promise.all(
        calculatedResults.map((res) =>
          setWordMark(res.wordId, res.isCorrect ? 'correct' : 'retest')
        )
      );
    } catch (e) {
      console.warn('Failed to save auto marks:', e);
    } finally {
      setSavingResults(false);
    }
  };

  const correctCount = results ? results.filter((r) => r.isCorrect).length : 0;
  const scorePercent =
    words.length > 0 && results
      ? Math.round((correctCount / words.length) * 100)
      : 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <AppHeader
        title="Spelling & Writing Check"
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        <Card radius={20} padding={18} elevation="sm" style={styles.banner}>
          <View style={[styles.bannerIcon, { backgroundColor: colors.primaryContainer }]}>
            <Icon name="spellcheck" size={24} color="primary" />
          </View>
          <View style={styles.bannerText}>
            <Txt variant="headlineMd">
              {results ? 'Writing Quiz Results' : 'Verify Your Written Words'}
            </Txt>
            <Txt variant="bodyMd" color="textSecondary">
              {results
                ? `You scored ${correctCount} out of ${words.length} correct (${scorePercent}%)`
                : 'Type what you wrote during the dictation audio to automatically check accuracy.'}
            </Txt>
          </View>
        </Card>

        {/* Results summary score card when graded */}
        {results && (
          <Card
            radius={20}
            padding={20}
            elevation="md"
            style={[
              styles.scoreCard,
              {
                backgroundColor:
                  scorePercent >= 80
                    ? colors.secondaryContainer
                    : colors.errorContainer,
              },
            ]}
          >
            <View style={styles.scoreRow}>
              <View>
                <Txt variant="headlineLg" style={{ fontWeight: '800' }}>
                  {scorePercent}%
                </Txt>
                <Txt variant="labelMd" color="textSecondary">
                  Overall Accuracy
                </Txt>
              </View>
              <View style={styles.statBadges}>
                <View
                  style={[
                    styles.badgePill,
                    { backgroundColor: colors.secondary },
                  ]}
                >
                  <Txt variant="labelSm" style={{ color: '#fff', fontWeight: '700' }}>
                    ✓ {correctCount} Correct
                  </Txt>
                </View>
                <View
                  style={[
                    styles.badgePill,
                    { backgroundColor: colors.error },
                  ]}
                >
                  <Txt variant="labelSm" style={{ color: '#fff', fontWeight: '700' }}>
                    ✕ {words.length - correctCount} Misspelled
                  </Txt>
                </View>
              </View>
            </View>
          </Card>
        )}

        {/* Word inputs or review items */}
        <Txt variant="labelSm" color="textSecondary" style={styles.sectionHeader}>
          {results ? 'WORD-BY-WORD BREAKDOWN' : 'TYPE SPELLINGS BELOW'}
        </Txt>

        {loading ? (
          <Txt variant="bodyMd" color="textSecondary" style={styles.centerText}>
            Loading session words...
          </Txt>
        ) : words.length === 0 ? (
          <Txt variant="bodyMd" color="textSecondary" style={styles.centerText}>
            No words recorded in this session.
          </Txt>
        ) : (
          words.map((item, index) => {
            const result = results ? results[index] : null;

            return (
              <View
                key={item.id}
                style={[
                  styles.wordRowCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: result
                      ? result.isCorrect
                        ? colors.secondary
                        : colors.error
                      : colors.outlineVariant,
                  },
                  Shadows.sm,
                ]}
              >
                <View style={styles.rowTop}>
                  <View style={styles.positionBadge}>
                    <Txt variant="labelSm" color="textSecondary" style={styles.bold}>
                      #{String(item.position).padStart(2, '0')}
                    </Txt>
                  </View>

                  <Pressable
                    onPress={() => handleHearWord(item.word)}
                    style={[styles.audioBtn, { backgroundColor: colors.containerLow }]}
                    accessibilityRole="button"
                    accessibilityLabel="Hear pronunciation"
                  >
                    <Icon name="volume-up" size={18} color="primary" />
                    <Txt variant="labelSm" color="primary" style={{ marginLeft: 4 }}>
                      Hear Audio
                    </Txt>
                  </Pressable>

                  {result && (
                    <View
                      style={[
                        styles.gradeBadge,
                        {
                          backgroundColor: result.isCorrect
                            ? colors.secondaryContainer
                            : colors.errorContainer,
                        },
                      ]}
                    >
                      <Icon
                        name={result.isCorrect ? 'check-circle' : 'cancel'}
                        size={16}
                        color={result.isCorrect ? 'secondary' : 'error'}
                      />
                      <Txt
                        variant="labelSm"
                        style={{
                          fontWeight: '700',
                          color: result.isCorrect
                            ? colors.secondary
                            : colors.error,
                          marginLeft: 4,
                        }}
                      >
                        {result.isCorrect ? 'Correct' : 'Missed'}
                      </Txt>
                    </View>
                  )}
                </View>

                {/* Input Field or Result Display */}
                {!results ? (
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[
                        styles.spellingInput,
                        {
                          backgroundColor: colors.containerLow,
                          color: colors.text,
                          borderColor: colors.outlineVariant,
                        },
                      ]}
                      placeholder="Type the word you wrote..."
                      placeholderTextColor={colors.outline}
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={userInputs[item.id] || ''}
                      onChangeText={(val) => handleInputChange(item.id, val)}
                    />
                  </View>
                ) : (
                  <View style={styles.resultDetails}>
                    <View style={styles.resultItem}>
                      <Txt variant="labelSm" color="textSecondary">
                        Correct Word:
                      </Txt>
                      <Txt variant="headlineMd" style={styles.targetWord}>
                        {item.word}
                      </Txt>
                    </View>
                    <View style={styles.resultItem}>
                      <Txt variant="labelSm" color="textSecondary">
                        Your Input:
                      </Txt>
                      <Txt
                        variant="headlineMd"
                        style={[
                          styles.typedWord,
                          {
                            color: result?.isCorrect
                              ? colors.secondary
                              : colors.error,
                            textDecorationLine: !result?.isCorrect
                              ? 'line-through'
                              : 'none',
                          },
                        ]}
                      >
                        {result?.userTyped.trim() || '(empty)'}
                      </Txt>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          {!results ? (
            <PrimaryButton
              label={savingResults ? 'Checking...' : 'Check Spelling & Grade'}
              icon="fact-check"
              disabled={savingResults || words.length === 0}
              onPress={handleGradeQuiz}
              style={styles.fullWidth}
            />
          ) : (
            <>
              <PrimaryButton
                label="View Session Word List"
                icon="checklist"
                onPress={() =>
                  router.replace({
                    pathname: '/session/[id]',
                    params: { id: String(sessionId) },
                  })
                }
                style={styles.fullWidth}
              />
              <PrimaryButton
                label="Retry Spell Check"
                variant="tonal"
                icon="refresh"
                onPress={() => setResults(null)}
                style={styles.fullWidth}
              />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  bannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
    gap: 2,
  },
  scoreCard: {
    marginVertical: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  badgePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  sectionHeader: {
    letterSpacing: 1.2,
    fontWeight: '700',
    marginTop: 8,
  },
  centerText: {
    textAlign: 'center',
    paddingVertical: 24,
  },
  wordRowCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 12,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  positionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  bold: {
    fontWeight: '700',
  },
  audioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  gradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  inputContainer: {
    marginTop: 2,
  },
  spellingInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  resultDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  resultItem: {
    gap: 2,
  },
  targetWord: {
    fontWeight: '700',
  },
  typedWord: {
    fontWeight: '600',
  },
  actions: {
    gap: 12,
    marginTop: 12,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
});
