import { useEffect, useMemo, useState } from 'react';
import type {
  AttestedSequenceStep,
  BibleMapMeta,
  LocationCertainty,
  MapStop,
  MapStopCandidate,
} from '../../types/bible';

interface BibleMapSvgProps {
  mapMeta: BibleMapMeta;
  highlightRegions?: readonly string[];
  highlightStops?: readonly string[];
  attestedSequence?: readonly AttestedSequenceStep[];
}

export const SVG_VIEW_W = 360;
export const SVG_VIEW_H = 220;

const STATUS_META: Record<LocationCertainty, { badge: string; className: string }> = {
  confirmed: {
    badge: '위치 확정',
    className: 'map-status-confirmed',
  },
  traditional: {
    badge: '전통적 전승 위치 (복수 후보)',
    className: 'map-status-traditional',
  },
  estimated: {
    badge: '추정 위치 (복수 후보·대표점)',
    className: 'map-status-estimated',
  },
  unknown: {
    badge: '위치 미상 · 세부 지점 미특정',
    className: 'map-status-unknown',
  },
};

export interface PlacedMapLabel {
  id: string;
  text: string;
  anchorX: number;
  anchorY: number;
  x: number;
  y: number;
  textAnchor: 'start' | 'middle' | 'end';
  box: { left: number; top: number; right: number; bottom: number };
  active: boolean;
  muted?: boolean;
}

interface LabelRequest {
  id: string;
  text: string;
  anchorX: number;
  anchorY: number;
  priority: number;
  active: boolean;
  muted?: boolean;
}

export function projectMapPoint(lat: number, lon: number, bbox: number[]): { x: number; y: number } {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return {
    x: ((lon - minLon) / (maxLon - minLon)) * SVG_VIEW_W,
    y: ((maxLat - lat) / (maxLat - minLat)) * SVG_VIEW_H,
  };
}

export function isPointInViewBox(pt: { x: number; y: number }, pad = 0): boolean {
  return pt.x >= -pad && pt.x <= SVG_VIEW_W + pad && pt.y >= -pad && pt.y <= SVG_VIEW_H + pad;
}

function estimateTextWidthSvg(text: string, fontSize = 9.4): number {
  let units = 0;
  for (const ch of text) {
    if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(ch)) units += 0.96;
    else if (/[()?·\s]/.test(ch)) units += 0.44;
    else units += 0.6;
  }
  return Math.max(16, units * fontSize + 3.0);
}

function boxesOverlap(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
  pad = 2.4,
): boolean {
  return !(
    a.right + pad < b.left ||
    a.left - pad > b.right ||
    a.bottom + pad < b.top ||
    a.top - pad > b.bottom
  );
}

/**
 * 모바일 화면(320px~430px)에서 지명 라벨이 서로 겹치거나 지도 테두리 밖으로 잘리지 않도록
 * 우선순위 기반 8방향 후보 배치 및 경계 상자 충돌 검사를 수행한다.
 */
export function computeNonOverlappingLabels(
  requests: LabelRequest[],
  obstaclePoints: { x: number; y: number; r: number }[],
): PlacedMapLabel[] {
  const sorted = [...requests].sort((a, b) => b.priority - a.priority);
  const placed: PlacedMapLabel[] = [];
  const marginX = 5;
  const marginY = 6;
  const textH = 10.8;

  const offsets: { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' }[] = [
    { dx: 6.2, dy: -3.2, anchor: 'start' },
    { dx: -6.2, dy: -3.2, anchor: 'end' },
    { dx: 6.2, dy: 8.6, anchor: 'start' },
    { dx: -6.2, dy: 8.6, anchor: 'end' },
    { dx: 0, dy: -7.5, anchor: 'middle' },
    { dx: 0, dy: 12.5, anchor: 'middle' },
    { dx: 8.5, dy: 2.5, anchor: 'start' },
    { dx: -8.5, dy: 2.5, anchor: 'end' },
  ];

  for (const req of sorted) {
    if (!isPointInViewBox({ x: req.anchorX, y: req.anchorY }, -2)) continue;
    const w = estimateTextWidthSvg(req.text, req.active ? 10.0 : req.muted ? 8.6 : 9.2);
    let chosen: PlacedMapLabel | null = null;

    for (const off of offsets) {
      const tx = req.anchorX + off.dx;
      const ty = req.anchorY + off.dy;
      const left = off.anchor === 'start' ? tx : off.anchor === 'end' ? tx - w : tx - w / 2;
      const right = left + w;
      const bottom = ty + 2;
      const top = bottom - textH;

      if (
        left < marginX ||
        right > SVG_VIEW_W - marginX ||
        top < marginY ||
        bottom > SVG_VIEW_H - marginY
      ) {
        continue;
      }

      const candidateBox = { left, top, right, bottom };
      const hitsLabel = placed.some((p) => boxesOverlap(candidateBox, p.box, 2.6));
      if (hitsLabel) continue;

      const hitsMarker = obstaclePoints.some((obs) => {
        if (Math.hypot(obs.x - req.anchorX, obs.y - req.anchorY) < 0.8) return false;
        const mbox = {
          left: obs.x - obs.r,
          top: obs.y - obs.r,
          right: obs.x + obs.r,
          bottom: obs.y + obs.r,
        };
        return boxesOverlap(candidateBox, mbox, 1.2);
      });
      if (hitsMarker && !req.active) continue;

      chosen = {
        id: req.id,
        text: req.text,
        anchorX: req.anchorX,
        anchorY: req.anchorY,
        x: Number(tx.toFixed(1)),
        y: Number(ty.toFixed(1)),
        textAnchor: off.anchor,
        box: candidateBox,
        active: req.active,
        muted: req.muted,
      };
      break;
    }

    if (!chosen && req.active) {
      const clampedLeft = Math.max(marginX, Math.min(SVG_VIEW_W - marginX - w, req.anchorX - w / 2));
      const preferAbove = req.anchorY > 26;
      const ty = preferAbove ? req.anchorY - 8.2 : req.anchorY + 13.5;
      const box = { left: clampedLeft, top: ty - textH + 2, right: clampedLeft + w, bottom: ty + 2 };
      chosen = {
        id: req.id,
        text: req.text,
        anchorX: req.anchorX,
        anchorY: req.anchorY,
        x: Number((clampedLeft + w / 2).toFixed(1)),
        y: Number(ty.toFixed(1)),
        textAnchor: 'middle',
        box,
        active: true,
        muted: false,
      };
    }

    if (chosen) {
      placed.push(chosen);
    }
  }

  return placed;
}

function getStopStatus(stop: MapStop): LocationCertainty {
  if (stop.locationStatus) return stop.locationStatus;
  if (stop.lat !== undefined && stop.lon !== undefined) return 'confirmed';
  return 'unknown';
}

function getInBoundsCandidates(
  stop: MapStop,
  bbox: number[],
): (MapStopCandidate & { x: number; y: number })[] {
  const raw: MapStopCandidate[] =
    stop.candidates && stop.candidates.length > 0
      ? stop.candidates
      : stop.lat !== undefined && stop.lon !== undefined
        ? [
            {
              lat: stop.lat,
              lon: stop.lon,
              modernName: stop.modernName ?? stop.label,
              modernNameKo: stop.modernNameKo,
              sourceUrl: stop.sourceUrl ?? '',
            },
          ]
        : [];
  return raw
    .map((cand) => ({ ...cand, ...projectMapPoint(cand.lat, cand.lon, bbox) }))
    .filter((pt) => isPointInViewBox(pt, -2));
}

function clusterCandidatesForOverview<T extends { x: number; y: number }>(
  pts: T[],
  minDist = 8.5,
): T[] {
  const kept: T[] = [];
  for (const pt of pts) {
    if (!kept.some((k) => Math.hypot(k.x - pt.x, k.y - pt.y) < minDist)) {
      kept.push(pt);
    }
  }
  return kept;
}

export function buildGoogleMapsRegionUrl(mapMeta: BibleMapMeta): string | null {
  if (mapMeta.bbox && mapMeta.bbox.length === 4) {
    const [minLon, minLat, maxLon, maxLat] = mapMeta.bbox;
    const centerLat = ((minLat + maxLat) / 2).toFixed(4);
    const centerLon = ((minLon + maxLon) / 2).toFixed(4);
    const lonSpan = Math.max(0.5, maxLon - minLon);
    const zoom = Math.max(4, Math.min(12, Math.round(Math.log2(360 / lonSpan)) + 1));
    return `https://www.google.com/maps/@?api=1&map_action=map&center=${centerLat},${centerLon}&zoom=${zoom}&basemap=satellite`;
  }
  const first = mapMeta.stops.find((s) => s.lat !== undefined && s.lon !== undefined);
  return first
    ? `https://www.google.com/maps/@?api=1&map_action=map&center=${first.lat},${first.lon}&zoom=7&basemap=satellite`
    : null;
}

export function buildGoogleMapsStopUrl(stop: MapStop): string | null {
  const status = getStopStatus(stop);
  if (status !== 'confirmed') return null;
  return stop.lat !== undefined && stop.lon !== undefined
    ? `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lon}`
    : null;
}

export function buildGoogleMapsCoordUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

export function BibleMapSvg({
  mapMeta,
  highlightRegions,
  highlightStops,
  attestedSequence,
}: BibleMapSvgProps) {
  const [showPlaces, setShowPlaces] = useState(true);
  const [showAncientRegions, setShowAncientRegions] = useState(true);
  const [showModernBorders, setShowModernBorders] = useState(false);
  const [showSequence, setShowSequence] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedStopId(null);
    setShowSequence(false);
  }, [mapMeta.id, highlightStops, attestedSequence]);

  const selectedStop = mapMeta.stops.find((stop) => stop.id === selectedStopId) ?? null;
  const hasChapterStopFocus = Boolean(highlightStops && highlightStops.length > 0);
  const activeStopSet = useMemo(
    () => new Set(hasChapterStopFocus ? highlightStops! : mapMeta.stops.map((stop) => stop.id)),
    [hasChapterStopFocus, highlightStops, mapMeta.stops],
  );

  const hasChapterRegionFocus = Boolean(highlightRegions && highlightRegions.length > 0);
  const activeRegionSet = useMemo(
    () =>
      new Set(
        hasChapterRegionFocus
          ? highlightRegions!
          : (mapMeta.ancientRegions ?? []).map((rg) => rg.id),
      ),
    [hasChapterRegionFocus, highlightRegions, mapMeta.ancientRegions],
  );

  const regionUrl = buildGoogleMapsRegionUrl(mapMeta);

  const layout = useMemo(() => {
    if (!mapMeta.bbox) {
      return {
        stopRenderItems: [],
        labels: [],
        placedRegions: [],
        sequenceArcs: [],
        scaleBarX: 12,
      };
    }
    const bbox = mapMeta.bbox;
    const obstacles: { x: number; y: number; r: number }[] = [];
    const labelRequests: LabelRequest[] = [];

    const rawRegions = (mapMeta.ancientRegions ?? []).map((rg) => ({
      ...rg,
      ...projectMapPoint(rg.lat, rg.lon, bbox),
    }));

    const stopCoordById = new Map<string, { x: number; y: number }>();

    const stopRenderItems = mapMeta.stops.map((stop) => {
      const status = getStopStatus(stop);
      const selected = selectedStopId === stop.id;
      const highlighted = activeStopSet.has(stop.id);
      const inBoundsCandidates = getInBoundsCandidates(stop, bbox);
      if (inBoundsCandidates.length > 0) {
        stopCoordById.set(stop.id, { x: inBoundsCandidates[0].x, y: inBoundsCandidates[0].y });
      }
      const visibleCandidates = selected
        ? clusterCandidatesForOverview(inBoundsCandidates, 8.5)
        : inBoundsCandidates.slice(0, 1);

      for (const vc of visibleCandidates) {
        obstacles.push({ x: vc.x, y: vc.y, r: selected ? 6.0 : 4.2 });
      }

      if (visibleCandidates.length > 0) {
        const anchor = visibleCandidates[0];
        const isMuted = hasChapterStopFocus && !highlighted && !selected;
        const basePriority = selected
          ? 1000
          : highlighted
            ? status === 'confirmed'
              ? 360
              : 300
            : status === 'confirmed'
              ? 140
              : 100;
        // BibleMapper 관례에 맞춰 미확정·복수 후보 지명은 간결한 '?' 표기를 붙여 확정 사실과 구분한다.
        const displayLabel =
          status === 'confirmed'
            ? stop.label
            : selected && visibleCandidates.length > 1
              ? `${stop.label}?(후보1)`
              : `${stop.label}?`;

        labelRequests.push({
          id: stop.id,
          text: displayLabel,
          anchorX: anchor.x,
          anchorY: anchor.y,
          priority: basePriority,
          active: selected,
          muted: isMuted,
        });

        if (selected && visibleCandidates.length > 1) {
          visibleCandidates.slice(1, 5).forEach((altCand, altIdx) => {
            labelRequests.push({
              id: `${stop.id}-alt-${altIdx + 2}`,
              text: `후보${altIdx + 2}`,
              anchorX: altCand.x,
              anchorY: altCand.y,
              priority: 540 - altIdx * 10,
              active: false,
              muted: false,
            });
          });
        }
      }

      return {
        stop,
        status,
        selected,
        highlighted,
        inBoundsCandidates,
        visibleCandidates,
      };
    });

    // 축척 막대 위치(좌하단 vs 우하단 중 마커가 적은 쪽 선택) 및 충돌 방지 영역 등록
    const leftBottomCount = obstacles.filter((o) => o.x < 120 && o.y > 182).length;
    const rightBottomCount = obstacles.filter((o) => o.x > 240 && o.y > 182).length;
    const scaleBarW = mapMeta.scaleBar?.svgWidth ?? 56;
    const scaleBarX = leftBottomCount <= rightBottomCount ? 12 : SVG_VIEW_W - 14 - scaleBarW;
    obstacles.push({ x: scaleBarX + scaleBarW / 2, y: SVG_VIEW_H - 12, r: 12 });

    const labels = showPlaces ? computeNonOverlappingLabels(labelRequests, obstacles) : [];

    // 고대 권역 라벨 배치 (마커·지명 라벨과 절대 겹치지 않도록 여백 탐색)
    const placedRegions: {
      id: string;
      label: string;
      color: string;
      svgPath?: string;
      sourceId: string;
      emphasized: boolean;
      labelPos: { x: number; y: number } | null;
    }[] = [];
    const regionPlacedBoxes: { left: number; top: number; right: number; bottom: number }[] = [];
    const regionOffsets = [
      { dx: 0, dy: 0 },
      { dx: -24, dy: -11 },
      { dx: 24, dy: -11 },
      { dx: -24, dy: 13 },
      { dx: 24, dy: 13 },
      { dx: 0, dy: -17 },
      { dx: 0, dy: 17 },
      { dx: -36, dy: 0 },
      { dx: 36, dy: 0 },
    ];

    for (const rg of rawRegions) {
      const isSelectedRegion =
        selectedStop?.placeType === 'region' &&
        Boolean(selectedStop.sourceId) &&
        selectedStop.sourceId === rg.sourceId;
      const emphasized = isSelectedRegion || activeRegionSet.has(rg.id);

      let labelPos: { x: number; y: number } | null = null;
      if (isPointInViewBox(rg, -12)) {
        const rw = estimateTextWidthSvg(rg.label, 8.8) * 1.15;
        const rh = 10.2;
        for (const roff of regionOffsets) {
          const rx = rg.x + roff.dx;
          const ry = rg.y + roff.dy;
          const rbox = {
            left: rx - rw / 2,
            top: ry - rh + 2,
            right: rx + rw / 2,
            bottom: ry + 2,
          };
          if (
            rbox.left < 6 ||
            rbox.right > SVG_VIEW_W - 6 ||
            rbox.top < 8 ||
            rbox.bottom > SVG_VIEW_H - 18
          ) {
            continue;
          }
          const hitLabel = showPlaces && labels.some((l) => boxesOverlap(rbox, l.box, 2.8));
          if (hitLabel) continue;
          const hitObs =
            showPlaces &&
            obstacles.some((o) =>
              boxesOverlap(
                rbox,
                { left: o.x - o.r, top: o.y - o.r, right: o.x + o.r, bottom: o.y + o.r },
                2.2,
              ),
            );
          if (hitObs) continue;
          const hitOtherReg = regionPlacedBoxes.some((b) => boxesOverlap(rbox, b, 3.5));
          if (hitOtherReg) continue;

          labelPos = { x: rx, y: ry };
          regionPlacedBoxes.push(rbox);
          break;
        }
      }

      placedRegions.push({
        id: rg.id,
        label: rg.label,
        color: rg.color ?? '#a6c972',
        svgPath: rg.svgPath,
        sourceId: rg.sourceId,
        emphasized,
        labelPos,
      });
    }

    // 본문 명시 이동 방향 곡선(필요할 때 사용자가 켰을 때만 렌더링 — 실제 도로 확정 아님)
    const sequenceArcs: { key: string; d: string; verseRef: string }[] = [];
    for (const step of attestedSequence ?? []) {
      const p0 = stopCoordById.get(step.from);
      const p1 = stopCoordById.get(step.to);
      if (!p0 || !p1) continue;
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy);
      if (len < 6) continue;
      const ux = dx / len;
      const uy = dy / len;
      const sx = p0.x + ux * 5.2;
      const sy = p0.y + uy * 5.2;
      const ex = p1.x - ux * 6.2;
      const ey = p1.y - uy * 6.2;
      const bend = Math.min(18, len * 0.16);
      const cx = (sx + ex) / 2 - uy * bend;
      const cy = (sy + ey) / 2 + ux * bend;
      sequenceArcs.push({
        key: `${step.from}-${step.to}-${step.verseRef}`,
        d: `M ${sx.toFixed(1)},${sy.toFixed(1)} Q ${cx.toFixed(1)},${cy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`,
        verseRef: step.verseRef,
      });
    }

    return { stopRenderItems, labels, placedRegions, sequenceArcs, scaleBarX };
  }, [
    mapMeta.bbox,
    mapMeta.ancientRegions,
    mapMeta.stops,
    mapMeta.scaleBar,
    selectedStopId,
    selectedStop,
    hasChapterStopFocus,
    activeStopSet,
    activeRegionSet,
    attestedSequence,
    showPlaces,
  ]);

  /**
   * BibleMapper Atlas 관례에 맞춘 작은 도시·후보 마커:
   * - 확정 도시(confirmed): 작고 또렷한 사각 마커(■)
   * - 전통·산 후보(traditional / mountain): 작은 삼각(▲) 또는 마름모(◆)
   * - 추정·복수 후보(estimated): 작은 점선 사각 마커(□)
   */
  const renderMarkerGlyph = (
    stop: MapStop,
    status: LocationCertainty,
    selected: boolean,
    highlighted: boolean,
    candidateIndex: number,
  ) => {
    const halo = '#fffdf8';
    const isMuted = hasChapterStopFocus && !highlighted && !selected;

    if (status === 'confirmed') {
      const half = selected ? 2.9 : highlighted ? 2.25 : 1.75;
      const fill = selected ? '#145a40' : highlighted ? '#7a2511' : '#4a545e';
      return (
        <rect
          x={-half}
          y={-half}
          width={half * 2}
          height={half * 2}
          rx={0.5}
          fill={fill}
          fillOpacity={isMuted ? 0.62 : 1}
          stroke={halo}
          strokeWidth={selected ? 1.5 : 1.15}
        />
      );
    }

    if (status === 'traditional' || stop.placeType === 'mountain') {
      const s = selected ? 4.3 : highlighted ? 3.5 : 2.9;
      const fill = selected ? '#145a40' : highlighted ? '#7c3f09' : '#5f574b';
      if (stop.placeType === 'mountain') {
        // 산봉우리 후보(예: 시내산 후보들) — 삼각 기호(▲)
        return (
          <polygon
            points={`0,${-s - 0.6} ${s},${s * 0.85} ${-s},${s * 0.85}`}
            fill={candidateIndex === 0 || selected ? fill : '#fdf7ea'}
            fillOpacity={isMuted ? 0.65 : 1}
            stroke={candidateIndex === 0 || selected ? halo : fill}
            strokeWidth="1.2"
          />
        );
      }
      return (
        <polygon
          points={`0,${-s} ${s},0 0,${s} ${-s},0`}
          fill={candidateIndex === 0 || selected ? fill : '#fdf7ea'}
          fillOpacity={isMuted ? 0.65 : 1}
          stroke={candidateIndex === 0 || selected ? halo : fill}
          strokeWidth="1.2"
        />
      );
    }

    // estimated (복수 후보·섬 대표점 — 확정 도시와 구별되는 작은 속 빈 점선 사각 마커)
    const half = selected ? 2.9 : highlighted ? 2.35 : 1.95;
    const stroke = selected ? '#145a40' : highlighted ? '#8f3718' : '#58636e';
    return (
      <>
        <rect
          x={-half}
          y={-half}
          width={half * 2}
          height={half * 2}
          fill="rgba(255, 252, 244, 0.9)"
          stroke={stroke}
          strokeOpacity={isMuted ? 0.65 : 1}
          strokeWidth="1.35"
          strokeDasharray="1.9 1.2"
        />
        <circle r={selected ? 1.15 : 0.9} fill={stroke} fillOpacity={isMuted ? 0.65 : 1} />
      </>
    );
  };

  const arrowMarkerId = `seq-arrow-${mapMeta.id}`;

  const renderSvgMap = (className: string) => (
    <svg
      viewBox={`0 0 ${SVG_VIEW_W} ${SVG_VIEW_H}`}
      className={className}
      role="img"
      aria-label={`${mapMeta.title} 성경 지명 지도`}
    >
      <defs>
        <marker
          id={arrowMarkerId}
          viewBox="0 0 8 8"
          refX="6.5"
          refY="4"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M 0 1 L 7 4 L 0 7 z" fill="#9e3318" />
        </marker>
      </defs>

      <rect width={SVG_VIEW_W} height={SVG_VIEW_H} fill="#bbd9f4" />
      {mapMeta.backdropImageUrl && (
        <image
          href={mapMeta.backdropImageUrl}
          width={SVG_VIEW_W}
          height={SVG_VIEW_H}
          preserveAspectRatio="xMidYMid meet"
        />
      )}

      {/* 별도 레이어 1: OpenBible 확률 등치선 기반 옅은 색 고대 권역 (읽는 본문 관련 지역만 강조, 확정 국경선 없음) */}
      {showAncientRegions &&
        layout.placedRegions.map((rg) => {
          const isSelectedRegion =
            selectedStop?.placeType === 'region' &&
            Boolean(selectedStop.sourceId) &&
            selectedStop.sourceId === rg.sourceId;
          const opacity = isSelectedRegion
            ? 0.44
            : rg.emphasized
              ? hasChapterRegionFocus
                ? 0.35
                : 0.25
              : 0.1;
          return (
            <g key={`reg-poly-${rg.id}`}>
              {rg.svgPath && (
                <path
                  d={rg.svgPath}
                  fill={rg.color}
                  fillOpacity={opacity}
                  stroke={isSelectedRegion ? '#145a40' : 'none'}
                  strokeWidth={isSelectedRegion ? 1.1 : 0}
                  strokeDasharray={isSelectedRegion ? '3 2.5' : undefined}
                  style={{ mixBlendMode: 'multiply' }}
                />
              )}
            </g>
          );
        })}

      {/* 고대 권역 명칭 라벨 */}
      {showAncientRegions &&
        layout.placedRegions.map((rg) => {
          if (!rg.labelPos) return null;
          const isSelectedRegion =
            selectedStop?.placeType === 'region' &&
            Boolean(selectedStop.sourceId) &&
            selectedStop.sourceId === rg.sourceId;
          const cls = isSelectedRegion
            ? 'map-ancient-region-label map-ancient-region-label-active'
            : rg.emphasized
              ? 'map-ancient-region-label'
              : 'map-ancient-region-label map-ancient-region-label-muted';
          return (
            <text
              key={`reg-lbl-${rg.id}`}
              x={rg.labelPos.x}
              y={rg.labelPos.y}
              textAnchor="middle"
              className={cls}
            >
              {rg.label}
            </text>
          );
        })}

      {/* 별도 레이어 2: 현대 국경선 참고 오버레이 (기존 방식 유지 · 기본 숨김) */}
      {showModernBorders && mapMeta.modernBordersImageUrl && (
        <image
          href={mapMeta.modernBordersImageUrl}
          width={SVG_VIEW_W}
          height={SVG_VIEW_H}
          preserveAspectRatio="xMidYMid meet"
        />
      )}

      {/* 선택적 레이어: 성경 본문에 명시된 이동 방향 (기본 숨김, 사용자가 켰을 때만 점선 화살표로 표시) */}
      {showSequence &&
        layout.sequenceArcs.map((arc) => (
          <path
            key={arc.key}
            d={arc.d}
            fill="none"
            stroke="#9e3318"
            strokeWidth="1.5"
            strokeDasharray="4 2.8"
            markerEnd={`url(#${arrowMarkerId})`}
            className="map-sequence-arc"
          >
            <title>본문 언급 이동 순서 ({arc.verseRef}) — 실제 고대 도로 궤적 확정 아님</title>
          </path>
        ))}

      {/* 별도 레이어 3: 작은 도시 마커 및 후보 기호 */}
      {showPlaces &&
        layout.stopRenderItems.map(({ stop, status, selected, highlighted, visibleCandidates }) =>
          visibleCandidates.map((cand, idx) => {
            const statusText = STATUS_META[status].badge;
            const ariaLabel =
              idx === 0
                ? `${stop.label}, ${statusText}`
                : `${stop.label} 후보 ${idx + 1}: ${cand.modernNameKo ?? cand.modernName}`;
            return (
              <g
                key={`${stop.id}-cand-${idx}`}
                transform={`translate(${cand.x.toFixed(2)}, ${cand.y.toFixed(2)})`}
                className="map-stop-clickable"
                role="button"
                tabIndex={idx === 0 ? 0 : -1}
                aria-label={ariaLabel}
                onClick={() => setSelectedStopId(stop.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedStopId(stop.id);
                  }
                }}
              >
                <circle r="11" fill="transparent" />
                {renderMarkerGlyph(stop, status, selected, highlighted, idx)}
                <title>
                  {stop.label} ({statusText}) — {cand.modernNameKo ?? cand.modernName}
                </title>
              </g>
            );
          }),
        )}

      {/* 충돌 방지 배치된 성경 도시명 라벨 */}
      {showPlaces &&
        layout.labels.map((lbl) => (
          <text
            key={`lbl-${lbl.id}`}
            x={lbl.x}
            y={lbl.y}
            textAnchor={lbl.textAnchor}
            className={
              lbl.active
                ? 'map-stop-label-2d map-stop-label-2d-active'
                : lbl.muted
                  ? 'map-stop-label-2d map-stop-label-2d-muted'
                  : 'map-stop-label-2d'
            }
            onClick={() => {
              const targetStop = mapMeta.stops.find(
                (s) => s.id === lbl.id || lbl.id.startsWith(`${s.id}-alt-`),
              );
              if (targetStop) setSelectedStopId(targetStop.id);
            }}
          >
            {lbl.text}
          </text>
        ))}

      {/* 우하단/좌하단 축척 막대 (km) */}
      {mapMeta.scaleBar && (
        <g
          transform={`translate(${layout.scaleBarX}, ${SVG_VIEW_H - 13})`}
          className="map-scale-bar"
          aria-hidden="true"
        >
          <rect
            x="-4"
            y="-9"
            width={mapMeta.scaleBar.svgWidth + 8}
            height="14"
            rx="3"
            fill="rgba(252, 249, 240, 0.78)"
          />
          <line
            x1="0"
            y1="1"
            x2={mapMeta.scaleBar.svgWidth}
            y2="1"
            stroke="#3a332a"
            strokeWidth="1.2"
          />
          <line x1="0" y1="-2" x2="0" y2="3" stroke="#3a332a" strokeWidth="1.2" />
          <line
            x1={mapMeta.scaleBar.svgWidth}
            y1="-2"
            x2={mapMeta.scaleBar.svgWidth}
            y2="3"
            stroke="#3a332a"
            strokeWidth="1.2"
          />
          <text
            x={mapMeta.scaleBar.svgWidth / 2}
            y="-2"
            textAnchor="middle"
            className="map-scale-bar-text"
          >
            {mapMeta.scaleBar.km} km
          </text>
        </g>
      )}
    </svg>
  );

  const selectedStatus = selectedStop ? getStopStatus(selectedStop) : null;
  const confirmedGoogleUrl = selectedStop ? buildGoogleMapsStopUrl(selectedStop) : null;

  return (
    <figure className="bible-map-figure">
      <div className="bible-map-header">
        <div className="bible-map-title-row">
          <strong className="bible-map-title">{mapMeta.title}</strong>
          <div className="bible-map-controls" role="group" aria-label="지도 레이어 및 화면 제어">
            <button
              type="button"
              className={`map-ctrl-btn ${showPlaces ? 'map-ctrl-btn-on' : ''}`}
              aria-pressed={showPlaces}
              onClick={() => setShowPlaces((v) => !v)}
            >
              {showPlaces ? '지명 숨기기' : '지명 표시'}
            </button>
            {mapMeta.ancientRegions && mapMeta.ancientRegions.length > 0 && (
              <button
                type="button"
                className={`map-ctrl-btn ${showAncientRegions ? 'map-ctrl-btn-on' : ''}`}
                aria-pressed={showAncientRegions}
                onClick={() => setShowAncientRegions((v) => !v)}
              >
                {showAncientRegions ? '고대 권역 켜짐' : '고대 권역 꺼짐'}
              </button>
            )}
            {layout.sequenceArcs.length > 0 && (
              <button
                type="button"
                className={`map-ctrl-btn ${showSequence ? 'map-ctrl-btn-on' : ''}`}
                aria-pressed={showSequence}
                onClick={() => setShowSequence((v) => !v)}
              >
                {showSequence ? '이동 방향 숨기기' : '이동 방향 보기'}
              </button>
            )}
            {mapMeta.modernBordersImageUrl && (
              <button
                type="button"
                className={`map-ctrl-btn ${showModernBorders ? 'map-ctrl-btn-on' : ''}`}
                aria-pressed={showModernBorders}
                onClick={() => setShowModernBorders((v) => !v)}
              >
                {showModernBorders ? '현대 국경 숨기기' : '현대 국경 참고'}
              </button>
            )}
            <button
              type="button"
              className="map-ctrl-btn"
              aria-pressed={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? '기본 크기' : '크게 보기'}
            </button>
            {regionUrl && (
              <a
                href={regionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="map-ctrl-btn map-google-link-btn"
                aria-label={`${mapMeta.title} 권역을 구글 위성지도로 열기 (새 창)`}
              >
                구글 지도 ↗
              </a>
            )}
          </div>
        </div>
        <p className="bible-map-summary">{mapMeta.regionSummary}</p>
      </div>

      {mapMeta.imageUrl ? (
        <img src={mapMeta.imageUrl} alt={mapMeta.title} className="bible-map-external-img" />
      ) : (
        <div className={expanded ? 'bible-map-scroll-zoom' : undefined}>
          {renderSvgMap(expanded ? 'bible-map-svg bible-map-svg-expanded' : 'bible-map-svg')}
        </div>
      )}

      {/* 범례: 옅은 색 고대 추정 권역 + 작은 도시·후보 마커 4단계 */}
      <div className="map-legend-bar" aria-label="지도 기호 및 위치 신뢰도 범례">
        <span className="map-legend-item">
          <i className="map-legend-glyph map-legend-region-wash" aria-hidden="true" /> 고대 권역(추정 범위)
        </span>
        <span className="map-legend-item">
          <i className="map-legend-glyph map-legend-confirmed" aria-hidden="true" /> 확정 성읍
        </span>
        <span className="map-legend-item">
          <i className="map-legend-glyph map-legend-traditional" aria-hidden="true" /> 전통·산 후보(?)
        </span>
        <span className="map-legend-item">
          <i className="map-legend-glyph map-legend-estimated" aria-hidden="true" /> 추정·복수 후보(?)
        </span>
        <span className="map-legend-item">
          <span className="map-legend-q" aria-hidden="true">?</span> 미상·광역(핀 미표시)
        </span>
      </div>

      <div className="map-places-panel">
        <span className="map-places-hint">
          읽는 본문과 관련된 권역·지명을 우선 강조합니다. 지명 뒤 ‘?’는 학술적으로 위치가 확정되지 않은 후보 지명입니다.
        </span>

        <div className="map-place-chips" role="group" aria-label="성경 지명 선택">
          {mapMeta.stops.map((stop) => {
            const st = getStopStatus(stop);
            const active = selectedStopId === stop.id;
            return (
              <button
                key={stop.id}
                type="button"
                className={`map-place-chip ${active ? 'map-place-chip-active' : ''}`}
                aria-pressed={active}
                onClick={() => setSelectedStopId(stop.id)}
              >
                {st === 'unknown' ? (
                  <span className="map-legend-q" aria-hidden="true">
                    ?
                  </span>
                ) : (
                  <i
                    className={`map-legend-glyph map-legend-${st}`}
                    aria-hidden="true"
                  />
                )}
                {stop.label}
              </button>
            );
          })}
        </div>

        {selectedStop && selectedStatus && (
          <div className="map-selected-place-bar" aria-live="polite">
            <div className="map-place-detail">
              <div className="map-place-detail-head">
                <strong>{selectedStop.label}</strong>
                <span className={`map-status-pill ${STATUS_META[selectedStatus].className}`}>
                  {STATUS_META[selectedStatus].badge}
                </span>
              </div>

              <div className="map-name-distinction">
                <span>
                  <strong>성경 지명(고대):</strong>{' '}
                  {selectedStop.biblicalName ?? selectedStop.label}
                </span>
                {selectedStatus === 'confirmed' &&
                  (selectedStop.modernNameKo || selectedStop.modernName) && (
                    <span>
                      <strong>현대 지명·유적:</strong>{' '}
                      {selectedStop.modernNameKo
                        ? `${selectedStop.modernNameKo} (${selectedStop.modernName})`
                        : selectedStop.modernName}
                    </span>
                  )}
              </div>

              {selectedStop.scriptureRef && (
                <span>
                  <strong>관련 성경 구절:</strong> {selectedStop.scriptureRef}
                </span>
              )}

              {selectedStop.historicalBackground && (
                <p className="map-place-bg-text">{selectedStop.historicalBackground}</p>
              )}

              {selectedStop.statusReason && (
                <span className="map-status-reason">
                  <strong>위치 신뢰도 근거:</strong> {selectedStop.statusReason}
                </span>
              )}

              {selectedStop.candidates && selectedStop.candidates.length > 0 && (
                <div className="map-candidates-box">
                  <strong>
                    {selectedStop.candidates.length > 1
                      ? `복수 현대 위치 후보 (${selectedStop.candidates.length}곳 — 단일 위치 미확정):`
                      : '원자료 현대 유적·대표 좌표:'}
                  </strong>
                  <ul className="map-candidates-list">
                    {selectedStop.candidates.map((cand, idx) => (
                      <li key={`${cand.modernName}-${idx}`}>
                        <span className="map-cand-title">
                          {selectedStop.candidates!.length > 1 ? `후보 ${idx + 1}: ` : ''}
                          {cand.modernNameKo
                            ? `${cand.modernNameKo} (${cand.modernName})`
                            : cand.modernName}
                        </span>{' '}
                        <span className="map-cand-coord">
                          ({cand.lat.toFixed(4)}°N, {cand.lon.toFixed(4)}°E
                          {cand.representative ? ' · 영역 대표점' : ''}
                          {cand.precisionMeters ? ` · 반경 ±${cand.precisionMeters}m` : ''}
                          {cand.coordinateSource ? ` · ${cand.coordinateSource}` : ''})
                        </span>{' '}
                        <a href={cand.sourceUrl} target="_blank" rel="noopener noreferrer">
                          OpenBible ↗
                        </a>
                        {' · '}
                        <a
                          href={buildGoogleMapsCoordUrl(cand.lat, cand.lon)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          위성 위치 ↗
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="map-source-links-row">
                {selectedStop.sourceUrl && (
                  <a href={selectedStop.sourceUrl} target="_blank" rel="noopener noreferrer">
                    OpenBible 고대 지명 원자료 ({selectedStop.sourceId}) ↗
                  </a>
                )}
              </div>
            </div>

            {confirmedGoogleUrl && (
              <a
                href={confirmedGoogleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="map-place-google-open-btn"
              >
                구글 지도에서 ‘{selectedStop.label}’ 열기 ↗
              </a>
            )}
          </div>
        )}
      </div>

      <figcaption className="bible-map-caption">
        <span>
          <strong>출처·라이선스:</strong> 성경 지명·고대 권역 등치선 —{' '}
          <a
            href="https://github.com/openbibleinfo/Bible-Geocoding-Data"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenBible.info Bible Geocoding Data (CC BY 4.0)
          </a>{' '}
          · 해안선·하천·현대 국경 —{' '}
          <a
            href="https://www.naturalearthdata.com/about/terms-of-use/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Natural Earth 1:10m (Public Domain)
          </a>{' '}
          · 고도 지형(DEM) — USGS SRTM / GMTED2010 / NOAA ETOPO1 (Public Domain) · 기반 유적 좌표 —{' '}
          <a href="https://pleiades.stoa.org/" target="_blank" rel="noopener noreferrer">
            Pleiades (CC BY 3.0)
          </a>
          ,{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
            OpenStreetMap 기여자 (ODbL 1.0)
          </a>
          , DAAHL, Wikidata
        </span>
        <span>
          <strong>역사·측지 원칙:</strong> 옅은 색 고대 권역은 확정 국경선이 아닌 성경 시대의 대략적 범위입니다. 현대 국경은 별도 참고 레이어로 분리했으며, 이동 방향 점선은 본문 순서 참고용으로만 선택 표시됩니다.
        </span>
        <span>
          <strong>투영 검증:</strong>{' '}
          {mapMeta.projection
            ? `${mapMeta.projection.crs} · ${mapMeta.projection.name} (표준위선 ${mapMeta.projection.standardParallel}°N, 배경·마커 동일 변환)`
            : 'WGS84 (EPSG:4326) · 정거 원통 선형 변환'}
        </span>
      </figcaption>
    </figure>
  );
}
