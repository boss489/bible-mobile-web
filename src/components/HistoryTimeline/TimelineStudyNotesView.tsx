import { useState, type RefObject } from 'react';
import { DATE_PRECISION_LABELS_KO } from '../../services/historyDataService';
import type { TranslationId } from '../../types/bible';
import type {
  ActiveChronicleTarget,
  BibleHistoryDataset,
  HistoryEraId,
  HistoryPassageLink,
  SpecialChronicleId,
} from '../../types/history';

interface TimelineStudyNotesViewProps {
  dataset: BibleHistoryDataset;
  translation: TranslationId;
  activeChronicle: ActiveChronicleTarget;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  onScrollContainer: () => void;
  onOpenEraChart: (eraId: HistoryEraId) => void;
  onOpenSpecialChart: (specialId: SpecialChronicleId) => void;
  onSelectPassage: (link: HistoryPassageLink) => void;
}

export function TimelineStudyNotesView({
  dataset,
  translation,
  activeChronicle,
  scrollContainerRef,
  onScrollContainer,
  onOpenEraChart,
  onOpenSpecialChart,
  onSelectPassage,
}: TimelineStudyNotesViewProps) {
  const [notesScope, setNotesScope] = useState<'all' | 'selected'>('all');

  const visibleEras =
    notesScope === 'selected' && activeChronicle.kind === 'era'
      ? dataset.eras.filter((e) => e.id === activeChronicle.id)
      : notesScope === 'selected'
        ? []
        : dataset.eras;

  const specials = dataset.specialChronicles ?? [];
  const visibleSpecials =
    notesScope === 'selected' && activeChronicle.kind === 'special'
      ? specials.filter((s) => s.id === activeChronicle.id)
      : notesScope === 'selected'
        ? []
        : specials;

  return (
    <div
      ref={scrollContainerRef}
      className="timeline-notes-scroll"
      onScroll={onScrollContainer}
      role="region"
      aria-label="성경 연대기 산출 근거 및 연구 노트"
    >
      {/* 1. 원칙 및 범례 요약 카드 */}
      <section className="study-notes-methodology-card">
        <div className="study-notes-top-row">
          <div>
            <h3 className="study-notes-main-title">📖 성경 역사 연대기 산출 기준 및 연구 노트</h3>
            <p className="study-notes-main-sub">
              성경 본문 내 연령·왕년 기록과 고대 근동·그리스-로마 사료를 대조하여 검증한 시대별 해설입니다.
            </p>
          </div>

          <div className="vertical-scope-toggle" role="group" aria-label="노트 표시 범위">
            <button
              type="button"
              className={`vertical-scope-btn ${
                notesScope === 'all' ? 'vertical-scope-btn-active' : ''
              }`}
              aria-pressed={notesScope === 'all'}
              onClick={() => setNotesScope('all')}
            >
              전체 연대기 노트
            </button>
            <button
              type="button"
              className={`vertical-scope-btn ${
                notesScope === 'selected' ? 'vertical-scope-btn-active' : ''
              }`}
              aria-pressed={notesScope === 'selected'}
              onClick={() => setNotesScope('selected')}
            >
              현재 선택만
            </button>
          </div>
        </div>

        <div className="study-notes-principles-grid">
          <div className="study-principle-item">
            <strong>1. 역사적 0년 배제</strong>
            <span>BC 1년 다음 해는 곧바로 AD 1년이며, 시간축 계산에서 0년 오차를 차단합니다.</span>
          </div>
          <div className="study-principle-item">
            <strong>2. 상대 순서 vs 비례 연도 분리</strong>
            <span>왕정 이전은 본문 내 세대·사건 순서로, 통일왕국 이후는 사료 대조 비례 연도로 표시합니다.</span>
          </div>
          <div className="study-principle-item">
            <strong>3. 활동 기간 vs 가능 범위 구분</strong>
            <span>실제 생존·통치 기간(실선)과 학설상 발생 가능 상·하한 범위(빗금·수염선)를 분리합니다.</span>
          </div>
          <div className="study-principle-item">
            <strong>4. 외부 역사·서신 배경 명시</strong>
            <span>중간기 외부 역사는 억지 성경 구절을 붙이지 않고, 서신서는 작성 시기를 별도 표기합니다.</span>
          </div>
        </div>
      </section>

      {/* 2. 12시대별 상세 연구 노트 */}
      {visibleEras.map((era) => {
        const isCurrent = activeChronicle.kind === 'era' && activeChronicle.id === era.id;
        return (
          <article
            key={era.id}
            className={`study-note-era-card ${isCurrent ? 'study-note-era-card-active' : ''}`}
            style={{ borderTopColor: era.color }}
          >
            <header className="study-note-card-head">
              <div>
                <div className="study-note-badges">
                  <span
                    className="study-note-era-badge"
                    style={{ backgroundColor: era.color }}
                  >
                    제{era.order}시대
                  </span>
                  <span className="comm-tag comm-tag-fact">{era.displayPeriodKo}</span>
                  <span className="comm-tag comm-tag-neutral">
                    {DATE_PRECISION_LABELS_KO[era.datePrecision]}
                  </span>
                </div>
                <h4 className="study-note-title">{era.nameKo}</h4>
              </div>

              <button
                type="button"
                className="study-note-jump-btn"
                onClick={() => onOpenEraChart(era.id)}
              >
                🔍 이 시대 차트 열기
              </button>
            </header>

            <p className="study-note-summary">{era.summaryKo}</p>

            {era.anchorBasisKo ? (
              <div className="study-note-anchor-box">
                <strong>연대 기준 구절 · 사료:</strong> {era.anchorBasisKo}
              </div>
            ) : null}

            {era.studyNotesKo && era.studyNotesKo.length > 0 ? (
              <ol className="study-note-list">
                {era.studyNotesKo.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ol>
            ) : null}

            {era.divergentViewsKo ? (
              <div className="comm-card comm-card-views timeline-sub-alert">
                <span className="comm-tag comm-tag-views">주요 학설 · 연대 견해 비교</span>
                <p className="comm-body-text">{era.divergentViewsKo}</p>
              </div>
            ) : null}

            {era.keyPassages.length > 0 ? (
              <div className="study-note-passages">
                {era.keyPassages.map((kp) => (
                  <button
                    key={kp.verseId}
                    type="button"
                    className="vertical-passage-chip"
                    onClick={() => onSelectPassage(kp)}
                  >
                    <strong>{translation === 'en' ? kp.labelEn : kp.labelKo}</strong> ·{' '}
                    {kp.titleKo} →
                  </button>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}

      {/* 3. 특집 연대기 연구 노트 */}
      {visibleSpecials.map((sp) => {
        const isCurrent = activeChronicle.kind === 'special' && activeChronicle.id === sp.id;
        return (
          <article
            key={sp.id}
            className={`study-note-era-card ${isCurrent ? 'study-note-era-card-active' : ''}`}
            style={{ borderTopColor: sp.color }}
          >
            <header className="study-note-card-head">
              <div>
                <div className="study-note-badges">
                  <span
                    className="study-note-era-badge"
                    style={{ backgroundColor: sp.color }}
                  >
                    특집 연대기
                  </span>
                  <span className="comm-tag comm-tag-fact">{sp.displayPeriodKo}</span>
                </div>
                <h4 className="study-note-title">{sp.nameKo}</h4>
              </div>

              <button
                type="button"
                className="study-note-jump-btn"
                onClick={() => onOpenSpecialChart(sp.id)}
              >
                🔍 특집 보드 열기
              </button>
            </header>

            <p className="study-note-summary">{sp.summaryKo}</p>

            <div className="study-note-anchor-box">
              <strong>성경 기준 본문:</strong> {sp.anchorBasisKo}
            </div>

            <ol className="study-note-list">
              {sp.studyNotesKo.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ol>

            {sp.divergentViewsKo ? (
              <div className="comm-card comm-card-views timeline-sub-alert">
                <span className="comm-tag comm-tag-views">연대 · 복음서 조화 참고</span>
                <p className="comm-body-text">{sp.divergentViewsKo}</p>
              </div>
            ) : null}
          </article>
        );
      })}

      {/* 4. 참고 사료 및 문헌 출처 */}
      <footer className="study-notes-sources-card">
        <h4>참고 자료 및 검증 기준</h4>
        <ul>
          {Object.values(dataset.sources).map((src) => (
            <li key={src.id}>
              <strong>{src.title}</strong>
              {src.authorOrOrg ? ` (${src.authorOrOrg} · ${src.license})` : ` (${src.license})`}
            </li>
          ))}
        </ul>
      </footer>
    </div>
  );
}
