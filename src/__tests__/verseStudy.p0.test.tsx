import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { BibleMapSvg, projectMapPoint } from '../components/CommentarySheet/BibleMapSvg';
import { clearDataCaches } from '../services/dataLoader';
import { StaticStudyDataRepository } from '../services/studyDataService';
import { buildTranslationComparison } from '../services/versification';
import type {
  BookStudyBundle,
  ChapterData,
  CommentaryIndex,
  CrossReferenceItem,
  StudyIndex,
} from '../types/bible';
import {
  filterAndSortCrossReferences,
  formatCanonicalVerseId,
  isValidCanonicalVerseId,
  parseCanonicalVerseId,
} from '../utils/verseId';

const UNLOCKED_SHA256 = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';

const MOCK_AMOS_CHAPTERS: Record<string, ChapterData> = {
  'kr:30:7': {
    translation: 'kr',
    book: 30,
    chapter: 7,
    verses: [
      {
        verse: 9,
        text: '이삭의 산당들이 황폐되며 이스라엘의 성소들이 파괴될 것이라 내가 일어나 칼로 여로보암의 집을 치리라 하시니라',
        isOmitted: false,
      },
      {
        verse: 15,
        text: '양 떼를 따를 때에 여호와께서 나를 데려다가 여호와께서 내게 이르시기를 가서 내 백성 이스라엘에게 예언하라 하셨나니',
        isOmitted: false,
      },
      {
        verse: 16,
        text: '이제 너는 여호와의 말씀을 들을지니라 네가 이르기를 이스라엘에 대하여 예언하지 말며 이삭의 집을 향하여 경고하지 말라 하므로',
        isOmitted: false,
      },
      {
        verse: 17,
        text: '여호와께서 이와 같이 말씀하시기를 네 아내는 성읍 가운데서 창녀가 될 것이요 이스라엘은 반드시 사로잡혀 그의 땅에서 떠나리라 하셨느니라',
        isOmitted: false,
      },
    ],
    missingVerses: [],
  },
  'en:30:7': {
    translation: 'en',
    book: 30,
    chapter: 7,
    verses: [
      {
        verse: 9,
        text: '"The high places of Isaac will be destroyed and the sanctuaries of Israel will be ruined; with my sword I will rise against the house of Jeroboam."',
        isOmitted: false,
      },
      {
        verse: 15,
        text: "But the LORD took me from tending the flock and said to me, 'Go, prophesy to my people Israel.'",
        isOmitted: false,
      },
      {
        verse: 16,
        text: 'Now then, hear the word of the LORD. You say, "\'Do not prophesy against Israel, and stop preaching against the house of Isaac.\'',
        isOmitted: false,
      },
      {
        verse: 17,
        text: '"Therefore this is what the LORD says: Israel will certainly go into exile, away from their native land."',
        isOmitted: false,
      },
    ],
    missingVerses: [],
  },
  'kr:30:2': {
    translation: 'kr',
    book: 30,
    chapter: 2,
    verses: [
      {
        verse: 11,
        text: '또 너희 아들 중에서 선지자를, 너희 청년 중에서 나실인을 일으켰나니',
        isOmitted: false,
      },
      {
        verse: 12,
        text: '그러나 너희가 나실 사람으로 포도주를 마시게 하며 또 선지자에게 명령하여 예언하지 말라 하였느니라',
        isOmitted: false,
      },
    ],
    missingVerses: [],
  },
  'en:30:2': {
    translation: 'en',
    book: 30,
    chapter: 2,
    verses: [
      {
        verse: 12,
        text: '"But you made the Nazirites drink wine and commanded the prophets not to prophesy.',
        isOmitted: false,
      },
    ],
    missingVerses: [],
  },
};

const MOCK_STUDY_INDEX: StudyIndex = {
  contentVersion: 'study-v1',
  sources: {
    'biblical-internal-text': {
      id: 'biblical-internal-text',
      title: '성경 본문 내 직접 인용·문맥 대조',
      license: 'Internal Editorial Commentary',
      attribution: '보유 역본 직접 대조 검수',
      version: '2026.11-v1',
    },
  },
  booksWithStudy: [30],
  studyVersesByChapter: {
    '30_7': [15, 16],
  },
};

const MOCK_AMOS_STUDY_BUNDLE: BookStudyBundle = {
  book: 30,
  osis: 'AMOS',
  contentVersion: 'study-v1',
  crossReferencesByVerse: {
    'AMOS.7.15': [
      {
        sourceVerseId: 'AMOS.7.15',
        targetVerseId: 'AMOS.3.8',
        targetLabelKo: '아모스 3:8',
        relationType: 'CONTEXT',
        reason: '15절 지연 응답 테스트용 문맥 연결 데이터입니다 (빠른 전환 시 노출 금지 검증).',
        evidenceVerseIds: ['AMOS.3.8', 'AMOS.7.15'],
        sourceIds: ['biblical-internal-text'],
        reviewStatus: 'VERIFIED',
      },
    ],
    'AMOS.7.16': [
      {
        sourceVerseId: 'AMOS.7.16',
        targetVerseId: 'AMOS.7.9',
        targetLabelKo: '아모스 7:9',
        relationType: 'CONTEXT',
        reason:
          "같은 장 다림줄 환상(7:9)에서 '이삭의 산당들'과 '이스라엘의 성소들'이 함께 선포된 문맥이 이어집니다.",
        evidenceVerseIds: ['AMOS.7.9', 'AMOS.7.16'],
        sourceIds: ['biblical-internal-text'],
        reviewStatus: 'VERIFIED',
      },
      {
        sourceVerseId: 'AMOS.7.16',
        targetVerseId: 'AMOS.2.12',
        targetLabelKo: '아모스 2:12',
        relationType: 'CONTEXT',
        reason:
          "선지자에게 '예언하지 말라'고 명령하던 이스라엘의 죄악(2:12)이 아마샤의 금지 행위로 재현됩니다.",
        evidenceVerseIds: ['AMOS.2.12', 'AMOS.7.16'],
        sourceIds: ['biblical-internal-text'],
        reviewStatus: 'VERIFIED',
      },
    ],
  },
  passageContexts: [
    {
      passageId: 'AMOS.7.10-17',
      book: 30,
      chapter: 7,
      verseStart: 10,
      verseEnd: 17,
      title: '벧엘 제사장 아마샤의 예언 금지와 아모스의 소명 변증',
      summary: '아마샤의 추방 명령에 맞서 아모스가 하나님의 소명과 심판 말씀을 전합니다.',
      statedFacts: '아마샤가 벧엘에서 예언하지 말라 하매 아모스가 소명을 밝히고 심판을 선포합니다.',
      speaker: '선지자 아모스',
      audience: '벧엘 제사장 아마샤',
      historicalSituation: '여로보암 2세 시대 북이스라엘 왕립 성소 벧엘',
      flow: '다림줄 환상(7:7–9) → 아마샤와의 충돌(7:10–17)',
      expressions: [
        {
          term: '이삭의 집',
          verse: 16,
          meaning: '북이스라엘 백성 공동체를 가리키는 병행 표현입니다.',
          basisType: 'STATED_FACT',
        },
      ],
      evidenceVerseIds: ['AMOS.7.9', 'AMOS.7.16'],
      sourceIds: ['biblical-internal-text'],
      reviewStatus: 'VERIFIED',
    },
  ],
  translationNotesByVerse: {
    'AMOS.7.16': [
      {
        verseId: 'AMOS.7.16',
        krPhrase: '이삭의 집을 향하여 경고하지 말라',
        enPhrase: 'stop preaching against the house of Isaac',
        explanation: "두 역본 모두 '이삭의 집(the house of Isaac)' 표현을 유지합니다.",
        sourceIds: ['biblical-internal-text'],
        reviewStatus: 'VERIFIED',
      },
    ],
  },
};

const MOCK_COMM_INDEX: CommentaryIndex = {
  version: 1,
  maps: {},
  bookOverviews: {
    '30': {
      book: 30,
      reviewed: true,
      statedFacts: '아모스서는 남유다 드고아 목자 아모스가 북이스라엘에 선포한 공의의 예언서입니다.',
      interpretations: '참된 예배는 공의와 정의의 실천과 분리될 수 없음을 강조합니다.',
      eraBackground: '여로보암 2세 번영기입니다.',
      chronology: '주전 8세기 중엽입니다.',
      keyVerse: {
        book: 30,
        chapter: 5,
        verseStart: 24,
        label: '아모스 5:24',
        reason: '아모스서의 핵심 구절입니다.',
      },
      sources: ['아모스 1:1, 5:24'],
    },
  },
  chaptersWithCommentary: [],
};

describe('P0 단위 검증: 공통 구절 ID · 관주 필터 · 역본 의미 정렬', () => {
  it('1. 표준 구절 ID 양방향 변환·별칭 정규화 및 잘못된 권/장/절 범위 즉시 차단', () => {
    expect(formatCanonicalVerseId(30, 7, 16)).toBe('AMOS.7.16');
    expect(formatCanonicalVerseId(43, 1, 1, 3)).toBe('JOHN.1.1-3');

    // USFM 3글자 별칭도 표준 OSIS 코드로 정규화
    const parsedAlias = parseCanonicalVerseId('AMO.7.16');
    expect(parsedAlias?.canonicalId).toBe('AMOS.7.16');
    expect(parsedAlias?.book).toBe(30);

    // 존재하지 않는 절(아모스 7장은 17절까지), 장(아모스 10장 없음), 권 차단
    expect(isValidCanonicalVerseId('AMOS.7.18')).toBe(false);
    expect(isValidCanonicalVerseId('AMOS.10.1')).toBe(false);
    expect(isValidCanonicalVerseId('FAKE.1.1')).toBe(false);
    expect(isValidCanonicalVerseId('AMOS.7.16-14')).toBe(false);
  });

  it('2. 관련 말씀(F02) 필터: 미검수·자기참조·중복·무관 후보를 차단하고 직접성 순으로 최대 5개만 정렬', () => {
    const candidates: CrossReferenceItem[] = [
      {
        sourceVerseId: 'MATT.4.4',
        targetVerseId: 'MATT.4.3-5', // 자기 자신 포함 -> 제외 대상
        targetLabelKo: '마태복음 4:3–5',
        relationType: 'CONTEXT',
        reason: '자기 자신을 포함하는 범위 구절이므로 제외되어야 합니다.',
        evidenceVerseIds: ['MATT.4.4'],
        sourceIds: ['s1'],
        reviewStatus: 'VERIFIED',
      },
      {
        sourceVerseId: 'MATT.4.4',
        targetVerseId: 'GEN.18.5', // 미검수 -> 제외 대상
        targetLabelKo: '창세기 18:5',
        relationType: 'THEME',
        reason: '단순히 떡이라는 단어가 등장하는 미검수 후보입니다.',
        evidenceVerseIds: ['GEN.18.5'],
        sourceIds: ['s1'],
        reviewStatus: 'UNREVIEWED',
      },
      {
        sourceVerseId: 'MATT.4.4',
        targetVerseId: 'JOHN.6.35',
        targetLabelKo: '요한복음 6:35',
        relationType: 'THEME',
        reason: '생명의 떡이신 예수님에 관한 신학적 주제 연결입니다.',
        evidenceVerseIds: ['JOHN.6.35'],
        sourceIds: ['s1'],
        reviewStatus: 'VERIFIED',
      },
      {
        sourceVerseId: 'MATT.4.4',
        targetVerseId: 'DEUT.8.3',
        targetLabelKo: '신명기 8:3',
        relationType: 'DIRECT_QUOTE',
        reason: '예수님께서 광야 첫 시험에서 직접 인용하신 구약 원문입니다.',
        evidenceVerseIds: ['MATT.4.4', 'DEUT.8.3'],
        sourceIds: ['s1'],
        reviewStatus: 'VERIFIED',
      },
      {
        sourceVerseId: 'MATT.4.4',
        targetVerseId: 'DEUT.8.3', // 중복 -> 제외 대상
        targetLabelKo: '신명기 8:3',
        relationType: 'CONTEXT',
        reason: '중복 등록된 동일 대상 구절이므로 한 번만 노출되어야 합니다.',
        evidenceVerseIds: ['DEUT.8.3'],
        sourceIds: ['s1'],
        reviewStatus: 'VERIFIED',
      },
      {
        sourceVerseId: 'MATT.4.4',
        targetVerseId: 'AMOS.99.1', // 존재하지 않는 장 -> 제외 대상
        targetLabelKo: '잘못된 구절',
        relationType: 'DIRECT_QUOTE',
        reason: '존재하지 않는 성경 장 번호를 가리키는 잘못된 참조입니다.',
        evidenceVerseIds: ['MATT.4.4'],
        sourceIds: ['s1'],
        reviewStatus: 'VERIFIED',
      },
    ];

    const filtered = filterAndSortCrossReferences('MATT.4.4', candidates, 5);
    expect(filtered.map((x) => x.targetVerseId)).toEqual(['DEUT.8.3', 'JOHN.6.35']);
    expect(filtered[0].relationType).toBe('DIRECT_QUOTE');
  });

  it('3. 역본 대조(F04) 의미 정렬: 고후 13:13↔NIV 13:14, 요삼 1:15↔NIV 1:14, 행 8:37 (없음), 겔 16:63 누락 처리', () => {
    const kr2Cor13: ChapterData = {
      translation: 'kr',
      book: 47,
      chapter: 13,
      verses: [
        { verse: 11, text: '마지막으로 말하노니... 거룩하게 입맞춤으로 서로 문안하라' },
        { verse: 12, text: '모든 성도가 너희에게 문안하느니라' },
        { verse: 13, text: '주 예수 그리스도의 은혜와 하나님의 사랑과...' },
      ],
      missingVerses: [],
    };
    const en2Cor13: ChapterData = {
      translation: 'en',
      book: 47,
      chapter: 13,
      verses: [
        { verse: 11, text: 'Finally, brothers, good-by...' },
        { verse: 12, text: 'Greet one another with a holy kiss.' },
        { verse: 13, text: 'All the saints send their greetings.' },
        { verse: 14, text: 'May the grace of the Lord Jesus Christ...' },
      ],
      missingVerses: [],
    };

    // 개역개정 13:13(축도) 조회 시 NIV 13:13(문안)이 아니라 NIV 13:14(축도)와 정확히 짝지어져야 함!
    const benedictionCmp = buildTranslationComparison({
      book: 47,
      chapter: 13,
      verse: 13,
      activeTranslation: 'kr',
      krChapter: kr2Cor13,
      enChapter: en2Cor13,
    });
    expect(benedictionCmp.krLabel).toBe('고린도후서 13:13');
    expect(benedictionCmp.enLabel).toBe('2 Corinthians 13:14');
    expect(benedictionCmp.enVerses[0].text).toContain('May the grace of the Lord Jesus Christ');
    expect(benedictionCmp.alignmentKind).toBe('VERSE_SPLIT_SHIFT');

    // 요한삼서 1:15(개역개정) 조회 시 NIV 1:14 통합 절과 대조
    const kr3Jn: ChapterData = {
      translation: 'kr',
      book: 64,
      chapter: 1,
      verses: [
        { verse: 14, text: '속히 보기를 바라노니 또한 우리가 대면하여 말하리라' },
        { verse: 15, text: '평강이 네게 있을지어다 여러 친구가 네게 문안하느니라' },
      ],
      missingVerses: [],
    };
    const en3Jn: ChapterData = {
      translation: 'en',
      book: 64,
      chapter: 1,
      verses: [
        { verse: 14, text: 'I hope to see you soon... Peace to you. The friends here send their greetings.' },
      ],
      missingVerses: [],
    };
    const jn3Cmp = buildTranslationComparison({
      book: 64,
      chapter: 1,
      verse: 15,
      activeTranslation: 'kr',
      krChapter: kr3Jn,
      enChapter: en3Jn,
    });
    expect(jn3Cmp.krLabel).toBe('요한삼서 1:14–15');
    expect(jn3Cmp.enLabel).toBe('3 John 1:14');
    expect(jn3Cmp.krVerses).toHaveLength(2);
    expect(jn3Cmp.enVerses).toHaveLength(1);
  });

  it('3-1. 강조 지명은 출처 없는 직선 경로로 연결하지 않는다', () => {
    expect(projectMapPoint(29.2, 32.8, [32.8, 29.2, 50.2, 38.2])).toEqual({ x: 0, y: 220 });
    expect(projectMapPoint(38.2, 50.2, [32.8, 29.2, 50.2, 38.2])).toEqual({ x: 360, y: 0 });
    const sampleMap = {
      id: 'canaan-kingdoms',
      title: '남북왕국과 제국 권역 2D 지도',
      regionSummary: '현대 국경 기반 2D 지도',
      backdropImageUrl: './assets/maps/canaan-kingdoms.jpg',
      bbox: [32.8, 29.2, 50.2, 38.2],
      license: 'ODbL · CC BY 4.0',
      attribution: 'OpenStreetMap · CARTO · Natural Earth',
      sourceNote: 'OpenBible',
      stops: [
        { id: 'jerusalem', label: '예루살렘', lat: 31.7767, lon: 35.2345 },
        { id: 'babylon', label: '바벨론', lat: 32.5364, lon: 44.4208 },
      ],
    };

    const { container: regionalContainer, unmount } = render(
      <BibleMapSvg mapMeta={sampleMap} />,
    );
    expect(regionalContainer.querySelectorAll('polyline')).toHaveLength(0);
    expect(regionalContainer.querySelectorAll('.map-stop-order')).toHaveLength(0);
    expect(screen.getByRole('button', { name: '지명 숨기기' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /구글 위성지도로 열기/ })).toBeInTheDocument();
    unmount();

    const { container: routeContainer } = render(
      <BibleMapSvg
        mapMeta={sampleMap}
        highlightStops={['jerusalem', 'babylon']}
      />,
    );
    expect(routeContainer.querySelectorAll('polyline')).toHaveLength(0);
    expect(routeContainer.querySelectorAll('.map-stop-order')).toHaveLength(0);
    expect(screen.getByRole('button', { name: '지명 숨기기' })).toBeInTheDocument();
  });
});

describe('P0 실제 빌드 산출물 콘텐츠 품질 검수 및 응답 성능 검증', () => {
  const studyOutDir = path.resolve(process.cwd(), 'public/data/study');
  const indexPath = path.join(studyOutDir, 'index.json');

  it('4. 배포용 public/data/study 산출물의 모든 구절 ID가 실재하며 명세 핵심 검증 세트(암 7:16, 마 4:4 등)를 충족한다', () => {
    expect(fs.existsSync(indexPath)).toBe(true);
    const studyIdx = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as StudyIndex;
    expect(studyIdx.booksWithStudy.length).toBeGreaterThanOrEqual(8);

    const seenRelations = new Set<string>();

    for (const bookNum of studyIdx.booksWithStudy) {
      const bundlePath = path.join(studyOutDir, 'books', `${bookNum}.json`);
      expect(fs.existsSync(bundlePath)).toBe(true);
      const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf-8')) as BookStudyBundle;

      for (const [srcId, items] of Object.entries(bundle.crossReferencesByVerse)) {
        expect(isValidCanonicalVerseId(srcId)).toBe(true);
        expect(items.length).toBeLessThanOrEqual(5);
        for (const item of items) {
          expect(item.reviewStatus).toBe('VERIFIED');
          expect(isValidCanonicalVerseId(item.targetVerseId)).toBe(true);
          expect(item.reason.length).toBeGreaterThanOrEqual(15);
          seenRelations.add(item.relationType);
          for (const evId of item.evidenceVerseIds) {
            expect(isValidCanonicalVerseId(evId)).toBe(true);
          }
        }
      }

      for (const pc of bundle.passageContexts) {
        expect(pc.reviewStatus).toBe('VERIFIED');
        expect(isValidCanonicalVerseId(pc.passageId)).toBe(true);
      }
    }

    // 핵심 4대 관계 유형(직접 인용, 예언·성취, 병행 사건, 문맥 연결) 모두 검수 세트에 포함됨을 검증
    expect(seenRelations.has('DIRECT_QUOTE')).toBe(true);
    expect(seenRelations.has('PROPHECY_FULFILLMENT')).toBe(true);
    expect(seenRelations.has('PARALLEL_EVENT')).toBe(true);
    expect(seenRelations.has('CONTEXT')).toBe(true);

    // 아모스 7:16 골든 케이스 검증 (단순 '이삭' 단어 일치인 창 21:3 등은 포함되지 않아야 함)
    const amosBundle = JSON.parse(
      fs.readFileSync(path.join(studyOutDir, 'books', '30.json'), 'utf-8'),
    ) as BookStudyBundle;
    const amos716Targets = amosBundle.crossReferencesByVerse['AMOS.7.16'].map(
      (r) => r.targetVerseId,
    );
    expect(amos716Targets).toContain('AMOS.7.9');
    expect(amos716Targets).toContain('AMOS.2.12');
    expect(amos716Targets).not.toContain('GEN.21.3');
  });

  it('5. 정적 탐구 리포지토리 조회 성능 측정: p95 500ms 목표를 여유 있게 충족한다', async () => {
    clearDataCaches();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/data/study/index.json')) {
          return { ok: true, status: 200, json: async () => MOCK_STUDY_INDEX };
        }
        if (url.endsWith('/data/study/books/30.json')) {
          return { ok: true, status: 200, json: async () => MOCK_AMOS_STUDY_BUNDLE };
        }
        const m = url.match(/\/data\/bible\/(kr|en)\/(\d+)\/(\d+)\.json$/);
        if (m) {
          const found = MOCK_AMOS_CHAPTERS[`${m[1]}:${m[2]}:${m[3]}`];
          if (found) return { ok: true, status: 200, json: async () => found };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      }),
    );

    const repo = new StaticStudyDataRepository();
    const durations: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      const res = await repo.getVerseStudy({
        book: 30,
        chapter: 7,
        verse: 16,
        activeTranslation: 'kr',
      });
      durations.push(performance.now() - t0);
      expect(res.verseId).toBe('AMOS.7.16');
    }
    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(durations.length * 0.95)];
    expect(p95).toBeLessThan(500);
  });
});

describe('P0 통합 및 E2E 사용자 동선 검증 (F01 ~ F04)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearDataCaches();
    window.scrollY = 0;
    window.location.hash = '#/read';
    window.localStorage.setItem('bible_web_v1:unlocked_hash', UNLOCKED_SHA256);
    window.localStorage.setItem(
      'bible_web_v1:last_read',
      JSON.stringify({ translation: 'kr', book: 30, chapter: 7, verse: 16 }),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/data/commentary/index.json')) {
          return { ok: true, status: 200, json: async () => MOCK_COMM_INDEX };
        }
        if (url.endsWith('/data/study/index.json')) {
          return { ok: true, status: 200, json: async () => MOCK_STUDY_INDEX };
        }
        if (url.endsWith('/data/study/books/30.json')) {
          return { ok: true, status: 200, json: async () => MOCK_AMOS_STUDY_BUNDLE };
        }
        const m = url.match(/\/data\/bible\/(kr|en)\/(\d+)\/(\d+)\.json$/);
        if (m) {
          const found = MOCK_AMOS_CHAPTERS[`${m[1]}:${m[2]}:${m[3]}`];
          if (found) return { ok: true, status: 200, json: async () => found };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      }),
    );
  });

  it('6. E2E 왕복: 아모스 7:16 선택 → 인라인 도구바 [본문 탐구] → 관주·문맥·번역 비교 확인 → 관련 구절(암 2:12) 이동 → 원래 위치 및 스크롤(scrollY) 복귀', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(
      await screen.findByText(/네가 이르기를 이스라엘에 대하여 예언하지 말며/),
    ).toBeInTheDocument();

    window.scrollY = 320;

    // 16절 탭 -> 인라인 도구 바 노출 -> 본문 탐구 오픈
    await user.click(screen.getByRole('button', { name: /16절 선택/ }));
    await user.click(screen.getByRole('button', { name: /본문 탐구/ }));

    const dialog = await screen.findByRole('dialog', { name: '아모스 7:16 본문 탐구' });
    expect(within(dialog).getByText('AMOS.7.16')).toBeInTheDocument();

    // F02 관련 말씀 탭 검증
    expect(await within(dialog).findByText('아모스 7:9')).toBeInTheDocument();
    expect(within(dialog).getByText('아모스 2:12')).toBeInTheDocument();

    // 문맥 해설 탭(F03) 전환 (키보드 ArrowRight 탐색 검증 포함)
    const refTab = within(dialog).getByRole('tab', { name: /관련 말씀/ });
    refTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByRole('tab', { name: /문맥 해설/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      within(dialog).getByText('벧엘 제사장 아마샤의 예언 금지와 아모스의 소명 변증'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/‘이삭의 집’/)).toBeInTheDocument();

    // 번역 비교 탭(F04) 전환
    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByRole('tab', { name: '번역 비교' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(dialog).getByText(/Now then, hear the word of the LORD/)).toBeInTheDocument();
    expect(
      within(dialog).getByText("두 역본 모두 '이삭의 집(the house of Isaac)' 표현을 유지합니다."),
    ).toBeInTheDocument();

    // 다시 관련 말씀 탭으로 가서 아모스 2:12 미리보기 -> 이어읽기 위치가 바뀌지 않는지 확인
    await user.click(within(dialog).getByRole('tab', { name: /관련 말씀/ }));
    const previewBtns = within(dialog).getAllByRole('button', { name: '팝업에서 미리 읽기' });
    await user.click(previewBtns[1]);
    expect(
      await within(dialog).findByText(/나실 사람으로 포도주를 마시게 하며/),
    ).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('bible_web_v1:last_read')!)).toEqual({
      translation: 'kr',
      book: 30,
      chapter: 7,
      verse: 16,
    });

    // 해당 구절(아모스 2:12)로 이동
    const moveBtns = within(dialog).getAllByRole('button', { name: '해당 구절로 이동' });
    await user.click(moveBtns[1]);

    expect(await screen.findByRole('heading', { name: '아모스 2장' })).toBeInTheDocument();

    // 원래 본문으로 돌아가기 -> 아모스 7:16 및 출발 스크롤(320px) 정확 복원!
    const scrollSpy = vi.mocked(window.scrollTo);
    scrollSpy.mockClear();
    await user.click(screen.getByRole('button', { name: '원래 본문으로 돌아가기' }));

    expect(await screen.findByRole('heading', { name: '아모스 7장' })).toBeInTheDocument();
    expect(scrollSpy).toHaveBeenCalledWith(0, 320);
  });

  it('7. 빠른 절 전환 레이스 컨디션 방지 & Esc 포커스 복귀 & 빈 결과 정직 안내', async () => {
    const delayedResolvers: Array<(val: BookStudyBundle) => void> = [];
    let callCount = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/data/commentary/index.json')) {
          return Promise.resolve({ ok: true, status: 200, json: async () => MOCK_COMM_INDEX });
        }
        if (url.endsWith('/data/study/index.json')) {
          return Promise.resolve({ ok: true, status: 200, json: async () => MOCK_STUDY_INDEX });
        }
        if (url.endsWith('/data/study/books/30.json')) {
          callCount += 1;
          if (callCount === 1) {
            return new Promise((resolve) => {
              delayedResolvers.push((bundle) =>
                resolve({ ok: true, status: 200, json: async () => bundle }),
              );
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => MOCK_AMOS_STUDY_BUNDLE,
          });
        }
        const m = url.match(/\/data\/bible\/(kr|en)\/(\d+)\/(\d+)\.json$/);
        if (m) {
          const found = MOCK_AMOS_CHAPTERS[`${m[1]}:${m[2]}:${m[3]}`];
          if (found) return Promise.resolve({ ok: true, status: 200, json: async () => found });
        }
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
      }),
    );

    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/양 떼를 따를 때에/)).toBeInTheDocument();

    // 15절 선택 후 본문 탐구 오픈 (첫 요청은 지연 중)
    await user.click(screen.getByRole('button', { name: /15절 선택/ }));
    await user.click(screen.getByRole('button', { name: /본문 탐구/ }));

    const dialog = await screen.findByRole('dialog', { name: '아모스 7:15 본문 탐구' });
    expect(within(dialog).getByText('탐구 자료를 불러오는 중입니다...')).toBeInTheDocument();

    // 응답이 오기 전 즉시 다음 절(16절)과 그 다음 절(17절 - 관주 비어 있는 절)로 빠르게 전환!
    await user.click(within(dialog).getByRole('button', { name: '다음 절 (16절)' }));
    await user.click(within(dialog).getByRole('button', { name: '다음 절 (17절)' }));

    // 이제 뒤늦게 15절 요청이 완료되더라도 현재 17절 패널에 15절 관주('아모스 3:8')가 절대 섞여 나오지 않아야 함!
    delayedResolvers[0]?.(MOCK_AMOS_STUDY_BUNDLE);

    expect(
      await within(dialog).findByText(
        '이 구절에 대해 검수 완료된 관련 말씀이 아직 등록되지 않았습니다.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText('아모스 3:8')).not.toBeInTheDocument();

    // Escape 키로 닫을 때 현재 보고 있던 17절 버튼(#verse-btn-17)으로 포커스가 복귀되어야 함
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(document.activeElement?.id).toBe('verse-btn-17');
    });
  });

  it('8. 네트워크 오류 발생 시 오류 상태 및 [다시 시도] 복구가 정상 동작한다', async () => {
    let shouldFailStudy = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/data/commentary/index.json')) {
          return { ok: true, status: 200, json: async () => MOCK_COMM_INDEX };
        }
        if (url.endsWith('/data/study/index.json')) {
          if (shouldFailStudy) {
            return { ok: false, status: 500, json: async () => ({}) };
          }
          return { ok: true, status: 200, json: async () => MOCK_STUDY_INDEX };
        }
        if (url.endsWith('/data/study/books/30.json')) {
          return { ok: true, status: 200, json: async () => MOCK_AMOS_STUDY_BUNDLE };
        }
        const m = url.match(/\/data\/bible\/(kr|en)\/(\d+)\/(\d+)\.json$/);
        if (m) {
          const found = MOCK_AMOS_CHAPTERS[`${m[1]}:${m[2]}:${m[3]}`];
          if (found) return { ok: true, status: 200, json: async () => found };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      }),
    );

    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/이제 너는 여호와의 말씀을 들을지니라/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /16절 선택/ }));
    await user.click(screen.getByRole('button', { name: /본문 탐구/ }));

    const dialog = await screen.findByRole('dialog', { name: '아모스 7:16 본문 탐구' });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '본문 탐구 색인 데이터를 불러오지 못했습니다.',
    );

    shouldFailStudy = false;
    await user.click(within(dialog).getByRole('button', { name: '다시 시도' }));
    expect(await within(dialog).findByText('아모스 7:9')).toBeInTheDocument();
  });
});
