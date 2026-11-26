import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  buildProportionalAxisTicks,
  CATEGORY_META,
  DATE_PRECISION_LABELS_KO,
  getProportionalStartX,
  getRecommendedZoomIndexForEra,
  getTotalCanvasWidth,
  historicalSpanYears,
  packTimelineTracks,
  PERIOD_KIND_LABELS_KO,
  RECORD_TYPE_LABELS_KO,
  relativeOrderToSegment,
  resolveContemporaryItems,
  TIMELINE_ZOOM_PRESETS,
  yearToX,
} from '../../services/historyDataService';
import type { ScriptureRef, TranslationId } from '../../types/bible';
import type {
  BibleHistoryDataset,
  ChapterHistoryMapping,
  HistoryEraId,
  HistoryPassageLink,
  TimelineCategoryFilter,
  TimelineEra,
  TimelineItem,
  TimelineSelection,
  TimelineViewState,
} from '../../types/history';
import { canonicalIdToScriptureRef } from '../../utils/verseId';

interface HistoryTimelineProps {
  dataset: BibleHistoryDataset;
  translation: TranslationId;
  variant?: 'page' | 'embedded';
  anchorMapping?: ChapterHistoryMapping | null;
  initialViewState?: TimelineViewState | null;
  onViewStateChange?: (state: TimelineViewState) => void;
  onSelectPassage: (ref: ScriptureRef, currentState: TimelineViewState) => void;
  onOpenFullTimeline?: () => void;
}

const SUB_LANE_HEIGHT_PX = 36;
const TRACK_PAD_Y_PX = 8;

export function HistoryTimeline({
  dataset,
  translation,
  variant = 'page',
  anchorMapping = null,
  initialViewState = null,
  onViewStateChange,
  onSelectPassage,
  onOpenFullTimeline,
}: HistoryTimelineProps) {
  const erasById = useMemo(
    () => new Map<HistoryEraId, TimelineEra>(dataset.eras.map((e) => [e.id, e])),
    [dataset.eras],
  );
  const itemsById = useMemo(
    () => new Map<string, TimelineItem>(dataset.items.map((i) => [i.id, i])),
    [dataset.items],
  );

  // 초기 확대 수준 및 초기 선택 결정
  const defaultZoomIndex = useMemo(() => {
    if (initialViewState) return initialViewState.zoomIndex;
    if (anchorMapping) {
      const anchorEra = erasById.get(anchorMapping.eraId);
      return anchorEra ? getRecommendedZoomIndexForEra(anchorEra) : 2;
    }
    return 2;
  }, [initialViewState, anchorMapping, erasById]);

  const defaultSelection = useMemo<TimelineSelection | null>(() => {
    if (initialViewState?.selection) return initialViewState.selection;
    if (anchorMapping) {
      const firstPrimary = anchorMapping.primaryItemIds[0];
      if (firstPrimary && itemsById.has(firstPrimary)) {
        return { kind: 'item', id: firstPrimary };
      }
      return { kind: 'era', id: anchorMapping.eraId };
    }
    // 기본 진입 시 분열왕국 아모스 또는 첫 시대 안내 대신 현재 시대가 선택되도록 설정
    return { kind: 'era', id: 'divided_kingdom' };
  }, [initialViewState, anchorMapping, itemsById]);

  const [zoomIndex, setZoomIndex] = useState<number>(defaultZoomIndex);
  const [categoryFilter, setCategoryFilter] = useState<TimelineCategoryFilter>(
    initialViewState?.categoryFilter ?? 'ALL',
  );
  const [activeEraId, setActiveEraId] = useState<HistoryEraId | null>(
    initialViewState?.activeEraId ?? anchorMapping?.eraId ?? 'divided_kingdom',
  );
  const [selection, setSelection] = useState<TimelineSelection | null>(defaultSelection);

  const viewportRef = useRef<HTMLDivElement>(null);
  const pendingScrollLeftRef = useRef<number | null>(
    initialViewState ? initialViewState.scrollLeft : null,
  );
  const pendingScrollTopRef = useRef<number | null>(
    initialViewState ? initialViewState.scrollTop : null,
  );
  const didInitialAutoScrollRef = useRef<boolean>(false);

  // PC 마우스 드래그 패닝 상태
  const dragStateRef = useRef<{
    active: boolean;
    moved: boolean;
    startClientX: number;
    startClientY: number;
    startScrollLeft: number;
    startScrollTop: number;
  }>({
    active: false,
    moved: false,
    startClientX: 0,
    startClientY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
  });

  const zoom = TIMELINE_ZOOM_PRESETS[zoomIndex] ?? TIMELINE_ZOOM_PRESETS[2];
  const canvasWidth = useMemo(() => getTotalCanvasWidth(zoom), [zoom]);
  const propStartX = useMemo(() => getProportionalStartX(zoom), [zoom]);
  const axisTicks = useMemo(() => buildProportionalAxisTicks(zoom), [zoom]);

  const packedTracks = useMemo(
    () => packTimelineTracks(dataset.items, zoom, categoryFilter),
    [dataset.items, zoom, categoryFilter],
  );

  const getLeftColWidth = useCallback((): number => {
    if (typeof window !== 'undefined' && window.innerWidth <= 480) {
      return 86;
    }
    return 118;
  }, []);

  const buildCurrentState = useCallback((): TimelineViewState => {
    const vp = viewportRef.current;
    return {
      scrollLeft: vp ? vp.scrollLeft : 0,
      scrollTop: vp ? vp.scrollTop : 0,
      zoomIndex,
      categoryFilter,
      activeEraId,
      selection,
    };
  }, [zoomIndex, categoryFilter, activeEraId, selection]);

  // 상태 변경 시 부모에 최신 연대표 상태 동기화
  useEffect(() => {
    onViewStateChange?.(buildCurrentState());
  }, [buildCurrentState, onViewStateChange]);

  const computeCenterScrollForX = useCallback(
    (targetCenterX: number): number => {
      const vp = viewportRef.current;
      const clientW = vp?.clientWidth || 640;
      const leftColW = getLeftColWidth();
      const usableW = Math.max(180, clientW - leftColW);
      return Math.max(0, Math.round(targetCenterX - usableW / 2));
    },
    [getLeftColWidth],
  );

  const getAnchorGeometry = useCallback(
    (targetZoom = zoom): { x: number; width: number; centerX: number; label: string } | null => {
      if (!anchorMapping) return null;
      if (
        anchorMapping.datePrecision === 'undetermined' ||
        anchorMapping.focusStartYear === null ||
        anchorMapping.focusEndYear === null
      ) {
        const seg = relativeOrderToSegment(
          anchorMapping.focusRelativeOrder ?? 1,
          1,
          targetZoom,
        );
        return {
          x: seg.x,
          width: Math.max(36, seg.width),
          centerX: seg.x + seg.width / 2,
          label: anchorMapping.displayPeriodKo,
        };
      }
      const x = yearToX(anchorMapping.focusStartYear, targetZoom);
      const span = historicalSpanYears(anchorMapping.focusStartYear, anchorMapping.focusEndYear);
      const width = Math.max(20, span * targetZoom.pxPerYear);
      return {
        x,
        width,
        centerX: x + width / 2,
        label: anchorMapping.displayPeriodKo,
      };
    },
    [anchorMapping, zoom],
  );

  const anchorGeometry = useMemo(() => getAnchorGeometry(zoom), [getAnchorGeometry, zoom]);

  // 초기 마운트 또는 본문 장 전환 시 목표 시점/저장된 스크롤 좌표 복원
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    if (pendingScrollLeftRef.current !== null) {
      vp.scrollLeft = pendingScrollLeftRef.current;
      if (pendingScrollTopRef.current !== null) {
        vp.scrollTop = pendingScrollTopRef.current;
      }
      pendingScrollLeftRef.current = null;
      pendingScrollTopRef.current = null;
      didInitialAutoScrollRef.current = true;
      return;
    }

    if (!didInitialAutoScrollRef.current) {
      didInitialAutoScrollRef.current = true;
      if (anchorGeometry) {
        vp.scrollLeft = computeCenterScrollForX(anchorGeometry.centerX);
        return;
      }
      // 기본 진입 시 분열왕국 시대(약 BC 800년 부근)로 초기 위치 정렬
      vp.scrollLeft = computeCenterScrollForX(yearToX(-800, zoom));
    }
  }, [anchorGeometry, computeCenterScrollForX, zoom]);

  // 본문 화면(embedded)에서 장이 바뀌어 anchorMapping이 달라지면 새 시점으로 자동 스크롤 및 강조 갱신
  const prevAnchorIdRef = useRef<string | null>(anchorMapping?.id ?? null);
  useEffect(() => {
    if (!anchorMapping || anchorMapping.id === prevAnchorIdRef.current) {
      prevAnchorIdRef.current = anchorMapping?.id ?? null;
      return;
    }
    prevAnchorIdRef.current = anchorMapping.id;
    const anchorEra = erasById.get(anchorMapping.eraId);
    const nextZoomIdx = anchorEra ? getRecommendedZoomIndexForEra(anchorEra) : 2;
    const nextZoom = TIMELINE_ZOOM_PRESETS[nextZoomIdx] ?? TIMELINE_ZOOM_PRESETS[2];
    setZoomIndex(nextZoomIdx);
    setActiveEraId(anchorMapping.eraId);
    const firstPrimary = anchorMapping.primaryItemIds[0];
    if (firstPrimary && itemsById.has(firstPrimary)) {
      setSelection({ kind: 'item', id: firstPrimary });
    } else {
      setSelection({ kind: 'era', id: anchorMapping.eraId });
    }
    const geom = getAnchorGeometry(nextZoom);
    if (geom) {
      pendingScrollLeftRef.current = computeCenterScrollForX(geom.centerX);
    }
  }, [anchorMapping, computeCenterScrollForX, erasById, getAnchorGeometry, itemsById]);

  const handleChangeZoom = (nextIdx: number) => {
    const clamped = Math.max(0, Math.min(TIMELINE_ZOOM_PRESETS.length - 1, nextIdx));
    if (clamped === zoomIndex) return;

    const vp = viewportRef.current;
    const nextZoom = TIMELINE_ZOOM_PRESETS[clamped];
    if (vp) {
      const leftColW = getLeftColWidth();
      const usableW = Math.max(180, (vp.clientWidth || 640) - leftColW);
      const currentCenterX = vp.scrollLeft + usableW / 2;
      if (currentCenterX <= propStartX) {
        pendingScrollLeftRef.current = 0;
      } else {
        const ratio = (currentCenterX - propStartX) / zoom.pxPerYear;
        const nextCenterX = getProportionalStartX(nextZoom) + ratio * nextZoom.pxPerYear;
        pendingScrollLeftRef.current = Math.max(0, Math.round(nextCenterX - usableW / 2));
      }
    }
    setZoomIndex(clamped);
  };

  const scrollToItem = useCallback(
    (item: TimelineItem, targetZoomIdx?: number) => {
      const effectiveIdx = targetZoomIdx ?? zoomIndex;
      const effectiveZoom = TIMELINE_ZOOM_PRESETS[effectiveIdx] ?? zoom;
      let centerX = 0;
      if (item.datePrecision === 'undetermined' || item.startYear === null || item.endYear === null) {
        const seg = relativeOrderToSegment(item.relativeOrder ?? 1, item.relativeSpan ?? 1, effectiveZoom);
        centerX = seg.x + seg.width / 2;
      } else {
        const startX = yearToX(item.startYear, effectiveZoom);
        const w = historicalSpanYears(item.startYear, item.endYear) * effectiveZoom.pxPerYear;
        centerX = startX + w / 2;
      }
      const nextScroll = computeCenterScrollForX(centerX);
      if (effectiveIdx !== zoomIndex) {
        pendingScrollLeftRef.current = nextScroll;
        setZoomIndex(effectiveIdx);
      } else if (viewportRef.current) {
        viewportRef.current.scrollLeft = nextScroll;
      }
    },
    [computeCenterScrollForX, zoom, zoomIndex],
  );

  const handleJumpToEra = (era: TimelineEra) => {
    setActiveEraId(era.id);
    setSelection({ kind: 'era', id: era.id });

    const recommendedIdx = getRecommendedZoomIndexForEra(era);
    const nextIdx = zoomIndex < recommendedIdx ? recommendedIdx : zoomIndex;
    const targetZoom = TIMELINE_ZOOM_PRESETS[nextIdx] ?? zoom;

    let centerX = targetZoom.primevalWidthPx / 2;
    if (era.datePrecision !== 'undetermined' && era.startYear !== null && era.endYear !== null) {
      const sx = yearToX(era.startYear, targetZoom);
      const ex = yearToX(era.endYear, targetZoom);
      centerX = (sx + ex) / 2;
    }

    const nextScroll = computeCenterScrollForX(centerX);
    if (nextIdx !== zoomIndex) {
      pendingScrollLeftRef.current = nextScroll;
      setZoomIndex(nextIdx);
    } else if (viewportRef.current) {
      viewportRef.current.scrollLeft = nextScroll;
    }
  };

  const handleReturnToCurrentPosition = () => {
    if (anchorMapping) {
      const era = erasById.get(anchorMapping.eraId);
      const targetIdx = era ? Math.max(zoomIndex, getRecommendedZoomIndexForEra(era)) : zoomIndex;
      const targetZoom = TIMELINE_ZOOM_PRESETS[targetIdx] ?? zoom;
      const geom = getAnchorGeometry(targetZoom);
      setActiveEraId(anchorMapping.eraId);
      const firstPrimary = anchorMapping.primaryItemIds[0];
      if (firstPrimary && itemsById.has(firstPrimary)) {
        setSelection({ kind: 'item', id: firstPrimary });
      }
      if (geom) {
        const nextScroll = computeCenterScrollForX(geom.centerX);
        if (targetIdx !== zoomIndex) {
          pendingScrollLeftRef.current = nextScroll;
          setZoomIndex(targetIdx);
        } else if (viewportRef.current) {
          viewportRef.current.scrollLeft = nextScroll;
        }
      }
      return;
    }

    if (selection?.kind === 'item') {
      const it = itemsById.get(selection.id);
      if (it) {
        scrollToItem(it);
        return;
      }
    }
    if (selection?.kind === 'era') {
      const er = erasById.get(selection.id);
      if (er) {
        handleJumpToEra(er);
      }
    }
  };

  const handleStepPan = (dir: -1 | 1) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const step = Math.max(220, Math.round((vp.clientWidth || 560) * 0.65));
    vp.scrollLeft = Math.max(0, vp.scrollLeft + dir * step);
    onViewStateChange?.(buildCurrentState());
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return; // 모바일 터치는 브라우저 기본 관성 스와이프 사용
    if ((e.target as HTMLElement).closest('button')) return;
    const vp = viewportRef.current;
    if (!vp) return;
    dragStateRef.current = {
      active: true,
      moved: false,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startScrollLeft: vp.scrollLeft,
      startScrollTop: vp.scrollTop,
    };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st.active) return;
    const vp = viewportRef.current;
    if (!vp) return;
    const dx = e.clientX - st.startClientX;
    const dy = e.clientY - st.startClientY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      st.moved = true;
    }
    if (st.moved) {
      vp.scrollLeft = Math.max(0, st.startScrollLeft - dx);
      vp.scrollTop = Math.max(0, st.startScrollTop - dy);
    }
  };

  const handlePointerUp = () => {
    if (dragStateRef.current.active) {
      dragStateRef.current.active = false;
      onViewStateChange?.(buildCurrentState());
    }
  };

  const handleSelectItem = (item: TimelineItem, shouldScroll = false) => {
    setSelection({ kind: 'item', id: item.id });
    if (item.eraIds[0]) {
      setActiveEraId(item.eraIds[0]);
    }
    if (categoryFilter !== 'ALL' && categoryFilter !== item.category) {
      setCategoryFilter('ALL');
    }
    if (shouldScroll) {
      const itemEra = item.eraIds[0] ? erasById.get(item.eraIds[0]) : undefined;
      const recIdx = itemEra ? Math.max(zoomIndex, getRecommendedZoomIndexForEra(itemEra)) : zoomIndex;
      scrollToItem(item, recIdx);
    }
  };

  const handlePassageClick = (link: HistoryPassageLink) => {
    const ref = canonicalIdToScriptureRef(link.verseId, translation, link.roleKo);
    if (!ref) return;
    onSelectPassage(ref, buildCurrentState());
  };

  const primaryHighlightIds = useMemo(
    () => new Set<string>(anchorMapping?.primaryItemIds ?? []),
    [anchorMapping],
  );
  const relatedHighlightIds = useMemo(
    () => new Set<string>(anchorMapping?.relatedItemIds ?? []),
    [anchorMapping],
  );

  const selectedItem = selection?.kind === 'item' ? itemsById.get(selection.id) ?? null : null;
  const selectedEra =
    selection?.kind === 'era'
      ? erasById.get(selection.id) ?? null
      : selectedItem?.eraIds[0]
        ? erasById.get(selectedItem.eraIds[0]) ?? null
        : null;

  const contemporaries = useMemo(() => {
    if (!selectedItem) return [];
    return resolveContemporaryItems(dataset, selectedItem, 8);
  }, [dataset, selectedItem]);

  const relatedEventsForSelected = useMemo(() => {
    if (!selectedItem) return [];
    const out: TimelineItem[] = [];
    for (const rid of selectedItem.relatedItemIds ?? []) {
      const found = itemsById.get(rid);
      if (found && found.category === 'event') {
        out.push(found);
      }
    }
    return out;
  }, [itemsById, selectedItem]);

  // 본문 배경 모드에서 바로 볼 수 있는 동시대 인물·관련 사건 목록
  const anchorContextPeopleAndEvents = useMemo(() => {
    if (!anchorMapping) return { people: [] as TimelineItem[], events: [] as TimelineItem[] };
    const allIds = [
      ...anchorMapping.primaryItemIds,
      ...(anchorMapping.relatedItemIds ?? []),
    ];
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
  }, [anchorMapping, itemsById]);

  const eraItemsPreview = useMemo(() => {
    if (selection?.kind !== 'era' || !selectedEra) return [];
    return dataset.items.filter((it) => it.eraIds.includes(selectedEra.id)).slice(0, 10);
  }, [dataset.items, selectedEra, selection]);

  return (
    <section
      className={`history-timeline-root ${
        variant === 'embedded' ? 'history-timeline-embedded' : 'history-timeline-page'
      }`}
      aria-label="통합 성경 역사 연대표"
    >
      {/* 1. 12시대 빠른 이동 개요 바 (비례하지 않음을 명시) */}
      <div className="timeline-era-jump-box">
        <div className="timeline-era-pills" role="navigation" aria-label="시대 빠른 이동">
          {dataset.eras.map((era) => {
            const isEraActive =
              (selection?.kind === 'era' && selection.id === era.id) ||
              (selection?.kind !== 'era' && activeEraId === era.id);
            return (
              <button
                key={era.id}
                type="button"
                className={`timeline-era-pill ${isEraActive ? 'timeline-era-pill-active' : ''}`}
                style={
                  isEraActive
                    ? { backgroundColor: era.color, borderColor: era.color, color: '#ffffff' }
                    : undefined
                }
                aria-pressed={isEraActive}
                onClick={() => handleJumpToEra(era)}
              >
                {era.shortNameKo}
              </button>
            );
          })}
        </div>
        <p className="timeline-scale-notice">
          상단 시대 빠른 이동 바는 탐색 편의를 위한 요약 배치이며, 아래 상세 시간축은 실제 연도 간격에 비례합니다(원역사는 상대적 순서 표시 · BC/AD 사이 0년 없음). {dataset.overviewNoticeKo}
        </p>
      </div>

      {/* 2. 확대·축소, 좌우 이동, 유형 필터, 현재 위치 복귀 컨트롤 바 */}
      <div className="timeline-controls-bar" role="toolbar" aria-label="연대표 탐색 도구">
        <div className="timeline-zoom-group">
          <button
            type="button"
            className="timeline-ctrl-btn"
            onClick={() => handleStepPan(-1)}
            aria-label="연대표 왼쪽으로 스크롤"
          >
            ←
          </button>
          <button
            type="button"
            className="timeline-ctrl-btn"
            disabled={zoomIndex <= 0}
            onClick={() => handleChangeZoom(zoomIndex - 1)}
            aria-label="연대표 축소"
          >
            축소 −
          </button>
          <span className="timeline-zoom-label" aria-live="polite">
            배율: {zoom.labelKo}
          </span>
          <button
            type="button"
            className="timeline-ctrl-btn"
            disabled={zoomIndex >= TIMELINE_ZOOM_PRESETS.length - 1}
            onClick={() => handleChangeZoom(zoomIndex + 1)}
            aria-label="연대표 확대"
          >
            확대 +
          </button>
          <button
            type="button"
            className="timeline-ctrl-btn"
            onClick={() => handleStepPan(1)}
            aria-label="연대표 오른쪽으로 스크롤"
          >
            →
          </button>
          <button
            type="button"
            className="timeline-ctrl-btn timeline-ctrl-locate"
            onClick={handleReturnToCurrentPosition}
          >
            {anchorMapping ? '현재 본문 시점' : '현재 위치 복귀'}
          </button>
        </div>

        <div className="timeline-filter-group" role="group" aria-label="연대표 유형 필터">
          <button
            type="button"
            className={`timeline-filter-chip ${
              categoryFilter === 'ALL' ? 'timeline-filter-chip-active' : ''
            }`}
            aria-pressed={categoryFilter === 'ALL'}
            onClick={() => setCategoryFilter('ALL')}
          >
            전체 유형
          </button>
          {CATEGORY_META.map((cat) => (
            <button
              key={cat.key}
              type="button"
              className={`timeline-filter-chip ${
                categoryFilter === cat.key ? 'timeline-filter-chip-active' : ''
              }`}
              aria-pressed={categoryFilter === cat.key}
              onClick={() => setCategoryFilter(cat.key)}
            >
              {cat.shortLabelKo}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 상단 시간축 고정 + 좌측 행 이름 고정 + 비겹침 인터랙티브 타임라인 뷰포트 */}
      <div
        ref={viewportRef}
        className="timeline-viewport"
        onScroll={() => onViewStateChange?.(buildCurrentState())}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="region"
        aria-label="좌우 스크롤 가능한 통합 역사 시간축"
      >
        <div className="timeline-grid-table" style={{ minWidth: `calc(var(--tl-label-col-w) + ${canvasWidth}px)` }}>
          {/* 상단 고정 시대 띠 & 비례 연도 눈금자 */}
          <div className="timeline-sticky-header">
            <div className="timeline-corner-cell">구분 · 시간축</div>
            <div className="timeline-ruler-cell" style={{ width: `${canvasWidth}px` }}>
              <svg
                className="timeline-ruler-svg"
                width={canvasWidth}
                height={58}
                viewBox={`0 0 ${canvasWidth} 58`}
                aria-hidden="true"
              >
                {/* 원역사(연대 미확정 상대 순서 구간) 배경 */}
                <rect
                  x={4}
                  y={4}
                  width={zoom.primevalWidthPx - 8}
                  height={22}
                  rx={6}
                  fill="#6c757d"
                  opacity={0.9}
                />
                <text
                  x={zoom.primevalWidthPx / 2}
                  y={19}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="11.5"
                  fontWeight="700"
                >
                  원역사 (연대 미확정 · 서사 순서)
                </text>
                <text
                  x={zoom.primevalWidthPx / 2}
                  y={44}
                  textAnchor="middle"
                  fill="#5c5449"
                  fontSize="11"
                  fontWeight="700"
                >
                  순서 1 → 4 (연도 비부여)
                </text>

                {/* 원역사 / 비례 연도축 구분 물결 파선 */}
                <line
                  x1={zoom.primevalWidthPx + 12}
                  y1={4}
                  x2={zoom.primevalWidthPx + 12}
                  y2={56}
                  stroke="#9a4d24"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />

                {/* 비례 시간축 시대 띠 */}
                {dataset.eras
                  .filter((e) => e.datePrecision !== 'undetermined' && e.startYear !== null && e.endYear !== null)
                  .map((era) => {
                    const ex = yearToX(era.startYear!, zoom);
                    const ew = Math.max(
                      18,
                      historicalSpanYears(era.startYear!, era.endYear!) * zoom.pxPerYear,
                    );
                    return (
                      <g key={era.id}>
                        <rect
                          x={ex}
                          y={4}
                          width={ew}
                          height={22}
                          rx={5}
                          fill={era.color}
                          opacity={activeEraId === era.id ? 0.96 : 0.76}
                        />
                        {ew >= 54 ? (
                          <text
                            x={ex + ew / 2}
                            y={19}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="11"
                            fontWeight="700"
                          >
                            {era.shortNameKo}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}

                {/* 비례 연도 눈금선 및 연도 라벨 (BC/AD 사이 0년 없음) */}
                <line
                  x1={propStartX}
                  y1={54}
                  x2={canvasWidth - 20}
                  y2={54}
                  stroke="#cfc5b4"
                  strokeWidth={1}
                />
                {axisTicks.map((tick) => (
                  <g key={tick.year}>
                    <line
                      x1={tick.x}
                      y1={30}
                      x2={tick.x}
                      y2={56}
                      stroke={tick.isBoundary ? '#9a4d24' : '#bfb4a2'}
                      strokeWidth={tick.isBoundary ? 1.8 : 1}
                    />
                    <text
                      x={tick.x}
                      y={44}
                      textAnchor="middle"
                      fill={tick.isBoundary ? '#9a4d24' : '#4a4339'}
                      fontSize="11"
                      fontWeight={tick.isBoundary ? '800' : '700'}
                    >
                      {tick.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          {/* 행(Track) 목록 */}
          {packedTracks.map((track) => {
            const laneHeight = track.subLaneCount * SUB_LANE_HEIGHT_PX + TRACK_PAD_Y_PX * 2;
            return (
              <div key={track.category} className="timeline-track-row">
                <div className="timeline-track-label-cell">
                  <span className="timeline-track-name">{track.labelKo}</span>
                  <span className="timeline-track-count">{track.items.length}개</span>
                </div>

                <div
                  className="timeline-track-canvas"
                  style={{ width: `${canvasWidth}px`, height: `${laneHeight}px` }}
                >
                  {/* 수직 배경 눈금선 및 현재 본문 시점 하이라이트 띠 */}
                  <svg
                    className="timeline-track-bg-svg"
                    width={canvasWidth}
                    height={laneHeight}
                    viewBox={`0 0 ${canvasWidth} ${laneHeight}`}
                    aria-hidden="true"
                  >
                    <rect
                      x={0}
                      y={0}
                      width={zoom.primevalWidthPx}
                      height={laneHeight}
                      fill="rgba(108, 117, 125, 0.05)"
                    />
                    <line
                      x1={zoom.primevalWidthPx + 12}
                      y1={0}
                      x2={zoom.primevalWidthPx + 12}
                      y2={laneHeight}
                      stroke="#9a4d24"
                      strokeWidth={1.2}
                      strokeDasharray="4 3"
                      opacity={0.55}
                    />
                    {axisTicks.map((tick) => (
                      <line
                        key={tick.year}
                        x1={tick.x}
                        y1={0}
                        x2={tick.x}
                        y2={laneHeight}
                        stroke={tick.isBoundary ? 'rgba(154, 77, 36, 0.35)' : 'rgba(191, 180, 162, 0.36)'}
                        strokeWidth={tick.isBoundary ? 1.5 : 1}
                      />
                    ))}
                    {anchorGeometry ? (
                      <g>
                        <rect
                          x={anchorGeometry.x}
                          y={0}
                          width={anchorGeometry.width}
                          height={laneHeight}
                          fill="rgba(217, 119, 6, 0.13)"
                        />
                        <line
                          x1={anchorGeometry.centerX}
                          y1={0}
                          x2={anchorGeometry.centerX}
                          y2={laneHeight}
                          stroke="#d97706"
                          strokeWidth={1.8}
                        />
                      </g>
                    ) : null}
                  </svg>

                  {/* 비겹침 인물·왕국·사건 막대/마커 버튼 */}
                  {track.items.map((packed) => {
                    const { item } = packed;
                    const isSelected = selection?.kind === 'item' && selection.id === item.id;
                    const isPrimaryContext = primaryHighlightIds.has(item.id);
                    const isRelatedContext = relatedHighlightIds.has(item.id);
                    const baseColor = item.accentColor ?? track.defaultColor;
                    const topPx = TRACK_PAD_Y_PX + packed.subLane * SUB_LANE_HEIGHT_PX;
                    const isEvent = item.category === 'event';
                    const isUncertain =
                      item.datePrecision === 'estimated' || item.datePrecision === 'range';
                    const isExternal = item.recordType === 'external_history';

                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-item-id={item.id}
                        data-sub-lane={packed.subLane}
                        data-bar-x={Math.round(packed.barX)}
                        data-footprint-end={Math.round(packed.footprintEndX)}
                        className={`timeline-item-hit ${
                          isSelected ? 'timeline-item-hit-selected' : ''
                        } ${isPrimaryContext ? 'timeline-item-hit-primary' : ''} ${
                          isRelatedContext && !isPrimaryContext ? 'timeline-item-hit-related' : ''
                        }`}
                        style={{
                          left: `${packed.barX}px`,
                          top: `${topPx}px`,
                          width: `${packed.visualWidth}px`,
                        }}
                        aria-pressed={isSelected}
                        aria-label={`${item.nameKo}, ${item.roleLabelKo}, ${PERIOD_KIND_LABELS_KO[item.periodKind]} ${item.displayPeriodKo}`}
                        onClick={() => handleSelectItem(item, false)}
                      >
                        <span
                          className={`timeline-bar-shape ${
                            isEvent ? 'timeline-bar-event' : ''
                          } ${isUncertain ? 'timeline-bar-uncertain' : ''} ${
                            isExternal ? 'timeline-bar-external' : ''
                          }`}
                          style={{
                            width: `${packed.barWidth}px`,
                            backgroundColor: isSelected
                              ? '#c2590a'
                              : isPrimaryContext
                                ? '#b45309'
                                : baseColor,
                          }}
                        >
                          {isEvent && packed.barWidth < 26 ? (
                            <span className="timeline-event-diamond" aria-hidden="true">
                              ◆
                            </span>
                          ) : null}
                          {packed.labelInside ? (
                            <span className="timeline-bar-label-inside">
                              {isEvent ? `◆ ${packed.displayLabel}` : packed.displayLabel}
                            </span>
                          ) : null}
                        </span>

                        {!packed.labelInside ? (
                          <span className="timeline-bar-label-outside">
                            {packed.displayLabel}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 본문 내장 모드일 때: 현재 장의 동시대 인물·사건 요약 칩 및 전체 연대표 이동 버튼 */}
      {variant === 'embedded' && anchorMapping ? (
        <div className="timeline-embedded-context-strip">
          <div className="timeline-embedded-meta-row">
            <span className="comm-tag comm-tag-fact">
              {PERIOD_KIND_LABELS_KO[anchorMapping.periodKind]} · {anchorMapping.displayPeriodKo}
            </span>
            <span className="comm-tag comm-tag-neutral">
              {DATE_PRECISION_LABELS_KO[anchorMapping.datePrecision]}
            </span>
          </div>
          <p className="timeline-embedded-summary">{anchorMapping.contextSummaryKo}</p>
          {anchorMapping.writtenVsEventNoteKo ? (
            <p className="timeline-embedded-note">{anchorMapping.writtenVsEventNoteKo}</p>
          ) : null}
          {anchorMapping.divergentViewsKo ? (
            <p className="timeline-embedded-note timeline-embedded-views">
              <strong>연대 견해 안내:</strong> {anchorMapping.divergentViewsKo}
            </p>
          ) : null}

          {anchorContextPeopleAndEvents.people.length > 0 ? (
            <div className="timeline-chip-line">
              <span className="timeline-chip-line-title">동시대 인물:</span>
              {anchorContextPeopleAndEvents.people.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`evidence-chip-btn ${
                    selectedItem?.id === p.id ? 'timeline-chip-selected' : ''
                  }`}
                  onClick={() => handleSelectItem(p, true)}
                >
                  {p.nameKo}
                </button>
              ))}
            </div>
          ) : null}

          {anchorContextPeopleAndEvents.events.length > 0 ? (
            <div className="timeline-chip-line">
              <span className="timeline-chip-line-title">관련 사건:</span>
              {anchorContextPeopleAndEvents.events.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  className={`evidence-chip-btn ${
                    selectedItem?.id === ev.id ? 'timeline-chip-selected' : ''
                  }`}
                  onClick={() => handleSelectItem(ev, true)}
                >
                  {ev.nameKo}
                </button>
              ))}
            </div>
          ) : null}

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
      ) : null}

      {/* 4. 선택된 인물 · 사건 · 시대 상세 정보 및 관련 말씀 이동 패널 */}
      {selectedItem ? (
        <article className="timeline-detail-card" aria-live="polite">
          <div className="timeline-detail-head">
            <div>
              <div className="timeline-detail-badges">
                <span className="comm-tag comm-tag-fact">
                  {PERIOD_KIND_LABELS_KO[selectedItem.periodKind]}: {selectedItem.displayPeriodKo}
                </span>
                <span className="comm-tag comm-tag-neutral">
                  {DATE_PRECISION_LABELS_KO[selectedItem.datePrecision]}
                </span>
                <span
                  className={`comm-tag ${
                    selectedItem.recordType === 'external_history'
                      ? 'comm-tag-views'
                      : 'comm-tag-interp'
                  }`}
                >
                  {RECORD_TYPE_LABELS_KO[selectedItem.recordType]}
                </span>
              </div>
              <h3 className="timeline-detail-title">{selectedItem.nameKo}</h3>
              <p className="timeline-detail-role">
                {selectedItem.roleLabelKo}
                {selectedEra ? ` · ${selectedEra.nameKo}` : ''}
              </p>
            </div>
          </div>

          {selectedItem.secondaryPeriods && selectedItem.secondaryPeriods.length > 0 ? (
            <div className="timeline-secondary-periods">
              {selectedItem.secondaryPeriods.map((sp, idx) => (
                <div key={idx} className="timeline-sec-period-item">
                  <strong>{PERIOD_KIND_LABELS_KO[sp.periodKind]}:</strong> {sp.displayKo}
                </div>
              ))}
            </div>
          ) : null}

          <p className="comm-body-text">{selectedItem.summaryKo}</p>

          {selectedItem.divergentViewsKo ? (
            <div className="comm-card comm-card-views timeline-sub-alert">
              <span className="comm-tag comm-tag-views">연대·학설 견해 안내</span>
              <p className="comm-body-text">{selectedItem.divergentViewsKo}</p>
            </div>
          ) : null}

          {selectedItem.externalHistoryNoteKo ? (
            <div className="comm-card comm-card-views timeline-sub-alert">
              <span className="comm-tag comm-tag-views">신구약 중간기 · 외부 역사 구분</span>
              <p className="comm-body-text">{selectedItem.externalHistoryNoteKo}</p>
            </div>
          ) : null}

          {contemporaries.length > 0 ? (
            <div className="timeline-related-block">
              <h4 className="timeline-sub-title">동시대 인물</h4>
              <div className="timeline-chip-wrap">
                {contemporaries.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    className="evidence-chip-btn"
                    onClick={() => handleSelectItem(person, true)}
                  >
                    {person.nameKo}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {relatedEventsForSelected.length > 0 ? (
            <div className="timeline-related-block">
              <h4 className="timeline-sub-title">연결된 사건 · 배경</h4>
              <div className="timeline-chip-wrap">
                {relatedEventsForSelected.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    className="evidence-chip-btn"
                    onClick={() => handleSelectItem(ev, true)}
                  >
                    ◆ {ev.nameKo}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="timeline-passages-block">
            <h4 className="timeline-sub-title">{selectedItem.nameKo} · 관련 말씀</h4>
            {selectedItem.passages.length === 0 ? (
              <p className="timeline-no-passage-msg">
                정경 66권 본문에 직접 기록되지 않은 외부 역사 항목이므로 임의의 성경 장절을 연결하지 않습니다.
              </p>
            ) : (
              <div className="timeline-passage-list">
                {selectedItem.passages.map((p) => (
                  <button
                    key={p.verseId}
                    type="button"
                    className="timeline-passage-card"
                    onClick={() => handlePassageClick(p)}
                  >
                    <div className="timeline-passage-main">
                      <strong className="timeline-passage-title">{p.titleKo}</strong>
                      <span className="timeline-passage-ref">
                        {translation === 'en' ? p.labelEn : p.labelKo}
                      </span>
                      <span className="timeline-passage-role">{p.roleKo}</span>
                    </div>
                    <span className="timeline-passage-go" aria-hidden="true">
                      본문 읽기 →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <footer className="comm-sources-box timeline-sources-footer">
            <strong>근거 및 참고 출처:</strong>{' '}
            {selectedItem.sourceIds
              .map((sid) => dataset.sources[sid]?.title ?? sid)
              .join(' · ')}
          </footer>
        </article>
      ) : selectedEra ? (
        <article className="timeline-detail-card" aria-live="polite">
          <div className="timeline-detail-badges">
            <span className="comm-tag comm-tag-fact">{selectedEra.displayPeriodKo}</span>
            <span className="comm-tag comm-tag-neutral">
              {DATE_PRECISION_LABELS_KO[selectedEra.datePrecision]}
            </span>
          </div>
          <h3 className="timeline-detail-title">{selectedEra.nameKo} 시대 개관</h3>
          <p className="comm-body-text">{selectedEra.summaryKo}</p>

          {selectedEra.divergentViewsKo ? (
            <div className="comm-card comm-card-views timeline-sub-alert">
              <span className="comm-tag comm-tag-views">시대 연대 견해 안내</span>
              <p className="comm-body-text">{selectedEra.divergentViewsKo}</p>
            </div>
          ) : null}

          {eraItemsPreview.length > 0 ? (
            <div className="timeline-related-block">
              <h4 className="timeline-sub-title">이 시대의 주요 인물 · 사건 선택</h4>
              <div className="timeline-chip-wrap">
                {eraItemsPreview.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    className="evidence-chip-btn"
                    onClick={() => handleSelectItem(it, true)}
                  >
                    {it.nameKo}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="timeline-passages-block">
            <h4 className="timeline-sub-title">{selectedEra.nameKo} · 주요 말씀</h4>
            {selectedEra.keyPassages.length === 0 ? (
              <p className="timeline-no-passage-msg">
                신구약 중간기는 구약 말라기 이후 세례 요한·예수님 탄생 이전의 외부 역사 시기로, 위 인물·사건 칩을 눌러 시대 배경을 살펴볼 수 있습니다.
              </p>
            ) : (
              <div className="timeline-passage-list">
                {selectedEra.keyPassages.map((kp) => (
                  <button
                    key={kp.verseId}
                    type="button"
                    className="timeline-passage-card"
                    onClick={() => handlePassageClick(kp)}
                  >
                    <div className="timeline-passage-main">
                      <strong className="timeline-passage-title">{kp.titleKo}</strong>
                      <span className="timeline-passage-ref">
                        {translation === 'en' ? kp.labelEn : kp.labelKo}
                      </span>
                      <span className="timeline-passage-role">{kp.roleKo}</span>
                    </div>
                    <span className="timeline-passage-go" aria-hidden="true">
                      본문 읽기 →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </article>
      ) : null}
    </section>
  );
}
