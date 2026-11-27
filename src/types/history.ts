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

export type PeriodScaleKind =
  | 'actual_duration'
  | 'point_or_brief'
  | 'uncertainty_window'
  | 'relative_sequence';

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
  anchorBasisKo?: string;
  studyNotesKo?: string[];
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
  periodScale?: PeriodScaleKind;
  dateHypothesesKo?: string;
  summaryKo: string;
  divergentViewsKo?: string;
  externalHistoryNoteKo?: string;
  contemporaryItemIds?: string[];
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
  contemporaryItemIds?: string[];
  relatedItemIds?: string[];
  sourceIds: string[];
}

export type SpecialChronicleId = 'sanctuary_history' | 'passion_week';

export type GospelNameKo = '마태' | '마가' | '누가' | '요한';

export interface SpecialChronicleGroup {
  key: string;
  labelKo: string;
  subLabelKo: string;
  color: string;
}

export interface SpecialChronicleStage {
  index: number;
  labelKo: string;
  periodKo: string;
}

export interface SpecialChronicleEvent {
  id: string;
  groupKey: string;
  stageIndex?: number;
  timeLabelKo: string;
  titleKo: string;
  summaryKo: string;
  datePrecision: DatePrecision;
  recordType: HistoricalRecordType;
  gospelTags?: GospelNameKo[];
  linkedItemId?: string;
  externalHistoryNoteKo?: string;
  passages: HistoryPassageLink[];
}

export interface SpecialChronicle {
  id: SpecialChronicleId;
  order: number;
  nameKo: string;
  shortNameKo: string;
  subtitleKo: string;
  displayPeriodKo: string;
  layout: 'stages' | 'day_columns';
  color: string;
  summaryKo: string;
  anchorBasisKo: string;
  studyNotesKo: string[];
  divergentViewsKo?: string;
  stages?: SpecialChronicleStage[];
  groups: SpecialChronicleGroup[];
  events: SpecialChronicleEvent[];
  sourceIds: string[];
}

export interface BibleHistoryDataset {
  contentVersion: string;
  overviewNoticeKo: string;
  sources: Record<string, SourceMeta>;
  eras: TimelineEra[];
  items: TimelineItem[];
  chapterMappings: ChapterHistoryMapping[];
  specialChronicles?: SpecialChronicle[];
}

export type TimelineCategoryFilter = 'ALL' | TimelineItemCategory;

export type TimelineDisplayMode = 'all' | 'era' | 'vertical' | 'notes';

export type ActiveChronicleTarget =
  | { kind: 'era'; id: HistoryEraId }
  | { kind: 'special'; id: SpecialChronicleId };

export type TimelineSelection =
  | { kind: 'era'; id: HistoryEraId }
  | { kind: 'item'; id: string }
  | { kind: 'special_event'; chronicleId: SpecialChronicleId; eventId: string };

export interface TimelineViewState {
  scrollLeft: number;
  scrollTop: number;
  zoomIndex: number;
  categoryFilter: TimelineCategoryFilter;
  activeEraId: HistoryEraId | null;
  selection: TimelineSelection | null;
  isDetailOpen?: boolean;
  displayMode?: TimelineDisplayMode;
  activeChronicle?: ActiveChronicleTarget;
  verticalScope?: 'selected' | 'all';
}
