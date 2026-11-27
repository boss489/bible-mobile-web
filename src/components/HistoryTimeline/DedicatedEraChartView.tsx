import { type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import {
  DATE_PRECISION_LABELS_KO,
  PERIOD_KIND_LABELS_KO,
  type DedicatedEraChartLayout,
} from '../../services/historyDataService';
import type { TranslationId } from '../../types/bible';
import type {
  HistoryPassageLink,
  SpecialChronicle,
  SpecialChronicleEvent,
  TimelineItem,
  TimelineSelection,
} from '../../types/history';

interface DedicatedEraChartViewProps {
  mode: 'era' | 'special';
  eraLayout: DedicatedEraChartLayout | null;
  specialChronicle: SpecialChronicle | null;
  chroniclePositionLabel: string;
  onPrevChronicle: () => void;
  onNextChronicle: () => void;
  translation: TranslationId;
  selection: TimelineSelection | null;
  primaryHighlightIds: ReadonlySet<string>;
  relatedHighlightIds: ReadonlySet<string>;
  anchorXRange?: { x: number; width: number; centerX: number } | null;
  viewportRef: RefObject<HTMLDivElement | null>;
  onScrollViewport: () => void;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  onSelectItem: (item: TimelineItem) => void;
  onSelectSpecialEvent: (chronicle: SpecialChronicle, ev: SpecialChronicleEvent) => void;
  onSelectPassage: (link: HistoryPassageLink) => void;
}

const SUB_LANE_HEIGHT_PX = 38;
const TRACK_PAD_Y_PX = 9;

export function DedicatedEraChartView({
  mode,
  eraLayout,
  specialChronicle,
  chroniclePositionLabel,
  onPrevChronicle,
  onNextChronicle,
  translation,
  selection,
  primaryHighlightIds,
  relatedHighlightIds,
  anchorXRange,
  viewportRef,
  onScrollViewport,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onSelectItem,
  onSelectSpecialEvent,
  onSelectPassage,
}: DedicatedEraChartViewProps) {
  const headerTitle =
    mode === 'era' && eraLayout
      ? `${eraLayout.era.order}. ${eraLayout.era.nameKo}`
      : specialChronicle
        ? `특집 · ${specialChronicle.nameKo}`
        : '';
  const headerPeriod =
    mode === 'era' && eraLayout
      ? eraLayout.era.displayPeriodKo
      : specialChronicle?.displayPeriodKo ?? '';
  const headerColor =
    mode === 'era' && eraLayout
      ? eraLayout.era.color
      : specialChronicle?.color ?? '#2c4a3e';
  const hasScaleBreaks = Boolean(mode === 'era' && eraLayout && eraLayout.scaleBreaks.length > 0);

  return (
    <div className="dedicated-era-chart-wrap">
      {/* 상단 시리즈 카르투슈 헤더 (이전/다음 연대기 전환 + 표기 범례) */}
      <div
        className="era-chronicle-banner"
        style={{ borderLeftColor: headerColor }}
        aria-label="선택된 시대 연대기 헤더"
      >
        <div className="era-chronicle-nav-row">
          <button
            type="button"
            className="era-chronicle-step-btn"
            onClick={onPrevChronicle}
            aria-label="이전 시대 연대기"
          >
            ‹ 이전
          </button>

          <div className="era-chronicle-title-group">
            <span className="era-chronicle-counter">{chroniclePositionLabel}</span>
            <strong className="era-chronicle-title">{headerTitle}</strong>
            <span className="era-chronicle-period">{headerPeriod}</span>
          </div>

          <button
            type="button"
            className="era-chronicle-step-btn"
            onClick={onNextChronicle}
            aria-label="다음 시대 연대기"
          >
            다음 ›
          </button>
        </div>

        <div className="era-chronicle-legend" aria-label="차트 기호 범례">
          <span className="tl-legend-item">
            <i className="tl-legend-swatch tl-legend-solid" aria-hidden="true" />
            확정 연대
          </span>
          <span className="tl-legend-item">
            <i className="tl-legend-swatch tl-legend-dashed" aria-hidden="true" />
            추정 연대
          </span>
          <span className="tl-legend-item">
            <i className="tl-legend-whisker" aria-hidden="true" />
            가능 범위
          </span>
          <span className="tl-legend-item">
            <span className="tl-legend-diamond" aria-hidden="true">
              ◆
            </span>
            사건·서신
          </span>
          {hasScaleBreaks ? (
            <span className="tl-legend-item tl-legend-break">
              <strong aria-hidden="true">≈</strong> 공백 구간 축척 압축
            </span>
          ) : null}
        </div>
      </div>

      {/* 1) 일반 12시대 전용 차트 (시대 맞춤 좌측 고정 행 + 전용 가변 축척 눈금자) */}
      {mode === 'era' && eraLayout ? (
        <div
          ref={viewportRef}
          className="timeline-viewport"
          onScroll={onScrollViewport}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="region"
          aria-label={`${eraLayout.era.nameKo} 전용 역사 시간축`}
        >
          <div
            className="timeline-grid-table"
            style={{ width: `calc(var(--tl-label-col-w) + ${eraLayout.canvasWidth}px)` }}
          >
            <div className="timeline-sticky-header">
              <div className="timeline-corner-cell">맞춤 행 · 축</div>
              <div
                className="timeline-ruler-cell"
                style={{ width: `${eraLayout.canvasWidth}px` }}
              >
                <svg
                  className="timeline-ruler-svg"
                  width={eraLayout.canvasWidth}
                  height={54}
                  viewBox={`0 0 ${eraLayout.canvasWidth} 54`}
                  aria-hidden="true"
                >
                  <rect
                    x={12}
                    y={4}
                    width={Math.max(40, eraLayout.canvasWidth - 28)}
                    height={20}
                    rx={5}
                    fill={eraLayout.era.color}
                    opacity={0.92}
                  />
                  <text
                    x={24}
                    y={18}
                    fill="#ffffff"
                    fontSize="11"
                    fontWeight="700"
                  >
                    {`${eraLayout.era.nameKo} (${eraLayout.era.displayPeriodKo})`}
                  </text>

                  <line
                    x1={12}
                    y1={50}
                    x2={eraLayout.canvasWidth - 16}
                    y2={50}
                    stroke="#cfc5b4"
                    strokeWidth={1}
                  />

                  {eraLayout.ticks.map((tick) => (
                    <g key={`${tick.year}-${tick.label}`}>
                      <line
                        x1={tick.x}
                        y1={27}
                        x2={tick.x}
                        y2={52}
                        stroke={tick.isBoundary ? '#9a4d24' : '#bfb4a2'}
                        strokeWidth={tick.isBoundary ? 1.8 : 1}
                      />
                      <text
                        x={tick.x}
                        y={41}
                        textAnchor="middle"
                        fill={tick.isBoundary ? '#9a4d24' : '#4a4339'}
                        fontSize="10.8"
                        fontWeight={tick.isBoundary ? '800' : '700'}
                      >
                        {tick.label}
                      </text>
                    </g>
                  ))}

                  {/* 가변 축척 압축 구간(≈) 마커 */}
                  {eraLayout.scaleBreaks.map((brk, idx) => (
                    <g key={idx}>
                      <rect
                        x={brk.x - 13}
                        y={28}
                        width={26}
                        height={18}
                        rx={4}
                        fill="#fbf2e6"
                        stroke="#c2590a"
                        strokeWidth={1}
                      />
                      <text
                        x={brk.x}
                        y={41}
                        textAnchor="middle"
                        fill="#9a4d24"
                        fontSize="11.5"
                        fontWeight="800"
                      >
                        ≈
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {eraLayout.tracks.map((track) => {
              const laneHeight = track.subLaneCount * SUB_LANE_HEIGHT_PX + TRACK_PAD_Y_PX * 2;
              return (
                <div key={track.key} className="timeline-track-row">
                  <div className="timeline-track-label-cell">
                    <span className="timeline-track-name">{track.labelKo}</span>
                    <span className="timeline-track-sublabel">{track.subLabelKo}</span>
                    <span className="timeline-track-count">{track.items.length}개</span>
                  </div>

                  <div
                    className="timeline-track-canvas"
                    style={{ width: `${eraLayout.canvasWidth}px`, height: `${laneHeight}px` }}
                  >
                    <svg
                      className="timeline-track-bg-svg"
                      width={eraLayout.canvasWidth}
                      height={laneHeight}
                      viewBox={`0 0 ${eraLayout.canvasWidth} ${laneHeight}`}
                      aria-hidden="true"
                    >
                      {eraLayout.ticks.map((tick) => (
                        <line
                          key={`${tick.year}-${tick.label}`}
                          x1={tick.x}
                          y1={0}
                          x2={tick.x}
                          y2={laneHeight}
                          stroke={
                            tick.isBoundary
                              ? 'rgba(154, 77, 36, 0.35)'
                              : 'rgba(191, 180, 162, 0.35)'
                          }
                          strokeWidth={tick.isBoundary ? 1.5 : 1}
                        />
                      ))}

                      {eraLayout.scaleBreaks.map((brk, idx) => (
                        <line
                          key={idx}
                          x1={brk.x}
                          y1={0}
                          x2={brk.x}
                          y2={laneHeight}
                          stroke="rgba(194, 89, 10, 0.42)"
                          strokeWidth={1.3}
                          strokeDasharray="3 3"
                        />
                      ))}

                      {anchorXRange ? (
                        <g>
                          <rect
                            x={anchorXRange.x}
                            y={0}
                            width={anchorXRange.width}
                            height={laneHeight}
                            fill="rgba(217, 119, 6, 0.13)"
                          />
                          <line
                            x1={anchorXRange.centerX}
                            y1={0}
                            x2={anchorXRange.centerX}
                            y2={laneHeight}
                            stroke="#d97706"
                            strokeWidth={1.8}
                          />
                        </g>
                      ) : null}
                    </svg>

                    {track.items.map((packed) => {
                      const { item } = packed;
                      const isSelected = selection?.kind === 'item' && selection.id === item.id;
                      const isPrimary = primaryHighlightIds.has(item.id);
                      const isRelated = relatedHighlightIds.has(item.id);
                      const baseColor = item.accentColor ?? track.defaultColor;
                      const topPx = TRACK_PAD_Y_PX + packed.subLane * SUB_LANE_HEIGHT_PX;
                      const isEvent = item.category === 'event';
                      const isWindow = item.periodScale === 'uncertainty_window';
                      const isUncertain =
                        item.datePrecision === 'estimated' || item.datePrecision === 'range';
                      const isExternal = item.recordType === 'external_history';
                      const clipPrefix = packed.clippedLeft ? '◀ ' : '';
                      const clipSuffix = packed.clippedRight ? ' ▶' : '';

                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-item-id={item.id}
                          data-sub-lane={packed.subLane}
                          className={`timeline-item-hit ${
                            isSelected ? 'timeline-item-hit-selected' : ''
                          } ${isPrimary ? 'timeline-item-hit-primary' : ''} ${
                            isRelated && !isPrimary ? 'timeline-item-hit-related' : ''
                          } ${packed.hasUncertaintyWhisker ? 'timeline-item-has-whisker' : ''}`}
                          style={{
                            left: `${packed.barX}px`,
                            top: `${topPx}px`,
                            width: `${packed.visualWidth}px`,
                          }}
                          aria-pressed={isSelected}
                          aria-label={`${item.nameKo}, ${packed.customTrackLabelKo}, ${PERIOD_KIND_LABELS_KO[item.periodKind]} ${item.displayPeriodKo}`}
                          onClick={() => onSelectItem(item)}
                        >
                          <span
                            className={`timeline-bar-shape ${
                              isEvent ? 'timeline-bar-event' : ''
                            } ${isWindow ? 'timeline-bar-window' : ''} ${
                              isUncertain ? 'timeline-bar-uncertain' : ''
                            } ${isExternal ? 'timeline-bar-external' : ''} ${
                              packed.hasUncertaintyWhisker ? 'timeline-bar-whiskered' : ''
                            }`}
                            style={{
                              width: `${packed.barWidth}px`,
                              backgroundColor: isSelected
                                ? '#c2590a'
                                : isPrimary
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
                                {clipPrefix}
                                {isEvent ? `◆ ${packed.displayLabel}` : packed.displayLabel}
                                {clipSuffix}
                              </span>
                            ) : null}
                          </span>

                          {!packed.labelInside ? (
                            <span className="timeline-bar-label-outside">
                              {clipPrefix}
                              {packed.displayLabel}
                              {clipSuffix}
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
      ) : null}

      {/* 2) 특집 연대기 A: 단계×행 매트릭스 차트 (예: 성막과 성전의 역사) */}
      {mode === 'special' && specialChronicle && specialChronicle.layout === 'stages' ? (
        <div
          ref={viewportRef}
          className="timeline-viewport special-stages-viewport"
          onScroll={onScrollViewport}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="region"
          aria-label={`${specialChronicle.nameKo} 단계별 차트`}
        >
          <div
            className="special-stage-matrix"
            style={{
              gridTemplateColumns: `var(--tl-label-col-w) repeat(${
                specialChronicle.stages?.length ?? 1
              }, minmax(178px, 1fr))`,
            }}
          >
            <div className="timeline-corner-cell special-stage-corner">구분 · 단계</div>
            {(specialChronicle.stages ?? []).map((stg) => (
              <div key={stg.index} className="special-stage-col-head">
                <span className="special-stage-num">단계 {stg.index}</span>
                <strong className="special-stage-name">{stg.labelKo}</strong>
                <span className="special-stage-period">{stg.periodKo}</span>
              </div>
            ))}

            {specialChronicle.groups.map((grp) => (
              <div key={grp.key} className="special-stage-row-contents">
                <div className="timeline-track-label-cell special-stage-row-label">
                  <span className="timeline-track-name">{grp.labelKo}</span>
                  <span className="timeline-track-sublabel">{grp.subLabelKo}</span>
                </div>

                {(specialChronicle.stages ?? []).map((stg) => {
                  const cellEvents = specialChronicle.events.filter(
                    (ev) => ev.groupKey === grp.key && ev.stageIndex === stg.index,
                  );
                  return (
                    <div key={`${grp.key}-${stg.index}`} className="special-stage-cell">
                      {cellEvents.map((ev) => {
                        const isSelected =
                          selection?.kind === 'special_event' && selection.eventId === ev.id;
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            className={`special-stage-card ${
                              isSelected ? 'special-stage-card-selected' : ''
                            }`}
                            style={{ borderLeftColor: grp.color }}
                            aria-pressed={isSelected}
                            onClick={() => onSelectSpecialEvent(specialChronicle, ev)}
                          >
                            <span className="special-stage-card-time">{ev.timeLabelKo}</span>
                            <strong className="special-stage-card-title">{ev.titleKo}</strong>
                            <span className="special-stage-card-prec">
                              {DATE_PRECISION_LABELS_KO[ev.datePrecision]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 3) 특집 연대기 B: 요일별 컬럼 조화 보드 (예: 고난주간 일별 조화 — Holy Week 스타일) */}
      {mode === 'special' && specialChronicle && specialChronicle.layout === 'day_columns' ? (
        <div
          ref={viewportRef}
          className="timeline-viewport special-days-viewport"
          onScroll={onScrollViewport}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="region"
          aria-label={`${specialChronicle.nameKo} 일별 조화 보드`}
        >
          <div className="special-days-board">
            {specialChronicle.groups.map((dayGrp) => {
              const dayEvents = specialChronicle.events.filter((e) => e.groupKey === dayGrp.key);
              return (
                <section key={dayGrp.key} className="special-day-column">
                  <header
                    className="special-day-head"
                    style={{ backgroundColor: dayGrp.color }}
                  >
                    <strong className="special-day-title">{dayGrp.labelKo}</strong>
                    <span className="special-day-sub">{dayGrp.subLabelKo}</span>
                  </header>

                  <div className="special-day-events">
                    {dayEvents.map((ev) => {
                      const isSelected =
                        selection?.kind === 'special_event' && selection.eventId === ev.id;
                      return (
                        <div
                          key={ev.id}
                          className={`special-day-card ${
                            isSelected ? 'special-day-card-selected' : ''
                          }`}
                        >
                          <button
                            type="button"
                            className="special-day-card-main"
                            aria-pressed={isSelected}
                            onClick={() => onSelectSpecialEvent(specialChronicle, ev)}
                          >
                            <span className="special-day-time">{ev.timeLabelKo}</span>
                            <strong className="special-day-ev-title">{ev.titleKo}</strong>
                            <p className="special-day-ev-desc">{ev.summaryKo}</p>

                            {ev.gospelTags && ev.gospelTags.length > 0 ? (
                              <div className="gospel-tag-row" aria-label="기록된 복음서">
                                {ev.gospelTags.map((gt) => (
                                  <span
                                    key={gt}
                                    className={`gospel-mini-pill gospel-pill-${gt}`}
                                  >
                                    {gt}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </button>

                          {ev.passages.length > 0 ? (
                            <div className="special-day-passage-row">
                              {ev.passages.map((p) => (
                                <button
                                  key={p.verseId}
                                  type="button"
                                  className="special-day-verse-btn"
                                  onClick={() => onSelectPassage(p)}
                                >
                                  {translation === 'en' ? p.labelEn : p.labelKo} →
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
