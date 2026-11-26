import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { clearDataCaches } from '../services/dataLoader';
import {
  parseScriptureQuery,
  searchBibleVerses,
  splitTextBySearchTokens,
  type BibleSearchIndexPayload,
  type IndexedSearchVerse,
} from '../services/searchService';
import type { ChapterData, CommentaryIndex } from '../types/bible';

const UNLOCKED_SHA256 = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';

const EMPTY_COMMENTARY_INDEX: CommentaryIndex = {
  version: 1,
  maps: {},
  bookOverviews: {},
  chaptersWithCommentary: [],
};

const MOCK_SEARCH_KR: BibleSearchIndexPayload = {
  version: 1,
  translation: 'kr',
  verses: [
    [1, 1, 1, '태초에 하나님이 천지를 창조하시니라'],
    [1, 1, 3, '하나님이 이르시되 빛이 있으라 하시니 빛이 있었고'],
    [19, 23, 1, '여호와는 나의 목자시니 내게 부족함이 없으리로다'],
    [43, 3, 16, '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라'],
    [46, 13, 4, '사랑은 오래 참고 사랑은 온유하며 시기하지 아니하며 사랑은 자랑하지 아니하며 교만하지 아니하며'],
  ],
};

const MOCK_SEARCH_EN: BibleSearchIndexPayload = {
  version: 1,
  translation: 'en',
  verses: [
    [1, 1, 1, 'In the beginning God created the heavens and the earth.'],
    [19, 23, 1, 'The LORD is my shepherd, I lack nothing.'],
    [43, 3, 16, 'For God so loved the world that he gave his one and only Son.'],
  ],
};

const MOCK_CHAPTERS: Record<string, ChapterData> = {
  'kr:1:1': {
    translation: 'kr',
    book: 1,
    chapter: 1,
    verses: [
      { verse: 1, text: '태초에 하나님이 천지를 창조하시니라' },
      { verse: 2, text: '땅이 혼돈하고 공허하며 흑암이 깊음 위에 있고' },
      { verse: 3, text: '하나님이 이르시되 빛이 있으라 하시니 빛이 있었고' },
    ],
    missingVerses: [],
  },
  'kr:19:23': {
    translation: 'kr',
    book: 19,
    chapter: 23,
    verses: [
      { verse: 1, text: '여호와는 나의 목자시니 내게 부족함이 없으리로다' },
      { verse: 2, text: '그가 나를 푸른 풀밭에 누이시며 쉴 만한 물 가로 인도하시는도다' },
    ],
    missingVerses: [],
  },
  'kr:43:3': {
    translation: 'kr',
    book: 43,
    chapter: 3,
    verses: Array.from({ length: 16 }, (_, idx) => ({
      verse: idx + 1,
      text:
        idx + 1 === 16
          ? '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니'
          : `요한복음 3장 ${idx + 1}절 본문`,
    })),
    missingVerses: [],
  },
  'en:19:23': {
    translation: 'en',
    book: 19,
    chapter: 23,
    verses: [{ verse: 1, text: 'The LORD is my shepherd, I lack nothing.' }],
    missingVerses: [],
  },
};

describe('성경 본문 검색 및 장절 바로가기 검증', () => {
  let fetchCalls: string[] = [];

  beforeEach(() => {
    window.localStorage.clear();
    clearDataCaches();
    window.scrollY = 0;
    window.location.hash = '';
    fetchCalls = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        fetchCalls.push(url);
        if (url.endsWith('/data/bible/search-kr.json')) {
          return { ok: true, status: 200, json: async () => MOCK_SEARCH_KR };
        }
        if (url.endsWith('/data/bible/search-en.json')) {
          return { ok: true, status: 200, json: async () => MOCK_SEARCH_EN };
        }
        if (url.endsWith('/data/commentary/index.json')) {
          return { ok: true, status: 200, json: async () => EMPTY_COMMENTARY_INDEX };
        }
        if (url.endsWith('/data/reading-facts/index.json')) {
          return { ok: true, status: 200, json: async () => ({}) };
        }
        if (url.endsWith('/data/study/index.json') || url.endsWith('/data/history/timeline.json')) {
          return { ok: false, status: 404, json: async () => ({}) };
        }
        const m = url.match(/\/data\/bible\/(kr|en)\/(\d+)\/(\d+)\.json$/);
        if (m) {
          const found = MOCK_CHAPTERS[`${m[1]}:${m[2]}:${m[3]}`];
          if (found) {
            return { ok: true, status: 200, json: async () => found };
          }
        }
        return { ok: false, status: 404, json: async () => ({}) };
      }),
    );
  });

  it('1. 장절 참조 파서 및 실제 생성된 정적 검색 색인 정합성 검증', () => {
    expect(parseScriptureQuery('요 3:16')).toMatchObject({
      book: 43,
      chapter: 3,
      verse: 16,
      isChapterOnly: false,
      labelKo: '요한복음 3:16',
    });
    expect(parseScriptureQuery('시편 23')).toMatchObject({
      book: 19,
      chapter: 23,
      verse: 1,
      isChapterOnly: true,
      labelKo: '시편 23편',
    });
    expect(parseScriptureQuery('1 Cor 13:4')).toMatchObject({
      book: 46,
      chapter: 13,
      verse: 4,
      labelEn: '1 Corinthians 13:4',
    });
    // 존재하지 않는 장·절은 null 반환
    expect(parseScriptureQuery('창세기 51:1')).toBeNull();
    expect(parseScriptureQuery('요 3:99')).toBeNull();

    // 실제 빌드된 search-kr.json 검증: 14개 (없음) 구절이 제외되고 다중 어절 AND 검색이 정확히 동작한다
    const realKrPayload = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/bible/search-kr.json'), 'utf-8'),
    ) as BibleSearchIndexPayload;
    expect(realKrPayload.verses.length).toBe(31087);
    expect(realKrPayload.verses.some(([, , , text]) => text === '(없음)')).toBe(false);

    const indexedSample: IndexedSearchVerse[] = MOCK_SEARCH_KR.verses.map(
      ([book, chapter, verse, text]) => ({
        book,
        chapter,
        verse,
        text,
        lowerText: text.toLowerCase(),
      }),
    );
    const res = searchBibleVerses(indexedSample, '여호와 목자', { scope: 'OT' });
    expect(res.totalCount).toBe(1);
    expect(res.items[0]).toMatchObject({ book: 19, chapter: 23, verse: 1 });

    const segments = splitTextBySearchTokens(res.items[0].text, res.tokens);
    expect(segments.filter((s) => s.highlighted).map((s) => s.text)).toEqual(['여호와', '목자']);
  });

  it('2. 메인 홈 검색 진입 및 지연 로딩: 검색창을 열기 전에는 색인을 받지 않으며, 검색 결과 선택 시 해당 절로 이동한다', async () => {
    window.localStorage.setItem('bible_web_v1:unlocked_hash', UNLOCKED_SHA256);
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('원하는 방식으로 성경을 읽어보세요')).toBeInTheDocument();
    // 검색창 오픈 전에는 search-kr.json 요청 0회 (초기 로딩 영향 없음)
    expect(fetchCalls.some((u) => u.includes('search-kr.json'))).toBe(false);

    await user.click(screen.getByRole('button', { name: '성경 본문 단어 및 장절 검색 열기' }));
    const dialog = screen.getByRole('dialog', { name: '성경 본문 검색' });
    expect(fetchCalls.some((u) => u.includes('search-kr.json'))).toBe(true);

    const input = within(dialog).getByLabelText('성경 본문 검색어 입력');
    await user.type(input, '여호와 목자');

    const resultBtn = await within(dialog).findByRole('button', { name: /시편 23:1/ });
    await user.click(resultBtn);

    expect(await screen.findByRole('heading', { name: '시편 23편' })).toBeInTheDocument();
    expect(screen.getByText('여호와는 나의 목자시니 내게 부족함이 없으리로다')).toBeInTheDocument();
  });

  it('3. 본문 읽기 중 검색 후 원래 본문 복귀 & 성경 목차 책 검색 결과 없음 시 본문 검색 연동', async () => {
    window.localStorage.setItem('bible_web_v1:unlocked_hash', UNLOCKED_SHA256);
    window.localStorage.setItem(
      'bible_web_v1:last_read',
      JSON.stringify({ translation: 'kr', book: 1, chapter: 1, verse: 3 }),
    );
    window.location.hash = '#/read';

    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('heading', { name: '창세기 1장' })).toBeInTheDocument();
    window.scrollY = 210;

    // 1) 리더 상단 '검색' 버튼 -> '요 3:16' 장절 바로가기 클릭 -> 이동 후 '원래 본문으로 돌아가기' 복귀
    await user.click(screen.getByRole('button', { name: '본문 검색 열기' }));
    const searchDialog = screen.getByRole('dialog', { name: '성경 본문 검색' });
    await user.type(within(searchDialog).getByLabelText('성경 본문 검색어 입력'), '요 3:16');

    const directJumpBtn = await within(searchDialog).findByRole('button', {
      name: /장절 바로가기.*요한복음 3:16/,
    });
    await user.click(directJumpBtn);

    expect(await screen.findByRole('heading', { name: '요한복음 3장' })).toBeInTheDocument();
    expect(document.getElementById('verse-16')).toHaveClass('verse-row-highlighted');

    await user.click(screen.getByRole('button', { name: '원래 본문으로 돌아가기' }));
    expect(await screen.findByRole('heading', { name: '창세기 1장' })).toBeInTheDocument();
    expect(document.getElementById('verse-3')).toHaveClass('verse-row-highlighted');

    // 2) 책·장·절 이동 시트의 책 이름 검색에 '목자' 입력 -> 일치하는 책 0개 -> 본문 전체 검색 연동 확인
    await user.click(screen.getByRole('button', { name: /책·장·절 이동 열기/ }));
    const navDialog = screen.getByRole('dialog', { name: '책·장·절 선택' });
    await user.type(within(navDialog).getByLabelText('성경 책 이름 검색'), '목자');

    const fallbackBtn = within(navDialog).getByRole('button', {
      name: /‘목자’ 본문 전체에서 검색하기/,
    });
    await user.click(fallbackBtn);

    const linkedSearchDialog = await screen.findByRole('dialog', { name: '성경 본문 검색' });
    expect(within(linkedSearchDialog).getByLabelText('성경 본문 검색어 입력')).toHaveValue('목자');
    expect(
      await within(linkedSearchDialog).findByRole('button', { name: /시편 23:1/ }),
    ).toBeInTheDocument();
  });
});
