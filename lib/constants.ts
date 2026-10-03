export const CATEGORIES = [
  'IELTS Listening',
  'Education',
  'Accommodation',
  'Transport',
  'Work',
  'Places',
  'Names',
  'Custom',
  'My Text',
  'Adaptive',
] as const;

/** Categories the AI can be asked about directly (everything except the two meta options). */
export const CONCRETE_CATEGORIES = CATEGORIES.filter((c) => c !== 'Custom' && c !== 'My Text' && c !== 'Adaptive');

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Adaptive'] as const;

export const DURATIONS = [10, 20, 30, 60] as const; // minutes
export const INTERVALS = [5, 10, 15, 30] as const; // seconds

export interface AccentOption {
  id: 'en-GB' | 'en-US' | 'en-AU';
  label: string;
  region: string;
  official?: boolean;
}

export const ACCENTS: AccentOption[] = [
  { id: 'en-GB', label: 'British English (RP)', region: 'Recommended for standard IELTS Part 1-4', official: true },
  { id: 'en-US', label: 'American English', region: 'North American intonation clarity' },
  { id: 'en-AU', label: 'Australian English', region: 'Common in IDP listening modules' },
];

export const DEFAULT_DURATION_MIN = 10;
export const DEFAULT_INTERVAL_SEC = 10;
export const DEFAULT_CATEGORY = 'IELTS Listening';
export const DEFAULT_DIFFICULTY = 'Medium';
export const DEFAULT_ACCENT = 'en-GB';

export const DEFAULT_SPEECH_RATE = 1.0;
export const CADENCE_RATES = [0.85, 1.0, 1.15] as const;
export const SPEECH_RATES = [0.75, 0.85, 1.0, 1.15, 1.25, 1.5] as const;
export const MIN_SPEECH_RATE = 0.75;
export const MAX_SPEECH_RATE = 1.5;

