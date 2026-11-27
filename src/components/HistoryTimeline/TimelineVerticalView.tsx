import { type RefObject } from 'react';
import {
  buildVerticalEraSections,
  DATE_PRECISION_LABELS_KO,
  PERIOD_KIND_LABELS_KO,
} from '../../services/historyDataService';
import type { TranslationId } from '../../types/bible';
import type {
  ActiveChronicleTarget,
  BibleHistoryDataset,
  HistoryPassageLink,
  SpecialChronicle,
  SpecialChronicleEvent,
  TimelineCategoryFilter,
  TimelineItem,
  TimelineSelection,
} from '../../types/history';

interface TimelineVerticalViewProps {
  dataset: BibleHistoryDataset;
  translation: TranslationId;
  activeChronicle: ActiveChronicleTarget;
  verticalScope: 'selected' | 'all';
  categoryFilter: TimelineCategoryFilter;
  selection: TimelineSelection | null;
  primaryHighlightIds: ReadonlySet<string>;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  onScrollContainer: () => void;
  onChangeVerticalScope: (next: 'selected' | 'all') => void;
  onSelectItem: (item: TimelineItem) => void;
  onSelectSpecialEvent: (chronicle: SpecialChronicle, ev: SpecialChronicleEvent) => void;
  onSelectPassage: (link: HistoryPassageLink) => void;
}

export function TimelineVerticalView({
  dataset,
  translation,
  activeChronicle,
  verticalScope,
  categoryFilter,
  selection,
  primaryHighlightIds,
  scrollContainerRef,
  onScrollContainer,
  onChangeVerticalScope,
  onSelectItem,
  onSelectSpecialEvent,
  onSelectPassage,
}: TimelineVerticalViewProps) {
  const activeSpecial =
    activeChronicle.kind === 'special'
      ? (dataset.specialChronicles ?? []).find((s) => s.id === activeChronicle.id) ?? null
      : null;

  const sections =
    activeChronicle.kind === 'era'
      ? buildVerticalEraSections(
          dataset,
          categoryFilter,
          verticalScope === 'all' ? 'ALL' : activeChronicle.id,
        )
      : [];

  return (
    <div
      ref={scrollContainerRef}
      className="timeline-vertical-scroll"
      onScroll={onScrollContainer}
      role="region"
      aria-label="모바일 세로 읽기 연대기"
    >
      {/* 상단 세로 읽기 범위 스위치 (선택 시대만 집중 vs 12시대 전체 연속 스크롤) */}
      {activeChronicle.kind === 'era' ? (
        <div className="vertical-scope-bar">
          <span className="vertical-scope-hint">
            스마트폰 한 손 세로 스크롤에 맞춘 연대기 카드 뷰입니다.
          </span>
          <div className="vertical-scope-toggle" role="group" aria-label="세로 읽기 범위">
            <button
              type="button"
              className={`vertical-scope-btn ${
                verticalScope === 'selected' ? 'vertical-scope-btn-active' : ''
              }`}
              aria-pressed={verticalScope === 'selected'}
              onClick={() => onChangeVerticalScope('selected')}
            >
              선택 시대만
            </button>
            <button
              type="button"
              className={`vertical-scope-btn ${
                verticalScope === 'all' ? 'vertical-scope-btn-active' : ''
              }`}
              aria-pressed={verticalScope === 'all'}
              onClick={() => onChangeVerticalScope('all')}
            >
              12시대 전체 연속
            </button>
          </div>
        </div>
      ) : null}

      {/* 1) 특집 연대기 세로 카드 뷰 (성막·성전사 / 고난주간 일별 조화) */}
      {activeSpecial ? (
        <article className="vertical-era-block">
          <header
            className="vertical-era-banner"
            style={{ backgroundColor: activeSpecial.color }}
          >
            <div className="vertical-era-banner-top">
              <span className="vertical-era-step">특집 연대기</span>
              <span className="vertical-era-period">{activeSpecial.displayPeriodKo}</span>
            </div>
            <h3 className="vertical-era-title">{activeSpecial.nameKo}</h3>
            <p className="vertical-era-summary">{activeSpecial.summaryKo}</p>
          </header>

          {activeSpecial.groups.map((grp) => {
            const grpEvents = activeSpecial.events.filter((e) => e.groupKey === grp.key);
            if (grpEvents.length === 0) return null;
            return (
              <div key={grp.key} className="vertical-special-group">
                <div
                  className="vertical-special-group-head"
                  style={{ borderLeftColor: grp.color }}
                >
                  <strong>{grp.labelKo}</strong>
                  <span>{grp.subLabelKo}</span>
                </div>

                <div className="vertical-card-list">
                  {grpEvents.map((ev) => {
                    const isSelected =
                      selection?.kind === 'special_event' && selection.eventId === ev.id;
                    return (
                      <div
                        key={ev.id}
                        className={`vertical-event-card ${
                          isSelected ? 'vertical-event-card-selected' : ''
                        }`}
                      >
                        <div className="vertical-card-when">
                          <span className="vertical-card-period">{ev.timeLabelKo}</span>
                          <span
                            className="vertical-card-lane"
                            style={{ color: grp.color }}
                          >
                            {grp.labelKo}
                          </span>
                        </div>

                        <div className="vertical-card-title-row">
                          <button
                            type="button"
                            className="vertical-card-title-btn"
                            onClick={() => onSelectSpecialEvent(activeSpecial, ev)}
                          >
                            {ev.titleKo}
                          </button>
                          <button
                            type="button"
                            className="vertical-card-detail-btn"
                            onClick={() => onSelectSpecialEvent(activeSpecial, ev)}
                          >
                            상세 ↗
                          </button>
                        </div>

                        <p className="vertical-card-summary">{ev.summaryKo}</p>

                        {ev.gospelTags && ev.gospelTags.length > 0 ? (
                          <div className="gospel-tag-row">
                            {ev.gospelTags.map((gt) => (
                              <span key={gt} className={`gospel-mini-pill gospel-pill-${gt}`}>
                                {gt}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {ev.passages.length > 0 ? (
                          <div className="vertical-card-passages">
                            {ev.passages.map((p) => (
                              <button
                                key={p.verseId}
                                type="button"
                                className="vertical-passage-chip"
                                onClick={() => onSelectPassage(p)}
                              >
                                <strong>
                                  {translation === 'en' ? p.labelEn : p.labelKo}
                                </strong>{' '}
                                읽기 →
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <aside className="vertical-era-notes-box" aria-label="특집 연대 산출 노트">
            <h4 className="vertical-notes-heading">⚖ 성경 근거 및 연대 노트</h4>
            <p className="vertical-notes-anchor">
              <strong>핵심 기준:</strong> {activeSpecial.anchorBasisKo}
            </p>
            {activeSpecial.studyNotesKo.map((note, idx) => (
              <p key={idx} className="vertical-notes-item">
                <span className="vertical-note-num">{idx + 1}</span>
                {note}
              </p>
            ))}
            {activeSpecial.divergentViewsKo ? (
              <p className="vertical-notes-divergent">
                <strong>학설 안내:</strong> {activeSpecial.divergentViewsKo}
              </p>
            ) : null}
          </aside>
        </article>
      ) : null}

      {/* 2) 12시대 세로 카드 뷰 (Phone Edition 구조: 시대 배너 -> 사건 카드 -> 하단 Notes) */}
      {sections.map(({ era, entries }) => (
        <article
          key={era.id}
          data-era-id={era.id}
          className="vertical-era-block"
          aria-label={`${era.nameKo} 세로 연대기`}
        >
          <header
            className="vertical-era-banner"
            style={{ backgroundColor: era.color }}
          >
            <div className="vertical-era-banner-top">
              <span className="vertical-era-step">제{era.order}시대</span>
              <span className="vertical-era-period">{era.displayPeriodKo}</span>
            </div>
            <h3 className="vertical-era-title">{era.nameKo}</h3>
            <p className="vertical-era-summary">{era.summaryKo}</p>

            {era.keyPassages.length > 0 ? (
              <div className="vertical-era-key-passages">
                {era.keyPassages.map((kp) => (
                  <button
                    key={kp.verseId}
                    type="button"
                    className="vertical-era-kp-btn"
                    onClick={() => onSelectPassage(kp)}
                  >
                    📖 {translation === 'en' ? kp.labelEn : kp.labelKo}
                  </button>
                ))}
              </div>
            ) : null}
          </header>

          {entries.length === 0 ? (
            <p className="vertical-empty-msg">
              선택한 유형 필터에 해당하는 항목이 이 시대에 없습니다.
            </p>
          ) : (
            <div className="vertical-card-list">
              {entries.map(({ item, customTrackLabelKo, customTrackColor }) => {
                const isSelected = selection?.kind === 'item' && selection.id === item.id;
                const isPrimary = primaryHighlightIds.has(item.id);
                const isUncertain =
                  item.datePrecision === 'estimated' || item.datePrecision === 'range';

                return (
                  <div
                    key={item.id}
                    className={`vertical-event-card ${
                      isSelected ? 'vertical-event-card-selected' : ''
                    } ${isPrimary ? 'vertical-event-card-primary' : ''} ${
                      isUncertain ? 'vertical-event-card-soft' : ''
                    }`}
                  >
                    <div className="vertical-card-when">
                      <span className="vertical-card-period">
                        {PERIOD_KIND_LABELS_KO[item.periodKind]} · {item.displayPeriodKo}
                      </span>
                      <span
                        className="vertical-card-lane"
                        style={{ color: customTrackColor }}
                      >
                        {customTrackLabelKo}
                      </span>
                    </div>

                    <div className="vertical-card-title-row">
                      <button
                        type="button"
                        className="vertical-card-title-btn"
                        onClick={() => onSelectItem(item)}
                      >
                        {item.category === 'event' ? `◆ ${item.nameKo}` : item.nameKo}
                        <span className="vertical-card-role"> · {item.roleLabelKo}</span>
                      </button>

                      <button
                        type="button"
                        className="vertical-card-detail-btn"
                        aria-label={`${item.nameKo} 상세 열기`}
                        onClick={() => onSelectItem(item)}
                      >
                        상세 ↗
                      </button>
                    </div>

                    <p className="vertical-card-summary">{item.summaryKo}</p>

                    <div className="vertical-card-meta-badges">
                      <span className="vertical-mini-badge">
                        {DATE_PRECISION_LABELS_KO[item.datePrecision]}
                      </span>
                      {item.recordType === 'external_history' ? (
                        <span className="vertical-mini-badge vertical-mini-badge-warn">
                          신구약 중간기 · 외부 역사
                        </span>
                      ) : null}
                      {item.recordType === 'epistle_background' ? (
                        <span className="vertical-mini-badge">서신 작성 시기</span>
                      ) : null}
                    </div>

                    {item.passages.length > 0 ? (
                      <div className="vertical-card-passages">
                        {item.passages.slice(0, 3).map((p) => (
                          <button
                            key={p.verseId}
                            type="button"
                            className="vertical-passage-chip"
                            onClick={() => onSelectPassage(p)}
                          >
                            <strong>
                              {translation === 'en' ? p.labelEn : p.labelKo}
                            </strong>{' '}
                            읽기 →
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {/* 하단 시대 연대 산출 근거 & 학설 비교 박스 */}
          {era.anchorBasisKo || era.studyNotesKo || era.divergentViewsKo ? (
            <aside className="vertical-era-notes-box" aria-label={`${era.nameKo} 연대 노트`}>
              <h4 className="vertical-notes-heading">⚖ {era.nameKo} 연대 산출 노트</h4>
              {era.anchorBasisKo ? (
                <p className="vertical-notes-anchor">
                  <strong>기준 좌표:</strong> {era.anchorBasisKo}
                </p>
              ) : null}
              {(era.studyNotesKo ?? []).map((note, idx) => (
                <p key={idx} className="vertical-notes-item">
                  <span className="vertical-note-num">{idx + 1}</span>
                  {note}
                </p>
              ))}
              {era.divergentViewsKo ? (
                <p className="vertical-notes-divergent">
                  <strong>학설 · 연대 견해:</strong> {era.divergentViewsKo}
                </p>
              ) : null}
            </aside>
          ) : null}
        </article>
      ))}
    </div>
  );
}
