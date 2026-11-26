import { useState } from 'react';
import { formatVerseRef, getTranslationLabel } from '../../config/books';
import { BROWSER_STORAGE_NOTICE } from '../../config/siteConfig';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import type { PersonalRecord, PersonalRecordType, ReadingPosition } from '../../types/bible';

interface MyRecordsModalProps {
  isOpen: boolean;
  records: readonly PersonalRecord[];
  onJumpToRecord: (pos: ReadingPosition) => void;
  onRemoveRecord: (id: string) => void;
  onClose: () => void;
}

export function MyRecordsModal({
  isOpen,
  records,
  onJumpToRecord,
  onRemoveRecord,
  onClose,
}: MyRecordsModalProps) {
  useBodyScrollLock(isOpen);
  const [activeType, setActiveType] = useState<PersonalRecordType>('bookmark');

  if (!isOpen) return null;

  const bookmarks = records.filter((r) => r.type === 'bookmark');
  const underlines = records.filter((r) => r.type === 'underline');
  const shown = activeType === 'bookmark' ? bookmarks : underlines;

  return (
    <div className="layer-backdrop" role="dialog" aria-modal="true" aria-label="내 기록">
      <div className="layer-sheet">
        <div className="layer-header">
          <div>
            <h2 className="layer-title">내 기록</h2>
            <p className="layer-subtitle">저장한 구절을 누르면 저장 당시 번역본과 구절로 이동합니다</p>
          </div>
          <button type="button" className="layer-close-btn" onClick={onClose} aria-label="내 기록 닫기">
            닫기
          </button>
        </div>

        <div className="storage-notice-banner" role="note">
          {BROWSER_STORAGE_NOTICE}
        </div>

        <div className="nav-step-tabs" role="tablist" aria-label="내 기록 분류">
          <button
            type="button"
            role="tab"
            aria-selected={activeType === 'bookmark'}
            className={`nav-step-tab ${activeType === 'bookmark' ? 'nav-step-tab-active' : ''}`}
            onClick={() => setActiveType('bookmark')}
          >
            책갈피 ({bookmarks.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeType === 'underline'}
            className={`nav-step-tab ${activeType === 'underline' ? 'nav-step-tab-active' : ''}`}
            onClick={() => setActiveType('underline')}
          >
            밑줄 ({underlines.length})
          </button>
        </div>

        <div className="layer-scroll-body">
          {shown.length === 0 ? (
            <p className="empty-state-msg">
              {activeType === 'bookmark'
                ? '저장된 책갈피가 없습니다. 본문에서 구절을 눌러 책갈피를 추가해 보세요.'
                : '저장된 밑줄이 없습니다. 본문에서 구절을 눌러 밑줄을 그어 보세요.'}
            </p>
          ) : (
            <ul className="records-list">
              {shown.map((rec) => (
                <li key={rec.id} className="record-card">
                  <button
                    type="button"
                    className="record-jump-btn"
                    onClick={() => {
                      onJumpToRecord({
                        translation: rec.translation,
                        book: rec.book,
                        chapter: rec.chapter,
                        verse: rec.verse,
                      });
                      onClose();
                    }}
                  >
                    <div className="record-card-top">
                      <strong>
                        {formatVerseRef(rec.book, rec.chapter, rec.verse, rec.translation)}
                      </strong>
                      <span className="record-tr-pill">{getTranslationLabel(rec.translation)}</span>
                    </div>
                    <p
                      className={`record-preview-text ${
                        rec.type === 'underline' ? 'verse-text-underlined' : ''
                      }`}
                    >
                      {rec.previewText}
                    </p>
                  </button>
                  <button
                    type="button"
                    className="record-delete-btn"
                    onClick={() => onRemoveRecord(rec.id)}
                    aria-label={`${formatVerseRef(rec.book, rec.chapter, rec.verse, 'kr')} ${
                      rec.type === 'bookmark' ? '책갈피' : '밑줄'
                    } 삭제`}
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
