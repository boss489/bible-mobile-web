import { findBookByOsis, formatVerseRef, getBookMeta, getMaxVerseInChapter } from '../config/books';
import type {
  CanonicalVerseId,
  CrossReferenceItem,
  CrossRefRelationType,
  ScriptureRef,
  TranslationId,
} from '../types/bible';

export interface ParsedVerseId {
  canonicalId: CanonicalVerseId;
  osis: string;
  book: number;
  chapter: number;
  verseStart: number;
  verseEnd: number;
}

const CANONICAL_RE = /^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:-(\d+))?$/;

const RELATION_PRIORITY: Readonly<Record<CrossRefRelationType, number>> = {
  DIRECT_QUOTE: 1,
  PROPHECY_FULFILLMENT: 2,
  PARALLEL_EVENT: 3,
  CONTEXT: 4,
  PERSON_EVENT: 5,
  THEME: 6,
};

export const RELATION_LABELS_KO: Readonly<Record<CrossRefRelationType, string>> = {
  DIRECT_QUOTE: '직접 인용',
  PROPHECY_FULFILLMENT: '예언·성취',
  PARALLEL_EVENT: '병행 사건',
  CONTEXT: '문맥 연결',
  PERSON_EVENT: '인물·사건',
  THEME: '주제 연결',
};

export function formatCanonicalVerseId(
  book: number,
  chapter: number,
  verseStart: number,
  verseEnd?: number,
): CanonicalVerseId {
  const meta = getBookMeta(book);
  if (meta.book !== book) {
    throw new Error(`유효하지 않은 성경 권 번호입니다: ${book}`);
  }
  const maxV = getMaxVerseInChapter(book, chapter);
  if (maxV === null || verseStart < 1 || verseStart > maxV) {
    throw new Error(`유효하지 않은 장·절 범위입니다: ${meta.osis}.${chapter}.${verseStart}`);
  }
  const end = verseEnd ?? verseStart;
  if (end < verseStart || end > maxV) {
    throw new Error(`유효하지 않은 끝 절 번호입니다: ${meta.osis}.${chapter}.${verseStart}-${end}`);
  }
  return end > verseStart
    ? `${meta.osis}.${chapter}.${verseStart}-${end}`
    : `${meta.osis}.${chapter}.${verseStart}`;
}

export function parseCanonicalVerseId(rawId: string): ParsedVerseId | null {
  if (typeof rawId !== 'string') return null;
  const trimmed = rawId.trim();
  const match = CANONICAL_RE.exec(trimmed);
  if (!match) return null;

  const bookMeta = findBookByOsis(match[1]);
  if (!bookMeta) return null;

  const chapter = Number(match[2]);
  const verseStart = Number(match[3]);
  const verseEnd = match[4] ? Number(match[4]) : verseStart;

  if (!Number.isInteger(chapter) || !Number.isInteger(verseStart) || !Number.isInteger(verseEnd)) {
    return null;
  }

  const maxVerse = getMaxVerseInChapter(bookMeta.book, chapter);
  if (maxVerse === null) return null;
  if (verseStart < 1 || verseEnd < verseStart || verseEnd > maxVerse) {
    return null;
  }

  const canonicalId =
    verseEnd > verseStart
      ? `${bookMeta.osis}.${chapter}.${verseStart}-${verseEnd}`
      : `${bookMeta.osis}.${chapter}.${verseStart}`;

  return {
    canonicalId,
    osis: bookMeta.osis,
    book: bookMeta.book,
    chapter,
    verseStart,
    verseEnd,
  };
}

export function isValidCanonicalVerseId(rawId: string): boolean {
  return parseCanonicalVerseId(rawId) !== null;
}

export function canonicalIdToScriptureRef(
  rawId: string,
  translation: TranslationId = 'kr',
  reason?: string,
): ScriptureRef | null {
  const parsed = parseCanonicalVerseId(rawId);
  if (!parsed) return null;
  return {
    book: parsed.book,
    chapter: parsed.chapter,
    verseStart: parsed.verseStart,
    verseEnd: parsed.verseEnd > parsed.verseStart ? parsed.verseEnd : undefined,
    label: formatVerseRef(
      parsed.book,
      parsed.chapter,
      parsed.verseStart,
      translation,
      parsed.verseEnd,
    ),
    reason,
  };
}

export function isSameOrContainingSelf(sourceVerseId: string, targetVerseId: string): boolean {
  const src = parseCanonicalVerseId(sourceVerseId);
  const tgt = parseCanonicalVerseId(targetVerseId);
  if (!src || !tgt) return false;
  if (src.book !== tgt.book || src.chapter !== tgt.chapter) return false;
  return src.verseStart <= tgt.verseEnd && tgt.verseStart <= src.verseEnd;
}

/**
 * F02 관련 말씀 품질 검증·정렬 필터:
 * 1. 검수 상태가 VERIFIED 인 항목만 통과
 * 2. source/target/evidence 구절 ID가 모두 실제 성경 범위 내에 존재하는지 검증
 * 3. 자기 자신 참조 및 중복 구절 제외
 * 4. 연결 사유(reason) 최소 길이 및 구체성 확인
 * 5. 관계 직접성 우선순위로 정렬 후 최대 maxItems(기본 5개)만 반환
 */
export function filterAndSortCrossReferences(
  sourceVerseId: string,
  candidates: readonly CrossReferenceItem[],
  maxItems = 5,
): CrossReferenceItem[] {
  const srcParsed = parseCanonicalVerseId(sourceVerseId);
  if (!srcParsed) return [];

  const seenTargets = new Set<string>();
  const valid: CrossReferenceItem[] = [];

  for (const item of candidates) {
    if (item.reviewStatus !== 'VERIFIED') continue;
    if (!(item.relationType in RELATION_PRIORITY)) continue;

    const tgtParsed = parseCanonicalVerseId(item.targetVerseId);
    if (!tgtParsed) continue;

    if (isSameOrContainingSelf(srcParsed.canonicalId, tgtParsed.canonicalId)) continue;
    if (seenTargets.has(tgtParsed.canonicalId)) continue;

    const reasonText = item.reason?.trim() ?? '';
    if (reasonText.length < 12) continue;

    if (
      !Array.isArray(item.evidenceVerseIds) ||
      item.evidenceVerseIds.length === 0 ||
      item.evidenceVerseIds.some((evId) => !isValidCanonicalVerseId(evId))
    ) {
      continue;
    }

    seenTargets.add(tgtParsed.canonicalId);
    valid.push({
      ...item,
      sourceVerseId: srcParsed.canonicalId,
      targetVerseId: tgtParsed.canonicalId,
    });
  }

  valid.sort((a, b) => RELATION_PRIORITY[a.relationType] - RELATION_PRIORITY[b.relationType]);
  return valid.slice(0, Math.max(0, maxItems));
}
