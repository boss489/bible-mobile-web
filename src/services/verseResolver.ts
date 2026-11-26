import { getTranslationLabel } from '../config/books';
import type { ChapterData, TranslationId, VerseItem } from '../types/bible';

export interface VerseResolutionResult {
  resolvedVerse: number;
  notice: string | null;
}

function findNearestSubstantiveVerse(verses: VerseItem[], targetVerse: number): number {
  const substantive = verses.filter((v) => !v.isOmitted);
  const pool = substantive.length > 0 ? substantive : verses;
  if (pool.length === 0) return 1;

  let best = pool[0].verse;
  let bestDist = Math.abs(best - targetVerse);

  for (const item of pool) {
    const dist = Math.abs(item.verse - targetVerse);
    if (dist < bestDist || (dist === bestDist && item.verse < best)) {
      best = item.verse;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * 번역본 전환 또는 절 이동 시 대상 장 데이터에서 절 번호를 검증한다.
 * - 고린도후서 13:12–13(개역개정) → NIV 전환 시 절 구분 밀림(13:13–14)을 의미 기준으로 보정한다.
 * - 해당 절 번호가 다른 번역본에 없거나 사본상 '(없음)'으로 표기된 경우
 *   차이를 안내하는 문구와 같은 장의 인접 구절 번호를 반환한다.
 */
export function resolveVerseInChapter(
  chapterData: ChapterData,
  desiredVerse: number,
  options?: { isTranslationSwitch?: boolean },
): VerseResolutionResult {
  const trLabel = getTranslationLabel(chapterData.translation as TranslationId);

  // 고린도후서 13장 개역개정(12, 13절) -> NIV(13, 14절) 전환 시 의미 정렬 보정
  if (
    options?.isTranslationSwitch &&
    chapterData.translation === 'en' &&
    chapterData.book === 47 &&
    chapterData.chapter === 13 &&
    (desiredVerse === 12 || desiredVerse === 13)
  ) {
    const mapped = desiredVerse + 1;
    const hasMapped = chapterData.verses.some((v) => v.verse === mapped);
    if (hasMapped) {
      return {
        resolvedVerse: mapped,
        notice: `고린도후서 13장 절 구분 차이로 개역개정 ${desiredVerse}절에 대응하는 NIV ${mapped}절을 표시합니다.`,
      };
    }
  }

  const exact = chapterData.verses.find((v) => v.verse === desiredVerse);

  if (exact && !exact.isOmitted) {
    return { resolvedVerse: exact.verse, notice: null };
  }

  const adjacentVerse = findNearestSubstantiveVerse(chapterData.verses, desiredVerse);

  if (exact && exact.isOmitted) {
    return {
      resolvedVerse: adjacentVerse,
      notice: options?.isTranslationSwitch
        ? `${trLabel}에서는 사본 전승 차이로 ${desiredVerse}절 본문이 '(없음)'으로 표기되어 있어 같은 장의 인접 구절(${adjacentVerse}절)을 함께 표시합니다.`
        : `${trLabel} ${desiredVerse}절은 사본상 '(없음)' 구절이어서 인접 구절(${adjacentVerse}절)과 함께 표시합니다.`,
    };
  }

  if (chapterData.missingVerses?.includes(desiredVerse)) {
    return {
      resolvedVerse: adjacentVerse,
      notice: `${trLabel} 보유 데이터에 ${desiredVerse}절이 수록되어 있지 않아 같은 장의 인접 구절(${adjacentVerse}절)을 표시합니다.`,
    };
  }

  return {
    resolvedVerse: adjacentVerse,
    notice: `${trLabel}에는 번역본 간 절 구분 차이로 ${desiredVerse}절 번호가 없어 같은 장의 인접 구절(${adjacentVerse}절)을 표시합니다.`,
  };
}
