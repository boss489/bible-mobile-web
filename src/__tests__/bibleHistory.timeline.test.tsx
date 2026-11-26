import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { clearDataCaches } from '../services/dataLoader';
import {
  buildProportionalAxisTicks,
  findChapterHistoryContext,
  historicalSpanYears,
  packTimelineTracks,
  TIMELINE_ZOOM_PRESETS,
  yearToContinuous,
} from '../services/historyDataService';
import type { ChapterData, CommentaryIndex } from '../types/bible';
import type { BibleHistoryDataset } from '../types/history';

const UNLOCKED_SHA256 = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';

const REAL_HISTORY_DATASET: BibleHistoryDataset = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'public/data/history/timeline.json'), 'utf-8'),
) as BibleHistoryDataset;

const MOCK_CHAPTERS: Record<string, ChapterData> = {
  'kr:30:1': {
    translation: 'kr',
    book: 30,
    chapter: 1,
    verses: [
      {
        verse: 1,
        text: '유다 왕 웃시야의 시대 곧 이스라엘 왕 요아스의 아들 여로보암의 시대 지진 전 이년에 드고아 목자 중 아모스가 이스라엘에 대하여 이상으로 받은 말씀이라',
      },
      {
        verse: 2,
        text: '그가 이르되 여호와께서 시온에서부터 부르짖으시며 예루살렘에서부터 소리를 내시리니',
      },
    ],
    missingVerses: [],
  },
  'kr:20:1': {
    translation: 'kr',
    book: 20,
    chapter: 1,
    verses: [{ verse: 1, text: '다윗의 아들 이스라엘 왕 솔로몬의 잠언이라' }],
    missingVerses: [],
  },
  'kr:1:1': {
    translation: 'kr',
    book: 1,
    chapter: 1,
    verses: [{ verse: 1, text: '태초에 하나님이 천지를 창조하시니라' }],
    missingVerses: [],
  },
  'kr:45:1': {
    translation: 'kr',
    book: 45,
    chapter: 1,
    verses: [{ verse: 1, text: '예수 그리스도의 종 바울은 사도로 부르심을 받아' }],
    missingVerses: [],
  },
};

const EMPTY_COMMENTARY_INDEX: CommentaryIndex = {
  version: 1,
  maps: {},
  bookOverviews: {},
  chaptersWithCommentary: [],
};

describe('성경 앱 개편: 성경순 · 연대순 읽기 및 역사 연대표 요구사항 검증', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearDataCaches();
    window.scrollY = 0;
    window.location.hash = '';

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/data/history/timeline.json')) {
          return { ok: true, status: 200, json: async () => REAL_HISTORY_DATASET };
        }
        if (url.endsWith('/data/commentary/index.json')) {
          return { ok: true, status: 200, json: async () => EMPTY_COMMENTARY_INDEX };
        }
        if (url.endsWith('/data/reading-facts/index.json')) {
          return { ok: true, status: 200, json: async () => ({}) };
        }
        if (url.endsWith('/data/study/index.json')) {
          return { ok: false, status: 404, json: async () => ({}) };
        }
        const m = url.match(/\/data\/bible\/(kr|en)\/(\d+)\/(\d+)\.json$/);
        if (m) {
          const found = MOCK_CHAPTERS[`${m[1]}:${m[2]}:${m[3]}`];
          if (found) {
            return { ok: true, status: 200, json: async () => found };
          }
          // 기본 모의 장 응답
          return {
            ok: true,
            status: 200,
            json: async () => ({
              translation: m[1],
              book: Number(m[2]),
              chapter: Number(m[3]),
              verses: [{ verse: 1, text: `${m[2]}권 ${m[3]}장 1절 본문` }],
              missingVerses: [],
            }),
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      }),
    );
  });

  it('1. 시간축 수학 및 레이아웃 검증: BC/AD 사이 0년이 없고, 모든 배율에서 막대·텍스트 수평 영역이 절대 겹치지 않는다', () => {
    // BC 1년(-1)과 AD 1년(+1) 사이 간격은 2년이 아닌 정확히 1년이어야 함
    expect(yearToContinuous(-1)).toBe(0);
    expect(yearToContinuous(1)).toBe(1);
    expect(historicalSpanYears(-1, 1)).toBe(2); // BC 1년 한 해 + AD 1년 한 해 = 2개 연도
    expect(() => yearToContinuous(0)).toThrow(/0년/);

    for (const preset of TIMELINE_ZOOM_PRESETS) {
      const ticks = buildProportionalAxisTicks(preset);
      expect(ticks.some((t) => t.year === 0 || t.label.includes(' 0'))).toBe(false);
      expect(ticks.some((t) => t.year === 1 && t.label === 'AD 1')).toBe(true);

      // 모든 트랙·하위 레인(subLane) 내에서 인접 항목 간 [barX, footprintEndX] 겹침 0건 검증
      const tracks = packTimelineTracks(REAL_HISTORY_DATASET.items, preset, 'ALL');
      for (const track of tracks) {
        const byLane = new Map<number, typeof track.items>();
        for (const p of track.items) {
          const arr = byLane.get(p.subLane) ?? [];
          arr.push(p);
          byLane.set(p.subLane, arr);
        }
        for (const laneItems of byLane.values()) {
          laneItems.sort((a, b) => a.barX - b.barX);
          for (let i = 1; i < laneItems.length; i++) {
            expect(laneItems[i].barX).toBeGreaterThanOrEqual(laneItems[i - 1].footprintEndX);
          }
        }
      }
    }
  });

  it('2. 메인 화면 & 이어서 읽기 & 홈 복귀: 마지막 읽기 기록 유무에 따라 이어 읽기를 조건부 표시한다', async () => {
    window.localStorage.setItem('bible_web_v1:unlocked_hash', UNLOCKED_SHA256);
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    // 기록이 없을 때는 이어서 읽기 미표시
    expect(screen.getByText('원하는 방식으로 성경을 읽어보세요')).toBeInTheDocument();
    expect(screen.queryByText('이어서 읽기')).not.toBeInTheDocument();
    unmount();

    // 마지막 읽기 기록이 있을 때는 이어서 읽기 표시 및 즉시 이동·홈 복귀 동작
    window.localStorage.setItem(
      'bible_web_v1:last_read',
      JSON.stringify({ translation: 'kr', book: 30, chapter: 1, verse: 1 }),
    );
    render(<App />);
    const resumeBtn = screen.getByRole('button', { name: /이어서 읽기.*아모스 1:1/ });
    await user.click(resumeBtn);

    expect(await screen.findByRole('heading', { name: '아모스 1장' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '메인 홈 화면으로 이동' }));
    expect(await screen.findByText('원하는 방식으로 성경을 읽어보세요')).toBeInTheDocument();
  });

  it('3. 통합 연대표 탐색 → 인물(아모스) 선택 → 말씀 이동 → 뒤로 가기 시 확대 배율·필터·선택·스크롤 상태 복원', async () => {
    window.localStorage.setItem('bible_web_v1:unlocked_hash', UNLOCKED_SHA256);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /역사 연대표/ }));
    expect(
      await screen.findByRole('heading', { name: '연대순 읽기 · 통합 역사 연대표' }),
    ).toBeInTheDocument();

    // 확대 + 버튼 클릭 후 '선지자·사사' 유형 필터 적용
    await user.click(screen.getByRole('button', { name: '연대표 확대' }));
    expect(screen.getByText('배율: 상세')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '선지자·사사' }));

    // 스크롤 좌표 설정
    const viewport = screen.getByRole('region', { name: '좌우 스크롤 가능한 통합 역사 시간축' });
    viewport.scrollLeft = 980;

    // 아모스 막대 선택 -> 동시대 인물 및 관련 말씀 표시 확인
    const amosBar = screen.getByRole('button', { name: /^아모스,/ });
    await user.click(amosBar);

    expect(screen.getByRole('heading', { name: '아모스 · 관련 말씀' })).toBeInTheDocument();
    expect(screen.getByText('동시대 인물')).toBeInTheDocument();

    // 첫 번째 관련 말씀(아모스 1장) 클릭 -> 본문 화면으로 이동
    const passageButtons = screen.getAllByRole('button', { name: /아모스 1:1/ });
    await user.click(passageButtons[0]);

    expect(await screen.findByRole('heading', { name: '아모스 1장' })).toBeInTheDocument();
    expect(
      screen.getByText(/유다 왕 웃시야의 시대 곧 이스라엘 왕 요아스의 아들 여로보암의 시대/),
    ).toBeInTheDocument();

    // '← 연대표' 뒤로 가기 클릭 -> 배율(상세), 필터(선지자·사사), 선택(아모스), 스크롤(980) 모두 복원!
    await user.click(screen.getByRole('button', { name: '← 연대표' }));

    expect(
      await screen.findByRole('heading', { name: '연대순 읽기 · 통합 역사 연대표' }),
    ).toBeInTheDocument();
    expect(screen.getByText('배율: 상세')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '선지자·사사' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('heading', { name: '아모스 · 관련 말씀' })).toBeInTheDocument();
    const restoredViewport = screen.getByRole('region', {
      name: '좌우 스크롤 가능한 통합 역사 시간축',
    });
    expect(restoredViewport.scrollLeft).toBe(980);
  });

  it('4. 중간기 외부 역사와 서신서 작성 시기 구분: 외부 역사는 억지 성경 구절을 연결하지 않고, 서신서는 작성 시기와 관련 사건을 구분한다', async () => {
    window.localStorage.setItem('bible_web_v1:unlocked_hash', UNLOCKED_SHA256);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /역사 연대표/ }));
    await screen.findByRole('heading', { name: '연대순 읽기 · 통합 역사 연대표' });

    // 중간기 빠른 이동 후 외부 역사 사건(마카비 항쟁) 선택
    const eraNav = screen.getByRole('navigation', { name: '시대 빠른 이동' });
    await user.click(within(eraNav).getByRole('button', { name: /중간기/ }));

    const maccabeanBar = screen.getByRole('button', { name: /^마카비 항쟁,/ });
    await user.click(maccabeanBar);

    expect(screen.getByText('신구약 중간기·외부 역사')).toBeInTheDocument();
    expect(
      screen.getByText(/외부 역사 항목이므로 임의의 성경 장절을 연결하지 않습니다/),
    ).toBeInTheDocument();

    // 초대교회로 이동 후 서신 배경(로마서 작성 배경) 선택 -> '본문 작성 시기' 및 연결된 전도여행 구분 확인
    await user.click(within(eraNav).getByRole('button', { name: /초대교회/ }));
    const romansEpistleBar = screen.getByRole('button', { name: /^로마서 작성 배경,/ });
    await user.click(romansEpistleBar);

    expect(screen.getByText(/본문 작성 시기:/)).toBeInTheDocument();
    expect(screen.getByText('서신 작성·역사 배경')).toBeInTheDocument();
    expect(screen.getByText('연결된 사건 · 배경')).toBeInTheDocument();
  });

  it('5. 본문 화면 역사적 배경: 역사 배경이 있는 장(아모스 1장, 창세기 1장)에만 기본 접힘 배너를 제공하고, 비역사 지혜서(잠언 1장)에는 임의 연대를 표시하지 않는다', async () => {
    // 데이터 레벨 검증: 잠언(20), 욥기(18), 전도서(21), 아가(22), 요엘(29)은 null 반환
    expect(findChapterHistoryContext(REAL_HISTORY_DATASET, 20, 1)).toBeNull();
    expect(findChapterHistoryContext(REAL_HISTORY_DATASET, 18, 1)).toBeNull();
    expect(findChapterHistoryContext(REAL_HISTORY_DATASET, 29, 1)).toBeNull();
    // 원역사(창 1장)는 숫자 BC 연도가 없어야 함
    const gen1Ctx = findChapterHistoryContext(REAL_HISTORY_DATASET, 1, 1);
    expect(gen1Ctx?.datePrecision).toBe('undetermined');
    expect(gen1Ctx?.focusStartYear).toBeNull();
    expect(gen1Ctx?.displayPeriodKo).not.toMatch(/BC/i);

    window.localStorage.setItem('bible_web_v1:unlocked_hash', UNLOCKED_SHA256);
    window.localStorage.setItem(
      'bible_web_v1:last_read',
      JSON.stringify({ translation: 'kr', book: 30, chapter: 1, verse: 1 }),
    );
    window.location.hash = '#/read';

    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('heading', { name: '아모스 1장' })).toBeInTheDocument();

    // 기본 접힘(aria-expanded="false") 상태 확인
    const historyToggle = await screen.findByRole('button', { name: /역사적 배경.*분열왕국/ });
    expect(historyToggle).toHaveAttribute('aria-expanded', 'false');

    // 펼치면 공통 연대표 및 동시대 인물, 전체 연대표 이동 버튼이 표시됨
    await user.click(historyToggle);
    expect(historyToggle).toHaveAttribute('aria-expanded', 'true');
    const drawer = screen.getByRole('region', { name: '현재 본문의 역사적 배경' });
    expect(within(drawer).getByText('동시대 인물:')).toBeInTheDocument();
    expect(
      within(drawer).getByRole('button', { name: /전체 역사 연대표 보기/ }),
    ).toBeInTheDocument();

    // 다시 접으면 본문 읽기 상태(아모스 1장) 그대로 유지
    await user.click(historyToggle);
    expect(historyToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('heading', { name: '아모스 1장' })).toBeInTheDocument();

    // 잠언 1장으로 이동 시 '역사적 배경' 버튼 및 임의 연대가 일절 표시되지 않아야 함!
    await user.click(screen.getByRole('button', { name: /책·장·절 이동 열기/ }));
    const navDialog = screen.getByRole('dialog', { name: '책·장·절 선택' });
    await user.click(within(navDialog).getByRole('button', { name: /잠언/ }));
    await user.click(within(navDialog).getByRole('button', { name: '1' }));
    await user.click(within(navDialog).getByRole('button', { name: '1절부터 바로 읽기' }));

    expect(await screen.findByRole('heading', { name: '잠언 1장' })).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: '현재 본문의 역사적 배경' }),
    ).not.toBeInTheDocument();
  });

  it('6. 모바일 화면 최적화(1단계): 초기 진입 시 차트 시야 확보(하단 요약 바), 바텀시트 열기·확장·닫기, 기준 안내 토글, 전체화면 모드를 지원한다', async () => {
    window.localStorage.setItem('bible_web_v1:unlocked_hash', UNLOCKED_SHA256);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /역사 연대표/ }));
    await screen.findByRole('heading', { name: '연대순 읽기 · 통합 역사 연대표' });

    // 초기 진입 시 상세 바텀시트는 닫혀 있고 하단 요약 바를 통해 차트 가시 영역을 최대로 확보한다
    expect(
      screen.queryByRole('article', { name: '선택된 역사 항목 상세 정보' }),
    ).not.toBeInTheDocument();

    const peekOpenBtn = screen.getByRole('button', { name: /시대 설명 · 말씀/ });
    await user.click(peekOpenBtn);

    const detailSheet = screen.getByRole('article', { name: '선택된 역사 항목 상세 정보' });
    expect(within(detailSheet).getByRole('heading', { name: /시대 개관/ })).toBeInTheDocument();

    // 크기 전환 버튼 없이 기본 크게 열린 상태에서 닫기 동작 확인
    expect(within(detailSheet).queryByRole('button', { name: /크게|기본 높이/ })).not.toBeInTheDocument();
    await user.click(within(detailSheet).getByRole('button', { name: '상세 시트 닫기' }));
    expect(
      screen.queryByRole('article', { name: '선택된 역사 항목 상세 정보' }),
    ).not.toBeInTheDocument();

    // 상단 긴 안내문은 기본 접힘이며 'ⓘ 기준 안내' 클릭 시 펼쳐진다
    const infoToggle = screen.getByRole('button', { name: 'ⓘ 기준 안내' });
    expect(infoToggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(infoToggle);
    expect(screen.getByRole('button', { name: '기준 접기 ▴' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText(/탐색 편의를 위한 요약 배치이며/)).toBeInTheDocument();

    // '⤢ 크게 보기' 클릭 시 전체화면 클래스 및 스크롤 잠금 적용 후 종료 시 복원
    const fullscreenBtn = screen.getByRole('button', { name: '⤢ 크게 보기' });
    await user.click(fullscreenBtn);
    expect(screen.getByRole('region', { name: '통합 성경 역사 연대표' })).toHaveClass(
      'history-timeline-fullscreen',
    );
    expect(document.body.style.position).toBe('fixed');

    await user.click(screen.getByRole('button', { name: '전체화면 종료' }));
    expect(screen.getByRole('region', { name: '통합 성경 역사 연대표' })).not.toHaveClass(
      'history-timeline-fullscreen',
    );
  });

  it('7. 본문 내 역사적 배경 경량화 및 크게 열기 모달: 인라인 동시대 인물 퀵 프리뷰와 풀스크린 연대표 팝업 열기·닫기(스크롤 보존)를 지원한다', async () => {
    window.localStorage.setItem('bible_web_v1:unlocked_hash', UNLOCKED_SHA256);
    window.localStorage.setItem(
      'bible_web_v1:last_read',
      JSON.stringify({ translation: 'kr', book: 30, chapter: 1, verse: 1 }),
    );
    window.location.hash = '#/read';

    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('heading', { name: '아모스 1장' })).toBeInTheDocument();
    window.scrollY = 180;

    const historyToggle = await screen.findByRole('button', { name: /역사적 배경.*분열왕국/ });
    await user.click(historyToggle);

    const drawer = screen.getByRole('region', { name: '현재 본문의 역사적 배경' });
    // 본문 드로어 내부에는 무거운 가로 스크롤 타임라인 뷰포트가 바로 렌더링되지 않아 본문 가독성을 해치지 않음
    expect(
      within(drawer).queryByRole('region', { name: '좌우 스크롤 가능한 통합 역사 시간축' }),
    ).not.toBeInTheDocument();

    // 동시대 인물 칩 클릭 시 인라인 요약 카드 노출
    const amosChip = within(drawer).getByRole('button', { name: '아모스' });
    await user.click(amosChip);
    expect(within(drawer).getByRole('button', { name: '접기' })).toBeInTheDocument();

    // '⤢ 이 시점 연대표 크게 열기' 클릭 시 풀스크린 레이어 팝업으로 공통 연대표가 열리고 배경 스크롤이 잠긴다
    await user.click(within(drawer).getByRole('button', { name: /이 시점 연대표 크게 열기/ }));
    const modal = screen.getByRole('dialog', { name: '아모스 1장 역사 연대표 크게 보기' });
    expect(
      within(modal).getByRole('region', { name: '좌우 스크롤 가능한 통합 역사 시간축' }),
    ).toBeInTheDocument();
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-180px');

    // 팝업을 닫으면 원래 본문(아모스 1장) 상태와 스크롤이 복원된다
    await user.click(within(modal).getByRole('button', { name: '연대표 팝업 닫기' }));
    expect(
      screen.queryByRole('dialog', { name: '아모스 1장 역사 연대표 크게 보기' }),
    ).not.toBeInTheDocument();
    expect(document.body.style.position).toBe('');
    expect(screen.getByRole('heading', { name: '아모스 1장' })).toBeInTheDocument();
  });
});
