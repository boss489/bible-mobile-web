import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { formatVerseRef, getBookMeta, getTranslationLabel } from '../../config/books';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { loadChapterData } from '../../services/dataLoader';
import { makeRecordId } from '../../services/storage';
import {
  copyTextToClipboard,
  formatVerseClipboardText,
  shareOrCopyVerse,
  studyRepository,
  type StudyDataRepository,
  type VerseStudyDataPayload,
} from '../../services/studyDataService';
import type {
  BookOverview,
  ChapterCommentary,
  ChapterData,
  PersonalRecordType,
  ScriptureRef,
  TranslationId,
  VerseItem,
} from '../../types/bible';
import {
  canonicalIdToScriptureRef,
  formatCanonicalVerseId,
  RELATION_LABELS_KO,
} from '../../utils/verseId';

export type VerseStudyTabKey = 'references' | 'context' | 'translations';

interface VerseStudySheetProps {
  isOpen: boolean;
  book: number;
  chapter: number;
  verse: number;
  translation: TranslationId;
  chapterData: ChapterData | null;
  chapterCommentary: ChapterCommentary | null;
  bookOverview: BookOverview | null;
  recordIds: ReadonlySet<string>;
  initialTab?: VerseStudyTabKey;
  repository?: StudyDataRepository;
  onChangeVerse: (nextVerse: number) => void;
  onToggleRecord: (type: PersonalRecordType, verse: number, text: string) => void;
  onSwitchTranslation: (next: TranslationId) => void;
  onNavigateToRelated: (ref: ScriptureRef, originVerse: number) => void;
  onOpenChapterCommentary: () => void;
  onClose: () => void;
}

interface InlinePreviewState {
  ref: ScriptureRef;
  loading: boolean;
  verses: VerseItem[];
  error: string | null;
}

const TABS_ORDER: readonly { key: VerseStudyTabKey; label: string }[] = [
  { key: 'references', label: '관련 말씀' },
  { key: 'context', label: '문맥 해설' },
  { key: 'translations', label: '번역 비교' },
];

export function VerseStudySheet({
  isOpen,
  book,
  chapter,
  verse,
  translation,
  chapterData,
  chapterCommentary,
  bookOverview,
  recordIds,
  initialTab = 'references',
  repository = studyRepository,
  onChangeVerse,
  onToggleRecord,
  onSwitchTranslation,
  onNavigateToRelated,
  onOpenChapterCommentary,
  onClose,
}: VerseStudySheetProps) {
  useBodyScrollLock(isOpen);

  const [activeTab, setActiveTab] = useState<VerseStudyTabKey>(initialTab);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<VerseStudyDataPayload | null>(null);
  const [retrySeq, setRetrySeq] = useState<number>(0);
  const [preview, setPreview] = useState<InlinePreviewState | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const requestSeqRef = useRef<number>(0);
  const previewSeqRef = useRef<number>(0);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<Record<VerseStudyTabKey, HTMLButtonElement | null>>({
    references: null,
    context: null,
    translations: null,
  });

  // 시트 오픈 시 초기 탭 반영 및 닫기 버튼 동기 포커스 (지연 포커스로 인한 사용자 탭 조작 방해 방지)
  useLayoutEffect(() => {
    if (!isOpen) {
      setPreview(null);
      return;
    }
    setActiveTab(initialTab);
    closeBtnRef.current?.focus();
  }, [isOpen, initialTab]);

  // Escape 키 닫기 지원
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCloseWithFocusRestore();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, verse]);

  // 절 변경 또는 재시도 시 탐구 데이터 로드 (요청 식별자 + AbortController 로 레이스 컨디션 원천 차단)
  useEffect(() => {
    if (!isOpen) return;

    const currentReqId = ++requestSeqRef.current;
    const controller = new AbortController();

    setLoading(true);
    setError(null);
    setPayload(null);
    setPreview(null);

    repository
      .getVerseStudy({
        book,
        chapter,
        verse,
        activeTranslation: translation,
        signal: controller.signal,
      })
      .then((res) => {
        if (controller.signal.aborted || currentReqId !== requestSeqRef.current) {
          return;
        }
        setPayload(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || currentReqId !== requestSeqRef.current) {
          return;
        }
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setLoading(false);
        setError(err instanceof Error ? err.message : '본문 탐구 자료를 불러오지 못했습니다.');
      });

    return () => {
      controller.abort();
    };
  }, [isOpen, book, chapter, verse, translation, retrySeq, repository]);

  const handleCloseWithFocusRestore = () => {
    const targetVerseBtn = document.getElementById(`verse-btn-${verse}`);
    onClose();
    if (targetVerseBtn) {
      requestAnimationFrame(() => {
        targetVerseBtn.focus({ preventScroll: true });
      });
    }
  };

  const handleTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const idx = TABS_ORDER.findIndex((t) => t.key === activeTab);
    const nextIdx =
      e.key === 'ArrowRight'
        ? (idx + 1) % TABS_ORDER.length
        : (idx - 1 + TABS_ORDER.length) % TABS_ORDER.length;
    const nextKey = TABS_ORDER[nextIdx].key;
    setActiveTab(nextKey);
    tabRefs.current[nextKey]?.focus();
  };

  const handleOpenPreview = (canonicalId: string) => {
    const ref = canonicalIdToScriptureRef(canonicalId, translation);
    if (!ref) return;

    const seq = ++previewSeqRef.current;
    setPreview({ ref, loading: true, verses: [], error: null });

    loadChapterData(translation, ref.book, ref.chapter)
      .then((chData) => {
        if (seq !== previewSeqRef.current) return;
        const end = ref.verseEnd ?? ref.verseStart;
        const matched = chData.verses.filter((v) => v.verse >= ref.verseStart && v.verse <= end);
        setPreview({
          ref,
          loading: false,
          verses: matched,
          error: matched.length === 0 ? '해당 역본에서 구절 본문을 찾을 수 없습니다.' : null,
        });
      })
      .catch(() => {
        if (seq !== previewSeqRef.current) return;
        setPreview({
          ref,
          loading: false,
          verses: [],
          error: '구절 미리보기를 불러오지 못했습니다.',
        });
      });
  };

  const triggerFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    window.setTimeout(() => {
      setFeedbackMsg((prev) => (prev === msg ? null : prev));
    }, 1800);
  };

  if (!isOpen) return null;

  const currentVerseObj = chapterData?.verses.find((v) => v.verse === verse);
  const currentVerseText = currentVerseObj?.text ?? '';
  const chapterVerses = chapterData?.verses ?? [];
  const verseIdx = chapterVerses.findIndex((v) => v.verse === verse);
  const prevVerseNum = verseIdx > 0 ? chapterVerses[verseIdx - 1].verse : null;
  const nextVerseNum =
    verseIdx >= 0 && verseIdx < chapterVerses.length - 1 ? chapterVerses[verseIdx + 1].verse : null;

  const isBookmarked = recordIds.has(makeRecordId('bookmark', book, chapter, verse));
  const isUnderlined = recordIds.has(makeRecordId('underline', book, chapter, verse));

  let canonicalBadge = '';
  try {
    canonicalBadge = formatCanonicalVerseId(book, chapter, verse);
  } catch {
    canonicalBadge = '';
  }

  const refCount = payload?.crossReferences.length ?? 0;
  const ctxCount = payload?.passageContexts.length ?? 0;
  const bookMeta = getBookMeta(book);

  return (
    <div
      className="layer-backdrop study-layer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${formatVerseRef(book, chapter, verse, 'kr')} 본문 탐구`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCloseWithFocusRestore();
        }
      }}
    >
      <div className="layer-sheet study-layer-sheet">
        <div className="layer-header study-layer-header">
          <div className="study-header-main">
            <div className="study-title-row">
              <h2 className="layer-title">{formatVerseRef(book, chapter, verse, 'kr')}</h2>
              <span className="study-tr-badge">{getTranslationLabel(translation)}</span>
              {canonicalBadge ? <span className="study-id-badge">{canonicalBadge}</span> : null}
            </div>
            <p className="layer-subtitle">검수 완료된 자료와 로컬 성경 본문만 표시합니다 (실시간 AI 호출 없음)</p>
          </div>

          <div className="study-header-actions">
            <div className="study-verse-stepper" role="group" aria-label="인접 절 이동">
              <button
                type="button"
                className="study-step-btn"
                disabled={prevVerseNum === null}
                onClick={() => prevVerseNum !== null && onChangeVerse(prevVerseNum)}
                aria-label={prevVerseNum !== null ? `이전 절 (${prevVerseNum}절)` : '첫 절입니다'}
              >
                ‹ {prevVerseNum ?? ''}
              </button>
              <button
                type="button"
                className="study-step-btn"
                disabled={nextVerseNum === null}
                onClick={() => nextVerseNum !== null && onChangeVerse(nextVerseNum)}
                aria-label={nextVerseNum !== null ? `다음 절 (${nextVerseNum}절)` : '마지막 절입니다'}
              >
                {nextVerseNum ?? ''} ›
              </button>
            </div>
            <button
              ref={closeBtnRef}
              type="button"
              className="layer-close-btn"
              onClick={handleCloseWithFocusRestore}
              aria-label="본문 탐구 닫기"
            >
              닫기
            </button>
          </div>
        </div>

        {/* 선택 구절 요약 및 빠른 개인화 도구 */}
        {currentVerseText ? (
          <div className="study-anchor-strip">
            <p className="study-anchor-verse">
              <span className="preview-verse-num">{verse}</span> {currentVerseText}
            </p>
            <div className="study-quick-bar" role="toolbar" aria-label="선택 구절 빠른 실행">
              <button
                type="button"
                className="study-quick-btn"
                onClick={async () => {
                  const ok = await copyTextToClipboard(
                    formatVerseClipboardText(book, chapter, verse, translation, currentVerseText),
                  );
                  triggerFeedback(ok ? '구절 복사됨' : '복사 실패');
                }}
              >
                복사
              </button>
              <button
                type="button"
                className={`study-quick-btn ${isUnderlined ? 'study-quick-active' : ''}`}
                aria-pressed={isUnderlined}
                onClick={() => onToggleRecord('underline', verse, currentVerseText)}
              >
                {isUnderlined ? '밑줄됨' : '밑줄'}
              </button>
              <button
                type="button"
                className={`study-quick-btn ${isBookmarked ? 'study-quick-active' : ''}`}
                aria-pressed={isBookmarked}
                onClick={() => onToggleRecord('bookmark', verse, currentVerseText)}
              >
                {isBookmarked ? '책갈피됨' : '책갈피'}
              </button>
              <button
                type="button"
                className="study-quick-btn"
                onClick={async () => {
                  const res = await shareOrCopyVerse({
                    book,
                    chapter,
                    verse,
                    translation,
                    text: currentVerseText,
                  });
                  if (res === 'shared') triggerFeedback('공유 완료');
                  else if (res === 'copied') triggerFeedback('클립보드에 복사됨');
                }}
              >
                공유
              </button>
              {feedbackMsg ? (
                <span className="verse-toast-pill" role="status" aria-live="polite">
                  {feedbackMsg}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* 탐구 탭 목록 (키보드 좌우 방향키 탐색 지원) */}
        <div
          className="commentary-tabs study-tabs"
          role="tablist"
          aria-label="본문 탐구 항목"
          onKeyDown={handleTabKeyDown}
        >
          {TABS_ORDER.map((tab) => {
            const countBadge =
              !loading && !error && payload
                ? tab.key === 'references'
                  ? refCount
                  : tab.key === 'context'
                    ? ctxCount
                    : null
                : null;

            return (
              <button
                key={tab.key}
                ref={(el) => {
                  tabRefs.current[tab.key] = el;
                }}
                id={`study-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                aria-controls={`study-panel-${tab.key}`}
                tabIndex={activeTab === tab.key ? 0 : -1}
                className={`commentary-tab-btn ${
                  activeTab === tab.key ? 'commentary-tab-active' : ''
                }`}
                onClick={() => {
                  setActiveTab(tab.key);
                  setPreview(null);
                }}
              >
                <span>{tab.label}</span>
                {countBadge !== null && countBadge > 0 ? (
                  <span className="study-tab-count">{countBadge}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div
          id={`study-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`study-tab-${activeTab}`}
          className="layer-scroll-body commentary-scroll-body"
        >
          {loading ? (
            <div className="study-state-box" role="status" aria-live="polite">
              <p className="study-state-text">탐구 자료를 불러오는 중입니다...</p>
            </div>
          ) : error ? (
            <div className="study-state-box study-error-box" role="alert">
              <p className="study-error-text">{error}</p>
              <button
                type="button"
                className="study-retry-btn"
                onClick={() => setRetrySeq((s) => s + 1)}
              >
                다시 시도
              </button>
            </div>
          ) : payload ? (
            <>
              {/* 인라인 관련 구절 미리보기 박스 (이어읽기 위치 불변) */}
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
                      {preview.verses.map((pv) => (
                        <p key={pv.verse} className="preview-verse-line">
                          <span className="preview-verse-num">{pv.verse}</span> {pv.text}
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="related-preview-footer">
                    <span className="preview-hint">미리보기 중에는 이어서 읽기 위치가 바뀌지 않습니다.</span>
                    <button
                      type="button"
                      className="read-full-chapter-btn"
                      onClick={() => onNavigateToRelated(preview.ref, verse)}
                    >
                      해당 구절로 이동 →
                    </button>
                  </div>
                </section>
              ) : null}

              {/* F02. 관련 말씀 탭 */}
              {activeTab === 'references' ? (
                <article className="commentary-section">
                  {payload.crossReferences.length === 0 ? (
                    <div className="study-empty-card">
                      <p className="study-empty-title">
                        이 구절에 대해 검수 완료된 관련 말씀이 아직 등록되지 않았습니다.
                      </p>
                      <p className="study-empty-desc">
                        단순 단어 유사도에 따른 무분별한 추천을 배제하고, 문맥상 직접 인용·예언 성취·동일 사건 등 연결 근거가 확인된 구절만 제공합니다.
                      </p>
                      {chapterCommentary?.relatedPassages?.reviewed ? (
                        <button
                          type="button"
                          className="inline-preview-btn"
                          onClick={() => {
                            onClose();
                            onOpenChapterCommentary();
                          }}
                        >
                          이 장 전체의 관련 장절 보기 →
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <p className="related-guide">
                        직접 인용·성취·문맥 연결이 검증된 구절입니다(최대 5개). 미리 읽어 보거나 해당 장으로 이동했다가 원래 위치로 돌아올 수 있습니다.
                      </p>
                      {payload.crossReferences.map((item) => {
                        const targetRef = canonicalIdToScriptureRef(
                          item.targetVerseId,
                          'kr',
                          item.reason,
                        );
                        return (
                          <div key={item.targetVerseId} className="comm-card">
                            <div className="comm-ref-row">
                              <div className="study-ref-head">
                                <strong className="related-ref-title">{item.targetLabelKo}</strong>
                                <span className="comm-tag comm-tag-link">
                                  {RELATION_LABELS_KO[item.relationType]}
                                </span>
                              </div>
                              <span className="verified-pill">검수됨</span>
                            </div>
                            <p className="comm-body-text">{item.reason}</p>
                            <div className="related-btn-group">
                              <button
                                type="button"
                                className="inline-preview-btn"
                                onClick={() => handleOpenPreview(item.targetVerseId)}
                              >
                                팝업에서 미리 읽기
                              </button>
                              {targetRef ? (
                                <button
                                  type="button"
                                  className="read-full-chapter-btn"
                                  onClick={() => onNavigateToRelated(targetRef, verse)}
                                >
                                  해당 구절로 이동
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </article>
              ) : null}

              {/* F03. 문맥 해설 탭 */}
              {activeTab === 'context' ? (
                <article className="commentary-section">
                  {payload.passageContexts.length > 0 ? (
                    payload.passageContexts.map((pc) => {
                      const sourceTitles = pc.sourceIds
                        .map((sid) => payload.sources[sid]?.title ?? sid)
                        .join(' · ');

                      return (
                        <div key={pc.passageId} className="study-context-group">
                          <div className="comm-card">
                            <div className="study-context-top">
                              <span className="comm-tag comm-tag-neutral">
                                단락 문맥 · {formatVerseRef(pc.book, pc.chapter, pc.verseStart, 'kr', pc.verseEnd)}
                              </span>
                              <span className="verified-pill">검수됨</span>
                            </div>
                            <h3 className="study-context-title">{pc.title}</h3>
                            <p className="comm-body-text">{pc.summary}</p>

                            {pc.speaker || pc.audience || pc.historicalSituation ? (
                              <dl className="study-meta-list">
                                {pc.speaker ? (
                                  <div className="study-meta-row">
                                    <dt>화자</dt>
                                    <dd>{pc.speaker}</dd>
                                  </div>
                                ) : null}
                                {pc.audience ? (
                                  <div className="study-meta-row">
                                    <dt>청자</dt>
                                    <dd>{pc.audience}</dd>
                                  </div>
                                ) : null}
                                {pc.historicalSituation ? (
                                  <div className="study-meta-row">
                                    <dt>시대·현장 상황</dt>
                                    <dd>{pc.historicalSituation}</dd>
                                  </div>
                                ) : null}
                              </dl>
                            ) : null}
                          </div>

                          <div className="comm-card">
                            <span className="comm-tag comm-tag-fact">본문 명시 사실</span>
                            <p className="comm-body-text">{pc.statedFacts}</p>
                          </div>

                          <div className="comm-card">
                            <span className="comm-tag comm-tag-neutral">앞뒤 단락 흐름</span>
                            <p className="comm-body-text">{pc.flow}</p>
                          </div>

                          {pc.interpretations ? (
                            <div className="comm-card">
                              <span className="comm-tag comm-tag-interp">문맥·신학적 해설 (해석)</span>
                              <p className="comm-body-text">{pc.interpretations}</p>
                            </div>
                          ) : null}

                          {pc.divergentViews ? (
                            <div className="comm-card comm-card-views">
                              <span className="comm-tag comm-tag-views">학술적 쟁점·견해 차이</span>
                              <p className="comm-body-text">{pc.divergentViews}</p>
                            </div>
                          ) : null}

                          {pc.expressions && pc.expressions.length > 0 ? (
                            <div className="comm-card">
                              <div className="comm-sub-heading study-expr-heading">주요 표현 풀이</div>
                              <div className="study-expr-list">
                                {pc.expressions.map((expr) => {
                                  const isCurrentVerseExpr = expr.verse === verse;
                                  return (
                                    <div
                                      key={`${expr.term}-${expr.verse ?? 0}`}
                                      className={`study-expr-item ${
                                        isCurrentVerseExpr ? 'study-expr-item-highlight' : ''
                                      }`}
                                    >
                                      <div className="study-expr-top">
                                        <strong>
                                          ‘{expr.term}’
                                          {expr.verse ? ` (${expr.verse}절)` : ''}
                                        </strong>
                                        <span
                                          className={`comm-tag ${
                                            expr.basisType === 'STATED_FACT'
                                              ? 'comm-tag-fact'
                                              : 'comm-tag-interp'
                                          }`}
                                        >
                                          {expr.basisType === 'STATED_FACT' ? '본문 단서' : '학술 해설'}
                                        </span>
                                      </div>
                                      <p className="comm-body-text">{expr.meaning}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}

                          <footer className="comm-sources-box">
                            <div className="study-evidence-row">
                              <strong>근거 구절:</strong>
                              {pc.evidenceVerseIds.map((evId) => {
                                const evRef = canonicalIdToScriptureRef(evId, 'kr');
                                return (
                                  <button
                                    key={evId}
                                    type="button"
                                    className="evidence-chip-btn"
                                    onClick={() => handleOpenPreview(evId)}
                                  >
                                    {evRef?.label ?? evId}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="study-source-line">
                              <strong>출처:</strong> {sourceTitles}
                            </div>
                          </footer>
                        </div>
                      );
                    })
                  ) : (
                    <div className="study-empty-card">
                      <p className="study-empty-title">
                        이 구절의 개별 단락 해설은 아직 검수 전입니다.
                      </p>
                      <p className="study-empty-desc">
                        검증되지 않은 추측성 해설을 표시하지 않는 대신, 아래에서 현재 장·권의 사전 검토된 거시 배경을 확인하실 수 있습니다.
                      </p>
                    </div>
                  )}

                  {/* 기존 장별 해설 / 66권 개관 계층 연결 카드 */}
                  {chapterCommentary?.summary?.reviewed || bookOverview?.reviewed ? (
                    <div className="comm-card study-macro-bridge-card">
                      <span className="comm-tag comm-tag-neutral">
                        참고 · {chapterCommentary?.summary?.reviewed ? `${bookMeta.nameKo} ${chapter}장 흐름` : `${bookMeta.nameKo} 권별 개관`}
                      </span>
                      <p className="comm-body-text">
                        {chapterCommentary?.summary?.reviewed
                          ? chapterCommentary.summary.flow
                          : bookOverview?.statedFacts}
                      </p>
                      <div className="related-btn-group">
                        <button
                          type="button"
                          className="inline-preview-btn"
                          onClick={() => {
                            onClose();
                            onOpenChapterCommentary();
                          }}
                        >
                          {bookMeta.nameKo} 전체 개관·지도 열기 →
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              ) : null}

              {/* F04. 번역 비교 탭 */}
              {activeTab === 'translations' ? (
                <article className="commentary-section">
                  {payload.translationComparison.alignmentNotice ? (
                    <div className="comm-card comm-card-views" role="note">
                      <span className="comm-tag comm-tag-views">절 구분·사본 전승 안내</span>
                      <p className="comm-body-text">
                        {payload.translationComparison.alignmentNotice}
                      </p>
                    </div>
                  ) : null}

                  <div className="translation-compare-grid">
                    <div className="comm-card tr-compare-card">
                      <div className="comm-ref-row">
                        <div>
                          <span className="tr-compare-badge">개역개정</span>
                          <strong className="tr-compare-ref">
                            {payload.translationComparison.krLabel}
                          </strong>
                        </div>
                        {translation !== 'kr' ? (
                          <button
                            type="button"
                            className="inline-preview-btn"
                            onClick={() => {
                              onSwitchTranslation('kr');
                              onClose();
                            }}
                          >
                            개역개정으로 읽기
                          </button>
                        ) : null}
                      </div>
                      {payload.translationComparison.krVerses.length > 0 ? (
                        <div className="tr-compare-verses">
                          {payload.translationComparison.krVerses.map((kv) => (
                            <p
                              key={kv.verse}
                              className={`tr-compare-text ${kv.isOmitted ? 'tr-compare-omitted' : ''}`}
                            >
                              <span className="preview-verse-num">{kv.verse}</span> {kv.text}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="study-empty-desc">개역개정 보유 데이터에 수록된 본문이 없습니다.</p>
                      )}
                    </div>

                    <div className="comm-card tr-compare-card">
                      <div className="comm-ref-row">
                        <div>
                          <span className="tr-compare-badge tr-compare-badge-en">NIV</span>
                          <strong className="tr-compare-ref">
                            {payload.translationComparison.enLabel}
                          </strong>
                        </div>
                        {translation !== 'en' ? (
                          <button
                            type="button"
                            className="inline-preview-btn"
                            onClick={() => {
                              onSwitchTranslation('en');
                              onClose();
                            }}
                          >
                            NIV로 읽기
                          </button>
                        ) : null}
                      </div>
                      {payload.translationComparison.enVerses.length > 0 ? (
                        <div className="tr-compare-verses">
                          {payload.translationComparison.enVerses.map((ev) => (
                            <p key={ev.verse} className="tr-compare-text">
                              <span className="preview-verse-num">{ev.verse}</span> {ev.text}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="study-empty-desc">NIV 보유 데이터에 수록된 본문이 없습니다.</p>
                      )}
                    </div>
                  </div>

                  {payload.translationComparison.notes.length > 0 ? (
                    <div className="comm-card">
                      <div className="comm-sub-heading study-expr-heading">번역 표현 비교 해설</div>
                      <div className="study-expr-list">
                        {payload.translationComparison.notes.map((tn, idx) => (
                          <div key={idx} className="study-expr-item">
                            <div className="tr-phrase-pair">
                              <span className="tr-phrase-ko">{tn.krPhrase}</span>
                              <span className="tr-phrase-arrow" aria-hidden="true">
                                ↔
                              </span>
                              <span className="tr-phrase-en">{tn.enPhrase}</span>
                            </div>
                            <p className="comm-body-text">{tn.explanation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
