import type { IconName } from '@/components/Icon';

const ICONS: Record<string, IconName> = {
  'IELTS Listening': 'headset',
  Education: 'school',
  Accommodation: 'home',
  Transport: 'directions-bus',
  Work: 'work',
  Places: 'place',
  Names: 'badge',
  Custom: 'edit',
  'My Text': 'upload-file',
  Adaptive: 'auto-awesome',
};

/** "Adaptive → Transport" uses the resolved category. */
export function categoryIcon(label: string): IconName {
  const base = label.split('→').pop()!.trim();
  return ICONS[base] ?? 'spellcheck';
}

export function baseCategory(label: string): string {
  return label.split('→').pop()!.trim();
}
