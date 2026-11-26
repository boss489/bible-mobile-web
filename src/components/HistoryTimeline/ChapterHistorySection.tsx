import { useEffect, useMemo, useState } from 'react';
import {
  DATE_PRECISION_LABELS_KO,
  PERIOD_KIND_LABELS_KO,
  RECORD_TYPE_LABELS_KO,
} from '../../services/historyDataService';
import type { ScriptureRef, TranslationId } from '../../types/bible';
import type {
  BibleHistoryDataset,
  ChapterHistoryMapping,
  HistoryPassageLink,
  TimelineItem,
} from '../../types/history';
import { canonicalIdToScriptureRef } from '../../utils/verseId';

interface ChapterHistorySectionProps {
  dataset: BibleHistoryDataset;
  context: ChapterHistoryMapping;
  translation: TranslationId;
  chapterKey: string;
  onSelectPassage?: (ref: ScriptureRef) => void;
  onOpenTimelineModal: () => void;
  onOpenFullTimeline?: () => void;
}

export function ChapterHistorySection({
  dataset,
  context,
  translation,
  chapterKey,
  onSelectPassage,
  onOpenTimelineModal,
  onOpenFullTimeline,
}: ChapterHistorySectionProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);

  // 새 장으로 이동할 때 본문 집중을 위해 역사적 배경 패널은 기본 접힘 상태로 초기화
  useEffect(() => {
    setIsHistoryOpen(false);
    setPreviewItemId(null);
  }, [chapterKey]);

  const itemsById = useMemo(
    () => new Map<string, TimelineItem>(dataset.items.map((i) => [i.id, i])),
    [dataset.items],
  );

  const historyEra = useMemo(
    () => dataset.eras.find((e) => e.id === context.eraId) ?? null,
    [dataset.eras, context.eraId],
  );

  const contextPeopleAndEvents = useMemo(() => {
    const allIds = [...context.primaryItemIds, ...(context.relatedItemIds ?? [])];
    const seen = new Set<string>();
    const people: TimelineItem[] = [];
    const events: TimelineItem[] = [];
    for (const id of allIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const it = itemsById.get(id);
      if (!it) continue;
      if (it.category === 'event') events.push(it);
      else if (it.category !== 'polity') people.push(it);
    }
    return { people, events };
  }, [context, itemsById]);

  const previewItem = previewItemId ? itemsById.get(previewItemId) ?? null : null;

  const handleToggleChip = (itemId: string) => {
    setPreviewItemId((prev) => (prev === itemId ? null : itemId));
  };

  const handlePassageClick = (link: HistoryPassageLink) => {
    const ref = canonicalIdToScriptureRef(link.verseId, translation, link.roleKo);
    if (!ref) return;
    onSelectPassage?.(ref);
  };

  return (
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
          <span className="chapter-history-period">{context.displayPeriodKo}</span>
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
          {/* 1. 12시대 중 현재 본문 시대 위치 미니 스펙트럼 */}
          <div className="chapter-history-spectrum-box">
            <div className="chapter-history-spectrum-head">
              <span className="chapter-history-spectrum-label">
                {historyEra
                  ? `성경 역사 12시대 중 ${historyEra.order}단계 · ${historyEra.nameKo}`
                  : '역사 시대 위치'}
              </span>
              <span className="chapter-history-spectrum-sub">요약 위치 표시</span>
            </div>
            <div
              className="chapter-history-spectrum-bar"
              role="img"
              aria-label={
                historyEra
                  ? `12시대 중 ${historyEra.order}번째 ${historyEra.nameKo} 시대 강조`
                  : '시대 위치 표시 바'
              }
            >
              {dataset.eras.map((era) => {
                const isActive = era.id === context.eraId;
                return (
                  <span
                    key={era.id}
                    className={`chapter-history-spectrum-seg ${
                      isActive ? 'chapter-history-spectrum-seg-active' : ''
                    }`}
                    style={{ backgroundColor: era.color }}
                    title={`${era.nameKo} (${era.displayPeriodKo})`}
                  />
                );
              })}
            </div>
          </div>

          {/* 2. 현재 장절의 역사적 시점 요약 */}
          <div className="timeline-embedded-meta-row">
            <span className="comm-tag comm-tag-fact">
              {PERIOD_KIND_LABELS_KO[context.periodKind]} · {context.displayPeriodKo}
            </span>
            <span className="comm-tag comm-tag-neutral">
              {DATE_PRECISION_LABELS_KO[context.datePrecision]}
            </span>
          </div>

          <p className="timeline-embedded-summary">{context.contextSummaryKo}</p>

          {context.writtenVsEventNoteKo ? (
            <p className="timeline-embedded-note">{context.writtenVsEventNoteKo}</p>
          ) : null}

          {context.divergentViewsKo ? (
            <p className="timeline-embedded-note timeline-embedded-views">
              <strong>연대 견해 안내:</strong> {context.divergentViewsKo}
            </p>
          ) : null}

          {/* 3. 동시대 인물 및 관련 사건 칩 (탭하면 인라인 요약 + 다른 말씀 이동 표시) */}
          {contextPeopleAndEvents.people.length > 0 ? (
            <div className="timeline-chip-line">
              <span className="timeline-chip-line-title">동시대 인물:</span>
              {contextPeopleAndEvents.people.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={previewItemId === p.id}
                  className={`evidence-chip-btn ${
                    previewItemId === p.id ? 'timeline-chip-selected' : ''
                  }`}
                  onClick={() => handleToggleChip(p.id)}
                >
                  {p.nameKo}
                </button>
              ))}
            </div>
          ) : null}

          {contextPeopleAndEvents.events.length > 0 ? (
            <div className="timeline-chip-line">
              <span className="timeline-chip-line-title">관련 사건:</span>
              {contextPeopleAndEvents.events.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  aria-pressed={previewItemId === ev.id}
                  className={`evidence-chip-btn ${
                    previewItemId === ev.id ? 'timeline-chip-selected' : ''
                  }`}
                  onClick={() => handleToggleChip(ev.id)}
                >
                  ◆ {ev.nameKo}
                </button>
              ))}
            </div>
          ) : null}

          {/* 선택된 동시대 인물·사건 퀵 카드 */}
          {previewItem ? (
            <div className="chapter-history-quick-card" aria-live="polite">
              <div className="chapter-history-quick-head">
                <div>
                  <strong className="chapter-history-quick-title">{previewItem.nameKo}</strong>
                  <span className="chapter-history-quick-meta">
                    {previewItem.roleLabelKo} · {PERIOD_KIND_LABELS_KO[previewItem.periodKind]}{' '}
                    {previewItem.displayPeriodKo} ({RECORD_TYPE_LABELS_KO[previewItem.recordType]})
                  </span>
                </div>
                <button
                  type="button"
                  className="preview-close-btn"
                  onClick={() => setPreviewItemId(null)}
                >
                  접기
                </button>
              </div>
              <p className="chapter-history-quick-summary">{previewItem.summaryKo}</p>

              {previewItem.passages.length > 0 ? (
                <div className="chapter-history-quick-passages">
                  {previewItem.passages.map((p) => (
                    <button
                      key={p.verseId}
                      type="button"
                      className="chapter-history-quick-passage-btn"
                      onClick={() => handlePassageClick(p)}
                    >
                      <span>
                        <strong>{translation === 'en' ? p.labelEn : p.labelKo}</strong> ·{' '}
                        {p.titleKo}
                      </span>
                      <span className="timeline-passage-go" aria-hidden="true">
                        이동 →
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* 4. 연대표 크게 열기(모달) & 전체 역사 연대표 화면 이동 */}
          <div className="chapter-history-action-row">
            <button
              type="button"
              className="timeline-open-modal-btn"
              onClick={onOpenTimelineModal}
            >
              <span>⤢ 이 시점 연대표 크게 열기</span>
            </button>

            {onOpenFullTimeline ? (
              <button
                type="button"
                className="timeline-open-full-btn"
                onClick={onOpenFullTimeline}
              >
                <span>전체 역사 연대표 보기</span>
                <span aria-hidden="true">→</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
