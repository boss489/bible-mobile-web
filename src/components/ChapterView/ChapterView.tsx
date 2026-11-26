import { useEffect, useMemo, useState } from 'react';
import {
  formatVerseRef,
  getAdjacentChapter,
  getChapterLabel,
  getTranslationLabel,
} from '../../config/books';
import { FONT_SIZE_OPTIONS } from '../../config/siteConfig';
import { makeRecordId } from '../../services/storage';
import {
  copyTextToClipboard,
  formatVerseClipboardText,
  shareOrCopyVerse,
} from '../../services/studyDataService';
import type {
  BookOverview,
  ChapterCommentary,
  ChapterData,
  FontSizeLevel,
  PersonalRecordType,
  ReadingFact,
  ReadingPosition,
  ScriptureRef,
} from '../../types/bible';
import type { BibleHistoryDataset, ChapterHistoryMapping } from '../../types/history';
import { HistoryTimeline } from '../HistoryTimeline/HistoryTimeline';

export type VerseStudyOpenMode = 'default' | 'translations';

interface ChapterViewProps {
  chapterData: ChapterData | null;
  loading: boolean;
  error: string | null;
  fontSize: FontSizeLevel;
  highlightedVerse: number | null;
  selectedVerse: number | null;
  verseNotice: string | null;
  returnOrigin: ReadingPosition | null;
  recordIds: ReadonlySet<string>;
  studyVersesInChapter?: ReadonlySet<number>;
  chapterCommentary?: ChapterCommentary | null;
  bookOverview?: BookOverview | null;
  readingFact?: ReadingFact;
  historyDataset?: BibleHistoryDataset | null;
  chapterHistoryContext?: ChapterHistoryMapping | null;
  onDismissNotice: () => void;
  onSelectVerse: (verse: number | null) => void;
  onToggleRecord: (type: PersonalRecordType, verse: number, text: string) => void;
  onOpenVerseStudy?: (verse: number, mode: VerseStudyOpenMode) => void;
  onOpenCommentary?: () => void;
  onSelectHistoryPassage?: (ref: ScriptureRef) => void;
  onOpenFullHistoryTimeline?: () => void;
  onNavigateChapter: (book: number, chapter: number, verse: number) => void;
  onReturnToOrigin: () => void;
}

export function ChapterView({
  chapterData,
  loading,
  error,
  fontSize,
  highlightedVerse,
  selectedVerse,
  verseNotice,
  returnOrigin,
  recordIds,
  studyVersesInChapter,
  chapterCommentary,
  bookOverview,
  readingFact,
  historyDataset = null,
  chapterHistoryContext = null,
  onDismissNotice,
  onSelectVerse,
  onToggleRecord,
  onOpenVerseStudy,
  onOpenCommentary,
  onSelectHistoryPassage,
  onOpenFullHistoryTimeline,
  onNavigateChapter,
  onReturnToOrigin,
}: ChapterViewProps) {
  const [actionToast, setActionToast] = useState<{ verse: number; msg: string } | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const fontMeta = FONT_SIZE_OPTIONS.find((f) => f.level === fontSize) ?? FONT_SIZE_OPTIONS[2];

  // 새 장으로 이동할 때 본문 집중을 위해 역사적 배경 패널은 기본 접힘 상태로 시작
  useEffect(() => {
    setIsHistoryOpen(false);
  }, [chapterData?.book, chapterData?.chapter]);

  const historyEra = useMemo(() => {
    if (!historyDataset || !chapterHistoryContext) return null;
    return historyDataset.eras.find((e) => e.id === chapterHistoryContext.eraId) ?? null;
  }, [historyDataset, chapterHistoryContext]);

  const showFeedback = (verse: number, msg: string) => {
    setActionToast({ verse, msg });
    window.setTimeout(() => {
      setActionToast((prev) => (prev?.verse === verse && prev.msg === msg ? null : prev));
    }, 1800);
  };

  if (loading && !chapterData) {
    return (
      <main className="chapter-main">
        <p className="chapter-status-msg">본문을 불러오는 중입니다...</p>
      </main>
    );
  }

  if (error || !chapterData) {
    return (
      <main className="chapter-main">
        <p className="chapter-status-msg chapter-error-msg" role="alert">
          {error ?? '본문을 표시할 수 없습니다.'}
        </p>
      </main>
    );
  }

  const prevTarget = getAdjacentChapter(chapterData.book, chapterData.chapter, 'prev');
  const nextTarget = getAdjacentChapter(chapterData.book, chapterData.chapter, 'next');
  const keyVerse = chapterCommentary?.summary?.reviewed
    ? chapterCommentary.summary.keyVerses[0]
    : null;

  return (
    <main
      className="chapter-main"
      style={{
        ['--verse-font-size' as string]: fontMeta.remSize,
        ['--verse-line-height' as string]: fontMeta.lineHeight,
      }}
    >
      {returnOrigin ? (
        <div className="return-origin-banner" role="region" aria-label="관련 본문 열람 복귀 안내">
          <div className="return-origin-info">
            <span className="return-badge">관련 구절 전체 읽기</span>
            <span className="return-desc">
              출발 위치: {formatVerseRef(returnOrigin.book, returnOrigin.chapter, returnOrigin.verse, 'kr')} (
              {getTranslationLabel(returnOrigin.translation)})
            </span>
          </div>
          <button type="button" className="return-origin-btn" onClick={onReturnToOrigin}>
            원래 본문으로 돌아가기
          </button>
        </div>
      ) : null}

      {verseNotice ? (
        <div className="verse-diff-banner" role="status" aria-live="polite">
          <p className="verse-diff-text">{verseNotice}</p>
          <button
            type="button"
            className="verse-diff-close"
            onClick={onDismissNotice}
            aria-label="절 번호 안내 닫기"
          >
            확인
          </button>
        </div>
      ) : null}

      <div className="chapter-heading-block">
        <h1 className="chapter-heading-title">
          {getChapterLabel(chapterData.book, chapterData.chapter, chapterData.translation)}
        </h1>
        <span className="chapter-heading-tr">{getTranslationLabel(chapterData.translation)}</span>
      </div>

      {/* 역사적 배경이 검증된 본문에만 버튼 제공 (기본 접힘 상태 권장 · 비역사 본문에는 임의 연대 미표시) */}
      {historyDataset && chapterHistoryContext ? (
        <section className="chapter-history-section" aria-label="현재 본문의 역사적 배경">
          <button
            type="button"
            className={`chapter-history-toggle-btn ${
              isHistoryOpen ? 'chapter-history-toggle-open' : ''
            }`}
            aria-expanded={isHistoryOpen}
            onClick={() => setIsHistoryOpen((prev) => !prev)}
          >
            <span className="chapter-history-toggle-info">
              <strong className="chapter-history-badge">역사적 배경</strong>
              <span className="chapter-history-period">{chapterHistoryContext.displayPeriodKo}</span>
              {historyEra ? (
                <span className="chapter-history-era">· {historyEra.nameKo}</span>
              ) : null}
            </span>
            <span className="chapter-history-chevron" aria-hidden="true">
              {isHistoryOpen ? '접기 ▴' : '열기 ▾'}
            </span>
          </button>

          {isHistoryOpen ? (
            <div className="chapter-history-drawer">
              <HistoryTimeline
                variant="embedded"
                dataset={historyDataset}
                translation={chapterData.translation}
                anchorMapping={chapterHistoryContext}
                onSelectPassage={(ref) => onSelectHistoryPassage?.(ref)}
                onOpenFullTimeline={onOpenFullHistoryTimeline}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {!keyVerse && !readingFact && chapterData.chapter === 1 && bookOverview?.reviewed && onOpenCommentary ? (
        <button type="button" className="reading-context-cue" onClick={onOpenCommentary}>
          <span className="reading-context-label">이 책의 배경</span>
          <span className="reading-context-text">{bookOverview.statedFacts}</span>
          <span aria-hidden="true">›</span>
        </button>
      ) : null}

      <div className="verses-list" role="list">
        {chapterData.verses.map((v) => {
          const isBookmarked = recordIds.has(
            makeRecordId('bookmark', chapterData.book, chapterData.chapter, v.verse),
          );
          const isUnderlined = recordIds.has(
            makeRecordId('underline', chapterData.book, chapterData.chapter, v.verse),
          );
          const hasStudyNotes = Boolean(studyVersesInChapter?.has(v.verse));
          const isSelected = selectedVerse === v.verse;
          const isHighlighted = highlightedVerse === v.verse;

          return (
            <div
              key={v.verse}
              id={`verse-${v.verse}`}
              data-verse={v.verse}
              role="listitem"
              className={`verse-row ${isHighlighted ? 'verse-row-highlighted' : ''} ${
                isSelected ? 'verse-row-selected' : ''
              } ${v.isOmitted ? 'verse-row-omitted' : ''}`}
            >
              <button
                id={`verse-btn-${v.verse}`}
                type="button"
                className="verse-tap-area"
                onClick={() => onSelectVerse(isSelected ? null : v.verse)}
                aria-expanded={isSelected}
                aria-label={`${v.verse}절 선택${isBookmarked ? ', 책갈피됨' : ''}${
                  isUnderlined ? ', 밑줄됨' : ''
                }${hasStudyNotes ? ', 탐구 해설 있음' : ''}`}
              >
                <span className="verse-num-wrap">
                  <span className="verse-num">{v.verse}</span>
                  {hasStudyNotes ? (
                    <span
                      className="study-verse-dot"
                      title="검수된 본문 탐구 자료 있음"
                      aria-hidden="true"
                    />
                  ) : null}
                  {isBookmarked ? (
                    <span className="bookmark-indicator" aria-label="책갈피 표시됨" title="책갈피">
                      🔖
                    </span>
                  ) : null}
                </span>
                <span
                  className={`verse-text ${isUnderlined ? 'verse-text-underlined' : ''}`}
                  data-underlined={isUnderlined ? 'true' : 'false'}
                >
                  {v.text}
                </span>
              </button>

              {isSelected ? (
                <div className="verse-action-bar" role="toolbar" aria-label={`${v.verse}절 도구`}>
                  {onOpenVerseStudy ? (
                    <>
                      <button
                        type="button"
                        className="verse-tool-btn verse-tool-primary"
                        onClick={() => onOpenVerseStudy(v.verse, 'default')}
                      >
                        <span>본문 탐구</span>
                        {hasStudyNotes ? <span className="verse-tool-dot" aria-hidden="true" /> : null}
                      </button>
                      <button
                        type="button"
                        className="verse-tool-btn"
                        onClick={() => onOpenVerseStudy(v.verse, 'translations')}
                      >
                        번역 비교
                      </button>
                    </>
                  ) : null}

                  <button
                    type="button"
                    className={`verse-tool-btn ${isBookmarked ? 'verse-tool-active' : ''}`}
                    aria-pressed={isBookmarked}
                    onClick={() => onToggleRecord('bookmark', v.verse, v.text)}
                  >
                    {isBookmarked ? '책갈피 해제' : '책갈피 추가'}
                  </button>
                  <button
                    type="button"
                    className={`verse-tool-btn ${isUnderlined ? 'verse-tool-active' : ''}`}
                    aria-pressed={isUnderlined}
                    onClick={() => onToggleRecord('underline', v.verse, v.text)}
                  >
                    {isUnderlined ? '밑줄 해제' : '밑줄 긋기'}
                  </button>
                  <button
                    type="button"
                    className="verse-tool-btn"
                    onClick={async () => {
                      const ok = await copyTextToClipboard(
                        formatVerseClipboardText(
                          chapterData.book,
                          chapterData.chapter,
                          v.verse,
                          chapterData.translation,
                          v.text,
                        ),
                      );
                      showFeedback(v.verse, ok ? '복사됨' : '복사 실패');
                    }}
                  >
                    복사
                  </button>
                  <button
                    type="button"
                    className="verse-tool-btn"
                    onClick={async () => {
                      const res = await shareOrCopyVerse({
                        book: chapterData.book,
                        chapter: chapterData.chapter,
                        verse: v.verse,
                        translation: chapterData.translation,
                        text: v.text,
                      });
                      if (res === 'shared') showFeedback(v.verse, '공유됨');
                      else if (res === 'copied') showFeedback(v.verse, '클립보드에 복사됨');
                    }}
                  >
                    공유
                  </button>
                  {actionToast?.verse === v.verse ? (
                    <span className="verse-toast-pill" role="status" aria-live="polite">
                      {actionToast.msg}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {keyVerse?.verseStart === v.verse && onOpenCommentary ? (
                <button type="button" className="reading-context-cue" onClick={onOpenCommentary}>
                  <span className="reading-context-label">이 장의 흐름</span>
                  <span className="reading-context-text">{keyVerse.reason}</span>
                  <span aria-hidden="true">›</span>
                </button>
              ) : null}
              {!keyVerse && chapterData.translation === 'kr' && readingFact?.verse === v.verse ? (
                <aside className="reading-fact" aria-label={`${readingFact.term} 설명`}>
                  <strong>{readingFact.term}</strong>
                  <span>{readingFact.text}</span>
                  <a href={readingFact.sourceUrl} target="_blank" rel="noopener noreferrer">출처</a>
                </aside>
              ) : null}
            </div>
          );
        })}
      </div>

      <nav className="chapter-bottom-nav" aria-label="이전 장 및 다음 장 이동">
        <button
          type="button"
          className="chapter-nav-btn"
          disabled={!prevTarget}
          onClick={() => prevTarget && onNavigateChapter(prevTarget.book, prevTarget.chapter, 1)}
        >
          <span className="nav-dir-label">← 이전 장</span>
          <span className="nav-target-name">
            {prevTarget ? getChapterLabel(prevTarget.book, prevTarget.chapter, 'kr') : '첫 장입니다'}
          </span>
        </button>

        <button
          type="button"
          className="chapter-nav-btn chapter-nav-next"
          disabled={!nextTarget}
          onClick={() => nextTarget && onNavigateChapter(nextTarget.book, nextTarget.chapter, 1)}
        >
          <span className="nav-dir-label">다음 장 →</span>
          <span className="nav-target-name">
            {nextTarget ? getChapterLabel(nextTarget.book, nextTarget.chapter, 'kr') : '마지막 장입니다'}
          </span>
        </button>
      </nav>
    </main>
  );
}
