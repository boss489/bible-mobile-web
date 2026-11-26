import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { BROWSER_STORAGE_NOTICE } from '../config/siteConfig';
import { sha256Hex } from '../services/auth';
import { clearDataCaches } from '../services/dataLoader';
import type { ChapterCommentary, ChapterData, CommentaryIndex } from '../types/bible';

const MOCK_CHAPTERS: Record<string, ChapterData> = {
  'kr:1:1': {
    translation: 'kr',
    book: 1,
    chapter: 1,
    verses: [
      { verse: 1, text: '태초에 하나님이 천지를 창조하시니라', isOmitted: false },
      { verse: 2, text: '땅이 혼돈하고 공허하며 흑암이 깊음 위에 있고', isOmitted: false },
      { verse: 3, text: '하나님이 이르시되 빛이 있으라 하시니 빛이 있었고', isOmitted: false },
    ],
    missingVerses: [],
  },
  'en:1:1': {
    translation: 'en',
    book: 1,
    chapter: 1,
    verses: [
      { verse: 1, text: 'In the beginning God created the heavens and the earth.', isOmitted: false },
      { verse: 2, text: 'Now the earth was formless and empty.', isOmitted: false },
      { verse: 3, text: 'And God said, "Let there be light," and there was light.', isOmitted: false },
    ],
    missingVerses: [],
  },
  'kr:1:2': {
    translation: 'kr',
    book: 1,
    chapter: 2,
    verses: [{ verse: 1, text: '천지와 만물이 다 이루어지니라', isOmitted: false }],
    missingVerses: [],
  },
  'kr:43:1': {
    translation: 'kr',
    book: 43,
    chapter: 1,
    verses: [
      { verse: 1, text: '태초에 말씀이 계시니라 이 말씀이 하나님과 함께 계셨으니', isOmitted: false },
      { verse: 2, text: '그가 태초에 하나님과 함께 계셨고', isOmitted: false },
      { verse: 3, text: '만물이 그로 말미암아 지은 바 되었으니', isOmitted: false },
    ],
    missingVerses: [],
  },
  'en:43:1': {
    translation: 'en',
    book: 43,
    chapter: 1,
    verses: [
      { verse: 1, text: 'In the beginning was the Word, and the Word was with God.', isOmitted: false },
    ],
    missingVerses: [],
  },
  'en:47:13': {
    translation: 'en',
    book: 47,
    chapter: 13,
    verses: [
      { verse: 13, text: 'All the saints send their greetings.', isOmitted: false },
      { verse: 14, text: 'May the grace of the Lord Jesus Christ be with you all.', isOmitted: false },
    ],
    missingVerses: [],
  },
  'kr:47:13': {
    translation: 'kr',
    book: 47,
    chapter: 13,
    verses: [
      { verse: 12, text: '거룩하게 입맞춤으로 서로 문안하라 모든 성도가 너희에게 문안하느니라', isOmitted: false },
      { verse: 13, text: '주 예수 그리스도의 은혜와 하나님의 사랑과 성령의 교통하심이 너희 무리와 함께 있을지어다', isOmitted: false },
    ],
    missingVerses: [],
  },
  'en:44:8': {
    translation: 'en',
    book: 44,
    chapter: 8,
    verses: [
      { verse: 36, text: 'Look, here is water. Why should I not be baptized?', isOmitted: false },
      { verse: 37, text: 'Philip said, If you believe with all your heart, you may.', isOmitted: false },
    ],
    missingVerses: [],
  },
  'kr:44:8': {
    translation: 'kr',
    book: 44,
    chapter: 8,
    verses: [
      { verse: 36, text: '길 가다가 물 있는 곳에 이르러 그 내시가 말하되', isOmitted: false },
      { verse: 37, text: '(없음)', isOmitted: true },
    ],
    missingVerses: [],
  },
};

const MOCK_COMMENTARY_INDEX: CommentaryIndex = {
  version: 1,
  maps: {
    'patriarchs-fertile-crescent': {
      id: 'patriarchs-fertile-crescent',
      title: '족장 시대 이동로',
      regionSummary: '우르에서 가나안까지의 개략도',
      backdropImageUrl: './assets/maps/patriarchs-fertile-crescent.jpg',
      bbox: [29.5, 28.2, 48.5, 38.4],
      license: 'CC BY 4.0 & NASA Public Domain',
      attribution: 'Sentinel-2 cloudless & NASA GIBS',
      sourceNote: 'OpenBible 지리 좌표 참고',
      stops: [
        { id: 'ur', label: '우르', lat: 30.9625, lon: 46.1031 },
        { id: 'shechem', label: '세겜', lat: 32.2136, lon: 35.2819 },
      ],
    },
  },
  bookOverviews: {
    '1': {
      book: 1,
      reviewed: true,
      statedFacts: '창세기는 천지 창조와 족장사를 다룹니다.',
      interpretations: '창조주 하나님과 언약의 출발을 보여 줍니다.',
      eraBackground: '고대 근동 배경입니다.',
      chronology: '중기 청동기 연대 논의가 있습니다.',
      mapId: 'patriarchs-fertile-crescent',
      keyVerse: {
        book: 1,
        chapter: 1,
        verseStart: 1,
        label: '창세기 1:1',
        reason: '창조 선언 구절입니다.',
      },
      sources: ['대한성서공회 창세기 서론'],
    },
  },
  chaptersWithCommentary: ['1_1'],
};

const MOCK_GEN1_COMMENTARY: ChapterCommentary = {
  book: 1,
  chapter: 1,
  summary: {
    reviewed: true,
    flow: '엿새 동안의 창조 흐름입니다.',
    statedFacts: '하나님이 말씀으로 창조하셨습니다.',
    interpretations: '만물이 하나님의 질서 아래 세워졌습니다.',
    keyVerses: [
      {
        book: 1,
        chapter: 1,
        verseStart: 1,
        label: '창세기 1:1',
        reason: '성경의 첫 선언입니다.',
      },
    ],
    sources: ['창세기 1:1–31'],
  },
  // characters는 미수록 -> 검토된 항목만 탭 노출되는지 검증!
  relatedPassages: {
    reviewed: true,
    items: [
      {
        book: 43,
        chapter: 1,
        verseStart: 1,
        verseEnd: 3,
        label: '요한복음 1:1–3',
        connectionType: '주제·신학 연결',
        reason: '태초의 말씀 창조와 연결됩니다.',
      },
    ],
  },
};

beforeEach(() => {
  window.localStorage.clear();
  clearDataCaches();
  window.scrollY = 0;
  window.location.hash = '#/read';

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/data/commentary/index.json')) {
        return { ok: true, json: async () => MOCK_COMMENTARY_INDEX };
      }
      if (url.endsWith('/data/commentary/chapters/1_1.json')) {
        return { ok: true, json: async () => MOCK_GEN1_COMMENTARY };
      }
      if (url.endsWith('/data/reading-facts/index.json')) {
        return {
          ok: true,
          json: async () => ({
            '1_2': {
              term: '천지', verse: 1, text: '본문에 등장하는 말의 짧은 설명입니다.',
              sourceUrl: 'https://bible.bskorea.or.kr/resources/study/nkt_glossary',
            },
          }),
        };
      }
      const m = url.match(/\/data\/bible\/(kr|en)\/(\d+)\/(\d+)\.json$/);
      if (m) {
        const key = `${m[1]}:${m[2]}:${m[3]}`;
        const found = MOCK_CHAPTERS[key];
        if (found) {
          return { ok: true, json: async () => found };
        }
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }),
  );
});

describe('성경 모바일 웹사이트 핵심 요구사항 검증', () => {
  it('검토된 장별 정보만 본문 가까이에 보여 주고 읽던 위치에서 해설을 연다', async () => {
    window.localStorage.setItem(
      'bible_web_v1:unlocked_hash',
      '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
    );

    const user = userEvent.setup();
    render(<App />);

    const cue = await screen.findByRole('button', { name: /이 장의 흐름.*성경의 첫 선언입니다/ });
    expect(document.getElementById('verse-1')).toContainElement(cue);
    await user.click(cue);
    expect(screen.getByRole('dialog', { name: '창세기 1장 본문 이해' })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('bible_web_v1:last_read')!).verse).toBe(1);
  });

  it('장별로 연결된 짧은 용어 설명을 해당 절 뒤에만 표시한다', async () => {
    window.localStorage.setItem(
      'bible_web_v1:unlocked_hash',
      '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
    );
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('태초에 하나님이 천지를 창조하시니라');
    await user.click(screen.getByRole('button', { name: /다음 장/ }));
    const fact = await screen.findByLabelText('천지 설명');
    expect(document.getElementById('verse-1')).toContainElement(fact);
    expect(fact).toHaveTextContent('본문에 등장하는 말의 짧은 설명입니다.');
  });

  it('1. 공용 비밀번호 검증: 오입력 시 재입력 가능하며, 정답 입력 시 메인 화면으로 진입해 성경순 목차로 창세기 1장을 연다', async () => {
    window.location.hash = '';
    expect(sha256Hex('1234')).toBe(
      '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
    );

    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByLabelText('공용 비밀번호');
    await user.type(input, 'wrong-pw');
    await user.click(screen.getByRole('button', { name: '성경 읽기 시작' }));

    expect(screen.getByRole('alert')).toHaveTextContent('비밀번호가 일치하지 않습니다');

    await user.type(screen.getByLabelText('공용 비밀번호'), '1234');
    await user.click(screen.getByRole('button', { name: '성경 읽기 시작' }));

    // 인증 성공 후 메인 화면 진입 확인 (두 읽기 경로 동등 제공)
    expect(await screen.findByText('원하는 방식으로 성경을 읽어보세요')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '성경순 읽기' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '연대순 읽기' })).toBeInTheDocument();

    // 성경순 읽기 -> 성경 목차 -> 창세기 1장 1절부터 바로 읽기
    await user.click(screen.getByRole('button', { name: /성경 목차/ }));
    await user.click(screen.getByRole('button', { name: /창세기/ }));
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '1절부터 바로 읽기' }));

    expect(await screen.findByText('태초에 하나님이 천지를 창조하시니라')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '창세기 1장' })).toBeInTheDocument();
    // 해설은 독자가 선택하기 전에는 노출되지 않는다
    expect(screen.queryByText('엿새 동안의 창조 흐름입니다.')).not.toBeInTheDocument();
  });

  it('2. 이어 읽기 & 번역본 전환 절 차이 안내: 고후 13:14(NIV)에서 개역개정 전환 시 차이를 안내하고 인접 절(13절)을 표시한다', async () => {
    window.localStorage.setItem(
      'bible_web_v1:unlocked_hash',
      '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
    );
    window.localStorage.setItem(
      'bible_web_v1:last_read',
      JSON.stringify({ translation: 'en', book: 47, chapter: 13, verse: 14 }),
    );

    const user = userEvent.setup();
    render(<App />);

    expect(
      await screen.findByText('May the grace of the Lord Jesus Christ be with you all.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '개역개정' }));

    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent('14절 번호가 없어 같은 장의 인접 구절(13절)을 표시합니다');
    expect(
      screen.getByText(
        '주 예수 그리스도의 은혜와 하나님의 사랑과 성령의 교통하심이 너희 무리와 함께 있을지어다',
      ),
    ).toBeInTheDocument();
  });

  it('3. 사본상 (없음) 구절 번역본 전환 안내: 행 8:37(NIV)에서 개역개정 전환 시 (없음) 안내 및 인접 36절을 표시한다', async () => {
    window.localStorage.setItem(
      'bible_web_v1:unlocked_hash',
      '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
    );
    window.localStorage.setItem(
      'bible_web_v1:last_read',
      JSON.stringify({ translation: 'en', book: 44, chapter: 8, verse: 37 }),
    );

    const user = userEvent.setup();
    render(<App />);

    expect(
      await screen.findByText('Philip said, If you believe with all your heart, you may.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '개역개정' }));

    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent("37절 본문이 '(없음)'으로 표기되어 있어 같은 장의 인접 구절(36절)");
  });

  it('4. 해설 레이어 팝업: 검토된 항목만 표시, 배경 스크롤 잠금, 관련 구절 미리보기 시 이어읽기 미갱신, 장 전체 이동 후 원래 번역본·절 복귀', async () => {
    window.localStorage.setItem(
      'bible_web_v1:unlocked_hash',
      '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
    );

    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('태초에 하나님이 천지를 창조하시니라')).toBeInTheDocument();

    // 3절을 선택해 현재 읽던 절을 창세기 1:3(개역개정)으로 설정
    await user.click(screen.getByRole('button', { name: /3절 선택/ }));
    expect(JSON.parse(window.localStorage.getItem('bible_web_v1:last_read')!)).toEqual({
      translation: 'kr',
      book: 1,
      chapter: 1,
      verse: 3,
    });

    window.scrollY = 240;
    await user.click(screen.getByRole('button', { name: /본문 이해/ }));

    // 배경 본문 스크롤 고정 확인
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-240px');

    const dialog = screen.getByRole('dialog', { name: '창세기 1장 본문 이해' });
    // 검토 완료된 장별 요약·관련 장절·창세기 개관은 표시되고, 미검토/미수록 인물 설명 탭은 없어야 함
    expect(within(dialog).getByRole('tab', { name: '장별 요약' })).toBeInTheDocument();
    expect(within(dialog).getByRole('tab', { name: '관련 장절' })).toBeInTheDocument();
    expect(within(dialog).getByRole('tab', { name: '창세기 개관' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('tab', { name: '인물 설명' })).not.toBeInTheDocument();

    // 관련 장절 탭 -> 팝업에서 미리 읽기
    await user.click(within(dialog).getByRole('tab', { name: '관련 장절' }));
    await user.click(within(dialog).getByRole('button', { name: '팝업에서 미리 읽기' }));

    expect(
      await within(dialog).findByText('태초에 말씀이 계시니라 이 말씀이 하나님과 함께 계셨으니'),
    ).toBeInTheDocument();

    // 중요: 팝업에서 미리 보는 동안 '이어서 읽기' 위치(창 1:3)는 갱신되지 않아야 함!
    expect(JSON.parse(window.localStorage.getItem('bible_web_v1:last_read')!)).toEqual({
      translation: 'kr',
      book: 1,
      chapter: 1,
      verse: 3,
    });

    // '해당 장 전체 읽기' 클릭 -> 요한복음 1장으로 이동
    const readFullButtons = within(dialog).getAllByRole('button', { name: /해당 장 전체 읽기/ });
    await user.click(readFullButtons[0]);

    expect(await screen.findByRole('heading', { name: '요한복음 1장' })).toBeInTheDocument();
    // 요한복음 1장에서 번역본을 NIV로 바꿔 보더라도
    await user.click(screen.getByRole('button', { name: 'NIV' }));
    expect(
      await screen.findByText('In the beginning was the Word, and the Word was with God.'),
    ).toBeInTheDocument();

    // '원래 본문으로 돌아가기' 선택 시 출발했던 번역본(개역개정)과 구절(창세기 1:3)로 복귀!
    await user.click(screen.getByRole('button', { name: '원래 본문으로 돌아가기' }));
    expect(await screen.findByRole('heading', { name: '창세기 1장' })).toBeInTheDocument();
    expect(screen.getByText('하나님이 이르시되 빛이 있으라 하시니 빛이 있었고')).toBeInTheDocument();
    expect(document.getElementById('verse-3')).toHaveClass('verse-row-highlighted');
  });

  it('5. 개인 읽기 기록: 책갈피와 밑줄 개별 추가/해제, 본문 밑줄 표시, 내 기록 안내 문구 및 저장 당시 번역본 이동', async () => {
    window.localStorage.setItem(
      'bible_web_v1:unlocked_hash',
      '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
    );

    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('태초에 하나님이 천지를 창조하시니라')).toBeInTheDocument();

    // NIV로 전환 후 창세기 1:2에 밑줄만 추가
    await user.click(screen.getByRole('button', { name: 'NIV' }));
    expect(await screen.findByText('Now the earth was formless and empty.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /2절 선택/ }));
    await user.click(screen.getByRole('button', { name: '밑줄 긋기' }));

    const verse2Span = screen.getByText('Now the earth was formless and empty.');
    expect(verse2Span).toHaveAttribute('data-underlined', 'true');
    // 책갈피는 아직 추가하지 않았으므로 독립 동작 확인
    expect(screen.getByRole('button', { name: '책갈피 추가' })).toBeInTheDocument();

    // 다시 개역개정 창세기 2장으로 이동
    await user.click(screen.getByRole('button', { name: '개역개정' }));
    await waitFor(() =>
      expect(screen.getByText('태초에 하나님이 천지를 창조하시니라')).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /다음 장/ }));
    expect(await screen.findByText('천지와 만물이 다 이루어지니라')).toBeInTheDocument();

    // 내 기록 열기 -> 필수 안내 문구 원문 확인 -> 밑줄 탭에서 항목 클릭 시 저장 당시 번역본(NIV)과 창 1:2로 이동!
    await user.click(screen.getByRole('button', { name: /내 기록 열기/ }));
    const recordsDialog = screen.getByRole('dialog', { name: '내 기록' });
    expect(within(recordsDialog).getByText(BROWSER_STORAGE_NOTICE)).toBeInTheDocument();

    await user.click(within(recordsDialog).getByRole('tab', { name: /밑줄 \(1\)/ }));
    await user.click(within(recordsDialog).getByRole('button', { name: /Genesis 1:2/ }));

    expect(await screen.findByRole('heading', { name: 'Genesis 1' })).toBeInTheDocument();
    expect(screen.getByText('Now the earth was formless and empty.')).toBeInTheDocument();
  });

  it('6. 책·장·절 직접 이동 및 글자 크기 변경 시 읽던 절 화면 위치 보정(Scroll Anchoring)', async () => {
    window.localStorage.setItem(
      'bible_web_v1:unlocked_hash',
      '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
    );

    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('태초에 하나님이 천지를 창조하시니라')).toBeInTheDocument();

    // 3절 선택 후 글자 크기 변경 시 레이아웃 확장에 따른 스크롤 보정 확인
    await user.click(screen.getByRole('button', { name: /3절 선택/ }));
    const verse3El = document.getElementById('verse-3')!;
    let simulatedTop = 120;
    vi.spyOn(verse3El, 'getBoundingClientRect').mockImplementation(() => ({
      top: simulatedTop,
      bottom: simulatedTop + 48,
      left: 0,
      right: 360,
      width: 360,
      height: 48,
      x: 0,
      y: simulatedTop,
      toJSON: () => ({}),
    }));

    window.scrollY = 300;
    await user.click(screen.getByRole('button', { name: '글자 크기 조절' }));

    // 글자가 커져서 리플로우 후 3절의 Y좌표가 +140px 아래로 밀린 상황을 시뮬레이션
    const origGetRect = verse3El.getBoundingClientRect;
    let callCount = 0;
    vi.spyOn(verse3El, 'getBoundingClientRect').mockImplementation(() => {
      callCount += 1;
      simulatedTop = callCount === 1 ? 120 : 260;
      return origGetRect.call(verse3El);
    });

    await user.click(screen.getByRole('button', { name: '5단계' }));
    expect(window.scrollTo).toHaveBeenCalledWith(0, 440);

    // 책·장·절 선택기를 열어 요한복음 1장 3절로 직접 이동
    await user.click(screen.getByRole('button', { name: /책·장·절 이동 열기/ }));
    const navDialog = screen.getByRole('dialog', { name: '책·장·절 선택' });
    await user.click(within(navDialog).getByRole('button', { name: /요한복음/ }));
    await user.click(within(navDialog).getByRole('button', { name: '1' }));
    await user.click(within(navDialog).getByRole('button', { name: '3' }));

    expect(await screen.findByRole('heading', { name: '요한복음 1장' })).toBeInTheDocument();
    expect(screen.getByText('만물이 그로 말미암아 지은 바 되었으니')).toBeInTheDocument();
    expect(document.getElementById('verse-3')).toHaveClass('verse-row-highlighted');
  });

  it('7. 실제 위성 지도에서 전체 권역 및 개별 성경 지명을 구글 지도(새 창)로 연결한다', async () => {
    window.localStorage.setItem(
      'bible_web_v1:unlocked_hash',
      '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
    );

    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('태초에 하나님이 천지를 창조하시니라')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /본문 이해/ }));

    const dialog = screen.getByRole('dialog', { name: '창세기 1장 본문 이해' });
    await user.click(within(dialog).getByRole('tab', { name: '창세기 개관' }));

    const regionLink = within(dialog).getByRole('link', { name: /구글 위성지도로 열기/ });
    expect(regionLink).toHaveAttribute('target', '_blank');
    expect(regionLink.getAttribute('href')).toContain(
      'https://www.google.com/maps/@?api=1&map_action=map',
    );
    expect(regionLink.getAttribute('href')).toContain('basemap=satellite');

    await user.click(within(dialog).getByRole('button', { name: '세겜' }));
    const stopLink = within(dialog).getByRole('link', { name: /구글 지도에서 ‘세겜’ 열기/ });
    expect(stopLink).toHaveAttribute('target', '_blank');
    expect(stopLink).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=32.2136,35.2819',
    );
  });
});
