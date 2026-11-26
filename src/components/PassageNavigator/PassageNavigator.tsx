import { useEffect, useMemo, useState } from 'react';
import { BOOKS_LIST, getBookMeta } from '../../config/books';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { loadChapterData } from '../../services/dataLoader';
import type { TranslationId } from '../../types/bible';

interface PassageNavigatorProps {
  isOpen: boolean;
  mode?: 'sheet' | 'page';
  currentBook: number;
  currentChapter: number;
  currentVerse: number;
  translation: TranslationId;
  onSelectPassage: (book: number, chapter: number, verse: number) => void;
  onClose: () => void;
  onSwitchTranslation?: (next: TranslationId) => void;
  onSearchFullText?: (initialQuery: string) => void;
}

type Step = 'book' | 'chapter' | 'verse';

export function PassageNavigator({
  isOpen,
  mode = 'sheet',
  currentBook,
  currentChapter,
  currentVerse,
  translation,
  onSelectPassage,
  onClose,
  onSwitchTranslation,
  onSearchFullText,
}: PassageNavigatorProps) {
  useBodyScrollLock(mode === 'sheet' && isOpen);

  const [step, setStep] = useState<Step>('book');
  const [testamentFilter, setTestamentFilter] = useState<'ALL' | 'OT' | 'NT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState(currentBook);
  const [selectedChapter, setSelectedChapter] = useState(currentChapter);
  const [verseNumbers, setVerseNumbers] = useState<number[]>([]);
  const [loadingVerses, setLoadingVerses] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('book');
      setSelectedBook(currentBook);
      setSelectedChapter(currentChapter);
      setSearchQuery('');
    }
  }, [isOpen, currentBook, currentChapter]);

  useEffect(() => {
    if (!isOpen || step !== 'verse') return;
    let cancelled = false;
    setLoadingVerses(true);
    loadChapterData(translation, selectedBook, selectedChapter)
      .then((chData) => {
        if (!cancelled) {
          setVerseNumbers(chData.verses.map((v) => v.verse));
          setLoadingVerses(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVerseNumbers([1]);
          setLoadingVerses(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, step, translation, selectedBook, selectedChapter]);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return BOOKS_LIST.filter((b) => {
      if (testamentFilter !== 'ALL' && b.testament !== testamentFilter) return false;
      if (!q) return true;
      return (
        b.nameKo.toLowerCase().includes(q) ||
        b.abbrKo.toLowerCase().includes(q) ||
        b.nameEn.toLowerCase().includes(q) ||
        b.abbrEn.toLowerCase().includes(q)
      );
    });
  }, [testamentFilter, searchQuery]);

  if (!isOpen) return null;

  const bookMeta = getBookMeta(selectedBook);
  const chapterUnit = bookMeta.book === 19 ? '편' : '장';

  const tabsAndBody = (
    <>
      <div className="nav-step-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={step === 'book'}
          className={`nav-step-tab ${step === 'book' ? 'nav-step-tab-active' : ''}`}
          onClick={() => setStep('book')}
        >
          1. 책 ({bookMeta.abbrKo})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={step === 'chapter'}
          className={`nav-step-tab ${step === 'chapter' ? 'nav-step-tab-active' : ''}`}
          onClick={() => setStep('chapter')}
        >
          2. {chapterUnit} ({selectedChapter})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={step === 'verse'}
          className={`nav-step-tab ${step === 'verse' ? 'nav-step-tab-active' : ''}`}
          onClick={() => setStep('verse')}
        >
          3. 절 선택
        </button>
      </div>

      <div className={mode === 'page' ? 'canon-page-body' : 'layer-scroll-body'}>
        {step === 'book' ? (
          <>
            <div className="book-filter-bar">
              <div className="testament-pills">
                <button
                  type="button"
                  className={`filter-pill ${testamentFilter === 'ALL' ? 'filter-pill-active' : ''}`}
                  onClick={() => setTestamentFilter('ALL')}
                >
                  전체 66권
                </button>
                <button
                  type="button"
                  className={`filter-pill ${testamentFilter === 'OT' ? 'filter-pill-active' : ''}`}
                  onClick={() => setTestamentFilter('OT')}
                >
                  구약 39권
                </button>
                <button
                  type="button"
                  className={`filter-pill ${testamentFilter === 'NT' ? 'filter-pill-active' : ''}`}
                  onClick={() => setTestamentFilter('NT')}
                >
                  신약 27권
                </button>
              </div>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="책 이름 검색 (예: 창세기, 시, John)"
                className="book-search-input"
                aria-label="성경 책 이름 검색"
              />
              {onSearchFullText && filteredBooks.length > 0 && searchQuery.trim().length >= 2 ? (
                <button
                  type="button"
                  className="book-search-fulltext-hint"
                  onClick={() => {
                    const q = searchQuery.trim();
                    if (mode === 'sheet') onClose();
                    onSearchFullText(q);
                  }}
                >
                  구절 단어를 찾으시나요? <strong>‘{searchQuery.trim()}’ 본문 전체에서 검색 →</strong>
                </button>
              ) : null}
            </div>

            {filteredBooks.length === 0 ? (
              <div className="book-empty-fulltext-box">
                <p className="empty-state-msg">
                  ‘{searchQuery.trim()}’에 일치하는 성경 책 이름이 없습니다.
                </p>
                {onSearchFullText && searchQuery.trim() ? (
                  <button
                    type="button"
                    className="book-empty-fulltext-btn"
                    onClick={() => {
                      const q = searchQuery.trim();
                      if (mode === 'sheet') onClose();
                      onSearchFullText(q);
                    }}
                  >
                    ‘{searchQuery.trim()}’ 본문 전체에서 검색하기 →
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="book-grid">
                {filteredBooks.map((b) => (
                  <button
                    key={b.book}
                    type="button"
                    className={`book-grid-btn ${b.book === selectedBook ? 'grid-btn-selected' : ''}`}
                    onClick={() => {
                      setSelectedBook(b.book);
                      setSelectedChapter(1);
                      setStep('chapter');
                    }}
                  >
                    <span className="book-grid-ko">{b.nameKo}</span>
                    <span className="book-grid-en">
                      {b.nameEn} · {b.category}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}

        {step === 'chapter' ? (
          <div className="number-grid-section">
            <p className="number-grid-guide">
              <strong>{bookMeta.nameKo}</strong>의 {chapterUnit}을 선택하세요 (총 {bookMeta.chapters}
              {chapterUnit})
            </p>
            <div className="number-grid">
              {Array.from({ length: bookMeta.chapters }, (_, i) => i + 1).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  className={`number-cell-btn ${
                    selectedBook === currentBook && ch === currentChapter ? 'grid-btn-selected' : ''
                  }`}
                  onClick={() => {
                    setSelectedChapter(ch);
                    setStep('verse');
                  }}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 'verse' ? (
          <div className="number-grid-section">
            <div className="verse-step-top">
              <p className="number-grid-guide">
                <strong>
                  {bookMeta.nameKo} {selectedChapter}
                  {chapterUnit}
                </strong>
                의 이동할 절을 선택하세요
              </p>
              <button
                type="button"
                className="quick-first-verse-btn"
                onClick={() => {
                  onSelectPassage(selectedBook, selectedChapter, 1);
                  if (mode === 'sheet') onClose();
                }}
              >
                1절부터 바로 읽기
              </button>
            </div>
            {loadingVerses ? (
              <p className="loading-text">절 목록을 불러오는 중...</p>
            ) : (
              <div className="number-grid">
                {verseNumbers.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`number-cell-btn ${
                      selectedBook === currentBook &&
                      selectedChapter === currentChapter &&
                      v === currentVerse
                        ? 'grid-btn-selected'
                        : ''
                    }`}
                    onClick={() => {
                      onSelectPassage(selectedBook, selectedChapter, v);
                      if (mode === 'sheet') onClose();
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </>
  );

  if (mode === 'page') {
    return (
      <div className="canon-page-shell">
        <header className="subpage-header">
          <div className="subpage-header-left">
            <button
              type="button"
              className="nav-back-btn"
              onClick={onClose}
              aria-label="메인 화면으로 돌아가기"
            >
              ← 홈
            </button>
            <div>
              <h1 className="subpage-title">성경순 읽기 · 성경 목차</h1>
              <p className="subpage-subtitle">
                선택 중: {bookMeta.nameKo} {selectedChapter}
                {chapterUnit}
              </p>
            </div>
          </div>

          {onSwitchTranslation ? (
            <div className="translation-toggle" role="group" aria-label="번역본 선택">
              <button
                type="button"
                className={`tr-btn ${translation === 'kr' ? 'tr-btn-active' : ''}`}
                aria-pressed={translation === 'kr'}
                onClick={() => {
                  if (translation !== 'kr') onSwitchTranslation('kr');
                }}
              >
                개역개정
              </button>
              <button
                type="button"
                className={`tr-btn ${translation === 'en' ? 'tr-btn-active' : ''}`}
                aria-pressed={translation === 'en'}
                onClick={() => {
                  if (translation !== 'en') onSwitchTranslation('en');
                }}
              >
                NIV
              </button>
            </div>
          ) : null}
        </header>

        <main className="canon-page-main">{tabsAndBody}</main>
      </div>
    );
  }

  return (
    <div className="layer-backdrop" role="dialog" aria-modal="true" aria-label="책·장·절 선택">
      <div className="layer-sheet">
        <div className="layer-header">
          <div>
            <h2 className="layer-title">본문 바로 이동</h2>
            <p className="layer-subtitle">
              {bookMeta.nameKo} {selectedChapter}
              {chapterUnit}
            </p>
          </div>
          <button type="button" className="layer-close-btn" onClick={onClose} aria-label="이동 창 닫기">
            닫기
          </button>
        </div>

        {tabsAndBody}
      </div>
    </div>
  );
}
