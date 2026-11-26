import type {
  BibleHistoryDataset,
  ChapterHistoryMapping,
  DatePrecision,
  HistoricalPeriodKind,
  HistoricalRecordType,
  TimelineCategoryFilter,
  TimelineEra,
  TimelineItem,
  TimelineItemCategory,
} from '../types/history';

export const PERIOD_KIND_LABELS_KO: Readonly<Record<HistoricalPeriodKind, string>> = {
  polity_span: '존속 기간',
  reign: '통치·재위 기간',
  ministry: '활동·사역 기간',
  lifespan: '생존 기간',
  event: '사건 시점',
  narrative_time: '본문 사건 시점',
  composition_time: '본문 작성 시기',
};

export const DATE_PRECISION_LABELS_KO: Readonly<Record<DatePrecision, string>> = {
  confirmed: '확정 연대',
  estimated: '추정 연대',
  range: '범위·학설 병기',
  undetermined: '연대 미확정 (상대적 순서)',
};

export const RECORD_TYPE_LABELS_KO: Readonly<Record<HistoricalRecordType, string>> = {
  biblical_record: '성경 본문 기록',
  external_history: '신구약 중간기·외부 역사',
  epistle_background: '서신 작성·역사 배경',
};

export const CATEGORY_META: readonly {
  key: TimelineItemCategory;
  labelKo: string;
  shortLabelKo: string;
  defaultColor: string;
}[] = [
  { key: 'polity', labelKo: '왕국 · 제국', shortLabelKo: '왕국·제국', defaultColor: '#526b7a' },
  { key: 'ruler', labelKo: '왕 · 통치자', shortLabelKo: '왕·통치자', defaultColor: '#4c6f94' },
  {
    key: 'prophet_priest',
    labelKo: '선지자 · 사사 · 제사장',
    shortLabelKo: '선지자·사사',
    defaultColor: '#8f6b3e',
  },
  {
    key: 'person',
    labelKo: '사도 · 주요 인물',
    shortLabelKo: '사도·인물',
    defaultColor: '#2c6252',
  },
  {
    key: 'event',
    labelKo: '사건 · 전도여행 · 서신',
    shortLabelKo: '사건·서신',
    defaultColor: '#9a4d24',
  },
];

export interface ZoomPreset {
  index: number;
  labelKo: string;
  pxPerYear: number;
  primevalWidthPx: number;
  majorTickStepYears: number;
}

export const TIMELINE_ZOOM_PRESETS: readonly ZoomPreset[] = [
  { index: 0, labelKo: '전체 흐름', pxPerYear: 0.72, primevalWidthPx: 260, majorTickStepYears: 200 },
  { index: 1, labelKo: '기본', pxPerYear: 1.8, primevalWidthPx: 320, majorTickStepYears: 100 },
  { index: 2, labelKo: '중간 확대', pxPerYear: 4.2, primevalWidthPx: 380, majorTickStepYears: 50 },
  { index: 3, labelKo: '상세', pxPerYear: 9.5, primevalWidthPx: 440, majorTickStepYears: 25 },
  { index: 4, labelKo: '초상세 (신약·왕정)', pxPerYear: 20.0, primevalWidthPx: 520, majorTickStepYears: 10 },
];

export const TIMELINE_MIN_YEAR = -2050;
export const TIMELINE_MAX_YEAR = 105;
export const PRIMEVAL_GAP_PX = 28;
export const TIMELINE_RIGHT_PAD_PX = 160;
export const PRIMEVAL_MAX_ORDER = 5;

/**
 * 역사적 연도(BC는 음수, AD는 양수, 0년 없음!)를 연속 실수 축으로 변환한다.
 * 예:
 *   BC 2 (-2) -> -1
 *   BC 1 (-1) ->  0
 *   AD 1 (+1) -> +1
 * 따라서 BC 1년 시작점과 AD 1년 시작점 사이의 간격은 정확히 1년이며, 역사적 0년이 존재하지 않는다.
 */
export function yearToContinuous(year: number): number {
  if (year === 0) {
    throw new Error('역사적 연대에는 0년(Year 0)이 존재하지 않습니다.');
  }
  return year < 0 ? year + 1 : year;
}

export function continuousToHistoricalYear(continuous: number): number {
  const rounded = Math.round(continuous);
  return rounded <= 0 ? rounded - 1 : rounded;
}

export function formatHistoricalYearKo(year: number): string {
  if (year === 0) {
    throw new Error('역사적 연대에는 0년(Year 0)이 존재하지 않습니다.');
  }
  return year < 0 ? `BC ${Math.abs(year)}` : `AD ${year}`;
}

/**
 * 종료 연도는 해당 연도 말(포함 구간)까지를 나타내므로 +1년 폭을 부여한다.
 * 예: AD 51–52 재임 -> [yearToContinuous(51), yearToContinuous(52) + 1] = 2년 간격.
 */
export function historicalSpanYears(startYear: number, endYear: number): number {
  return Math.max(1, yearToContinuous(endYear) + 1 - yearToContinuous(startYear));
}

export function getProportionalStartX(zoom: ZoomPreset): number {
  return zoom.primevalWidthPx + PRIMEVAL_GAP_PX;
}

export function yearToX(year: number, zoom: ZoomPreset): number {
  const originCont = yearToContinuous(TIMELINE_MIN_YEAR);
  const targetCont = yearToContinuous(year);
  return getProportionalStartX(zoom) + (targetCont - originCont) * zoom.pxPerYear;
}

export function getTotalCanvasWidth(zoom: ZoomPreset): number {
  const maxCont = yearToContinuous(TIMELINE_MAX_YEAR) + 1;
  const minCont = yearToContinuous(TIMELINE_MIN_YEAR);
  return (
    getProportionalStartX(zoom) +
    (maxCont - minCont) * zoom.pxPerYear +
    TIMELINE_RIGHT_PAD_PX
  );
}

export function relativeOrderToSegment(
  order: number,
  span = 1,
  zoom: ZoomPreset,
): { x: number; width: number } {
  const leftPad = 14;
  const usable = Math.max(160, zoom.primevalWidthPx - leftPad * 2);
  const slotW = usable / PRIMEVAL_MAX_ORDER;
  const x = leftPad + (Math.max(1, order) - 1) * slotW;
  const width = Math.max(28, Math.min(usable - (x - leftPad), span * slotW - 8));
  return { x, width };
}

export interface AxisTick {
  year: number;
  x: number;
  label: string;
  isBoundary?: boolean;
}

export function buildProportionalAxisTicks(zoom: ZoomPreset): AxisTick[] {
  const step = zoom.majorTickStepYears;
  const ticks: AxisTick[] = [];

  for (let y = -2000; y <= -step; y += step) {
    ticks.push({
      year: y,
      x: yearToX(y, zoom),
      label: `BC ${Math.abs(y)}`,
    });
  }

  // BC/AD 경계(AD 1년 시작점, 0년 없음)는 항상 명시
  ticks.push({
    year: 1,
    x: yearToX(1, zoom),
    label: 'AD 1',
    isBoundary: true,
  });

  if (step <= 100) {
    for (let ad = step; ad <= 100; ad += step) {
      ticks.push({
        year: ad,
        x: yearToX(ad, zoom),
        label: `AD ${ad}`,
      });
    }
  } else {
    ticks.push({
      year: 100,
      x: yearToX(100, zoom),
      label: 'AD 100',
    });
  }

  return ticks;
}

/** 한글(가-힣)·영문 폭을 보수적으로 추정해 어떤 확대 배율에서도 막대와 글자가 절대 겹치지 않게 한다. */
export function estimateLabelWidthPx(text: string): number {
  let width = 18;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0x3130 && code <= 0x318f) ||
      code > 0x2e80
    ) {
      width += 12.8;
    } else if (ch === ' ') {
      width += 4.5;
    } else {
      width += 7.6;
    }
  }
  return Math.ceil(width);
}

export interface PackedTimelineItem {
  item: TimelineItem;
  barX: number;
  barWidth: number;
  visualWidth: number;
  footprintEndX: number;
  labelInside: boolean;
  subLane: number;
  displayLabel: string;
}

export interface PackedCategoryTrack {
  category: TimelineItemCategory;
  labelKo: string;
  shortLabelKo: string;
  defaultColor: string;
  subLaneCount: number;
  items: PackedTimelineItem[];
}

const MIN_BAR_VISUAL_PX = 14;
const MIN_TOUCH_TARGET_PX = 44;
const HORIZONTAL_LANE_GAP_PX = 12;

export function packTimelineTracks(
  items: readonly TimelineItem[],
  zoom: ZoomPreset,
  categoryFilter: TimelineCategoryFilter,
): PackedCategoryTrack[] {
  const categories =
    categoryFilter === 'ALL'
      ? CATEGORY_META
      : CATEGORY_META.filter((c) => c.key === categoryFilter);

  return categories.map((catMeta) => {
    const catItems = items.filter((it) => it.category === catMeta.key);

    const measured = catItems.map((item) => {
      const displayLabel = item.shortLabelKo ?? item.nameKo;
      let barX = 0;
      let barWidth = MIN_BAR_VISUAL_PX;

      if (item.datePrecision === 'undetermined' || item.startYear === null || item.endYear === null) {
        const seg = relativeOrderToSegment(
          item.relativeOrder ?? 1,
          item.relativeSpan ?? 1,
          zoom,
        );
        barX = seg.x;
        barWidth = Math.max(MIN_BAR_VISUAL_PX, seg.width);
      } else {
        const startX = yearToX(item.startYear, zoom);
        const spanYears = historicalSpanYears(item.startYear, item.endYear);
        barX = startX;
        barWidth = Math.max(MIN_BAR_VISUAL_PX, spanYears * zoom.pxPerYear);
      }

      const labelPx = estimateLabelWidthPx(displayLabel);
      const labelInside = barWidth >= labelPx + 14;
      const totalInteractiveWidth = labelInside
        ? Math.max(barWidth, MIN_TOUCH_TARGET_PX)
        : Math.max(MIN_TOUCH_TARGET_PX, barWidth + 8 + labelPx);

      return {
        item,
        displayLabel,
        barX,
        barWidth,
        labelInside,
        visualWidth: totalInteractiveWidth,
        footprintEndX: barX + totalInteractiveWidth,
      };
    });

    measured.sort((a, b) => {
      if (a.barX !== b.barX) return a.barX - b.barX;
      return b.barWidth - a.barWidth;
    });

    const laneEnds: number[] = [];
    const packed: PackedTimelineItem[] = [];

    for (const m of measured) {
      let chosenLane = -1;
      for (let i = 0; i < laneEnds.length; i++) {
        if (laneEnds[i] + HORIZONTAL_LANE_GAP_PX <= m.barX) {
          chosenLane = i;
          laneEnds[i] = m.footprintEndX;
          break;
        }
      }
      if (chosenLane === -1) {
        chosenLane = laneEnds.length;
        laneEnds.push(m.footprintEndX);
      }
      packed.push({
        ...m,
        subLane: chosenLane,
      });
    }

    return {
      category: catMeta.key,
      labelKo: catMeta.labelKo,
      shortLabelKo: catMeta.shortLabelKo,
      defaultColor: catMeta.defaultColor,
      subLaneCount: Math.max(1, laneEnds.length),
      items: packed,
    };
  });
}

/** 특정 시대에 가장 읽기 좋은 기본 확대 단계 추천 */
export function getRecommendedZoomIndexForEra(era: TimelineEra): number {
  if (era.datePrecision === 'undetermined' || era.startYear === null || era.endYear === null) {
    return 1;
  }
  const span = historicalSpanYears(era.startYear, era.endYear);
  if (span <= 80) return 4; // 예수님의 생애, 초대교회, 포로기
  if (span <= 180) return 3; // 통일왕국, 유다 단독왕국, 귀환기
  if (span <= 360) return 2; // 족장, 출애굽, 정복·사사, 분열왕국, 중간기
  return 1;
}

/** 특정 본문(권·장·절)에 해당하는 역사적 배경 매핑 조회 (역사 정보가 없는 본문은 null 반환 — 임의 연대 표시 금지) */
export function findChapterHistoryContext(
  dataset: BibleHistoryDataset | null,
  book: number,
  chapter: number,
  verse?: number | null,
): ChapterHistoryMapping | null {
  if (!dataset) return null;
  const candidates = dataset.chapterMappings.filter(
    (m) => m.book === book && chapter >= m.chapterStart && chapter <= m.chapterEnd,
  );
  if (candidates.length === 0) return null;

  if (typeof verse === 'number' && verse >= 1) {
    const verseMatched = candidates.find(
      (m) =>
        typeof m.verseStart === 'number' &&
        typeof m.verseEnd === 'number' &&
        verse >= m.verseStart &&
        verse <= m.verseEnd,
    );
    if (verseMatched) return verseMatched;
  }

  // 범위가 가장 좁고 구체적인 매핑 우선 반환
  candidates.sort((a, b) => {
    const aHasVerse = typeof a.verseStart === 'number' ? 1 : 0;
    const bHasVerse = typeof b.verseStart === 'number' ? 1 : 0;
    if (aHasVerse !== bHasVerse) return aHasVerse - bHasVerse; // 절 미지정 시 장 전체 매핑 우선
    return a.chapterEnd - a.chapterStart - (b.chapterEnd - b.chapterStart);
  });
  return candidates[0] ?? null;
}

/** 선택된 인물·사건과 역사적으로 시기가 겹치거나 명시적으로 연결된 동시대 인물 산출 */
export function resolveContemporaryItems(
  dataset: BibleHistoryDataset,
  target: TimelineItem,
  maxCount = 8,
): TimelineItem[] {
  const byId = new Map(dataset.items.map((i) => [i.id, i]));
  const result: TimelineItem[] = [];
  const seen = new Set<string>([target.id]);

  // 1. 명시적으로 검증 등록된 관련 항목 중 인물/왕/선지자 우선 추가
  for (const relId of target.relatedItemIds ?? []) {
    const found = byId.get(relId);
    if (found && !seen.has(found.id) && found.category !== 'polity') {
      seen.add(found.id);
      result.push(found);
    }
  }

  // 2. 수치 연대가 존재하는 경우 실제 활동·통치 기간이 겹치는 동시대 인물 보완
  if (
    target.datePrecision !== 'undetermined' &&
    target.startYear !== null &&
    target.endYear !== null
  ) {
    const tStart = yearToContinuous(target.startYear);
    const tEnd = yearToContinuous(target.endYear) + 1;

    const overlapping = dataset.items.filter((cand) => {
      if (seen.has(cand.id)) return false;
      if (cand.category === 'polity' || cand.category === 'event') return false;
      if (cand.datePrecision === 'undetermined' || cand.startYear === null || cand.endYear === null) {
        return false;
      }
      const cStart = yearToContinuous(cand.startYear);
      const cEnd = yearToContinuous(cand.endYear) + 1;
      return cStart < tEnd && tStart < cEnd;
    });

    overlapping.sort((a, b) => {
      const aMid = ((a.startYear ?? 0) + (a.endYear ?? 0)) / 2;
      const bMid = ((b.startYear ?? 0) + (b.endYear ?? 0)) / 2;
      const tMid = (target.startYear! + target.endYear!) / 2;
      return Math.abs(aMid - tMid) - Math.abs(bMid - tMid);
    });

    for (const ov of overlapping) {
      if (result.length >= maxCount) break;
      seen.add(ov.id);
      result.push(ov);
    }
  } else {
    // 원역사(미확정 구간)인 경우 같은 원역사 시대의 인물 보완
    for (const cand of dataset.items) {
      if (result.length >= maxCount) break;
      if (
        !seen.has(cand.id) &&
        cand.category !== 'polity' &&
        cand.category !== 'event' &&
        cand.eraIds.some((e) => target.eraIds.includes(e))
      ) {
        seen.add(cand.id);
        result.push(cand);
      }
    }
  }

  return result.slice(0, maxCount);
}

let historyDatasetPromise: Promise<BibleHistoryDataset> | null = null;

export function clearHistoryDataCache(): void {
  historyDatasetPromise = null;
}

export function loadBibleHistoryDataset(): Promise<BibleHistoryDataset> {
  if (historyDatasetPromise) return historyDatasetPromise;
  historyDatasetPromise = fetch('./data/history/timeline.json').then(async (res) => {
    if (!res.ok) {
      throw new Error('통합 역사 연대표 데이터를 불러오지 못했습니다.');
    }
    return (await res.json()) as BibleHistoryDataset;
  });
  historyDatasetPromise.catch(() => {
    historyDatasetPromise = null;
  });
  return historyDatasetPromise;
}
