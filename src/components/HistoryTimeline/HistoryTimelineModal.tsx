import { useEffect } from 'react';
import { getChapterLabel } from '../../config/books';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import type { ScriptureRef, TranslationId } from '../../types/bible';
import type { BibleHistoryDataset, ChapterHistoryMapping } from '../../types/history';
import { HistoryTimeline } from './HistoryTimeline';

interface HistoryTimelineModalProps {
  isOpen: boolean;
  book: number;
  chapter: number;
  translation: TranslationId;
  dataset: BibleHistoryDataset | null;
  anchorMapping: ChapterHistoryMapping | null;
  onSelectPassage: (ref: ScriptureRef) => void;
  onOpenFullTimeline?: () => void;
  onClose: () => void;
}

export function HistoryTimelineModal({
  isOpen,
  book,
  chapter,
  translation,
  dataset,
  anchorMapping,
  onSelectPassage,
  onOpenFullTimeline,
  onClose,
}: HistoryTimelineModalProps) {
  useBodyScrollLock(isOpen);

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

  if (!isOpen || !dataset) return null;

  const chapterLabel = getChapterLabel(book, chapter, 'kr');
  const era = anchorMapping
    ? dataset.eras.find((er) => er.id === anchorMapping.eraId) ?? null
    : null;

  return (
    <div
      className="layer-backdrop history-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="layer-sheet history-modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${chapterLabel} 역사 연대표 크게 보기`}
      >
        <div className="layer-header history-modal-header">
          <div className="history-modal-title-wrap">
            <h2 className="layer-title">{chapterLabel} · 역사 연대표</h2>
            {anchorMapping ? (
              <p className="layer-subtitle">
                {anchorMapping.displayPeriodKo}
                {era ? ` · ${era.nameKo}` : ''}
              </p>
            ) : null}
          </div>

          <div className="history-modal-header-actions">
            {onOpenFullTimeline ? (
              <button
                type="button"
                className="history-modal-fullpage-btn"
                onClick={() => {
                  onClose();
                  onOpenFullTimeline();
                }}
              >
                전체 화면 이동 →
              </button>
            ) : null}
            <button
              type="button"
              className="layer-close-btn"
              onClick={onClose}
              aria-label="연대표 팝업 닫기"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="history-modal-body">
          <HistoryTimeline
            variant="modal"
            dataset={dataset}
            translation={translation}
            anchorMapping={anchorMapping}
            onSelectPassage={(ref) => onSelectPassage(ref)}
          />
        </div>
      </div>
    </div>
  );
}
