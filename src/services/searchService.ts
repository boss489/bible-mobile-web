import {
  BOOKS_LIST,
  findBookByOsis,
  formatVerseRef,
  getBookMeta,
  getChapterLabel,
  getMaxVerseInChapter,
} from '../config/books';
import type { BookMeta, TranslationId } from '../types/bible';

export type SearchVerseTuple = [book: number, chapter: number, verse: number, text: string];

export interface BibleSearchIndexPayload {
  version: number;
  translation: TranslationId;
  verses: SearchVerseTuple[];
}

export interface IndexedSearchVerse {
  book: number;
  chapter: number;
  verse: number;
  text: string;
  lowerText: string;
}

export type SearchScope = 'ALL' | 'OT' | 'NT' | 'CURRENT_BOOK';

export interface SearchExecutionResult {
  items: IndexedSearchVerse[];
  totalCount: number;
  otCount: number;
  ntCount: number;
  tokens: string[];
}

export interface ParsedScriptureReference {
  book: number;
  chapter: number;
  verse: number;
  isChapterOnly: boolean;
  labelKo: string;
  labelEn: string;
}

const searchIndexCache = new Map<TranslationId, Promise<IndexedSearchVerse[]>>();

export function clearSearchDataCache(): void {
  searchIndexCache.clear();
}

export function loadBibleSearchIndex(translation: TranslationId): Promise<IndexedSearchVerse[]> {
  const cached = searchIndexCache.get(translation);
  if (cached) return cached;

  const promise = fetch(`./data/bible/search-${translation}.json`).then(async (res) => {
    if (!res.ok) {
      throw new Error(`성경 검색 색인을 불러오지 못했습니다 (${translation}).`);
    }
    const payload = (await res.json()) as BibleSearchIndexPayload;
    return payload.verses.map(([book, chapter, verse, text]) => ({
      book,
      chapter,
      verse,
      text,
      lowerText: text.toLowerCase(),
    }));
  });

  searchIndexCache.set(translation, promise);
  promise.catch(() => {
    searchIndexCache.delete(translation);
  });
  return promise;
}

// 한국어·영문 책 이름 및 약어 매칭 테이블
const BOOK_LOOKUP_ENTRIES: readonly { key: string; meta: BookMeta }[] = (() => {
  const list: { key: string; meta: BookMeta }[] = [];
  for (const b of BOOKS_LIST) {
    const candidates = [
      b.nameKo,
      b.abbrKo,
      b.nameEn.toLowerCase(),
      b.nameEn.replace(/\s+/g, '').toLowerCase(),
      b.abbrEn.toLowerCase(),
    ];
    for (const c of candidates) {
      list.push({ key: c, meta: b });
    }
  }
  // 긴 이름 우선 매칭 (예: '요한복음'·'요한일서'가 '요'보다 먼저 매칭되도록 정렬)
  list.sort((a, b) => b.key.length - a.key.length);
  return list;
})();

function matchBookToken(rawBook: string): BookMeta | null {
  const cleaned = rawBook.trim().replace(/\.$/, '');
  if (!cleaned) return null;

  const lower = cleaned.toLowerCase();
  const compactLower = lower.replace(/\s+/g, '');

  for (const entry of BOOK_LOOKUP_ENTRIES) {
    if (entry.key === lower || entry.key === compactLower) {
      return entry.meta;
    }
  }

  const byOsis = findBookByOsis(compactLower);
  if (byOsis) return byOsis;

  return null;
}

const SCRIPTURE_REF_RE =
  /^([1-3]?\s*[A-Za-z가-힣.]+?)\s*(\d{1,3})\s*(?:장|편|:|\s)\s*(\d{1,3})?\s*(?:절)?$/;
const SCRIPTURE_CHAPTER_ONLY_RE = /^([1-3]?\s*[A-Za-z가-힣.]+?)\s*(\d{1,3})\s*(?:장|편)?$/;

/**
 * 검색창 입력이 '요 3:16', '창세기 1장 1절', '시편 23', 'John 3:16', '1 Cor 13:4' 등
 * 성경 장절 참조 형식일 경우 실제 존재하는 장·절인지 검증하여 반환한다.
 */
export function parseScriptureQuery(rawQuery: string): ParsedScriptureReference | null {
  const trimmed = rawQuery.trim();
  if (!trimmed) return null;

  let bookPart = '';
  let chapterNum = 0;
  let verseNum: number | null = null;

  const mFull = trimmed.match(SCRIPTURE_REF_RE);
  if (mFull && mFull[3]) {
    bookPart = mFull[1];
    chapterNum = Number(mFull[2]);
    verseNum = Number(mFull[3]);
  } else {
    const mChap = trimmed.match(SCRIPTURE_CHAPTER_ONLY_RE);
    if (!mChap) return null;
    bookPart = mChap[1];
    chapterNum = Number(mChap[2]);
  }

  const meta = matchBookToken(bookPart);
  if (!meta) return null;
  if (!Number.isInteger(chapterNum) || chapterNum < 1 || chapterNum > meta.chapters) {
    return null;
  }

  const maxVerse = getMaxVerseInChapter(meta.book, chapterNum);
  if (!maxVerse) return null;

  if (verseNum !== null) {
    if (!Number.isInteger(verseNum) || verseNum < 1 || verseNum > maxVerse) {
      return null;
    }
    return {
      book: meta.book,
      chapter: chapterNum,
      verse: verseNum,
      isChapterOnly: false,
      labelKo: formatVerseRef(meta.book, chapterNum, verseNum, 'kr'),
      labelEn: formatVerseRef(meta.book, chapterNum, verseNum, 'en'),
    };
  }

  return {
    book: meta.book,
    chapter: chapterNum,
    verse: 1,
    isChapterOnly: true,
    labelKo: getChapterLabel(meta.book, chapterNum, 'kr'),
    labelEn: getChapterLabel(meta.book, chapterNum, 'en'),
  };
}

export function tokenizeSearchQuery(rawQuery: string): string[] {
  const normalized = rawQuery.trim().toLowerCase();
  if (!normalized) return [];
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const part of normalized.split(/\s+/)) {
    if (part && !seen.has(part)) {
      seen.add(part);
      tokens.push(part);
    }
  }
  return tokens;
}

/**
 * 공백 구분 다중 키워드(AND) 성경 본문 검색.
 * 성경 정경 순서(창세기 -> 요한계시록)를 유지하며 범위 필터 및 구약·신약 건수를 함께 계산한다.
 */
export function searchBibleVerses(
  entries: readonly IndexedSearchVerse[],
  rawQuery: string,
  options?: {
    scope?: SearchScope;
    currentBook?: number | null;
  },
): SearchExecutionResult {
  const tokens = tokenizeSearchQuery(rawQuery);
  if (tokens.length === 0) {
    return { items: [], totalCount: 0, otCount: 0, ntCount: 0, tokens: [] };
  }

  const scope = options?.scope ?? 'ALL';
  const currentBook = options?.currentBook ?? null;

  const matched: IndexedSearchVerse[] = [];
  let otCount = 0;
  let ntCount = 0;

  const tokenCount = tokens.length;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // 모든 검색어 토큰이 해당 절에 포함되는지 검사 (AND 조건)
    let allMatched = true;
    for (let t = 0; t < tokenCount; t++) {
      if (!entry.lowerText.includes(tokens[t])) {
        allMatched = false;
        break;
      }
    }
    if (!allMatched) continue;

    // 구약/신약 전체 분포는 구약·신약 탭 뱃지 안내를 위해 함께 집계
    if (entry.book <= 39) otCount += 1;
    else ntCount += 1;

    if (scope === 'OT' && entry.book > 39) continue;
    if (scope === 'NT' && entry.book < 40) continue;
    if (scope === 'CURRENT_BOOK' && currentBook !== null && entry.book !== currentBook) {
      continue;
    }

    matched.push(entry);
  }

  return {
    items: matched,
    totalCount: matched.length,
    otCount,
    ntCount,
    tokens,
  };
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface HighlightSegment {
  text: string;
  highlighted: boolean;
}

/** XSS 위험 없이 안전하게 <mark> 렌더링할 수 있도록 텍스트를 검색어 기준 조각으로 분할한다. */
export function splitTextBySearchTokens(
  text: string,
  tokens: readonly string[],
): HighlightSegment[] {
  if (!text || tokens.length === 0) {
    return [{ text, highlighted: false }];
  }
  const sorted = [...tokens].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${sorted.map(escapeRegExp).join('|')})`, 'gi');
  const rawParts = text.split(pattern);
  const out: HighlightSegment[] = [];
  const tokenSet = new Set(sorted.map((t) => t.toLowerCase()));

  for (const part of rawParts) {
    if (!part) continue;
    out.push({
      text: part,
      highlighted: tokenSet.has(part.toLowerCase()),
    });
  }
  return out;
}

export function getBookTestamentBadge(book: number): string {
  const meta = getBookMeta(book);
  return meta.category;
}
