import { useEffect, useMemo, useState } from 'react';
import { getBookMeta, getChapterLabel, getTranslationLabel } from '../../config/books';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { loadChapterData } from '../../services/dataLoader';
import type {
  BibleMapMeta,
  BookOverview,
  ChapterCommentary,
  ScriptureRef,
  TranslationId,
  VerseItem,
} from '../../types/bible';
import { BibleMapSvg } from './BibleMapSvg';

type CommentaryTabKey =
  | 'summary'
  | 'background'
  | 'mapTimeline'
  | 'characters'
  | 'relatedPassages'
  | 'bookOverview';

interface CommentarySheetProps {
  isOpen: boolean;
  book: number;
  chapter: number;
  translation: TranslationId;
  chapterCommentary: ChapterCommentary | null;
  bookOverview: BookOverview | null;
  maps: Record<string, BibleMapMeta>;
  onReadFullRelatedChapter: (ref: ScriptureRef) => void;
  onClose: () => void;
}

interface PreviewState {
  ref: ScriptureRef;
  loading: boolean;
  verses: VerseItem[];
  error: string | null;
}

export function CommentarySheet({
  isOpen,
  book,
  chapter,
  translation,
  chapterCommentary,
  bookOverview,
  maps,
  onReadFullRelatedChapter,
  onClose,
}: CommentarySheetProps) {
  useBodyScrollLock(isOpen);

  const availableTabs = useMemo(() => {
    const tabs: { key: CommentaryTabKey; label: string }[] = [];
    if (chapterCommentary?.summary?.reviewed) {
      tabs.push({ key: 'summary', label: '장별 요약' });
    }
    if (chapterCommentary?.background?.reviewed) {
      tabs.push({ key: 'background', label: '시대 배경' });
    }
    if (chapterCommentary?.mapTimeline?.reviewed) {
      tabs.push({ key: 'mapTimeline', label: '지도·연표' });
    }
    if (chapterCommentary?.characters?.reviewed) {
      tabs.push({ key: 'characters', label: '인물 설명' });
    }
    if (chapterCommentary?.relatedPassages?.reviewed) {
      tabs.push({ key: 'relatedPassages', label: '관련 장절' });
    }
    if (bookOverview?.reviewed) {
      tabs.push({ key: 'bookOverview', label: `${getBookMeta(book).nameKo} 개관` });
    }
    return tabs;
  }, [chapterCommentary, bookOverview, book]);

  const [activeTab, setActiveTab] = useState<CommentaryTabKey>('summary');
  const [preview, setPreview] = useState<PreviewState | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPreview(null);
      return;
    }
    if (availableTabs.length > 0 && !availableTabs.some((t) => t.key === activeTab)) {
      setActiveTab(availableTabs[0].key);
    }
  }, [isOpen, availableTabs, activeTab]);

  useEffect(() => {
    if (isOpen && availableTabs.length > 0) {
      setActiveTab(availableTabs[0].key);
      setPreview(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, chapter, isOpen]);

  const handleOpenPreview = (ref: ScriptureRef) => {
    setPreview({ ref, loading: true, verses: [], error: null });
    loadChapterData(translation, ref.book, ref.chapter)
      .then((chData) => {
        const end = ref.verseEnd ?? ref.verseStart;
        const matched = chData.verses.filter((v) => v.verse >= ref.verseStart && v.verse <= end);
        setPreview({
          ref,
          loading: false,
          verses: matched.length > 0 ? matched : chData.verses.slice(0, 2),
          error: null,
        });
      })
      .catch(() => {
        setPreview({
          ref,
          loading: false,
          verses: [],
          error: '구절 미리보기를 불러오지 못했습니다.',
        });
      });
  };

  if (!isOpen) return null;

  const chapterMapMeta = chapterCommentary?.mapTimeline?.mapId
    ? maps[chapterCommentary.mapTimeline.mapId]
    : undefined;
  const bookMapMeta = bookOverview?.mapId ? maps[bookOverview.mapId] : undefined;

  return (
    <div
      className="layer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${getChapterLabel(book, chapter, 'kr')} 본문 이해`}
    >
      <div className="layer-sheet commentary-layer-sheet">
        <div className="layer-header">
          <div>
            <h2 className="layer-title">{getChapterLabel(book, chapter, 'kr')} 이해</h2>
            <p className="layer-subtitle">사전 검토된 해설 자료만 표시됩니다 (AI 실시간 호출 없음)</p>
          </div>
          <button type="button" className="layer-close-btn" onClick={onClose} aria-label="해설 팝업 닫기">
            닫기
          </button>
        </div>

        {availableTabs.length === 0 ? (
          <div className="layer-scroll-body">
            <p className="empty-state-msg">현재 검토 완료된 해설 자료가 없습니다.</p>
          </div>
        ) : (
          <>
            <div className="commentary-tabs" role="tablist" aria-label="해설 항목">
              {availableTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  className={`commentary-tab-btn ${
                    activeTab === tab.key ? 'commentary-tab-active' : ''
                  }`}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setPreview(null);
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="layer-scroll-body commentary-scroll-body">
              {/* 구절 미리보기 카드 (이어서 읽기 위치를 절대 갱신하지 않음) */}
              {preview ? (
                <section className="related-preview-box" aria-live="polite">
                  <div className="related-preview-header">
                    <strong>
                      구절 미리보기 · {preview.ref.label} ({getTranslationLabel(translation)})
                    </strong>
                    <button
                      type="button"
                      className="preview-close-btn"
                      onClick={() => setPreview(null)}
                    >
                      접기
                    </button>
                  </div>
                  {preview.loading ? (
                    <p className="preview-loading">본문을 불러오는 중...</p>
                  ) : preview.error ? (
                    <p className="preview-error">{preview.error}</p>
                  ) : (
                    <div className="preview-verses">
                      {preview.verses.map((v) => (
                        <p key={v.verse} className="preview-verse-line">
                          <span className="preview-verse-num">{v.verse}</span> {v.text}
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="related-preview-footer">
                    <span className="preview-hint">미리보기 중에는 이어서 읽기 위치가 바뀌지 않습니다.</span>
                    <button
                      type="button"
                      className="read-full-chapter-btn"
                      onClick={() => onReadFullRelatedChapter(preview.ref)}
                    >
                      해당 장 전체 읽기 →
                    </button>
                  </div>
                </section>
              ) : null}

              {activeTab === 'summary' && chapterCommentary?.summary ? (
                <article className="commentary-section">
                  <div className="comm-card">
                    <span className="comm-tag comm-tag-neutral">장별 흐름</span>
                    <p className="comm-body-text">{chapterCommentary.summary.flow}</p>
                  </div>

                  <div className="comm-card">
                    <span className="comm-tag comm-tag-fact">본문 명시 사실</span>
                    <p className="comm-body-text">{chapterCommentary.summary.statedFacts}</p>
                  </div>

                  <div className="comm-card">
                    <span className="comm-tag comm-tag-interp">해설 및 신학적 의미</span>
                    <p className="comm-body-text">{chapterCommentary.summary.interpretations}</p>
                  </div>

                  <div className="comm-sub-heading">핵심 구절과 선정 이유</div>
                  {chapterCommentary.summary.keyVerses.map((kv) => (
                    <div key={kv.label} className="comm-card">
                      <div className="comm-ref-row">
                        <strong>{kv.label}</strong>
                        <button
                          type="button"
                          className="inline-preview-btn"
                          onClick={() => handleOpenPreview(kv)}
                        >
                          구절 미리보기
                        </button>
                      </div>
                      <p className="comm-body-text">{kv.reason}</p>
                    </div>
                  ))}

                  <footer className="comm-sources-box">
                    <strong>근거 장절 및 참고자료:</strong> {chapterCommentary.summary.sources.join(' · ')}
                  </footer>
                </article>
              ) : null}

              {activeTab === 'background' && chapterCommentary?.background ? (
                <article className="commentary-section">
                  <div className="comm-card">
                    <span className="comm-tag comm-tag-fact">본문 내 배경 단서 (사실)</span>
                    <p className="comm-body-text">{chapterCommentary.background.statedFacts}</p>
                  </div>

                  <div className="comm-card">
                    <span className="comm-tag comm-tag-interp">시대·역사·문화적 설명</span>
                    <p className="comm-body-text">{chapterCommentary.background.interpretations}</p>
                  </div>

                  {chapterCommentary.background.divergentViews ? (
                    <div className="comm-card comm-card-views">
                      <span className="comm-tag comm-tag-views">학계·해석 견해 차이 안내</span>
                      <p className="comm-body-text">{chapterCommentary.background.divergentViews}</p>
                    </div>
                  ) : null}

                  <footer className="comm-sources-box">
                    <strong>근거 장절 및 참고자료:</strong>{' '}
                    {chapterCommentary.background.sources.join(' · ')}
                  </footer>
                </article>
              ) : null}

              {activeTab === 'mapTimeline' && chapterCommentary?.mapTimeline ? (
                <article className="commentary-section">
                  {chapterMapMeta ? (
                    <BibleMapSvg
                      mapMeta={chapterMapMeta}
                      highlightRegions={chapterCommentary.mapTimeline.highlightRegions}
                      highlightStops={chapterCommentary.mapTimeline.highlightStops}
                      attestedSequence={chapterCommentary.mapTimeline.attestedSequence}
                    />
                  ) : null}

                  <div className="comm-sub-heading">사건 및 이동 순서</div>
                  <ol className="timeline-list">
                    {chapterCommentary.mapTimeline.events.map((ev, idx) => (
                      <li key={idx} className="timeline-item">
                        <div className="timeline-step-head">
                          <strong>{ev.step}</strong>
                          {ev.place ? <span className="timeline-place">{ev.place}</span> : null}
                          {ev.verseRef ? <span className="timeline-ref">({ev.verseRef})</span> : null}
                        </div>
                        <p className="comm-body-text">{ev.description}</p>
                      </li>
                    ))}
                  </ol>

                  {chapterCommentary.mapTimeline.chronologyNote ? (
                    <div className="comm-card comm-card-views">
                      <span className="comm-tag comm-tag-views">연대·지리 참고</span>
                      <p className="comm-body-text">{chapterCommentary.mapTimeline.chronologyNote}</p>
                    </div>
                  ) : null}

                  <footer className="comm-sources-box">
                    <strong>근거 장절 및 참고자료:</strong>{' '}
                    {chapterCommentary.mapTimeline.sources.join(' · ')}
                  </footer>
                </article>
              ) : null}

              {activeTab === 'characters' && chapterCommentary?.characters ? (
                <article className="commentary-section">
                  {chapterCommentary.characters.items.map((person) => (
                    <div key={person.name} className="comm-card">
                      <h3 className="char-name">{person.name}</h3>
                      <p className="char-meta">
                        <strong>역할:</strong> {person.role} · <strong>관계:</strong> {person.relationships}
                      </p>
                      {person.disambiguation ? (
                        <div className="char-disambig-box">
                          <strong>동명이인·호칭 구분:</strong> {person.disambiguation}
                        </div>
                      ) : null}
                      <p className="comm-body-text">
                        <strong>본 장에서의 행적·발언:</strong> {person.actionsInChapter}
                      </p>
                      {person.motiveNote ? (
                        <p className="char-motive-note">
                          <strong>동기·해석 참고:</strong> {person.motiveNote}
                        </p>
                      ) : null}
                    </div>
                  ))}

                  <footer className="comm-sources-box">
                    <strong>근거 장절 및 참고자료:</strong>{' '}
                    {chapterCommentary.characters.sources.join(' · ')}
                  </footer>
                </article>
              ) : null}

              {activeTab === 'relatedPassages' && chapterCommentary?.relatedPassages ? (
                <article className="commentary-section">
                  <p className="related-guide">
                    관련 구절을 먼저 팝업에서 미리 읽어 보거나, 해당 장 전체로 이동했다가 원래 읽던 번역본과 절로 돌아올 수 있습니다.
                  </p>
                  {chapterCommentary.relatedPassages.items.map((item) => (
                    <div key={item.label} className="comm-card">
                      <div className="comm-ref-row">
                        <div>
                          <strong className="related-ref-title">{item.label}</strong>
                          <span className="comm-tag comm-tag-link">{item.connectionType}</span>
                        </div>
                      </div>
                      <p className="comm-body-text">{item.reason}</p>
                      <div className="related-btn-group">
                        <button
                          type="button"
                          className="inline-preview-btn"
                          onClick={() => handleOpenPreview(item)}
                        >
                          팝업에서 미리 읽기
                        </button>
                        <button
                          type="button"
                          className="read-full-chapter-btn"
                          onClick={() => onReadFullRelatedChapter(item)}
                        >
                          해당 장 전체 읽기
                        </button>
                      </div>
                    </div>
                  ))}
                </article>
              ) : null}

              {activeTab === 'bookOverview' && bookOverview ? (
                <article className="commentary-section">
                  <div className="comm-card">
                    <span className="comm-tag comm-tag-fact">권 전체 구성 (본문 사실)</span>
                    <p className="comm-body-text">{bookOverview.statedFacts}</p>
                  </div>

                  <div className="comm-card">
                    <span className="comm-tag comm-tag-interp">핵심 메시지와 신학적 의미</span>
                    <p className="comm-body-text">{bookOverview.interpretations}</p>
                  </div>

                  <div className="comm-card">
                    <span className="comm-tag comm-tag-neutral">시대 배경</span>
                    <p className="comm-body-text">{bookOverview.eraBackground}</p>
                  </div>

                  <div className="comm-card comm-card-views">
                    <span className="comm-tag comm-tag-views">연대 및 학계 견해 안내</span>
                    <p className="comm-body-text">{bookOverview.chronology}</p>
                  </div>

                  {bookMapMeta ? <BibleMapSvg mapMeta={bookMapMeta} /> : null}

                  <div className="comm-card">
                    <div className="comm-ref-row">
                      <strong>대표 핵심 구절 · {bookOverview.keyVerse.label}</strong>
                      <button
                        type="button"
                        className="inline-preview-btn"
                        onClick={() => handleOpenPreview(bookOverview.keyVerse)}
                      >
                        구절 미리보기
                      </button>
                    </div>
                    <p className="comm-body-text">{bookOverview.keyVerse.reason}</p>
                    <div className="related-btn-group">
                      <button
                        type="button"
                        className="read-full-chapter-btn"
                        onClick={() => onReadFullRelatedChapter(bookOverview.keyVerse)}
                      >
                        해당 장 전체 읽기
                      </button>
                    </div>
                  </div>

                  <footer className="comm-sources-box">
                    <strong>근거 장절 및 참고자료:</strong> {bookOverview.sources.join(' · ')}
                  </footer>
                </article>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
