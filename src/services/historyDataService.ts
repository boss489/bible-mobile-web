import type {
  BibleHistoryDataset,
  ChapterHistoryMapping,
  DatePrecision,
  HistoricalPeriodKind,
  HistoricalRecordType,
  HistoryEraId,
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

// ============================================================================
// 시대별 독립 차트 (1~12 시리즈) · 맞춤 행(Track) · 가변 축척(Scale-Break) · 세로 읽기 엔진
// ============================================================================

export interface EraCustomTrackDef {
  key: string;
  labelKo: string;
  subLabelKo: string;
  color: string;
}

export const ERA_CUSTOM_TRACKS: Readonly<Record<HistoryEraId, readonly EraCustomTrackDef[]>> = {
  primeval: [
    { key: 'prim_creation', labelKo: '창조 · 에덴', subLabelKo: '창 1–4장', color: '#6d727c' },
    { key: 'prim_flood', labelKo: '홍수 · 무지개 언약', subLabelKo: '창 6–9장', color: '#4c6f94' },
    { key: 'prim_babel', labelKo: '바벨 · 열방 분화', subLabelKo: '창 10–11장', color: '#8f6b3e' },
  ],
  patriarchs: [
    { key: 'pat_events', labelKo: '족장기 중요 사건', subLabelKo: '소명·언약·이주', color: '#9a4d24' },
    { key: 'pat_abraham', labelKo: '아브라함 (1대)', subLabelKo: '언약의 시조', color: '#8b5e34' },
    { key: 'pat_isaac', labelKo: '이삭 (2대)', subLabelKo: '언약 계승', color: '#6f6544' },
    { key: 'pat_jacob', labelKo: '야곱 · 이스라엘', subLabelKo: '12지파 조상', color: '#2c6252' },
    { key: 'pat_joseph', labelKo: '요셉 (4대)', subLabelKo: '애굽 총리', color: '#4c6f94' },
  ],
  exodus: [
    { key: 'exo_events', labelKo: '출애굽 중요 사건', subLabelKo: '구원·언약·광야', color: '#9a4d24' },
    { key: 'exo_moses', labelKo: '모세 (인도자)', subLabelKo: '광야 40년', color: '#2c6252' },
    { key: 'exo_aaron', labelKo: '아론 · 제사장', subLabelKo: '초대 대제사장', color: '#8f6b3e' },
  ],
  conquest_judges: [
    { key: 'jud_events', labelKo: '정복·사사 중요 사건', subLabelKo: '입성·정복·회복', color: '#9a4d24' },
    { key: 'jud_leaders', labelKo: '정복 · 전환 지도자', subLabelKo: '여호수아·사무엘', color: '#2c6252' },
    { key: 'jud_cycle', labelKo: '사사 구원 주기', subLabelKo: '옷니엘~삼손', color: '#8f6b3e' },
    { key: 'jud_lineage', labelKo: '언약 계보 · 사건', subLabelKo: '룻·다윗 계보', color: '#735c70' },
  ],
  united_kingdom: [
    { key: 'uk_events', labelKo: '언약 · 성전 사건', subLabelKo: '주요 사건', color: '#9a4d24' },
    { key: 'uk_polity', labelKo: '통일 왕국 체제', subLabelKo: '12지파 연합', color: '#526b7a' },
    { key: 'uk_kings', labelKo: '사울 · 다윗 · 솔로몬', subLabelKo: '통일 3대 왕', color: '#4c6f94' },
    { key: 'uk_prophets', labelKo: '선지자 · 제사장', subLabelKo: '사무엘·나단', color: '#8f6b3e' },
  ],
  divided_kingdom: [
    { key: 'dk_events', labelKo: '분열 · 함락 사건', subLabelKo: '역사 분기점', color: '#9a4d24' },
    { key: 'dk_israel', labelKo: '북이스라엘 왕', subLabelKo: '여로보암~호세아', color: '#476b88' },
    { key: 'dk_judah', labelKo: '남유다 왕', subLabelKo: '다윗 왕조 계승', color: '#7d5260' },
    { key: 'dk_prophets', labelKo: '활동 선지자', subLabelKo: '엘리야~이사야', color: '#8f6b3e' },
    { key: 'dk_polities', labelKo: '왕국 · 주변 제국', subLabelKo: '남북왕국·앗수르', color: '#526b7a' },
  ],
  judah_alone: [
    { key: 'ja_events', labelKo: '개혁 · 포로 · 함락', subLabelKo: '성전 소실까지', color: '#9a4d24' },
    { key: 'ja_judah', labelKo: '남유다 왕', subLabelKo: '히스기야~시드기야', color: '#7d5260' },
    { key: 'ja_prophets', labelKo: '유다 선지자', subLabelKo: '이사야~예레미야', color: '#8f6b3e' },
    { key: 'ja_empires', labelKo: '주변 제국 · 황제', subLabelKo: '앗수르·바벨론', color: '#526b7a' },
  ],
  exile: [
    { key: 'exl_events', labelKo: '함락 · 회복 분기', subLabelKo: '핵심 사건', color: '#9a4d24' },
    { key: 'exl_empires', labelKo: '바벨론 · 바사 제국', subLabelKo: '제국과 황제', color: '#526b7a' },
    { key: 'exl_exiles', labelKo: '포로기 왕족 · 인물', subLabelKo: '여호야긴·다니엘', color: '#2c6252' },
    { key: 'exl_prophets', labelKo: '포로기 선지자', subLabelKo: '예레미야·에스겔', color: '#8f6b3e' },
  ],
  return_persian: [
    { key: 'ret_events', labelKo: '귀환 · 성전 재건', subLabelKo: '칙령·성전 완공', color: '#9a4d24' },
    { key: 'ret_persia', labelKo: '페르시아 제국 · 황제', subLabelKo: '고레스~아하수에로', color: '#526b7a' },
    { key: 'ret_leaders', labelKo: '총독 · 귀환 인물', subLabelKo: '스룹바벨·느헤미야', color: '#2c6252' },
    { key: 'ret_prophets', labelKo: '선지자 · 학사', subLabelKo: '학개·에스라·말라기', color: '#8f6b3e' },
  ],
  intertestamental: [
    { key: 'int_events', labelKo: '역사적 격변 사건', subLabelKo: '원정·마카비·로마', color: '#9a4d24' },
    { key: 'int_polities', labelKo: '제국 · 왕조', subLabelKo: '프톨레마이오스~하스몬', color: '#526b7a' },
    { key: 'int_rulers', labelKo: '헬레니즘 · 유대 통치자', subLabelKo: '안티오코스·헤롯', color: '#4c6f94' },
  ],
  jesus_life: [
    { key: 'jl_events', labelKo: '구속 중심 사건', subLabelKo: '십자가와 부활', color: '#9a4d24' },
    { key: 'jl_jesus', labelKo: '예수 그리스도', subLabelKo: '성육신 · 공생애', color: '#8b3a2e' },
    { key: 'jl_disciples', labelKo: '성가족 · 선구자 · 제자', subLabelKo: '마리아·세례 요한·사도', color: '#2c6252' },
    { key: 'jl_rulers', labelKo: '로마 · 유대 통치자', subLabelKo: '아우구스투스·빌라도', color: '#4c6f94' },
  ],
  early_church: [
    { key: 'ec_journeys', labelKo: '선교여행 · 교회 사건', subLabelKo: '공의회·1~3차 여행', color: '#9a4d24' },
    { key: 'ec_apostles', labelKo: '사도 · 교회 지도자', subLabelKo: '베드로·요한·바울', color: '#2c6252' },
    { key: 'ec_pauline', labelKo: '바울 서신 작성', subLabelKo: '로마서~목회서신', color: '#7b5e3b' },
    { key: 'ec_general_nt', labelKo: '일반서신 · 계시록', subLabelKo: '히브리서~요한계시록', color: '#6b5876' },
    { key: 'ec_rulers', labelKo: '로마 황제 · 총독', subLabelKo: '글라우디오·갈리오·네로', color: '#4c6f94' },
  ],
};

export function resolveEraCustomTrackDef(
  eraId: HistoryEraId,
  item: TimelineItem,
): EraCustomTrackDef {
  const defs = ERA_CUSTOM_TRACKS[eraId];
  const byKey = (k: string) => defs.find((d) => d.key === k) ?? defs[defs.length - 1];

  switch (eraId) {
    case 'primeval': {
      if (item.id === 'event-flood') return byKey('prim_flood');
      if (item.id === 'event-babel') return byKey('prim_babel');
      return byKey('prim_creation');
    }
    case 'patriarchs': {
      if (item.id === 'item-abraham') return byKey('pat_abraham');
      if (item.id === 'item-isaac') return byKey('pat_isaac');
      if (item.id === 'item-jacob') return byKey('pat_jacob');
      if (item.id === 'item-joseph') return byKey('pat_joseph');
      return byKey('pat_events');
    }
    case 'exodus': {
      if (item.id === 'item-moses' || item.category === 'person') return byKey('exo_moses');
      if (item.category === 'prophet_priest') return byKey('exo_aaron');
      return byKey('exo_events');
    }
    case 'conquest_judges': {
      if (item.category === 'event') return byKey('jud_events');
      if (item.id === 'item-joshua' || item.id === 'item-samuel') return byKey('jud_leaders');
      if (item.category === 'prophet_priest') return byKey('jud_cycle');
      return byKey('jud_lineage');
    }
    case 'united_kingdom': {
      if (item.category === 'polity') return byKey('uk_polity');
      if (item.category === 'ruler') return byKey('uk_kings');
      if (item.category === 'prophet_priest') return byKey('uk_prophets');
      return byKey('uk_events');
    }
    case 'divided_kingdom': {
      if (item.category === 'polity') return byKey('dk_polities');
      if (item.category === 'ruler') {
        if (item.roleLabelKo.includes('북이스라엘')) return byKey('dk_israel');
        if (item.roleLabelKo.includes('남유다')) return byKey('dk_judah');
        return byKey('dk_polities');
      }
      if (item.category === 'prophet_priest') return byKey('dk_prophets');
      return byKey('dk_events');
    }
    case 'judah_alone': {
      if (item.category === 'ruler' && item.roleLabelKo.includes('남유다')) {
        return byKey('ja_judah');
      }
      if (item.id === 'item-daniel') return byKey('ja_prophets');
      if (item.category === 'polity' || item.category === 'ruler') {
        return byKey('ja_empires');
      }
      if (item.category === 'prophet_priest') return byKey('ja_prophets');
      return byKey('ja_events');
    }
    case 'exile': {
      if (item.category === 'polity') return byKey('exl_empires');
      if (item.category === 'ruler') {
        if (item.roleLabelKo.includes('남유다')) return byKey('exl_exiles');
        return byKey('exl_empires');
      }
      if (item.category === 'prophet_priest') return byKey('exl_prophets');
      if (item.category === 'person') return byKey('exl_exiles');
      return byKey('exl_events');
    }
    case 'return_persian': {
      if (item.category === 'polity' || item.category === 'ruler') return byKey('ret_persia');
      if (item.category === 'person') return byKey('ret_leaders');
      if (item.category === 'prophet_priest') return byKey('ret_prophets');
      return byKey('ret_events');
    }
    case 'intertestamental': {
      if (item.category === 'polity') return byKey('int_polities');
      if (item.category === 'ruler') return byKey('int_rulers');
      return byKey('int_events');
    }
    case 'jesus_life': {
      if (item.id === 'person-jesus') return byKey('jl_jesus');
      if (item.category === 'ruler' || item.category === 'polity') return byKey('jl_rulers');
      if (item.category === 'event') return byKey('jl_events');
      return byKey('jl_disciples');
    }
    case 'early_church': {
      if (item.category === 'ruler' || item.category === 'polity') return byKey('ec_rulers');
      if (item.recordType === 'epistle_background') {
        const epMatch = item.id.match(/^epistle-(\d+)$/);
        const bookNum = epMatch ? Number(epMatch[1]) : 0;
        if (bookNum >= 45 && bookNum <= 57) return byKey('ec_pauline');
        return byKey('ec_general_nt');
      }
      if (item.category === 'event') return byKey('ec_journeys');
      return byKey('ec_apostles');
    }
  }
}

interface CompressedStretchSpec {
  startYear: number;
  endYear: number;
  factor: number;
  labelKo: string;
}

interface EraNumericAxisSpec {
  domainStartYear: number;
  domainEndYear: number;
  baseCanvasPx: number;
  tickYears: readonly number[];
  compressedStretches?: readonly CompressedStretchSpec[];
}

const ERA_NUMERIC_SPECS: Partial<Record<HistoryEraId, EraNumericAxisSpec>> = {
  united_kingdom: {
    domainStartYear: -1060,
    domainEndYear: -928,
    baseCanvasPx: 760,
    tickYears: [-1050, -1030, -1010, -990, -970, -950, -931],
  },
  divided_kingdom: {
    domainStartYear: -935,
    domainEndYear: -718,
    baseCanvasPx: 1120,
    tickYears: [-930, -900, -875, -850, -825, -800, -775, -750, -722],
  },
  judah_alone: {
    domainStartYear: -726,
    domainEndYear: -582,
    baseCanvasPx: 920,
    tickYears: [-722, -700, -680, -660, -640, -620, -605, -597, -586],
  },
  exile: {
    domainStartYear: -608,
    domainEndYear: -535,
    baseCanvasPx: 760,
    tickYears: [-605, -597, -586, -575, -560, -550, -538],
  },
  return_persian: {
    domainStartYear: -542,
    domainEndYear: -426,
    baseCanvasPx: 820,
    tickYears: [-538, -520, -515, -485, -475, -458, -445, -430],
    compressedStretches: [
      { startYear: -512, endYear: -488, factor: 0.35, labelKo: '성전 완공~아하수에로 공백 압축' },
    ],
  },
  intertestamental: {
    domainStartYear: -432,
    domainEndYear: -4,
    baseCanvasPx: 880,
    tickYears: [-430, -334, -301, -198, -175, -164, -142, -63, -37, -4],
    compressedStretches: [
      { startYear: -425, endYear: -340, factor: 0.24, labelKo: '페르시아 후기 축척 압축' },
      { startYear: -295, endYear: -205, factor: 0.28, labelKo: '프톨레마이오스기 축척 압축' },
      { startYear: -135, endYear: -70, factor: 0.36, labelKo: '하스몬 중기 축척 압축' },
    ],
  },
  jesus_life: {
    domainStartYear: -8,
    domainEndYear: 35,
    baseCanvasPx: 780,
    tickYears: [-6, -4, 1, 14, 26, 28, 30, 33],
    compressedStretches: [
      { startYear: -2, endYear: 24, factor: 0.3, labelKo: '나사렛 성장기 축척 압축' },
    ],
  },
  early_church: {
    domainStartYear: 29,
    domainEndYear: 98,
    baseCanvasPx: 1180,
    tickYears: [30, 35, 40, 45, 50, 55, 60, 65, 70, 85, 95],
    compressedStretches: [
      { startYear: 71, endYear: 83, factor: 0.38, labelKo: 'AD 70 이후 축척 압축' },
    ],
  },
};

const RELATIVE_ERA_SLOT_LABELS: Partial<Record<HistoryEraId, Record<number, string>>> = {
  primeval: {
    1: '1. 창조',
    2: '2. 에덴 타락',
    3: '3. 노아 홍수',
    4: '4. 바벨탑',
  },
  patriarchs: {
    5: '아브라함 소명',
    6: '이삭 출생',
    7: '야곱 출생',
    8: '야곱 · 이스라엘',
    9: '요셉 세대',
    10: '요셉 통치',
    11: '애굽 이주·보존',
  },
  exodus: {
    13: '출애굽·유월절',
    14: '시내산 언약·성막',
    15: '광야 40년 여정',
    16: '모압 평지 고별',
  },
  conquest_judges: {
    17: '가나안 정복',
    19: '옷니엘·에훗',
    21: '드보라·기드온',
    23: '입다·룻 배경',
    24: '삼손·블레셋기',
    25: '사무엘·왕정 전환',
  },
};

export interface EraScaleBreakMark {
  x: number;
  labelKo: string;
}

export interface PackedEraTimelineItem extends PackedTimelineItem {
  clippedLeft: boolean;
  clippedRight: boolean;
  hasUncertaintyWhisker: boolean;
  customTrackKey: string;
  customTrackLabelKo: string;
}

export interface PackedEraCustomTrack {
  key: string;
  labelKo: string;
  subLabelKo: string;
  defaultColor: string;
  subLaneCount: number;
  items: PackedEraTimelineItem[];
}

export interface DedicatedEraChartLayout {
  era: TimelineEra;
  canvasWidth: number;
  ticks: AxisTick[];
  scaleBreaks: EraScaleBreakMark[];
  tracks: PackedEraCustomTrack[];
  yearOrOrderToX: (year: number | null, relativeOrder?: number) => number;
  spanToGeometry: (
    startYear: number | null,
    endYear: number | null,
    relativeOrder?: number,
    relativeSpan?: number,
  ) => { x: number; width: number; clippedLeft: boolean; clippedRight: boolean };
}

const ERA_ZOOM_FACTORS = [0.76, 1.0, 1.32, 1.72, 2.25] as const;

export function buildDedicatedEraChartLayout(
  era: TimelineEra,
  allItems: readonly TimelineItem[],
  zoomIndex: number,
  categoryFilter: TimelineCategoryFilter,
): DedicatedEraChartLayout {
  const zFactor = ERA_ZOOM_FACTORS[Math.max(0, Math.min(ERA_ZOOM_FACTORS.length - 1, zoomIndex))] ?? 1.0;
  const leftPad = 24;
  const rightPad = 150;

  const eraItems = allItems.filter(
    (it) =>
      it.eraIds.includes(era.id) &&
      (categoryFilter === 'ALL' || it.category === categoryFilter),
  );

  let innerWidth = Math.round(680 * zFactor);
  let ticks: AxisTick[] = [];
  const scaleBreaks: EraScaleBreakMark[] = [];

  let mapSpan: DedicatedEraChartLayout['spanToGeometry'];
  let mapPoint: DedicatedEraChartLayout['yearOrOrderToX'];

  const numericSpec = ERA_NUMERIC_SPECS[era.id];

  if (!numericSpec && era.relativeRange) {
    const [slotMin, slotMax] = era.relativeRange;
    const slotCount = Math.max(1, slotMax - slotMin + 1);
    const pxPerSlot = Math.max(92, Math.round(118 * zFactor));
    innerWidth = Math.max(Math.round(520 * zFactor), slotCount * pxPerSlot);

    const slotToX = (slot: number) => leftPad + (slot - slotMin) * pxPerSlot;

    const labelMap = RELATIVE_ERA_SLOT_LABELS[era.id] ?? {};
    for (let s = slotMin; s <= slotMax; s += 1) {
      const customLbl = labelMap[s];
      if (customLbl || slotCount <= 6) {
        ticks.push({
          year: s,
          x: slotToX(s) + pxPerSlot * 0.12,
          label: customLbl ?? `순서 ${s - slotMin + 1}`,
        });
      }
    }

    mapPoint = (_year, relOrder) => {
      const effectiveSlot = relOrder ?? slotMax;
      return slotToX(Math.max(slotMin, Math.min(slotMax, effectiveSlot)));
    };

    mapSpan = (_sy, _ey, relOrder, relSpan) => {
      const isDatedTransition = relOrder === undefined;
      const startSlot = isDatedTransition ? slotMax : Math.max(slotMin, relOrder);
      const spanSlots = isDatedTransition ? 1 : Math.max(1, relSpan ?? 1);
      const clippedRight = isDatedTransition || startSlot + spanSlots - 1 > slotMax;
      const clampedEnd = Math.min(slotMax + 1, startSlot + spanSlots);
      const x = slotToX(startSlot);
      const width = Math.max(22, (clampedEnd - startSlot) * pxPerSlot - 10);
      return { x, width, clippedLeft: startSlot < slotMin, clippedRight };
    };
  } else {
    const spec: EraNumericAxisSpec = numericSpec ?? {
      domainStartYear: era.startYear ?? -1000,
      domainEndYear: era.endYear ?? 100,
      baseCanvasPx: 840,
      tickYears: [era.startYear ?? -1000, era.endYear ?? 100],
    };
    innerWidth = Math.round(spec.baseCanvasPx * zFactor);

    const cMin = yearToContinuous(spec.domainStartYear);
    const cMax = yearToContinuous(spec.domainEndYear) + 1;
    const stretches = (spec.compressedStretches ?? []).map((st) => ({
      cStart: yearToContinuous(st.startYear),
      cEnd: yearToContinuous(st.endYear),
      factor: st.factor,
      labelKo: st.labelKo,
    }));

    const effectiveUnitsUpTo = (cVal: number): number => {
      const clamped = Math.max(cMin, Math.min(cMax, cVal));
      let cursor = cMin;
      let acc = 0;
      for (const st of stretches) {
        if (clamped <= cursor) break;
        if (st.cStart > cursor) {
          const normalEnd = Math.min(clamped, st.cStart);
          acc += normalEnd - cursor;
          cursor = normalEnd;
        }
        if (clamped > st.cStart && cursor < st.cEnd) {
          const compEnd = Math.min(clamped, st.cEnd);
          acc += (compEnd - Math.max(cursor, st.cStart)) * st.factor;
          cursor = compEnd;
        }
      }
      if (clamped > cursor) {
        acc += clamped - cursor;
      }
      return acc;
    };

    const totalEffective = Math.max(1, effectiveUnitsUpTo(cMax));
    const contToX = (cVal: number): number =>
      leftPad + (effectiveUnitsUpTo(cVal) / totalEffective) * innerWidth;

    // 가변 축척 변화점(≈) 마커 산출
    for (const st of stretches) {
      const midX = (contToX(st.cStart) + contToX(st.cEnd)) / 2;
      scaleBreaks.push({ x: midX, labelKo: st.labelKo });
    }

    // 비겹침 눈금 생성 (BC/AD 0년 없음)
    const rawTicks: AxisTick[] = spec.tickYears
      .filter((y) => y !== 0 && y >= spec.domainStartYear && y <= spec.domainEndYear)
      .map((y) => ({
        year: y,
        x: contToX(yearToContinuous(y)),
        label: formatHistoricalYearKo(y),
        isBoundary: y === 1,
      }));

    const minLabelGapPx = 56;
    const filteredTicks: AxisTick[] = [];
    for (const tk of rawTicks) {
      const prev = filteredTicks[filteredTicks.length - 1];
      if (!prev || tk.x - prev.x >= minLabelGapPx || tk.isBoundary) {
        if (prev && tk.isBoundary && tk.x - prev.x < minLabelGapPx) {
          filteredTicks[filteredTicks.length - 1] = tk;
        } else {
          filteredTicks.push(tk);
        }
      }
    }
    ticks = filteredTicks;

    mapPoint = (year) => {
      if (year === null || year === 0) return leftPad;
      return contToX(yearToContinuous(year));
    };

    mapSpan = (sy, ey) => {
      const rawStart = sy ?? spec.domainStartYear;
      const rawEnd = ey ?? rawStart;
      const clippedLeft = rawStart < spec.domainStartYear;
      const clippedRight = rawEnd > spec.domainEndYear;
      const clampedStart = Math.max(spec.domainStartYear, Math.min(spec.domainEndYear, rawStart));
      const clampedEnd = Math.max(clampedStart, Math.min(spec.domainEndYear, rawEnd));
      const x1 = contToX(yearToContinuous(clampedStart));
      const x2 = contToX(yearToContinuous(clampedEnd) + 1);
      return {
        x: x1,
        width: Math.max(MIN_BAR_VISUAL_PX, x2 - x1),
        clippedLeft,
        clippedRight,
      };
    };
  }

  const canvasWidth = leftPad + innerWidth + rightPad;
  const trackDefs = ERA_CUSTOM_TRACKS[era.id];
  const bucketMap = new Map<string, TimelineItem[]>();
  for (const d of trackDefs) bucketMap.set(d.key, []);

  for (const item of eraItems) {
    const tDef = resolveEraCustomTrackDef(era.id, item);
    bucketMap.get(tDef.key)?.push(item);
  }

  // 항목이 존재하는 맞춤 행만 노출하되, 필터로 인해 모두 비었으면 첫 행 유지
  const activeDefs = trackDefs.filter((d) => (bucketMap.get(d.key)?.length ?? 0) > 0);
  const effectiveDefs = activeDefs.length > 0 ? activeDefs : [trackDefs[0]];

  const packedTracks: PackedEraCustomTrack[] = effectiveDefs.map((def) => {
    const groupItems = bucketMap.get(def.key) ?? [];
    const measured = groupItems.map((item) => {
      const displayLabel = item.shortLabelKo ?? item.nameKo;
      const geom = mapSpan(
        item.startYear,
        item.endYear,
        item.relativeOrder,
        item.relativeSpan,
      );
      const barX = geom.x;
      const barWidth =
        item.periodScale === 'point_or_brief' ||
        (item.category === 'event' &&
          item.datePrecision === 'undetermined' &&
          (item.relativeSpan ?? 1) <= 1)
          ? Math.min(26, Math.max(MIN_BAR_VISUAL_PX, geom.width))
          : Math.max(MIN_BAR_VISUAL_PX, geom.width);

      const prefixExtra = (geom.clippedLeft ? 12 : 0) + (geom.clippedRight ? 12 : 0);
      const labelPx = estimateLabelWidthPx(displayLabel) + prefixExtra;
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
        clippedLeft: geom.clippedLeft,
        clippedRight: geom.clippedRight,
        hasUncertaintyWhisker:
          item.periodScale === 'uncertainty_window' || item.datePrecision === 'range',
        customTrackKey: def.key,
        customTrackLabelKo: def.labelKo,
      };
    });

    measured.sort((a, b) => {
      if (a.barX !== b.barX) return a.barX - b.barX;
      return b.barWidth - a.barWidth;
    });

    const laneEnds: number[] = [];
    const packed: PackedEraTimelineItem[] = [];

    for (const m of measured) {
      let chosenLane = -1;
      for (let i = 0; i < laneEnds.length; i += 1) {
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
      packed.push({ ...m, subLane: chosenLane });
    }

    return {
      key: def.key,
      labelKo: def.labelKo,
      subLabelKo: def.subLabelKo,
      defaultColor: def.color,
      subLaneCount: Math.max(1, laneEnds.length),
      items: packed,
    };
  });

  return {
    era,
    canvasWidth,
    ticks,
    scaleBreaks,
    tracks: packedTracks,
    yearOrOrderToX: mapPoint,
    spanToGeometry: mapSpan,
  };
}

export interface VerticalEraCardEntry {
  item: TimelineItem;
  customTrackLabelKo: string;
  customTrackColor: string;
}

export interface VerticalEraSection {
  era: TimelineEra;
  entries: VerticalEraCardEntry[];
}

export function buildVerticalEraSections(
  dataset: BibleHistoryDataset,
  categoryFilter: TimelineCategoryFilter,
  targetEraId: HistoryEraId | 'ALL',
): VerticalEraSection[] {
  const targetEras =
    targetEraId === 'ALL'
      ? dataset.eras
      : dataset.eras.filter((e) => e.id === targetEraId);

  return targetEras.map((era) => {
    const rawItems = dataset.items.filter(
      (it) =>
        it.eraIds.includes(era.id) &&
        (categoryFilter === 'ALL' || it.category === categoryFilter),
    );

    const sorted = [...rawItems].sort((a, b) => {
      const aRel = a.relativeOrder;
      const bRel = b.relativeOrder;
      if (aRel !== undefined && bRel !== undefined) {
        if (aRel !== bRel) return aRel - bRel;
        if ((era.id === 'patriarchs' || era.id === 'exodus' || era.id === 'conquest_judges') && a.category !== b.category) {
          if (a.category === 'event') return -1;
          if (b.category === 'event') return 1;
        }
        return (b.relativeSpan ?? 1) - (a.relativeSpan ?? 1);
      }
      if (aRel !== undefined) return -1;
      if (bRel !== undefined) return 1;
      const aStart = a.startYear ?? 0;
      const bStart = b.startYear ?? 0;
      if (aStart !== bStart) return aStart - bStart;
      return (a.endYear ?? aStart) - (b.endYear ?? bStart);
    });

    const entries: VerticalEraCardEntry[] = sorted.map((item) => {
      const def = resolveEraCustomTrackDef(era.id, item);
      return {
        item,
        customTrackLabelKo: def.labelKo,
        customTrackColor: def.color,
      };
    });

    return { era, entries };
  });
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
