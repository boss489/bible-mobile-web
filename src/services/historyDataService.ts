import type {
  BibleHistoryDataset,
  ChapterHistoryMapping,
  DatePrecision,
  HistoricalPeriodKind,
  HistoricalRecordType,
  PeriodScaleKind,
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

export const PERIOD_SCALE_LABELS_KO: Readonly<Record<PeriodScaleKind, string>> = {
  actual_duration: '실제 지속 기간',
  point_or_brief: '단기·발생 시점',
  uncertainty_window: '발생·작성 가능 범위',
  relative_sequence: '본문 상대 순서',
};

export const DATE_PRECISION_LABELS_KO: Readonly<Record<DatePrecision, string>> = {
  confirmed: '사료·역사 확정 연대',
  estimated: '추정 연대',
  range: '범위·학설 병기',
  undetermined: '절대 연대 미확정 (본문 순서)',
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
  { index: 0, labelKo: '전체 흐름', pxPerYear: 0.88, primevalWidthPx: 640, majorTickStepYears: 200 },
  { index: 1, labelKo: '기본', pxPerYear: 1.95, primevalWidthPx: 920, majorTickStepYears: 100 },
  { index: 2, labelKo: '중간 확대', pxPerYear: 4.3, primevalWidthPx: 1280, majorTickStepYears: 50 },
  { index: 3, labelKo: '상세', pxPerYear: 9.6, primevalWidthPx: 1720, majorTickStepYears: 25 },
  { index: 4, labelKo: '초상세 (신약·왕정)', pxPerYear: 20.0, primevalWidthPx: 2240, majorTickStepYears: 10 },
];

export const TIMELINE_MIN_YEAR = -1110;
export const TIMELINE_MAX_YEAR = 105;
export const PRIMEVAL_GAP_PX = 28;
export const TIMELINE_RIGHT_PAD_PX = 160;
export const RELATIVE_MAX_ORDER = 25;

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

/**
 * 왕정 이전 상대 순서 구간(원역사 1..4 · 족장 5..12 · 출애굽 13..16 · 정복·사사 17..25)을
 * 비례 연도가 아닌 본문 내 선후·세대 슬롯 좌표로 변환한다.
 */
export function relativeOrderToSegment(
  order: number,
  span = 1,
  zoom: ZoomPreset,
): { x: number; width: number } {
  const leftPad = 14;
  const usable = Math.max(320, zoom.primevalWidthPx - leftPad * 2);
  const slotW = usable / RELATIVE_MAX_ORDER;
  const x = leftPad + (Math.max(1, order) - 1) * slotW;
  const width = Math.max(18, Math.min(usable - (x - leftPad), span * slotW - 6));
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
  const firstBcTick = -Math.floor(1100 / step) * step;

  for (let y = firstBcTick; y <= -step; y += step) {
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
        barWidth =
          item.category === 'event' && (item.relativeSpan ?? 1) <= 1
            ? Math.min(22, Math.max(MIN_BAR_VISUAL_PX, seg.width))
            : Math.max(MIN_BAR_VISUAL_PX, seg.width);
      } else {
        const startX = yearToX(item.startYear, zoom);
        const spanYears = historicalSpanYears(item.startYear, item.endYear);
        barX = startX;
        barWidth =
          item.periodScale === 'point_or_brief'
            ? Math.max(MIN_BAR_VISUAL_PX, Math.min(24, spanYears * zoom.pxPerYear))
            : Math.max(MIN_BAR_VISUAL_PX, spanYears * zoom.pxPerYear);
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
    return 2;
  }
  const span = historicalSpanYears(era.startYear, era.endYear);
  if (span <= 80) return 4; // 예수님의 생애, 초대교회, 포로기
  if (span <= 180) return 3; // 통일왕국, 유다 단독왕국, 귀환기
  if (span <= 360) return 2; // 분열왕국
  return 1; // 신구약 중간기
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

  candidates.sort((a, b) => {
    const aHasVerse = typeof a.verseStart === 'number' ? 1 : 0;
    const bHasVerse = typeof b.verseStart === 'number' ? 1 : 0;
    if (aHasVerse !== bHasVerse) return aHasVerse - bHasVerse;
    return a.chapterEnd - a.chapterStart - (b.chapterEnd - b.chapterStart);
  });
  return candidates[0] ?? null;
}

/**
 * 보수적 동시대 인물 산출 (TIMELINE_ACCURACY_REVIEW.md §3 반영):
 * 1. 성경 본문 또는 사료로 실제 생존·활동 겹침이 검증되어 등록된 contemporaryItemIds를 최우선 반영한다.
 * 2. 수치 연대 기반 자동 보완은 두 항목 모두 'actual_duration'(실제 지속 기간)이고
 *    확정/추정 연대(confirmed/estimated)이며 최소 2년 이상(또는 단기 재위 전체) 실제 겹치는 경우에만 허용한다.
 * 3. 발생 가능 범위(uncertainty_window)나 상대 순서(undetermined)만으로 같은 시대에 속한 인물은
 *    결코 자동으로 '동시대 인물'로 묶지 않는다.
 */
export function resolveContemporaryItems(
  dataset: BibleHistoryDataset,
  target: TimelineItem,
  maxCount = 8,
): TimelineItem[] {
  const byId = new Map(dataset.items.map((i) => [i.id, i]));
  const result: TimelineItem[] = [];
  const seen = new Set<string>([target.id]);

  for (const cid of target.contemporaryItemIds ?? []) {
    const found = byId.get(cid);
    if (found && !seen.has(found.id) && found.category !== 'polity' && found.category !== 'event') {
      seen.add(found.id);
      result.push(found);
    }
  }

  const targetScale = target.periodScale ?? 'actual_duration';
  if (
    result.length < maxCount &&
    targetScale === 'actual_duration' &&
    (target.datePrecision === 'confirmed' || target.datePrecision === 'estimated') &&
    target.startYear !== null &&
    target.endYear !== null
  ) {
    const tStart = yearToContinuous(target.startYear);
    const tEnd = yearToContinuous(target.endYear) + 1;
    const tSpan = tEnd - tStart;

    const overlapping = dataset.items.filter((cand) => {
      if (seen.has(cand.id)) return false;
      if (cand.category === 'polity' || cand.category === 'event') return false;
      const candScale = cand.periodScale ?? 'actual_duration';
      if (candScale !== 'actual_duration') return false;
      if (cand.datePrecision !== 'confirmed' && cand.datePrecision !== 'estimated') return false;
      if (cand.startYear === null || cand.endYear === null) return false;

      const cStart = yearToContinuous(cand.startYear);
      const cEnd = yearToContinuous(cand.endYear) + 1;
      const overlap = Math.min(tEnd, cEnd) - Math.max(tStart, cStart);
      const minRequired = Math.min(2, tSpan, cEnd - cStart);
      return overlap >= minRequired;
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
  }

  return result.slice(0, maxCount);
}

/**
 * 동시대 인물로 단정하지는 않으나 계보·시대·문맥상 연결된 인물(예: 아브라함 <-> 요셉, 룻 <-> 다윗 등)을
 * 동시대 목록과 분리하여 반환한다.
 */
export function resolveRelatedPeopleItems(
  dataset: BibleHistoryDataset,
  target: TimelineItem,
  contemporaries: readonly TimelineItem[],
): TimelineItem[] {
  const byId = new Map(dataset.items.map((i) => [i.id, i]));
  const contempSet = new Set<string>([target.id, ...contemporaries.map((c) => c.id)]);
  const out: TimelineItem[] = [];

  for (const rid of target.relatedItemIds ?? []) {
    if (contempSet.has(rid)) continue;
    const found = byId.get(rid);
    if (found && found.category !== 'polity' && found.category !== 'event') {
      contempSet.add(found.id);
      out.push(found);
    }
  }
  return out;
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
