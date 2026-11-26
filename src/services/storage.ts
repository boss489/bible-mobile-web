import { DEFAULT_FONT_SIZE, ENTRY_PASSWORD_SHA256 } from '../config/siteConfig';
import type {
  FontSizeLevel,
  PersonalRecord,
  PersonalRecordType,
  ReadingPosition,
  TranslationId,
} from '../types/bible';

const KEYS = {
  UNLOCKED_HASH: 'bible_web_v1:unlocked_hash',
  LAST_READ: 'bible_web_v1:last_read',
  FONT_SIZE: 'bible_web_v1:font_size',
  RECORDS: 'bible_web_v1:records',
} as const;

const memoryFallback = new Map<string, string>();

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memoryFallback.set(key, value);
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    memoryFallback.delete(key);
  }
}

export function isSessionUnlocked(expectedHash: string = ENTRY_PASSWORD_SHA256): boolean {
  return safeGet(KEYS.UNLOCKED_HASH) === expectedHash.toLowerCase();
}

export function saveUnlockedSession(expectedHash: string = ENTRY_PASSWORD_SHA256): void {
  safeSet(KEYS.UNLOCKED_HASH, expectedHash.toLowerCase());
}

export function clearUnlockedSession(): void {
  safeRemove(KEYS.UNLOCKED_HASH);
}

export function loadLastReadPosition(): ReadingPosition | null {
  const raw = safeGet(KEYS.LAST_READ);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ReadingPosition>;
    if (
      (parsed.translation === 'kr' || parsed.translation === 'en') &&
      typeof parsed.book === 'number' &&
      parsed.book >= 1 &&
      parsed.book <= 66 &&
      typeof parsed.chapter === 'number' &&
      parsed.chapter >= 1 &&
      typeof parsed.verse === 'number' &&
      parsed.verse >= 1
    ) {
      return parsed as ReadingPosition;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveLastReadPosition(pos: ReadingPosition): void {
  safeSet(KEYS.LAST_READ, JSON.stringify(pos));
}

export function loadFontSize(): FontSizeLevel {
  const raw = safeGet(KEYS.FONT_SIZE);
  const num = Number(raw);
  if (num >= 1 && num <= 5) {
    return num as FontSizeLevel;
  }
  return DEFAULT_FONT_SIZE;
}

export function saveFontSize(level: FontSizeLevel): void {
  safeSet(KEYS.FONT_SIZE, String(level));
}

export function makeRecordId(
  type: PersonalRecordType,
  book: number,
  chapter: number,
  verse: number,
): string {
  return `${type}:${book}:${chapter}:${verse}`;
}

export function loadPersonalRecords(): PersonalRecord[] {
  const raw = safeGet(KEYS.RECORDS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PersonalRecord =>
        item &&
        typeof item.id === 'string' &&
        (item.type === 'bookmark' || item.type === 'underline') &&
        (item.translation === 'kr' || item.translation === 'en') &&
        typeof item.book === 'number' &&
        typeof item.chapter === 'number' &&
        typeof item.verse === 'number' &&
        typeof item.previewText === 'string',
    );
  } catch {
    return [];
  }
}

export function togglePersonalRecord(
  current: PersonalRecord[],
  params: {
    type: PersonalRecordType;
    translation: TranslationId;
    book: number;
    chapter: number;
    verse: number;
    previewText: string;
  },
): PersonalRecord[] {
  const id = makeRecordId(params.type, params.book, params.chapter, params.verse);
  const exists = current.some((r) => r.id === id);
  const next = exists
    ? current.filter((r) => r.id !== id)
    : [
        {
          id,
          type: params.type,
          translation: params.translation,
          book: params.book,
          chapter: params.chapter,
          verse: params.verse,
          previewText: params.previewText,
          createdAt: Date.now(),
        },
        ...current,
      ];
  safeSet(KEYS.RECORDS, JSON.stringify(next));
  return next;
}

export function removePersonalRecord(current: PersonalRecord[], id: string): PersonalRecord[] {
  const next = current.filter((r) => r.id !== id);
  safeSet(KEYS.RECORDS, JSON.stringify(next));
  return next;
}
