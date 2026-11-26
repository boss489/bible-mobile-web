import { useState } from 'react';
import { getChapterLabel } from '../../config/books';
import { FONT_SIZE_OPTIONS } from '../../config/siteConfig';
import type { FontSizeLevel, TranslationId } from '../../types/bible';

interface ReaderHeaderProps {
  book: number;
  chapter: number;
  translation: TranslationId;
  fontSize: FontSizeLevel;
  recordsCount: number;
  hasChapterCommentary: boolean;
  backLabel?: string | null;
  onBack?: (() => void) | null;
  onGoHome?: () => void;
  onOpenNavigator: () => void;
  onSwitchTranslation: (next: TranslationId) => void;
  onChangeFontSize: (next: FontSizeLevel) => void;
  onOpenCommentary: () => void;
  onOpenSearch: () => void;
  onOpenRecords: () => void;
}

export function ReaderHeader({
  book,
  chapter,
  translation,
  fontSize,
  recordsCount,
  hasChapterCommentary,
  backLabel,
  onBack,
  onGoHome,
  onOpenNavigator,
  onSwitchTranslation,
  onChangeFontSize,
  onOpenCommentary,
  onOpenSearch,
  onOpenRecords,
}: ReaderHeaderProps) {
  const [fontPanelOpen, setFontPanelOpen] = useState(false);
  const currentFontMeta = FONT_SIZE_OPTIONS.find((f) => f.level === fontSize) ?? FONT_SIZE_OPTIONS[2];

  return (
    <header className="reader-header" id="reader-sticky-header">
      <div className="reader-header-row">
        <div className="reader-header-left">
          {onGoHome ? (
            <button
              type="button"
              className="reader-home-btn"
              onClick={onGoHome}
              aria-label="메인 홈 화면으로 이동"
            >
              홈
            </button>
          ) : null}

          {onBack && backLabel ? (
            <button
              type="button"
              className="reader-back-route-btn"
              onClick={onBack}
            >
              ← {backLabel}
            </button>
          ) : null}

          <button
            type="button"
            className="passage-trigger-btn"
            onClick={onOpenNavigator}
            aria-label={`현재 본문 ${getChapterLabel(book, chapter, 'kr')}, 책·장·절 이동 열기`}
          >
            <span className="passage-trigger-main">{getChapterLabel(book, chapter, 'kr')}</span>
            {translation === 'en' ? (
              <span className="passage-trigger-sub">{getChapterLabel(book, chapter, 'en')}</span>
            ) : null}
            <span className="passage-trigger-chevron" aria-hidden="true">
              ▾
            </span>
          </button>
        </div>

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
      </div>

      <div className="reader-toolbar-row">
        <button
          type="button"
          className="toolbar-action-btn toolbar-commentary-btn"
          onClick={onOpenCommentary}
        >
          <span>본문 이해</span>
          {hasChapterCommentary ? (
            <span className="commentary-dot" title="장별 상세 해설 수록" aria-label="장별 해설 있음" />
          ) : null}
        </button>

        <div className="toolbar-right-group">
          <button
            type="button"
            className="toolbar-action-btn"
            onClick={onOpenSearch}
            aria-label="본문 검색 열기"
          >
            검색
          </button>

          <button
            type="button"
            className={`toolbar-action-btn ${fontPanelOpen ? 'toolbar-action-active' : ''}`}
            aria-expanded={fontPanelOpen}
            aria-label="글자 크기 조절"
            onClick={() => setFontPanelOpen((prev) => !prev)}
          >
            글자크기
          </button>

          <button
            type="button"
            className="toolbar-action-btn"
            onClick={onOpenRecords}
            aria-label={`내 기록 열기${recordsCount > 0 ? ` (${recordsCount}개)` : ''}`}
          >
            <span>내 기록</span>
            {recordsCount > 0 ? <span className="records-badge">{recordsCount}</span> : null}
          </button>
        </div>
      </div>

      {fontPanelOpen ? (
        <div className="font-size-bar" role="region" aria-label="글자 크기 단계 선택">
          <button
            type="button"
            className="font-step-btn"
            disabled={fontSize <= 1}
            onClick={() => fontSize > 1 && onChangeFontSize((fontSize - 1) as FontSizeLevel)}
            aria-label="글자 작게"
          >
            가-
          </button>
          <div className="font-pills">
            {FONT_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.level}
                type="button"
                className={`font-pill ${opt.level === fontSize ? 'font-pill-active' : ''}`}
                aria-pressed={opt.level === fontSize}
                onClick={() => onChangeFontSize(opt.level)}
              >
                {opt.level}단계
              </button>
            ))}
          </div>
          <button
            type="button"
            className="font-step-btn"
            disabled={fontSize >= 5}
            onClick={() => fontSize < 5 && onChangeFontSize((fontSize + 1) as FontSizeLevel)}
            aria-label="글자 크게"
          >
            가+
          </button>
          <span className="font-current-label">{currentFontMeta.label}</span>
        </div>
      ) : null}
    </header>
  );
}
