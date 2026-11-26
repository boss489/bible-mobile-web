import { formatVerseRef, getTranslationLabel } from '../../config/books';
import type { ReadingPosition, TranslationId } from '../../types/bible';

interface MainHomeProps {
  translation: TranslationId;
  lastReadPos: ReadingPosition | null;
  recordsCount: number;
  onSelectCanonicalPath: () => void;
  onSelectChronologicalPath: () => void;
  onResumeReading: (pos: ReadingPosition) => void;
  onSwitchTranslation: (next: TranslationId) => void;
  onOpenRecords: () => void;
}

export function MainHome({
  translation,
  lastReadPos,
  recordsCount,
  onSelectCanonicalPath,
  onSelectChronologicalPath,
  onResumeReading,
  onSwitchTranslation,
  onOpenRecords,
}: MainHomeProps) {
  const resumeRefLabel = lastReadPos
    ? formatVerseRef(
        lastReadPos.book,
        lastReadPos.chapter,
        lastReadPos.verse,
        lastReadPos.translation,
      )
    : null;

  return (
    <div className="home-shell">
      <header className="home-topbar">
        <div className="home-brand">
          <span className="home-eyebrow">개역개정 · NIV</span>
          <h1 className="home-brand-title">성경 읽기</h1>
        </div>

        <div className="home-topbar-actions">
          <div className="translation-toggle" role="group" aria-label="기본 번역본 선택">
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
      </header>

      <main className="home-main">
        <p className="home-lead">원하는 방식으로 성경을 읽어보세요</p>

        <section className="home-path-grid" aria-label="성경 읽기 방식 선택">
          <article className="home-path-card">
            <div className="home-path-card-body">
              <div className="home-path-icon-row">
                <span className="home-path-glyph home-path-glyph-canon" aria-hidden="true">
                  ▤
                </span>
                <span className="home-path-kicker">정경 순서 66권</span>
              </div>
              <h2 className="home-path-title">성경순 읽기</h2>
              <p className="home-path-subtitle">창세기부터 요한계시록까지</p>
              <p className="home-path-desc">
                구약 39권과 신약 27권의 정경 목차를 따라 원하는 책·장·절 본문을 바로 펼쳐 읽습니다.
              </p>
            </div>
            <button
              type="button"
              className="home-path-cta home-path-cta-canon"
              onClick={onSelectCanonicalPath}
            >
              <span>성경 목차</span>
              <span aria-hidden="true">→</span>
            </button>
          </article>

          <article className="home-path-card">
            <div className="home-path-card-body">
              <div className="home-path-icon-row">
                <span className="home-path-glyph home-path-glyph-history" aria-hidden="true">
                  ▥
                </span>
                <span className="home-path-kicker">12시대 통합 시간축</span>
              </div>
              <h2 className="home-path-title">연대순 읽기</h2>
              <p className="home-path-subtitle">시대 · 인물 · 사건을 따라 읽기</p>
              <p className="home-path-desc">
                원역사와 족장 시대부터 왕국·선지자, 중간기, 예수님의 생애와 초대교회까지 역사 흐름 속에서 말씀을 읽습니다.
              </p>
            </div>
            <button
              type="button"
              className="home-path-cta home-path-cta-history"
              onClick={onSelectChronologicalPath}
            >
              <span>역사 연대표</span>
              <span aria-hidden="true">→</span>
            </button>
          </article>
        </section>

        {lastReadPos && resumeRefLabel ? (
          <section className="home-resume-section" aria-label="마지막 읽던 본문 이어 읽기">
            <button
              type="button"
              className="home-resume-btn"
              onClick={() => onResumeReading(lastReadPos)}
            >
              <div className="home-resume-info">
                <span className="home-resume-badge">이어서 읽기</span>
                <strong className="home-resume-ref">{resumeRefLabel}</strong>
                <span className="home-resume-tr">
                  {getTranslationLabel(lastReadPos.translation)}
                </span>
              </div>
              <span className="home-resume-arrow" aria-hidden="true">
                계속 읽기 →
              </span>
            </button>
          </section>
        ) : null}
      </main>
    </div>
  );
}
