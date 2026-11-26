import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChapterView, type VerseStudyOpenMode } from './components/ChapterView/ChapterView';
import { CommentarySheet } from './components/CommentarySheet/CommentarySheet';
import { EntryGate } from './components/EntryGate/EntryGate';
import { HistoryTimeline } from './components/HistoryTimeline/HistoryTimeline';
import { MainHome } from './components/MainHome/MainHome';
import { MyRecordsModal } from './components/MyRecordsModal/MyRecordsModal';
import { PassageNavigator } from './components/PassageNavigator/PassageNavigator';
import { ReaderHeader } from './components/ReaderHeader/ReaderHeader';
import { VerseStudySheet, type VerseStudyTabKey } from './components/VerseStudySheet/VerseStudySheet';
import { formatVerseRef, getChapterLabel, getTranslationLabel } from './config/books';
import { DEFAULT_START_POSITION } from './config/siteConfig';
import {
  loadBibleHistoryDataset,
  loadChapterCommentary,
  loadChapterData,
  loadCommentaryIndex,
  loadReadingFacts,
  loadStudyIndex,
  prefetchAdjacentChapters,
} from './services/dataLoader';
import { findChapterHistoryContext } from './services/historyDataService';
import {
  isSessionUnlocked,
  loadFontSize,
  loadLastReadPosition,
  loadPersonalRecords,
  removePersonalRecord,
  saveFontSize,
  saveLastReadPosition,
  saveUnlockedSession,
  togglePersonalRecord,
} from './services/storage';
import { resolveVerseInChapter } from './services/verseResolver';
import type {
  ChapterCommentary,
  ChapterData,
  CommentaryIndex,
  FontSizeLevel,
  PersonalRecord,
  PersonalRecordType,
  ReadingFact,
  ReadingPosition,
  ReturnOriginState,
  ScriptureRef,
  StudyIndex,
  TranslationId,
} from './types/bible';
import type {
  BibleHistoryDataset,
  ChapterHistoryMapping,
  TimelineViewState,
} from './types/history';

export type AppScreen = 'home' | 'canon' | 'timeline' | 'reader';

interface PendingVerseIntent {
  verse: number;
  isTranslationSwitch: boolean;
  shouldHighlight: boolean;
  shouldScroll: boolean;
  exactScrollY?: number;
}

interface ReaderReturnSnapshot extends ReadingPosition {
  scrollY: number;
}

function parseScreenFromHash(hash: string): AppScreen {
  if (hash.startsWith('#/timeline')) return 'timeline';
  if (hash.startsWith('#/canon')) return 'canon';
  if (hash.startsWith('#/read')) return 'reader';
  return 'home';
}

function screenToHash(screen: AppScreen): string {
  switch (screen) {
    case 'timeline':
      return '#/timeline';
    case 'canon':
      return '#/canon';
    case 'reader':
      return '#/read';
    case 'home':
    default:
      return '#/';
  }
}

export function App() {
  const initialSavedPos = useMemo(() => loadLastReadPosition(), []);
  const startPos = initialSavedPos ?? DEFAULT_START_POSITION;

  const [unlocked, setUnlocked] = useState<boolean>(() => isSessionUnlocked());
  const [screen, setScreen] = useState<AppScreen>(() =>
    typeof window !== 'undefined' ? parseScreenFromHash(window.location.hash) : 'home',
  );
  const [lastReadPos, setLastReadPos] = useState<ReadingPosition | null>(initialSavedPos);

  const [translation, setTranslation] = useState<TranslationId>(startPos.translation);
  const [book, setBook] = useState<number>(startPos.book);
  const [chapter, setChapter] = useState<number>(startPos.chapter);
  const [activeVerse, setActiveVerse] = useState<number>(startPos.verse);
  const activeVerseRef = useRef<number>(startPos.verse);

  const [fontSize, setFontSize] = useState<FontSizeLevel>(() => loadFontSize());
  const [records, setRecords] = useState<PersonalRecord[]>(() => loadPersonalRecords());

  const [chapterData, setChapterData] = useState<ChapterData | null>(null);
  const [loadingChapter, setLoadingChapter] = useState<boolean>(false);
  const [chapterError, setChapterError] = useState<string | null>(null);

  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [highlightedVerse, setHighlightedVerse] = useState<number | null>(
    initialSavedPos && initialSavedPos.verse > 1 ? initialSavedPos.verse : null,
  );
  const [verseNotice, setVerseNotice] = useState<string | null>(null);
  const [returnOrigin, setReturnOrigin] = useState<ReturnOriginState | null>(null);

  const [isNavigatorOpen, setIsNavigatorOpen] = useState<boolean>(false);
  const [isCommentaryOpen, setIsCommentaryOpen] = useState<boolean>(false);
  const [isRecordsOpen, setIsRecordsOpen] = useState<boolean>(false);
  const [studyVerse, setStudyVerse] = useState<number | null>(null);
  const [studyInitialTab, setStudyInitialTab] = useState<VerseStudyTabKey>('references');

  const [commentaryIndex, setCommentaryIndex] = useState<CommentaryIndex | null>(null);
  const [readingFacts, setReadingFacts] = useState<Record<string, ReadingFact>>({});
  const [chapterCommentary, setChapterCommentary] = useState<ChapterCommentary | null>(null);
  const [studyIndex, setStudyIndex] = useState<StudyIndex | null>(null);

  const [historyDataset, setHistoryDataset] = useState<BibleHistoryDataset | null>(null);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // 연대표 상태 보존 및 양방향 이동 복귀 상태
  const latestTimelineStateRef = useRef<TimelineViewState | null>(null);
  const [savedTimelineState, setSavedTimelineState] = useState<TimelineViewState | null>(null);
  const [timelineAnchorOverride, setTimelineAnchorOverride] =
    useState<ChapterHistoryMapping | null>(null);
  const [readerBackSource, setReaderBackSource] = useState<'timeline' | 'canon' | null>(null);
  const [timelineBackToReader, setTimelineBackToReader] = useState<ReaderReturnSnapshot | null>(
    null,
  );

  const pendingIntentRef = useRef<PendingVerseIntent>({
    verse: startPos.verse,
    isTranslationSwitch: false,
    shouldHighlight: Boolean(initialSavedPos && initialSavedPos.verse > 1),
    shouldScroll: startPos.verse > 1,
  });

  const scrollTargetVerseRef = useRef<number | null>(null);
  const exactScrollRestoreRef = useRef<number | null>(null);
  const fontAnchorRef = useRef<{ verse: number; offsetFromHeader: number } | null>(null);

  const persistLastRead = useCallback((pos: ReadingPosition) => {
    saveLastReadPosition(pos);
    setLastReadPos(pos);
  }, []);

  const updateActiveVerse = useCallback((v: number) => {
    activeVerseRef.current = v;
    setActiveVerse(v);
  }, []);

  const navigateScreen = useCallback((nextScreen: AppScreen, replace = false) => {
    setScreen(nextScreen);
    if (typeof window !== 'undefined') {
      const targetHash = screenToHash(nextScreen);
      if (window.location.hash !== targetHash) {
        if (replace) {
          window.history.replaceState({ screen: nextScreen }, '', targetHash);
        } else {
          window.history.pushState({ screen: nextScreen }, '', targetHash);
        }
      }
    }
  }, []);

  // 브라우저 뒤로 가기(popstate) 시 화면 및 연대표 스크롤·필터·선택 상태 복원
  useEffect(() => {
    const onPopState = () => {
      const next = parseScreenFromHash(window.location.hash);
      if (next === 'timeline' && latestTimelineStateRef.current) {
        setSavedTimelineState(latestTimelineStateRef.current);
      }
      setScreen(next);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // 해설 인덱스, 본문 탐구 인덱스, 역사 연대표 데이터 로드 (정적 JSON 1회)
  const fetchHistory = useCallback(() => {
    setHistoryLoading(true);
    setHistoryError(null);
    loadBibleHistoryDataset()
      .then((ds) => {
        setHistoryDataset(ds);
        setHistoryLoading(false);
      })
      .catch((err: unknown) => {
        setHistoryLoading(false);
        setHistoryError(
          err instanceof Error ? err.message : '역사 연대표 데이터를 불러오지 못했습니다.',
        );
      });
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    loadCommentaryIndex()
      .then((idx) => setCommentaryIndex(idx))
      .catch(() => setCommentaryIndex(null));
    loadStudyIndex()
      .then((idx) => setStudyIndex(idx))
      .catch(() => setStudyIndex(null));
    loadReadingFacts()
      .then(setReadingFacts)
      .catch(() => setReadingFacts({}));
    fetchHistory();
  }, [unlocked, fetchHistory]);

  // 현재 장의 장별 상세 해설 로드 (본문 읽기 화면일 때)
  useEffect(() => {
    if (!unlocked || screen !== 'reader') return;
    let cancelled = false;
    loadChapterCommentary(book, chapter, commentaryIndex?.chaptersWithCommentary)
      .then((comm) => {
        if (!cancelled) setChapterCommentary(comm);
      })
      .catch(() => {
        if (!cancelled) setChapterCommentary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [unlocked, screen, book, chapter, commentaryIndex]);

  // 현재 장 본문 로드 및 절 검증 (본문 읽기 화면일 때만 실행 — 메인 화면 진입 시 이어읽기 기록 오염 방지!)
  useEffect(() => {
    if (!unlocked || screen !== 'reader') return;
    let cancelled = false;
    setLoadingChapter(true);
    setChapterError(null);

    const intent = pendingIntentRef.current;

    loadChapterData(translation, book, chapter)
      .then((data) => {
        if (cancelled) return;
        const resolution = resolveVerseInChapter(data, intent.verse, {
          isTranslationSwitch: intent.isTranslationSwitch,
        });

        setChapterData(data);
        setLoadingChapter(false);
        setSelectedVerse(null);
        setVerseNotice(resolution.notice);
        updateActiveVerse(resolution.resolvedVerse);
        setHighlightedVerse(
          intent.shouldHighlight || Boolean(resolution.notice) ? resolution.resolvedVerse : null,
        );

        exactScrollRestoreRef.current =
          typeof intent.exactScrollY === 'number' ? intent.exactScrollY : null;
        scrollTargetVerseRef.current = intent.shouldScroll ? resolution.resolvedVerse : 0;

        if (!returnOrigin) {
          persistLastRead({
            translation,
            book,
            chapter,
            verse: resolution.resolvedVerse,
          });
        }

        prefetchAdjacentChapters(translation, book, chapter);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadingChapter(false);
        setChapterError(err instanceof Error ? err.message : '본문을 불러오지 못했습니다.');
      });

    return () => {
      cancelled = true;
    };
  }, [unlocked, screen, translation, book, chapter, returnOrigin, updateActiveVerse, persistLastRead]);

  // 장 전환·번역 전환·절 점프 후 목표 절 또는 출발 스크롤 위치로 복원
  useLayoutEffect(() => {
    if (screen !== 'reader' || !chapterData || scrollTargetVerseRef.current === null) return;
    const targetV = scrollTargetVerseRef.current;
    const exactY = exactScrollRestoreRef.current;
    scrollTargetVerseRef.current = null;
    exactScrollRestoreRef.current = null;

    if (exactY !== null) {
      window.scrollTo(0, Math.max(0, exactY));
      return;
    }

    if (targetV <= 1) {
      window.scrollTo(0, 0);
      return;
    }

    const verseEl = document.getElementById(`verse-${targetV}`);
    if (!verseEl) return;

    const headerEl = document.getElementById('reader-sticky-header');
    const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;
    const targetTop = window.scrollY + verseEl.getBoundingClientRect().top - headerHeight - 12;
    window.scrollTo(0, Math.max(0, targetTop));
  }, [screen, chapterData]);

  // 글자 크기 변경 직후 읽던 절이 화면 같은 위치에 남도록 스크롤 보정
  useLayoutEffect(() => {
    if (screen !== 'reader') return;
    const anchor = fontAnchorRef.current;
    if (!anchor) return;
    fontAnchorRef.current = null;

    const verseEl = document.getElementById(`verse-${anchor.verse}`);
    if (!verseEl) return;

    const headerEl = document.getElementById('reader-sticky-header');
    const headerBottom = headerEl ? headerEl.getBoundingClientRect().bottom : 0;
    const currentOffsetFromHeader = verseEl.getBoundingClientRect().top - headerBottom;
    const delta = currentOffsetFromHeader - anchor.offsetFromHeader;

    if (Math.abs(delta) > 0.5) {
      window.scrollTo(0, Math.max(0, window.scrollY + delta));
    }
  }, [fontSize, screen]);

  const isAnySheetOpen =
    isNavigatorOpen || isCommentaryOpen || isRecordsOpen || studyVerse !== null;

  // 본문 스크롤 시 현재 읽고 있는 절 추적
  useEffect(() => {
    if (!unlocked || screen !== 'reader' || !chapterData || isAnySheetOpen) {
      return;
    }

    let rafId = 0;
    const detectVisibleVerse = () => {
      const headerEl = document.getElementById('reader-sticky-header');
      const thresholdY = (headerEl ? headerEl.getBoundingClientRect().bottom : 0) + 16;
      const rows = document.querySelectorAll<HTMLElement>('[data-verse]');

      let foundVerse: number | null = null;
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (rect.bottom > thresholdY) {
          const parsed = Number(row.dataset.verse);
          if (!Number.isNaN(parsed)) {
            foundVerse = parsed;
            break;
          }
        }
      }

      if (foundVerse !== null && foundVerse !== activeVerseRef.current) {
        updateActiveVerse(foundVerse);
        if (!returnOrigin) {
          persistLastRead({
            translation,
            book,
            chapter,
            verse: foundVerse,
          });
        }
      }
    };

    const onScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(detectVisibleVerse);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [
    unlocked,
    screen,
    chapterData,
    isAnySheetOpen,
    returnOrigin,
    translation,
    book,
    chapter,
    updateActiveVerse,
    persistLastRead,
  ]);

  const handleUnlockSuccess = () => {
    saveUnlockedSession();
    setUnlocked(true);
    navigateScreen('home', true);
  };

  const navigateTo = useCallback(
    (
      nextTranslation: TranslationId,
      nextBook: number,
      nextChapter: number,
      nextVerse: number,
      opts?: {
        isSwitch?: boolean;
        highlight?: boolean;
        clearReturnOrigin?: boolean;
        exactScrollY?: number;
        openReader?: boolean;
      },
    ) => {
      if (opts?.clearReturnOrigin) {
        setReturnOrigin(null);
      }

      const targetOpenReader = opts?.openReader ?? true;
      const alreadyInReader = screen === 'reader';
      const sameChapterAndTranslation =
        alreadyInReader &&
        nextTranslation === translation &&
        nextBook === book &&
        nextChapter === chapter &&
        chapterData?.translation === nextTranslation &&
        chapterData?.book === nextBook &&
        chapterData?.chapter === nextChapter;

      pendingIntentRef.current = {
        verse: nextVerse,
        isTranslationSwitch: Boolean(opts?.isSwitch),
        shouldHighlight: Boolean(opts?.highlight ?? nextVerse > 1),
        shouldScroll: true,
        exactScrollY: opts?.exactScrollY,
      };

      if (targetOpenReader && !alreadyInReader) {
        navigateScreen('reader');
      }

      if (sameChapterAndTranslation && chapterData) {
        const resolution = resolveVerseInChapter(chapterData, nextVerse, {
          isTranslationSwitch: Boolean(opts?.isSwitch),
        });
        setVerseNotice(resolution.notice);
        updateActiveVerse(resolution.resolvedVerse);
        setHighlightedVerse(
          opts?.highlight || resolution.resolvedVerse > 1 ? resolution.resolvedVerse : null,
        );
        setSelectedVerse(null);

        if (typeof opts?.exactScrollY === 'number') {
          window.scrollTo(0, Math.max(0, opts.exactScrollY));
        } else {
          const verseEl = document.getElementById(`verse-${resolution.resolvedVerse}`);
          if (verseEl && resolution.resolvedVerse > 1) {
            const headerEl = document.getElementById('reader-sticky-header');
            const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;
            const targetTop =
              window.scrollY + verseEl.getBoundingClientRect().top - headerHeight - 12;
            window.scrollTo(0, Math.max(0, targetTop));
          } else {
            window.scrollTo(0, 0);
          }
        }

        if (!returnOrigin || opts?.clearReturnOrigin) {
          persistLastRead({
            translation: nextTranslation,
            book: nextBook,
            chapter: nextChapter,
            verse: resolution.resolvedVerse,
          });
        }
        return;
      }

      setTranslation(nextTranslation);
      setBook(nextBook);
      setChapter(nextChapter);
    },
    [
      screen,
      translation,
      book,
      chapter,
      chapterData,
      returnOrigin,
      navigateScreen,
      updateActiveVerse,
      persistLastRead,
    ],
  );

  const handleSwitchTranslation = (nextTranslation: TranslationId) => {
    if (screen !== 'reader') {
      setTranslation(nextTranslation);
      return;
    }
    const currentReadingVerse = studyVerse ?? selectedVerse ?? activeVerseRef.current;
    navigateTo(nextTranslation, book, chapter, currentReadingVerse, {
      isSwitch: true,
      highlight: true,
    });
  };

  const handleChangeFontSize = (nextSize: FontSizeLevel) => {
    const anchorVerse = selectedVerse ?? activeVerseRef.current;
    const verseEl = document.getElementById(`verse-${anchorVerse}`);
    const headerEl = document.getElementById('reader-sticky-header');
    const headerBottom = headerEl ? headerEl.getBoundingClientRect().bottom : 0;
    const offsetFromHeader = verseEl ? verseEl.getBoundingClientRect().top - headerBottom : 0;

    fontAnchorRef.current = { verse: anchorVerse, offsetFromHeader };
    setFontSize(nextSize);
    saveFontSize(nextSize);
  };

  const handleSelectVerseInBody = (verse: number | null) => {
    setSelectedVerse(verse);
    if (verse !== null) {
      updateActiveVerse(verse);
      if (!returnOrigin) {
        persistLastRead({ translation, book, chapter, verse });
      }
    }
  };

  const handleOpenVerseStudy = (verse: number, mode: VerseStudyOpenMode) => {
    setStudyInitialTab(mode === 'translations' ? 'translations' : 'references');
    setStudyVerse(verse);
  };

  const handleChangeVerseInStudySheet = (nextVerse: number) => {
    setStudyVerse(nextVerse);
    setSelectedVerse(nextVerse);
    updateActiveVerse(nextVerse);
    if (!returnOrigin) {
      persistLastRead({ translation, book, chapter, verse: nextVerse });
    }
  };

  const captureCurrentScrollY = (): number => {
    if (document.body.style.position === 'fixed' && document.body.style.top) {
      const parsed = Math.abs(parseFloat(document.body.style.top));
      if (!Number.isNaN(parsed)) return parsed;
    }
    return window.scrollY;
  };

  const handleToggleRecord = (type: PersonalRecordType, verse: number, text: string) => {
    setRecords((prev) =>
      togglePersonalRecord(prev, {
        type,
        translation,
        book,
        chapter,
        verse,
        previewText: text,
      }),
    );
  };

  const handleRemoveRecord = (id: string) => {
    setRecords((prev) => removePersonalRecord(prev, id));
  };

  const handleReadFullRelatedChapter = (ref: ScriptureRef, originStudyVerse?: number) => {
    const originToSave: ReturnOriginState = returnOrigin ?? {
      translation,
      book,
      chapter,
      verse: originStudyVerse ?? selectedVerse ?? activeVerseRef.current,
      scrollY: captureCurrentScrollY(),
      reopenStudyVerse: originStudyVerse ?? null,
    };
    setReturnOrigin(originToSave);
    setIsCommentaryOpen(false);
    setStudyVerse(null);
    navigateTo(translation, ref.book, ref.chapter, ref.verseStart, {
      highlight: true,
    });
  };

  const handleReturnToOrigin = () => {
    if (!returnOrigin) return;
    const dest = returnOrigin;
    setReturnOrigin(null);
    const cleanPos: ReadingPosition = {
      translation: dest.translation,
      book: dest.book,
      chapter: dest.chapter,
      verse: dest.verse,
    };
    persistLastRead(cleanPos);
    navigateTo(dest.translation, dest.book, dest.chapter, dest.verse, {
      highlight: true,
      clearReturnOrigin: true,
      exactScrollY: dest.scrollY,
    });
  };

  const currentChapterHistoryContext = useMemo(
    () =>
      findChapterHistoryContext(
        historyDataset,
        book,
        chapter,
        selectedVerse ?? activeVerse,
      ),
    [historyDataset, book, chapter, selectedVerse, activeVerse],
  );

  // 본문 화면의 역사적 배경 -> '전체 역사 연대표 보기' 클릭 시
  const handleOpenFullTimelineFromReader = () => {
    setTimelineBackToReader({
      translation,
      book,
      chapter,
      verse: selectedVerse ?? activeVerseRef.current,
      scrollY: captureCurrentScrollY(),
    });
    setSavedTimelineState(null);
    setTimelineAnchorOverride(currentChapterHistoryContext);
    navigateScreen('timeline');
    window.scrollTo(0, 0);
  };

  // 연대표에서 말씀 클릭 -> 본문 화면으로 이동 (뒤로 가기용 연대표 상태 저장)
  const handleSelectPassageFromTimeline = (ref: ScriptureRef, viewState: TimelineViewState) => {
    latestTimelineStateRef.current = viewState;
    setSavedTimelineState(viewState);
    setReaderBackSource('timeline');
    setTimelineBackToReader(null);
    navigateTo(translation, ref.book, ref.chapter, ref.verseStart, {
      highlight: true,
      clearReturnOrigin: true,
      openReader: true,
    });
  };

  // 본문 화면 헤더에서 '← 연대표' 또는 '← 성경 목차' 클릭 시 복귀
  const handleReaderBack = () => {
    if (readerBackSource === 'timeline') {
      if (latestTimelineStateRef.current) {
        setSavedTimelineState(latestTimelineStateRef.current);
      }
      navigateScreen('timeline');
      return;
    }
    if (readerBackSource === 'canon') {
      navigateScreen('canon');
      window.scrollTo(0, 0);
    }
  };

  const recordIdSet = useMemo(() => new Set(records.map((r) => r.id)), [records]);
  const studyVersesInChapter = useMemo(() => {
    const arr = studyIndex?.studyVersesByChapter[`${book}_${chapter}`] ?? [];
    return new Set<number>(arr);
  }, [studyIndex, book, chapter]);

  const resumeLabel = lastReadPos
    ? `${formatVerseRef(
        lastReadPos.book,
        lastReadPos.chapter,
        lastReadPos.verse,
        'kr',
      )} · ${getTranslationLabel(lastReadPos.translation)}`
    : null;

  if (!unlocked) {
    return (
      <EntryGate
        hasResumeRecord={Boolean(lastReadPos)}
        resumeSummaryLabel={resumeLabel}
        onUnlockSuccess={handleUnlockSuccess}
      />
    );
  }

  const hasChapterCommentary = Boolean(
    commentaryIndex?.chaptersWithCommentary.includes(`${book}_${chapter}`),
  );
  const currentBookOverview = commentaryIndex?.bookOverviews[String(book)] ?? null;

  // 마지막 읽던 위치 기준의 연대표 기본 앵커 (메인 -> 연대순 읽기 직접 진입 시 '현재 위치 복귀' 기준점 지원)
  const fallbackAnchorFromLastRead = lastReadPos
    ? findChapterHistoryContext(
        historyDataset,
        lastReadPos.book,
        lastReadPos.chapter,
        lastReadPos.verse,
      )
    : null;

  return (
    <>
      {screen === 'home' ? (
        <MainHome
          translation={translation}
          lastReadPos={lastReadPos}
          recordsCount={records.length}
          onSelectCanonicalPath={() => {
            navigateScreen('canon');
            window.scrollTo(0, 0);
          }}
          onSelectChronologicalPath={() => {
            setTimelineBackToReader(null);
            setTimelineAnchorOverride(null);
            navigateScreen('timeline');
            window.scrollTo(0, 0);
          }}
          onResumeReading={(pos) => {
            setReaderBackSource(null);
            navigateTo(pos.translation, pos.book, pos.chapter, pos.verse, {
              highlight: pos.verse > 1,
              clearReturnOrigin: true,
              openReader: true,
            });
          }}
          onSwitchTranslation={handleSwitchTranslation}
          onOpenRecords={() => setIsRecordsOpen(true)}
        />
      ) : null}

      {screen === 'canon' ? (
        <PassageNavigator
          isOpen
          mode="page"
          currentBook={book}
          currentChapter={chapter}
          currentVerse={activeVerse}
          translation={translation}
          onSwitchTranslation={handleSwitchTranslation}
          onSelectPassage={(nextB, nextC, nextV) => {
            setReaderBackSource('canon');
            navigateTo(translation, nextB, nextC, nextV, {
              highlight: nextV > 1,
              clearReturnOrigin: true,
              openReader: true,
            });
          }}
          onClose={() => {
            navigateScreen('home');
            window.scrollTo(0, 0);
          }}
        />
      ) : null}

      {screen === 'timeline' ? (
        <div className="timeline-page-shell">
          <header className="subpage-header">
            <div className="subpage-header-left">
              <button
                type="button"
                className="nav-back-btn"
                onClick={() => {
                  setTimelineBackToReader(null);
                  navigateScreen('home');
                  window.scrollTo(0, 0);
                }}
                aria-label="메인 홈 화면으로 이동"
              >
                홈
              </button>

              {timelineBackToReader ? (
                <button
                  type="button"
                  className="reader-back-route-btn"
                  onClick={() => {
                    const dest = timelineBackToReader;
                    setTimelineBackToReader(null);
                    navigateTo(dest.translation, dest.book, dest.chapter, dest.verse, {
                      highlight: dest.verse > 1,
                      exactScrollY: dest.scrollY,
                      openReader: true,
                    });
                  }}
                >
                  ← 읽던 본문 ({getChapterLabel(timelineBackToReader.book, timelineBackToReader.chapter, 'kr')})
                </button>
              ) : null}

              <div>
                <h1 className="subpage-title">연대순 읽기 · 통합 역사 연대표</h1>
                <p className="subpage-subtitle">
                  시대 · 왕국 · 인물 · 사건을 선택해 연결된 성경 본문으로 바로 이동합니다
                </p>
              </div>
            </div>

            <div className="subpage-header-right">
              <div className="translation-toggle" role="group" aria-label="번역본 선택">
                <button
                  type="button"
                  className={`tr-btn ${translation === 'kr' ? 'tr-btn-active' : ''}`}
                  aria-pressed={translation === 'kr'}
                  onClick={() => {
                    if (translation !== 'kr') handleSwitchTranslation('kr');
                  }}
                >
                  개역개정
                </button>
                <button
                  type="button"
                  className={`tr-btn ${translation === 'en' ? 'tr-btn-active' : ''}`}
                  aria-pressed={translation === 'en'}
                  onClick={() => {
                    if (translation !== 'en') handleSwitchTranslation('en');
                  }}
                >
                  NIV
                </button>
              </div>

              <button
                type="button"
                className="toolbar-action-btn"
                onClick={() => setIsRecordsOpen(true)}
                aria-label={`내 기록 열기${records.length > 0 ? ` (${records.length}개)` : ''}`}
              >
                <span>내 기록</span>
                {records.length > 0 ? <span className="records-badge">{records.length}</span> : null}
              </button>
            </div>
          </header>

          <main className="timeline-page-main">
            {historyLoading && !historyDataset ? (
              <div className="study-state-box">
                <p className="study-state-text">통합 역사 연대표를 불러오는 중입니다...</p>
              </div>
            ) : historyError || !historyDataset ? (
              <div className="study-state-box study-error-box" role="alert">
                <p className="study-error-text">
                  {historyError ?? '역사 연대표를 표시할 수 없습니다.'}
                </p>
                <button type="button" className="study-retry-btn" onClick={fetchHistory}>
                  다시 시도
                </button>
              </div>
            ) : (
              <HistoryTimeline
                variant="page"
                dataset={historyDataset}
                translation={translation}
                anchorMapping={timelineAnchorOverride ?? fallbackAnchorFromLastRead}
                initialViewState={savedTimelineState}
                onViewStateChange={(st) => {
                  latestTimelineStateRef.current = st;
                }}
                onSelectPassage={handleSelectPassageFromTimeline}
              />
            )}
          </main>
        </div>
      ) : null}

      {screen === 'reader' ? (
        <div className="app-shell">
          <ReaderHeader
            book={book}
            chapter={chapter}
            translation={translation}
            fontSize={fontSize}
            recordsCount={records.length}
            hasChapterCommentary={hasChapterCommentary}
            backLabel={
              readerBackSource === 'timeline'
                ? '연대표'
                : readerBackSource === 'canon'
                  ? '성경 목차'
                  : null
            }
            onBack={readerBackSource ? handleReaderBack : null}
            onGoHome={() => {
              setIsNavigatorOpen(false);
              setIsCommentaryOpen(false);
              setStudyVerse(null);
              navigateScreen('home');
              window.scrollTo(0, 0);
            }}
            onOpenNavigator={() => setIsNavigatorOpen(true)}
            onSwitchTranslation={handleSwitchTranslation}
            onChangeFontSize={handleChangeFontSize}
            onOpenCommentary={() => setIsCommentaryOpen(true)}
            onOpenRecords={() => setIsRecordsOpen(true)}
          />

          <ChapterView
            chapterData={chapterData}
            loading={loadingChapter}
            error={chapterError}
            fontSize={fontSize}
            highlightedVerse={highlightedVerse}
            selectedVerse={selectedVerse}
            verseNotice={verseNotice}
            returnOrigin={returnOrigin}
            recordIds={recordIdSet}
            studyVersesInChapter={studyVersesInChapter}
            chapterCommentary={
              chapterCommentary?.book === book && chapterCommentary.chapter === chapter
                ? chapterCommentary
                : null
            }
            bookOverview={currentBookOverview}
            readingFact={readingFacts[`${book}_${chapter}`]}
            historyDataset={historyDataset}
            chapterHistoryContext={currentChapterHistoryContext}
            onDismissNotice={() => setVerseNotice(null)}
            onSelectVerse={handleSelectVerseInBody}
            onToggleRecord={handleToggleRecord}
            onOpenVerseStudy={handleOpenVerseStudy}
            onOpenCommentary={() => setIsCommentaryOpen(true)}
            onSelectHistoryPassage={(ref) => handleReadFullRelatedChapter(ref)}
            onOpenFullHistoryTimeline={handleOpenFullTimelineFromReader}
            onNavigateChapter={(nextB, nextC, nextV) =>
              navigateTo(translation, nextB, nextC, nextV, { highlight: false })
            }
            onReturnToOrigin={handleReturnToOrigin}
          />

          <PassageNavigator
            isOpen={isNavigatorOpen}
            mode="sheet"
            currentBook={book}
            currentChapter={chapter}
            currentVerse={activeVerse}
            translation={translation}
            onSelectPassage={(nextB, nextC, nextV) =>
              navigateTo(translation, nextB, nextC, nextV, {
                highlight: nextV > 1,
                clearReturnOrigin: true,
              })
            }
            onClose={() => setIsNavigatorOpen(false)}
          />

          <VerseStudySheet
            isOpen={studyVerse !== null}
            book={book}
            chapter={chapter}
            verse={studyVerse ?? activeVerse}
            translation={translation}
            chapterData={chapterData}
            chapterCommentary={chapterCommentary}
            bookOverview={currentBookOverview}
            recordIds={recordIdSet}
            initialTab={studyInitialTab}
            onChangeVerse={handleChangeVerseInStudySheet}
            onToggleRecord={handleToggleRecord}
            onSwitchTranslation={handleSwitchTranslation}
            onNavigateToRelated={(ref, originVerse) =>
              handleReadFullRelatedChapter(ref, originVerse)
            }
            onOpenChapterCommentary={() => setIsCommentaryOpen(true)}
            onClose={() => setStudyVerse(null)}
          />

          <CommentarySheet
            isOpen={isCommentaryOpen}
            book={book}
            chapter={chapter}
            translation={translation}
            chapterCommentary={chapterCommentary}
            bookOverview={currentBookOverview}
            maps={commentaryIndex?.maps ?? {}}
            onReadFullRelatedChapter={(ref) => handleReadFullRelatedChapter(ref)}
            onClose={() => setIsCommentaryOpen(false)}
          />
        </div>
      ) : null}

      <MyRecordsModal
        isOpen={isRecordsOpen}
        records={records}
        onJumpToRecord={(pos) => {
          setReaderBackSource(null);
          navigateTo(pos.translation, pos.book, pos.chapter, pos.verse, {
            highlight: true,
            clearReturnOrigin: true,
            openReader: true,
          });
        }}
        onRemoveRecord={handleRemoveRecord}
        onClose={() => setIsRecordsOpen(false)}
      />
    </>
  );
}
