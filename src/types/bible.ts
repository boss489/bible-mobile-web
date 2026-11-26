export type TranslationId = 'kr' | 'en';

export type FontSizeLevel = 1 | 2 | 3 | 4 | 5;

export interface VerseItem {
  verse: number;
  text: string;
  isOmitted?: boolean;
}

export interface ChapterData {
  translation: TranslationId;
  book: number;
  chapter: number;
  verses: VerseItem[];
  missingVerses: number[];
}

export interface ReadingFact {
  term: string;
  verse: number;
  text: string;
  sourceUrl: string;
}

export interface BookMeta {
  book: number;
  osis: string;
  testament: 'OT' | 'NT';
  category: string;
  nameKo: string;
  abbrKo: string;
  nameEn: string;
  abbrEn: string;
  chapters: number;
}

export interface ReadingPosition {
  translation: TranslationId;
  book: number;
  chapter: number;
  verse: number;
}

export interface ReturnOriginState extends ReadingPosition {
  scrollY?: number;
  reopenStudyVerse?: number | null;
}

export type PersonalRecordType = 'bookmark' | 'underline';

export interface PersonalRecord {
  id: string;
  type: PersonalRecordType;
  translation: TranslationId;
  book: number;
  chapter: number;
  verse: number;
  previewText: string;
  createdAt: number;
}

export interface ScriptureRef {
  book: number;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
  label: string;
  reason?: string;
}

export type LocationCertainty = 'confirmed' | 'traditional' | 'estimated' | 'unknown';

export interface MapStopCandidate {
  lat: number;
  lon: number;
  modernName: string;
  modernNameKo?: string;
  geometryType?: 'point' | 'center' | 'representative point';
  representative?: boolean;
  coordinateSource?: string;
  precisionMeters?: number;
  sourceUrl: string;
}

export interface AncientRegionItem {
  id: string;
  label: string;
  biblicalNameEn?: string;
  color?: string;
  svgPath?: string;
  lat: number;
  lon: number;
  sourceId: string;
  sourceUrl: string;
}

export interface MapScaleBarMeta {
  km: number;
  svgWidth: number;
}

export interface AttestedSequenceStep {
  from: string;
  to: string;
  verseRef: string;
}

export interface MapProjectionMeta {
  crs: string;
  name: string;
  standardParallel: number;
  viewBox: [number, number, number, number];
}

export interface MapStop {
  id: string;
  label: string;
  biblicalName?: string;
  biblicalNameEn?: string;
  modernName?: string;
  modernNameKo?: string;
  placeType?: 'settlement' | 'mountain' | 'water' | 'island' | 'region';
  locationStatus?: LocationCertainty;
  statusReason?: string;
  historicalBackground?: string;
  scriptureRef?: string;
  sourceUrl?: string;
  sourceId?: string;
  candidates?: MapStopCandidate[];
  /** 단일 유적 위치가 확정(confirmed)된 경우에만 설정. 복수 후보·추정·전통·미상 지명은 단일 좌표로 확정하지 않음 */
  lat?: number;
  lon?: number;
}

export interface BibleMapMeta {
  id: string;
  title: string;
  regionSummary: string;
  backdropImageUrl?: string;
  modernBordersImageUrl?: string;
  bbox?: number[];
  scaleBar?: MapScaleBarMeta;
  projection?: MapProjectionMeta;
  license: string;
  attribution: string;
  sourceNote: string;
  imageUrl?: string;
  ancientRegions?: AncientRegionItem[];
  stops: MapStop[];
}

export interface BookOverview {
  book: number;
  reviewed: boolean;
  statedFacts: string;
  interpretations: string;
  eraBackground: string;
  chronology: string;
  mapId?: string;
  keyVerse: ScriptureRef & { reason: string };
  sources: string[];
}

export interface ChapterSummarySection {
  reviewed: boolean;
  flow: string;
  statedFacts: string;
  interpretations: string;
  keyVerses: (ScriptureRef & { reason: string })[];
  sources: string[];
}

export interface ChapterBackgroundSection {
  reviewed: boolean;
  statedFacts: string;
  interpretations: string;
  divergentViews?: string;
  sources: string[];
}

export interface TimelineEvent {
  step: string;
  place?: string;
  description: string;
  verseRef?: string;
}

export interface ChapterMapTimelineSection {
  reviewed: boolean;
  mapId?: string;
  imageUrl?: string;
  imageAttribution?: string;
  imageLicense?: string;
  highlightRegions?: string[];
  highlightStops?: string[];
  attestedSequence?: AttestedSequenceStep[];
  events: TimelineEvent[];
  chronologyNote?: string;
  sources: string[];
}

export interface CharacterItem {
  name: string;
  disambiguation?: string;
  role: string;
  relationships: string;
  actionsInChapter: string;
  motiveNote?: string;
}

export interface ChapterCharactersSection {
  reviewed: boolean;
  items: CharacterItem[];
  sources: string[];
}

export interface RelatedPassageItem extends ScriptureRef {
  connectionType: string;
  reason: string;
}

export interface ChapterRelatedSection {
  reviewed: boolean;
  items: RelatedPassageItem[];
}

export interface ChapterCommentary {
  book: number;
  chapter: number;
  summary?: ChapterSummarySection;
  background?: ChapterBackgroundSection;
  mapTimeline?: ChapterMapTimelineSection;
  characters?: ChapterCharactersSection;
  relatedPassages?: ChapterRelatedSection;
}

export interface CommentaryIndex {
  version: number;
  maps: Record<string, BibleMapMeta>;
  bookOverviews: Record<string, BookOverview>;
  chaptersWithCommentary: string[];
}


/* ===== P0 절 단위 본문 탐구 (F01 ~ F04) 도메인 모델 ===== */

/** 표준 정규화 구절 식별자 (예: "AMOS.7.16" 또는 범위 "JOHN.1.1-3") */
export type CanonicalVerseId = string;

export type CrossRefRelationType =
  | 'DIRECT_QUOTE'
  | 'PROPHECY_FULFILLMENT'
  | 'PARALLEL_EVENT'
  | 'CONTEXT'
  | 'PERSON_EVENT'
  | 'THEME';

export type ReviewStatus = 'VERIFIED' | 'UNREVIEWED' | 'REJECTED';

export interface SourceMeta {
  id: string;
  title: string;
  authorOrOrg?: string;
  url?: string;
  license: string;
  attribution: string;
  version: string;
}

export interface CrossReferenceItem {
  sourceVerseId: CanonicalVerseId;
  targetVerseId: CanonicalVerseId;
  targetLabelKo: string;
  targetLabelEn?: string;
  relationType: CrossRefRelationType;
  reason: string;
  evidenceVerseIds: CanonicalVerseId[];
  sourceIds: string[];
  reviewStatus: ReviewStatus;
}

export interface PassageExpressionNote {
  term: string;
  verse?: number;
  meaning: string;
  basisType: 'STATED_FACT' | 'SCHOLARLY_INTERPRETATION';
}

export interface PassageContext {
  passageId: CanonicalVerseId;
  book: number;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  title: string;
  summary: string;
  statedFacts: string;
  speaker?: string;
  audience?: string;
  historicalSituation?: string;
  flow: string;
  interpretations?: string;
  divergentViews?: string;
  expressions?: PassageExpressionNote[];
  evidenceVerseIds: CanonicalVerseId[];
  sourceIds: string[];
  reviewStatus: ReviewStatus;
}

export interface TranslationNote {
  verseId: CanonicalVerseId;
  krPhrase: string;
  enPhrase: string;
  explanation: string;
  sourceIds: string[];
  reviewStatus: ReviewStatus;
}

export type VersificationAlignmentKind =
  | 'EXACT'
  | 'VERSE_SPLIT_SHIFT'
  | 'OMITTED_MANUSCRIPT'
  | 'MISSING_SOURCE_DATA';

export interface TranslationComparisonResult {
  verseId: CanonicalVerseId;
  book: number;
  chapter: number;
  requestedVerse: number;
  alignmentKind: VersificationAlignmentKind;
  alignmentNotice: string | null;
  krLabel: string;
  enLabel: string;
  krVerses: VerseItem[];
  enVerses: VerseItem[];
  notes: TranslationNote[];
}

export interface BookStudyBundle {
  book: number;
  osis: string;
  contentVersion: string;
  crossReferencesByVerse: Record<string, CrossReferenceItem[]>;
  passageContexts: PassageContext[];
  translationNotesByVerse: Record<string, TranslationNote[]>;
}

export interface StudyIndex {
  contentVersion: string;
  sources: Record<string, SourceMeta>;
  booksWithStudy: number[];
  /** 탐구 데이터(관주·문맥·번역노트)가 존재하는 장별 절 목록 ("30_7": [9, 10, ...]) */
  studyVersesByChapter: Record<string, number[]>;
}
