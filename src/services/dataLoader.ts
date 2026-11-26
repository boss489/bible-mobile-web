import { getAdjacentChapter } from '../config/books';
import { clearHistoryDataCache, loadBibleHistoryDataset } from './historyDataService';
import type {
  BookStudyBundle,
  ChapterCommentary,
  ChapterData,
  CommentaryIndex,
  ReadingFact,
  StudyIndex,
  TranslationId,
} from '../types/bible';

export { loadBibleHistoryDataset };

const chapterCache = new Map<string, Promise<ChapterData>>();
let commentaryIndexPromise: Promise<CommentaryIndex> | null = null;
let readingFactsPromise: Promise<Record<string, ReadingFact>> | null = null;
const chapterCommentaryCache = new Map<string, Promise<ChapterCommentary | null>>();
let studyIndexPromise: Promise<StudyIndex> | null = null;
const bookStudyCache = new Map<number, Promise<BookStudyBundle | null>>();

const EMPTY_STUDY_INDEX: StudyIndex = {
  contentVersion: 'empty',
  sources: {},
  booksWithStudy: [],
  studyVersesByChapter: {},
};

export function clearDataCaches(): void {
  chapterCache.clear();
  commentaryIndexPromise = null;
  readingFactsPromise = null;
  chapterCommentaryCache.clear();
  studyIndexPromise = null;
  bookStudyCache.clear();
  clearHistoryDataCache();
}

export function loadReadingFacts(): Promise<Record<string, ReadingFact>> {
  if (readingFactsPromise) return readingFactsPromise;
  readingFactsPromise = fetch('./data/reading-facts/index.json').then(async (res) =>
    res.ok ? (await res.json()) as Record<string, ReadingFact> : {},
  );
  readingFactsPromise.catch(() => { readingFactsPromise = null; });
  return readingFactsPromise;
}

export function loadChapterData(
  translation: TranslationId,
  book: number,
  chapter: number,
): Promise<ChapterData> {
  const key = `${translation}:${book}:${chapter}`;
  const cached = chapterCache.get(key);
  if (cached) return cached;

  const promise = fetch(`./data/bible/${translation}/${book}/${chapter}.json`).then(async (res) => {
    if (!res.ok) {
      throw new Error(`성경 본문 데이터를 불러오지 못했습니다 (${translation} ${book}:${chapter}).`);
    }
    return (await res.json()) as ChapterData;
  });

  chapterCache.set(key, promise);
  promise.catch(() => chapterCache.delete(key));
  return promise;
}

export function prefetchAdjacentChapters(
  translation: TranslationId,
  book: number,
  chapter: number,
): void {
  const prev = getAdjacentChapter(book, chapter, 'prev');
  const next = getAdjacentChapter(book, chapter, 'next');
  if (prev) {
    void loadChapterData(translation, prev.book, prev.chapter).catch(() => undefined);
  }
  if (next) {
    void loadChapterData(translation, next.book, next.chapter).catch(() => undefined);
  }
}

export function loadCommentaryIndex(): Promise<CommentaryIndex> {
  if (commentaryIndexPromise) return commentaryIndexPromise;
  commentaryIndexPromise = fetch('./data/commentary/index.json').then(async (res) => {
    if (!res.ok) {
      throw new Error('해설 색인 데이터를 불러오지 못했습니다.');
    }
    return (await res.json()) as CommentaryIndex;
  });
  commentaryIndexPromise.catch(() => {
    commentaryIndexPromise = null;
  });
  return commentaryIndexPromise;
}

export function loadChapterCommentary(
  book: number,
  chapter: number,
  knownKeys?: readonly string[],
): Promise<ChapterCommentary | null> {
  const key = `${book}_${chapter}`;
  if (knownKeys && !knownKeys.includes(key)) {
    return Promise.resolve(null);
  }
  const cached = chapterCommentaryCache.get(key);
  if (cached) return cached;

  const promise = fetch(`./data/commentary/chapters/${key}.json`).then(async (res) => {
    if (!res.ok) return null;
    return (await res.json()) as ChapterCommentary;
  });

  chapterCommentaryCache.set(key, promise);
  promise.catch(() => chapterCommentaryCache.delete(key));
  return promise;
}

export function loadStudyIndex(): Promise<StudyIndex> {
  if (studyIndexPromise) return studyIndexPromise;
  studyIndexPromise = fetch('./data/study/index.json').then(async (res) => {
    if (res.status === 404) {
      return EMPTY_STUDY_INDEX;
    }
    if (!res.ok) {
      throw new Error('본문 탐구 색인 데이터를 불러오지 못했습니다.');
    }
    return (await res.json()) as StudyIndex;
  });
  studyIndexPromise.catch(() => {
    studyIndexPromise = null;
  });
  return studyIndexPromise;
}

export function loadBookStudyBundle(
  book: number,
  knownBooks?: readonly number[],
): Promise<BookStudyBundle | null> {
  if (knownBooks && !knownBooks.includes(book)) {
    return Promise.resolve(null);
  }
  const cached = bookStudyCache.get(book);
  if (cached) return cached;

  const promise = fetch(`./data/study/books/${book}.json`).then(async (res) => {
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new Error(`본문 탐구 데이터를 불러오지 못했습니다 (권 번호: ${book}).`);
    }
    return (await res.json()) as BookStudyBundle;
  });

  bookStudyCache.set(book, promise);
  promise.catch(() => bookStudyCache.delete(book));
  return promise;
}
