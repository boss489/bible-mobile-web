import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BibleMapSvg,
  SVG_VIEW_H,
  SVG_VIEW_W,
  computeNonOverlappingLabels,
  projectMapPoint,
} from '../components/CommentarySheet/BibleMapSvg';
import type { BibleMapMeta } from '../types/bible';

const MAPS_META_RAW = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../content/maps-meta.json'), 'utf-8'),
) as { maps: BibleMapMeta[] };

const MAPS_BY_ID = Object.fromEntries(MAPS_META_RAW.maps.map((m) => [m.id, m]));

describe('성경 2D 지도 지리적 정확성·역사적 신뢰성·모바일 가독성 검증', () => {
  it('1. 6종 모든 지도에서 모바일 지명 라벨이 서로 겹치거나 뷰포트 밖으로 잘리지 않는다', () => {
    for (const mapMeta of MAPS_META_RAW.maps) {
      const bbox = mapMeta.bbox!;
      const obstacles = mapMeta.stops.flatMap((s) =>
        (s.candidates ?? []).slice(0, 2).map((c) => ({
          ...projectMapPoint(c.lat, c.lon, bbox),
          r: 5.5,
        })),
      );

      // 기본 초기 상태 및 개별 지명 선택 상태를 모두 검증
      const targetSelections: (string | null)[] = [null, ...mapMeta.stops.map((s) => s.id)];
      for (const activeId of targetSelections) {
        const reqs = mapMeta.stops
          .filter((s) => (s.candidates && s.candidates.length > 0) || s.lat !== undefined)
          .map((s) => {
            const c0 = s.candidates?.[0] ?? { lat: s.lat!, lon: s.lon! };
            const pt = projectMapPoint(c0.lat, c0.lon, bbox);
            return {
              id: s.id,
              text: s.locationStatus === 'confirmed' ? s.label : `${s.label}(후보)`,
              anchorX: pt.x,
              anchorY: pt.y,
              priority: activeId === s.id ? 1000 : 200,
              active: activeId === s.id,
            };
          });

        const placed = computeNonOverlappingLabels(reqs, obstacles);
        for (let i = 0; i < placed.length; i += 1) {
          const a = placed[i].box;
          expect(a.left).toBeGreaterThanOrEqual(4);
          expect(a.right).toBeLessThanOrEqual(SVG_VIEW_W - 4);
          expect(a.top).toBeGreaterThanOrEqual(4);
          expect(a.bottom).toBeLessThanOrEqual(SVG_VIEW_H - 4);

          for (let j = i + 1; j < placed.length; j += 1) {
            const b = placed[j].box;
            const overlaps = !(
              a.right < b.left ||
              a.left > b.right ||
              a.bottom < b.top ||
              a.top > b.bottom
            );
            expect(overlaps).toBe(false);
          }
        }
      }
    }
  });

  it('2. 옅은 색 고대 권역(본문 관련 지역 강조), 필요할 때만 켜는 이동 방향, 별도 현대 국경 레이어가 독립 동작한다', async () => {
    const user = userEvent.setup();
    const mapMeta = MAPS_BY_ID['jesus-palestine'];
    const { container } = render(
      <BibleMapSvg
        mapMeta={mapMeta}
        highlightRegions={['judea-2', 'samaria-2']}
        highlightStops={['jerusalem_nt', 'samaria_city', 'gaza_road']}
        attestedSequence={[
          { from: 'jerusalem_nt', to: 'samaria_city', verseRef: '행 8:5' },
        ]}
      />,
    );

    // 기본 상태: 현대 국경 오버레이 미렌더링, 이동 방향 화살표 미렌더링, 옅은 색 고대 권역 폴리곤 렌더링
    const imagesBefore = Array.from(container.querySelectorAll('svg image')).map((el) =>
      el.getAttribute('href'),
    );
    expect(imagesBefore).toEqual(['./assets/maps/jesus-palestine.jpg']);
    expect(container.querySelectorAll('.map-sequence-arc')).toHaveLength(0);
    expect(container.querySelectorAll('svg g path').length).toBeGreaterThan(0);

    // 필요할 때만 이동 방향 보기 켜기
    await user.click(screen.getByRole('button', { name: '이동 방향 보기' }));
    expect(container.querySelectorAll('.map-sequence-arc')).toHaveLength(1);

    // 현대 국경 참고 켜기 (기존 방식 유지)
    await user.click(screen.getByRole('button', { name: '현대 국경 참고' }));
    const imagesAfter = Array.from(container.querySelectorAll('svg image')).map((el) =>
      el.getAttribute('href'),
    );
    expect(imagesAfter).toContain('./assets/maps/jesus-palestine-modern.png');

    // 고대 권역 끄기 시 현대 국경은 그대로 유지되는 별도 레이어 관리 검증
    await user.click(screen.getByRole('button', { name: '고대 권역 켜짐' }));
    expect(container.querySelectorAll('svg g path')).toHaveLength(0);
    expect(
      Array.from(container.querySelectorAll('svg image')).map((el) => el.getAttribute('href')),
    ).toContain('./assets/maps/jesus-palestine-modern.png');
  });

  it('3. 수가(복수 후보·미확정)와 사마리아 성읍(세바스티야 확정), 가사와 애굽을 별개 장소로 구분한다', async () => {
    const user = userEvent.setup();
    const mapMeta = MAPS_BY_ID['jesus-palestine'];
    const { container } = render(<BibleMapSvg mapMeta={mapMeta} />);

    // 기본 상태에서 임의 이동 경로선(polyline / sequence arc)이 없어야 함
    expect(container.querySelectorAll('svg polyline, .map-sequence-arc')).toHaveLength(0);

    // 수가 선택: 복수 후보 안내 표시, 단일 확정 구글 지도 버튼 미노출
    await user.click(screen.getByRole('button', { name: '수가' }));
    expect(screen.getByText(/복수 현대 위치 후보/)).toBeInTheDocument();
    expect(screen.getAllByText(/아스카르/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/텔 발라타/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /구글 지도에서 ‘수가’ 열기/ })).not.toBeInTheDocument();

    // 사마리아 성읍 선택: 고대 지명과 현대 지명(세바스티야) 구분 및 확정 위치 제공
    await user.click(screen.getByRole('button', { name: '사마리아 성읍' }));
    expect(screen.getByText(/사마리아 성읍\(세바스테\)/)).toBeInTheDocument();
    expect(screen.getAllByText(/세바스티야/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /구글 지도에서 ‘사마리아 성읍’ 열기/ })).toBeInTheDocument();

    // 애굽 선택: 가사와 분리되어 있으며 점 마커나 단일 좌표 확정 링크가 없음
    await user.click(screen.getByRole('button', { name: '애굽' }));
    expect(screen.getByText(/가사 남서쪽 나일강 유역의 광역 지명/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /구글 지도에서 ‘애굽’ 열기/ })).not.toBeInTheDocument();
  });

  it('4. 전통적 전승 후보(시내산) 및 저작권·라이선스 출처 링크를 명확히 제공한다', async () => {
    const user = userEvent.setup();
    const exodusMap = MAPS_BY_ID['exodus-sinai'];
    render(<BibleMapSvg mapMeta={exodusMap} />);

    await user.click(screen.getByRole('button', { name: '시내산' }));
    const detailPanel = (screen
      .getByText(/이스라엘이 언약을 맺고 율법을 받은 산/)
      .closest('.map-places-panel') ?? document.body) as HTMLElement;
    expect(within(detailPanel).getByText('전통적 전승 위치 (복수 후보)')).toBeInTheDocument();
    expect(within(detailPanel).getAllByText(/제벨 무사/).length).toBeGreaterThan(0);
    expect(within(detailPanel).getAllByText(/하르 카르콤/).length).toBeGreaterThan(0);

    // 라이선스 및 출처 링크 확인
    expect(screen.getByRole('link', { name: /OpenBible\.info Bible Geocoding Data \(CC BY 4\.0\)/ })).toHaveAttribute(
      'href',
      'https://github.com/openbibleinfo/Bible-Geocoding-Data',
    );
    expect(screen.getByRole('link', { name: /Natural Earth 1:10m \(Public Domain\)/ })).toBeInTheDocument();
  });
});
