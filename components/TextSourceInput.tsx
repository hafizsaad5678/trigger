import { PrimaryButton } from '@/components/PrimaryButton';
import { Txt } from '@/components/Txt';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { extractWordsFromText } from '@/lib/textWords';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

interface Props {
  value: string;
  onChange: (text: string) => void;
}

/** Paste text or upload a .txt file; the words found in it become the session's word list. */
export function TextSourceInput({ value, onChange }: Props) {
  const colors = Colors[useColorScheme()];
  const [error, setError] = useState<string | null>(null);
  const count = extractWordsFromText(value).length;

  const handleUpload = async () => {
    setError(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const content = await new File(res.assets[0].uri).text();
      onChange(content);
    } catch {
      setError('Could not read that file. Please choose a plain .txt file.');
    }
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        style={[
          styles.input,
          { backgroundColor: colors.containerLow, color: colors.text, borderColor: colors.outlineVariant },
        ]}
        placeholder="Paste your text or word list here (words separated by spaces, commas or new lines)"
        placeholderTextColor={colors.outline}
        value={value}
        onChangeText={(t) => {
          setError(null);
          onChange(t);
        }}
        multiline
        textAlignVertical="top"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Txt variant="labelSm" color="textSecondary" style={styles.count}>
        {count > 0 ? `${count} unique words found` : 'No words yet'}
      </Txt>
      {error && (
        <Txt variant="labelSm" style={{ color: colors.error, marginTop: 4 }}>
          {error}
        </Txt>
      )}
      <View style={styles.row}>
        <PrimaryButton label="Upload .txt" variant="secondary" icon="upload-file" onPress={handleUpload} style={{ flex: 1 }} />
        {value.length > 0 && (
          <PrimaryButton label="Clear" variant="ghost" onPress={() => onChange('')} style={{ flex: 1 }} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  input: {
    minHeight: 120,
    maxHeight: 220,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  count: { marginTop: 6, marginLeft: 2 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
});
