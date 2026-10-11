import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Txt } from '@/components/Txt';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatDurationLabel } from '@/lib/format';

export default function SessionDoneScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme()];
  const params = useLocalSearchParams<{
    sessionId: string;
    totalWords: string;
    durationActualSec: string;
    error?: string;
    notice?: string;
  }>();

  const sessionId = parseInt(params.sessionId ?? '0', 10);
  const totalWords = parseInt(params.totalWords ?? '0', 10);
  const durationActualSec = parseInt(params.durationActualSec ?? '0', 10);
  const errorMsg = params.error || null;
  const noticeMsg = params.notice || null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Session Complete" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card radius={24} padding={24} elevation="md" style={styles.card}>
          <View style={[styles.icon, { backgroundColor: colors.secondaryContainer }]}>
            <Icon name="check-circle" size={36} color="onSecondaryContainer" />
          </View>
          <Txt variant="headlineLg" style={styles.center}>
            Session Finished
          </Txt>
          <Txt variant="bodyMd" color="textSecondary" style={styles.center}>
            Your dictated list is saved and ready for handwriting review.
          </Txt>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Txt variant="headlineLg" color="primary">
                {totalWords}
              </Txt>
              <Txt variant="labelMd" color="textSecondary">
                Words Dictated
              </Txt>
            </View>
            <View style={styles.stat}>
              <Txt variant="headlineLg">{formatDurationLabel(durationActualSec)}</Txt>
              <Txt variant="labelMd" color="textSecondary">
                Total Time
              </Txt>
            </View>
          </View>

          {(errorMsg || noticeMsg) && (
            <Txt variant="labelMd" color={errorMsg ? 'error' : 'textSecondary'} style={styles.center}>
              {errorMsg ?? noticeMsg}
            </Txt>
          )}

          <PrimaryButton
            label="Verify Writing & Spell-Check"
            icon="spellcheck"
            onPress={() =>
              router.replace({
                pathname: '/session/spellcheck',
                params: { sessionId: String(sessionId) },
              })
            }
            style={styles.full}
          />
          <PrimaryButton
            label="View & Check Word List"
            icon="checklist"
            variant="tonal"
            onPress={() => router.replace('/(tabs)/history' as never)}
            style={styles.full}
          />
          <PrimaryButton
            label="Start New Session"
            variant="text"
            size="md"
            onPress={() => router.replace('/(tabs)' as never)}
            style={styles.full}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 24 },
  card: { alignItems: 'center', gap: 12, marginBottom: 0 },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  stats: { flexDirection: 'row', gap: 32, marginVertical: 8 },
  stat: { alignItems: 'center' },
  full: { alignSelf: 'stretch' },
});
