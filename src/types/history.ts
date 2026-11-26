import type { CanonicalVerseId, SourceMeta } from './bible';

export type HistoryEraId =
  | 'primeval'
  | 'patriarchs'
  | 'exodus'
  | 'conquest_judges'
  | 'united_kingdom'
  | 'divided_kingdom'
  | 'judah_alone'
  | 'exile'
  | 'return_persian'
  | 'intertestamental'
  | 'jesus_life'
  | 'early_church';

export type TimelineItemCategory =
  | 'polity'
  | 'ruler'
  | 'prophet_priest'
  | 'person'
  | 'event';

export type HistoricalPeriodKind =
  | 'polity_span'
  | 'reign'
  | 'ministry'
  | 'lifespan'
  | 'event'
  | 'narrative_time'
  | 'composition_time';

export type DatePrecision =
  | 'confirmed'
  | 'estimated'
  | 'range'
  | 'undetermined';

export type HistoricalRecordType =
  | 'biblical_record'
  | 'external_history'
  | 'epistle_background';

export interface HistoryPassageLink {
  verseId: CanonicalVerseId;
  labelKo: string;
  labelEn: string;
  titleKo: string;
  roleKo: string;
}

export interface SecondaryPeriodNote {
  periodKind: HistoricalPeriodKind;
  displayKo: string;
}

export interface TimelineEra {
  id: HistoryEraId;
  order: number;
  nameKo: string;
  shortNameKo: string;
  summaryKo: string;
  datePrecision: DatePrecision;
  displayPeriodKo: string;
  startYear: number | null;
  endYear: number | null;
  relativeRange?: [number, number];
  divergentViewsKo?: string;
  color: string;
  keyPassages: HistoryPassageLink[];
  sourceIds: string[];
}

export interface TimelineItem {
  id: string;
  nameKo: string;
  shortLabelKo?: string;
  roleLabelKo: string;
  category: TimelineItemCategory;
  eraIds: HistoryEraId[];
  recordType: HistoricalRecordType;
  periodKind: HistoricalPeriodKind;
  datePrecision: DatePrecision;
  displayPeriodKo: string;
  startYear: number | null;
  endYear: number | null;
  relativeOrder?: number;
  relativeSpan?: number;
  secondaryPeriods?: SecondaryPeriodNote[];
  summaryKo: string;
  divergentViewsKo?: string;
  externalHistoryNoteKo?: string;
  relatedItemIds?: string[];
  passages: HistoryPassageLink[];
  accentColor?: string;
  sourceIds: string[];
}

export interface ChapterHistoryMapping {
  id: string;
  book: number;
  chapterStart: number;
  chapterEnd: number;
  verseStart?: number;
  verseEnd?: number;
  eraId: HistoryEraId;
  periodKind: HistoricalPeriodKind;
  datePrecision: DatePrecision;
  displayPeriodKo: string;
  focusStartYear: number | null;
  focusEndYear: number | null;
  focusRelativeOrder?: number;
  contextSummaryKo: string;
  writtenVsEventNoteKo?: string;
  divergentViewsKo?: string;
  primaryItemIds: string[];
  relatedItemIds?: string[];
  sourceIds: string[];
}

export interface BibleHistoryDataset {
  contentVersion: string;
  overviewNoticeKo: string;
  sources: Record<string, SourceMeta>;
  eras: TimelineEra[];
  items: TimelineItem[];
  chapterMappings: ChapterHistoryMapping[];
}

export type TimelineCategoryFilter = 'ALL' | TimelineItemCategory;

export type TimelineSelection =
  | { kind: 'era'; id: HistoryEraId }
  | { kind: 'item'; id: string };

export interface TimelineViewState {
  scrollLeft: number;
  scrollTop: number;
  zoomIndex: number;
  categoryFilter: TimelineCategoryFilter;
  activeEraId: HistoryEraId | null;
  selection: TimelineSelection | null;
}
