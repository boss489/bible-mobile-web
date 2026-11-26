import { formatVerseRef } from '../config/books';
import type {
  ChapterData,
  TranslationComparisonResult,
  TranslationNote,
  VerseItem,
  VersificationAlignmentKind,
} from '../types/bible';
import { formatCanonicalVerseId } from '../utils/verseId';

interface SpecialAlignmentRule {
  book: number;
  chapter: number;
  matchVerses: readonly number[];
  krVerseNums: readonly number[];
  enVerseNums: readonly number[];
  extraEnChapter13Verse1?: boolean;
  kind: VersificationAlignmentKind;
  notice: string;
}

/**
 * 보유 개역개정(kornkrv.lfa) 및 NIV(engNIV.lfa) 전수 대조를 통해 확정된
 * 역본 간 절 구분·누락 특수 정렬 규칙.
 */
const SPECIAL_ALIGNMENTS: readonly SpecialAlignmentRule[] = [
  {
    book: 47,
    chapter: 13,
    matchVerses: [11],
    krVerseNums: [11],
    enVerseNums: [11, 12],
    kind: 'VERSE_SPLIT_SHIFT',
    notice:
      '개역개정 고린도후서 13:11 말미("거룩하게 입맞춤으로 서로 문안하라")가 NIV에서는 13:12로 분리되어 있어 NIV 11–12절을 함께 대조합니다.',
  },
  {
    book: 47,
    chapter: 13,
    matchVerses: [12],
    krVerseNums: [12],
    enVerseNums: [13],
    kind: 'VERSE_SPLIT_SHIFT',
    notice:
      '고린도후서 13장 후반부 절 구분 전통 차이로 개역개정 13:12("모든 성도가 너희에게 문안하느니라")는 NIV 13:13에 대응합니다.',
  },
  {
    book: 47,
    chapter: 13,
    matchVerses: [13, 14],
    krVerseNums: [13],
    enVerseNums: [14],
    kind: 'VERSE_SPLIT_SHIFT',
    notice:
      '고린도후서 13장 절 구분 전통 차이로 사도 바울의 축도 본문은 개역개정 13:13과 NIV 13:14가 서로 대응합니다.',
  },
  {
    book: 64,
    chapter: 1,
    matchVerses: [14, 15],
    krVerseNums: [14, 15],
    enVerseNums: [14],
    kind: 'VERSE_SPLIT_SHIFT',
    notice:
      '개역개정 요한삼서 1:14–15 두 절의 문안 인사가 NIV에서는 1:14 한 절로 통합되어 있어 두 절을 함께 대조합니다.',
  },
  {
    book: 66,
    chapter: 12,
    matchVerses: [17],
    krVerseNums: [17],
    enVerseNums: [17],
    extraEnChapter13Verse1: true,
    kind: 'VERSE_SPLIT_SHIFT',
    notice:
      '개역개정 요한계시록 12:17 끝 구절("바다 모래 위에 서 있더라")은 NIV에서 13:1 첫 문장("And the dragon stood on the shore of the sea.")으로 배치되어 있습니다.',
  },
  {
    book: 66,
    chapter: 13,
    matchVerses: [1],
    krVerseNums: [1],
    enVerseNums: [1],
    kind: 'VERSE_SPLIT_SHIFT',
    notice:
      'NIV 요한계시록 13:1 첫 문장("And the dragon stood on the shore of the sea.")은 개역개정에서 앞 장 마지막 절(12:17 말미)에 수록되어 있습니다.',
  },
  {
    book: 26,
    chapter: 16,
    matchVerses: [63],
    krVerseNums: [62],
    enVerseNums: [63],
    kind: 'MISSING_SOURCE_DATA',
    notice:
      '개역개정 보유 원본 데이터(kornkrv.lfa)에 에스겔 16:63이 수록되어 있지 않아 직전 문맥 구절(16:62)을 참고용으로 함께 표시합니다.',
  },
];

function pickVerses(chapterData: ChapterData | null, nums: readonly number[]): VerseItem[] {
  if (!chapterData) return [];
  const targetSet = new Set(nums);
  return chapterData.verses.filter((v) => targetSet.has(v.verse));
}

function formatRangeLabel(
  book: number,
  chapter: number,
  nums: readonly number[],
  translation: 'kr' | 'en',
): string {
  if (nums.length === 0) {
    return formatVerseRef(book, chapter, 1, translation);
  }
  const first = nums[0];
  const last = nums[nums.length - 1];
  return formatVerseRef(book, chapter, first, translation, last > first ? last : undefined);
}

/**
 * 동일 구절(book, chapter, verse)에 대해 개역개정(kr)과 NIV(en) 장 데이터를 받아
 * 절 번호 어긋남·사본상 (없음)·누락 구절을 보정한 역본 대조 결과를 생성한다.
 */
export function buildTranslationComparison(params: {
  book: number;
  chapter: number;
  verse: number;
  activeTranslation?: 'kr' | 'en';
  krChapter: ChapterData | null;
  enChapter: ChapterData | null;
  notes?: readonly TranslationNote[];
}): TranslationComparisonResult {
  const { book, chapter, verse, activeTranslation, krChapter, enChapter, notes = [] } = params;
  const verseId = formatCanonicalVerseId(book, chapter, verse);
  const verifiedNotes = notes.filter((n) => n.reviewStatus === 'VERIFIED');

  // 고린도후서 13장 NIV 기준으로 12절 또는 13절을 보고 있을 때의 역방향 매칭 보정:
  // - NIV 13:12 -> 개역개정 13:11에 대응
  // - NIV 13:13 -> 개역개정 13:12에 대응
  if (book === 47 && chapter === 13 && activeTranslation === 'en') {
    if (verse === 12) {
      return {
        verseId,
        book,
        chapter,
        requestedVerse: verse,
        alignmentKind: 'VERSE_SPLIT_SHIFT',
        alignmentNotice:
          'NIV 고린도후서 13:12("Greet one another with a holy kiss.")은 개역개정 13:11 마지막 문장에 포함되어 있어 개역개정 13:11과 대조합니다.',
        krLabel: formatRangeLabel(book, chapter, [11], 'kr'),
        enLabel: formatRangeLabel(book, chapter, [11, 12], 'en'),
        krVerses: pickVerses(krChapter, [11]),
        enVerses: pickVerses(enChapter, [11, 12]),
        notes: verifiedNotes,
      };
    }
    if (verse === 13) {
      return {
        verseId,
        book,
        chapter,
        requestedVerse: verse,
        alignmentKind: 'VERSE_SPLIT_SHIFT',
        alignmentNotice:
          '고린도후서 13장 절 구분 전통 차이로 NIV 13:13("All the saints send their greetings.")은 개역개정 13:12에 대응합니다.',
        krLabel: formatRangeLabel(book, chapter, [12], 'kr'),
        enLabel: formatRangeLabel(book, chapter, [13], 'en'),
        krVerses: pickVerses(krChapter, [12]),
        enVerses: pickVerses(enChapter, [13]),
        notes: verifiedNotes,
      };
    }
  }

  const rule = SPECIAL_ALIGNMENTS.find(
    (r) => r.book === book && r.chapter === chapter && r.matchVerses.includes(verse),
  );

  if (rule) {
    return {
      verseId,
      book,
      chapter,
      requestedVerse: verse,
      alignmentKind: rule.kind,
      alignmentNotice: rule.notice,
      krLabel: formatRangeLabel(book, chapter, rule.krVerseNums, 'kr'),
      enLabel: formatRangeLabel(book, chapter, rule.enVerseNums, 'en'),
      krVerses: pickVerses(krChapter, rule.krVerseNums),
      enVerses: pickVerses(enChapter, rule.enVerseNums),
      notes: verifiedNotes,
    };
  }

  const krExact = pickVerses(krChapter, [verse]);
  const enExact = pickVerses(enChapter, [verse]);
  const isKrOmitted = krExact.some((v) => v.isOmitted);

  let alignmentKind: VersificationAlignmentKind = 'EXACT';
  let alignmentNotice: string | null = null;

  if (isKrOmitted) {
    alignmentKind = 'OMITTED_MANUSCRIPT';
    alignmentNotice =
      "개역개정은 초기 유력 그리스어 사본 전승에 따라 이 절 본문을 '(없음)'으로 표기하며, 보유 NIV(1984년판) 데이터에는 후기 전통 사본 계열의 문장이 수록되어 있습니다.";
  } else if (krChapter?.missingVerses?.includes(verse) || (krExact.length === 0 && enExact.length > 0)) {
    alignmentKind = 'MISSING_SOURCE_DATA';
    alignmentNotice = '개역개정 보유 데이터에 해당 절 번호가 수록되어 있지 않습니다.';
  } else if (enExact.length === 0 && krExact.length > 0) {
    alignmentKind = 'VERSE_SPLIT_SHIFT';
    alignmentNotice = 'NIV 보유 데이터에 해당 절 번호가 분리 수록되어 있지 않습니다.';
  }

  return {
    verseId,
    book,
    chapter,
    requestedVerse: verse,
    alignmentKind,
    alignmentNotice,
    krLabel: formatRangeLabel(book, chapter, [verse], 'kr'),
    enLabel: formatRangeLabel(book, chapter, [verse], 'en'),
    krVerses: krExact,
    enVerses: enExact,
    notes: verifiedNotes,
  };
}
