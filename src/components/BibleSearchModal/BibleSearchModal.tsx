import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatVerseRef, getBookMeta, getTranslationLabel } from '../../config/books';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import {
  getBookTestamentBadge,
  loadBibleSearchIndex,
  parseScriptureQuery,
  searchBibleVerses,
  splitTextBySearchTokens,
  type IndexedSearchVerse,
  type SearchScope,
} from '../../services/searchService';
import type { TranslationId } from '../../types/bible';

interface BibleSearchModalProps {
  isOpen: boolean;
  initialQuery?: string;
  translation: TranslationId;
  currentBook?: number | null;
  isFromReader?: boolean;
  onSelectResult: (
    translation: TranslationId,
    book: number,
    chapter: number,
    verse: number,
  ) => void;
  onClose: () => void;
}

const PAGE_SIZE = 60;

const EXAMPLE_QUERIES_KR = [
  '빛이 있으라',
  '여호와 목자',
  '사랑은 오래 참고',
  '요 3:16',
  '시편 23',
] as const;

const EXAMPLE_QUERIES_EN = [
  'Let there be light',
  'Lord shepherd',
  'Love is patient',
  'John 3:16',
  'Rom 8:28',
] as const;

export function BibleSearchModal({
  isOpen,
  initialQuery = '',
  translation,
  currentBook = null,
  isFromReader = false,
  onSelectResult,
  onClose,
}: BibleSearchModalProps) {
  useBodyScrollLock(isOpen);

  const [searchTranslation, setSearchTranslation] = useState<TranslationId>(translation);
  const [query, setQuery] = useState<string>(initialQuery);
  const [scope, setScope] = useState<SearchScope>('ALL');
  const [visibleLimit, setVisibleLimit] = useState<number>(PAGE_SIZE);

  const [entries, setEntries] = useState<IndexedSearchVerse[] | null>(null);
  const [loadingIndex, setLoadingIndex] = useState<boolean>(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [retrySeq, setRetrySeq] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // 모달이 열릴 때 현재 앱 번역본과 전달된 초기 검색어를 동기화하고 입력창에 포커스
  useLayoutEffect(() => {
    if (!isOpen) return;
    setSearchTranslation(translation);
    if (initialQuery) {
      setQuery(initialQuery);
    }
    setScope('ALL');
    setVisibleLimit(PAGE_SIZE);
    inputRef.current?.focus();
  }, [isOpen, initialQuery, translation]);

  // 검색 모달이 열렸을 때만 해당 번역본 색인 지연 로드 (초기 앱 로딩 영향 0)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingIndex(true);
    setIndexError(null);

    loadBibleSearchIndex(searchTranslation)
      .then((loaded) => {
        if (!cancelled) {
          setEntries(loaded);
          setLoadingIndex(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadingIndex(false);
          setIndexError(
            err instanceof Error ? err.message : '검색 색인을 불러오지 못했습니다.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, searchTranslation, retrySeq]);

  // Escape 키 닫기 지원
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // 검색어 또는 범위 변경 시 노출 개수 초기화
  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
  }, [query, scope, searchTranslation]);

  const parsedRef = useMemo(() => parseScriptureQuery(query), [query]);

  const parsedRefPreviewText = useMemo(() => {
    if (!parsedRef || !entries) return null;
    const found = entries.find(
      (e) =>
        e.book === parsedRef.book &&
        e.chapter === parsedRef.chapter &&
        e.verse === parsedRef.verse,
    );
    return found?.text ?? null;
  }, [parsedRef, entries]);

  const searchOutcome = useMemo(() => {
    if (!entries || !query.trim()) {
      return { items: [], totalCount: 0, otCount: 0, ntCount: 0, tokens: [] };
    }
    return searchBibleVerses(entries, query, { scope, currentBook });
  }, [entries, query, scope, currentBook]);

  if (!isOpen) return null;

  const currentBookMeta = currentBook ? getBookMeta(currentBook) : null;
  const trimmedQuery = query.trim();
  const isAsciiQueryInKr =
    searchTranslation === 'kr' &&
    trimmedQuery.length >= 2 &&
    /^[A-Za-z0-9\s:'"-]+$/.test(trimmedQuery) &&
    searchOutcome.totalCount === 0 &&
    !parsedRef;

  const visibleItems = searchOutcome.items.slice(0, visibleLimit);
  const remainingCount = Math.max(0, searchOutcome.totalCount - visibleLimit);
  const examples = searchTranslation === 'en' ? EXAMPLE_QUERIES_EN : EXAMPLE_QUERIES_KR;

  const handleChooseVerse = (book: number, chapter: number, verse: number) => {
    onSelectResult(searchTranslation, book, chapter, verse);
    onClose();
  };

  return (
    <div
      className="layer-backdrop search-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="layer-sheet search-modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="성경 본문 검색"
      >
        <div className="layer-header search-modal-header">
          <div>
            <h2 className="layer-title">성경 본문 검색</h2>
            <p className="layer-subtitle">
              {isFromReader
                ? '구절 이동 후 ‘원래 본문으로 돌아가기’로 읽던 위치에 복귀할 수 있습니다'
                : '단어 · 어절(공백 구분) 또는 장절(예: 요 3:16)을 입력하세요'}
            </p>
          </div>

          <div className="search-header-actions">
            <div className="translation-toggle" role="group" aria-label="검색 번역본 선택">
              <button
                type="button"
                className={`tr-btn ${searchTranslation === 'kr' ? 'tr-btn-active' : ''}`}
                aria-pressed={searchTranslation === 'kr'}
                onClick={() => setSearchTranslation('kr')}
              >
                개역개정
              </button>
              <button
                type="button"
                className={`tr-btn ${searchTranslation === 'en' ? 'tr-btn-active' : ''}`}
                aria-pressed={searchTranslation === 'en'}
                onClick={() => setSearchTranslation('en')}
              >
                NIV
              </button>
            </div>

            <button
              type="button"
              className="layer-close-btn"
              onClick={onClose}
              aria-label="본문 검색 닫기"
            >
              닫기
            </button>
          </div>
        </div>

        {/* 검색어 입력 및 범위 필터 고정 영역 */}
        <div className="search-controls-box">
          <div className="search-input-wrap">
            <span className="search-input-icon" aria-hidden="true">
              🔍
            </span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                searchTranslation === 'en'
                  ? 'Search words or verse (e.g., shepherd, John 3:16)'
                  : '말씀 단어 또는 장절 검색 (예: 여호와 목자, 요 3:16)'
              }
              className="search-modal-input"
              aria-label="성경 본문 검색어 입력"
            />
            {query ? (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                aria-label="검색어 지우기"
              >
                지우기
              </button>
            ) : null}
          </div>

          <div className="search-scope-pills" role="group" aria-label="검색 범위 선택">
            <button
              type="button"
              className={`filter-pill ${scope === 'ALL' ? 'filter-pill-active' : ''}`}
              aria-pressed={scope === 'ALL'}
              onClick={() => setScope('ALL')}
            >
              전체 66권
              {trimmedQuery && entries
                ? ` (${searchOutcome.otCount + searchOutcome.ntCount})`
                : ''}
            </button>
            <button
              type="button"
              className={`filter-pill ${scope === 'OT' ? 'filter-pill-active' : ''}`}
              aria-pressed={scope === 'OT'}
              onClick={() => setScope('OT')}
            >
              구약{trimmedQuery && entries ? ` (${searchOutcome.otCount})` : ''}
            </button>
            <button
              type="button"
              className={`filter-pill ${scope === 'NT' ? 'filter-pill-active' : ''}`}
              aria-pressed={scope === 'NT'}
              onClick={() => setScope('NT')}
            >
              신약{trimmedQuery && entries ? ` (${searchOutcome.ntCount})` : ''}
            </button>
            {currentBookMeta ? (
              <button
                type="button"
                className={`filter-pill ${scope === 'CURRENT_BOOK' ? 'filter-pill-active' : ''}`}
                aria-pressed={scope === 'CURRENT_BOOK'}
                onClick={() => setScope('CURRENT_BOOK')}
              >
                {searchTranslation === 'en'
                  ? `${currentBookMeta.abbrEn}만`
                  : `${currentBookMeta.nameKo}만`}
              </button>
            ) : null}
          </div>
        </div>

        {/* 검색 결과 본문 스크롤 영역 */}
        <div className="layer-scroll-body search-results-body">
          {/* 1. 장절 참조 자동 인식 바로가기 카드 (색인 로드 전에도 즉시 동작!) */}
          {parsedRef ? (
            <div className="search-direct-ref-box">
              <button
                type="button"
                className="search-direct-ref-btn"
                onClick={() =>
                  handleChooseVerse(parsedRef.book, parsedRef.chapter, parsedRef.verse)
                }
              >
                <div className="search-direct-ref-main">
                  <span className="search-direct-badge">장절 바로가기</span>
                  <strong className="search-direct-title">
                    {searchTranslation === 'en' ? parsedRef.labelEn : parsedRef.labelKo}
                    {parsedRef.isChapterOnly ? ' (1절부터)' : ''}
                  </strong>
                  {parsedRefPreviewText ? (
                    <p className="search-direct-preview">{parsedRefPreviewText}</p>
                  ) : null}
                </div>
                <span className="search-direct-go" aria-hidden="true">
                  바로 이동 →
                </span>
              </button>
            </div>
          ) : null}

          {/* 2. 색인 로딩 / 오류 / 빈 검색어 안내 / 결과 목록 */}
          {loadingIndex && !entries ? (
            <div className="study-state-box">
              <p className="study-state-text">
                {getTranslationLabel(searchTranslation)} 전체 본문 색인을 준비하는 중입니다...
              </p>
            </div>
          ) : indexError ? (
            <div className="study-state-box study-error-box" role="alert">
              <p className="study-error-text">{indexError}</p>
              <button
                type="button"
                className="study-retry-btn"
                onClick={() => setRetrySeq((s) => s + 1)}
              >
                다시 시도
              </button>
            </div>
          ) : !trimmedQuery ? (
            <div className="search-empty-guide">
              <p className="search-guide-title">예시 검색어로 바로 찾아보세요</p>
              <div className="search-example-chips">
                {examples.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    className="evidence-chip-btn"
                    onClick={() => setQuery(ex)}
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <p className="search-guide-tip">
                여러 단어를 띄어쓰기로 입력하면(예: <strong>여호와 목자</strong>) 해당 단어가 모두 들어간 구절을 함께 찾아 줍니다.
              </p>
            </div>
          ) : searchOutcome.totalCount === 0 ? (
            !parsedRef ? (
              <div className="search-no-result-box">
                <p className="empty-state-msg">
                  ‘{trimmedQuery}’에 일치하는 {getTranslationLabel(searchTranslation)} 본문 구절이 없습니다.
                </p>
                {scope !== 'ALL' && searchOutcome.otCount + searchOutcome.ntCount > 0 ? (
                  <button
                    type="button"
                    className="search-switch-hint-btn"
                    onClick={() => setScope('ALL')}
                  >
                    전체 66권에서 {searchOutcome.otCount + searchOutcome.ntCount}구절 결과 보기 →
                  </button>
                ) : null}
                {isAsciiQueryInKr ? (
                  <button
                    type="button"
                    className="search-switch-hint-btn"
                    onClick={() => setSearchTranslation('en')}
                  >
                    영문 검색어입니다 · NIV 영어 성경에서 ‘{trimmedQuery}’ 검색하기 →
                  </button>
                ) : null}
              </div>
            ) : null
          ) : (
            <>
              <div className="search-summary-bar" aria-live="polite">
                <span>
                  검색 결과 <strong>{searchOutcome.totalCount.toLocaleString()}</strong>구절 (
                  {getTranslationLabel(searchTranslation)})
                </span>
              </div>

              <ul className="search-result-list">
                {visibleItems.map((item) => {
                  const refLabel = formatVerseRef(
                    item.book,
                    item.chapter,
                    item.verse,
                    searchTranslation,
                  );
                  const segments = splitTextBySearchTokens(item.text, searchOutcome.tokens);

                  return (
                    <li key={`${item.book}_${item.chapter}_${item.verse}`}>
                      <button
                        type="button"
                        className="search-result-card"
                        onClick={() =>
                          handleChooseVerse(item.book, item.chapter, item.verse)
                        }
                      >
                        <div className="search-result-top">
                          <strong className="search-result-ref">{refLabel}</strong>
                          <span className="search-result-cat">
                            {getBookTestamentBadge(item.book)}
                          </span>
                        </div>
                        <p className="search-result-text">
                          {segments.map((seg, idx) =>
                            seg.highlighted ? (
                              <mark key={idx} className="search-hit-mark">
                                {seg.text}
                              </mark>
                            ) : (
                              <span key={idx}>{seg.text}</span>
                            ),
                          )}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {remainingCount > 0 ? (
                <button
                  type="button"
                  className="search-more-btn"
                  onClick={() => setVisibleLimit((prev) => prev + PAGE_SIZE)}
                >
                  결과 더 보기 ({remainingCount.toLocaleString()}구절 남음)
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
