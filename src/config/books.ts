import type { BookMeta, TranslationId } from '../types/bible';

type RawBookDef = Omit<BookMeta, 'osis'>;

const RAW_BOOKS_LIST: readonly RawBookDef[] = [
  { book: 1, testament: 'OT', category: '모세오경', nameKo: '창세기', abbrKo: '창', nameEn: 'Genesis', abbrEn: 'Gen', chapters: 50 },
  { book: 2, testament: 'OT', category: '모세오경', nameKo: '출애굽기', abbrKo: '출', nameEn: 'Exodus', abbrEn: 'Exod', chapters: 40 },
  { book: 3, testament: 'OT', category: '모세오경', nameKo: '레위기', abbrKo: '레', nameEn: 'Leviticus', abbrEn: 'Lev', chapters: 27 },
  { book: 4, testament: 'OT', category: '모세오경', nameKo: '민수기', abbrKo: '민', nameEn: 'Numbers', abbrEn: 'Num', chapters: 36 },
  { book: 5, testament: 'OT', category: '모세오경', nameKo: '신명기', abbrKo: '신', nameEn: 'Deuteronomy', abbrEn: 'Deut', chapters: 34 },
  { book: 6, testament: 'OT', category: '역사서', nameKo: '여호수아', abbrKo: '수', nameEn: 'Joshua', abbrEn: 'Josh', chapters: 24 },
  { book: 7, testament: 'OT', category: '역사서', nameKo: '사사기', abbrKo: '삿', nameEn: 'Judges', abbrEn: 'Judg', chapters: 21 },
  { book: 8, testament: 'OT', category: '역사서', nameKo: '룻기', abbrKo: '룻', nameEn: 'Ruth', abbrEn: 'Ruth', chapters: 4 },
  { book: 9, testament: 'OT', category: '역사서', nameKo: '사무엘상', abbrKo: '삼상', nameEn: '1 Samuel', abbrEn: '1Sam', chapters: 31 },
  { book: 10, testament: 'OT', category: '역사서', nameKo: '사무엘하', abbrKo: '삼하', nameEn: '2 Samuel', abbrEn: '2Sam', chapters: 24 },
  { book: 11, testament: 'OT', category: '역사서', nameKo: '열왕기상', abbrKo: '왕상', nameEn: '1 Kings', abbrEn: '1Kgs', chapters: 22 },
  { book: 12, testament: 'OT', category: '역사서', nameKo: '열왕기하', abbrKo: '왕하', nameEn: '2 Kings', abbrEn: '2Kgs', chapters: 25 },
  { book: 13, testament: 'OT', category: '역사서', nameKo: '역대상', abbrKo: '대상', nameEn: '1 Chronicles', abbrEn: '1Chr', chapters: 29 },
  { book: 14, testament: 'OT', category: '역사서', nameKo: '역대하', abbrKo: '대하', nameEn: '2 Chronicles', abbrEn: '2Chr', chapters: 36 },
  { book: 15, testament: 'OT', category: '역사서', nameKo: '에스라', abbrKo: '스', nameEn: 'Ezra', abbrEn: 'Ezra', chapters: 10 },
  { book: 16, testament: 'OT', category: '역사서', nameKo: '느헤미야', abbrKo: '느', nameEn: 'Nehemiah', abbrEn: 'Neh', chapters: 13 },
  { book: 17, testament: 'OT', category: '역사서', nameKo: '에스더', abbrKo: '에', nameEn: 'Esther', abbrEn: 'Esth', chapters: 10 },
  { book: 18, testament: 'OT', category: '시가서', nameKo: '욥기', abbrKo: '욥', nameEn: 'Job', abbrEn: 'Job', chapters: 42 },
  { book: 19, testament: 'OT', category: '시가서', nameKo: '시편', abbrKo: '시', nameEn: 'Psalms', abbrEn: 'Ps', chapters: 150 },
  { book: 20, testament: 'OT', category: '시가서', nameKo: '잠언', abbrKo: '잠', nameEn: 'Proverbs', abbrEn: 'Prov', chapters: 31 },
  { book: 21, testament: 'OT', category: '시가서', nameKo: '전도서', abbrKo: '전', nameEn: 'Ecclesiastes', abbrEn: 'Eccl', chapters: 12 },
  { book: 22, testament: 'OT', category: '시가서', nameKo: '아가', abbrKo: '아', nameEn: 'Song of Songs', abbrEn: 'Song', chapters: 8 },
  { book: 23, testament: 'OT', category: '대선지서', nameKo: '이사야', abbrKo: '사', nameEn: 'Isaiah', abbrEn: 'Isa', chapters: 66 },
  { book: 24, testament: 'OT', category: '대선지서', nameKo: '예레미야', abbrKo: '렘', nameEn: 'Jeremiah', abbrEn: 'Jer', chapters: 52 },
  { book: 25, testament: 'OT', category: '대선지서', nameKo: '예레미야애가', abbrKo: '애', nameEn: 'Lamentations', abbrEn: 'Lam', chapters: 5 },
  { book: 26, testament: 'OT', category: '대선지서', nameKo: '에스겔', abbrKo: '겔', nameEn: 'Ezekiel', abbrEn: 'Ezek', chapters: 48 },
  { book: 27, testament: 'OT', category: '대선지서', nameKo: '다니엘', abbrKo: '단', nameEn: 'Daniel', abbrEn: 'Dan', chapters: 12 },
  { book: 28, testament: 'OT', category: '소선지서', nameKo: '호세아', abbrKo: '호', nameEn: 'Hosea', abbrEn: 'Hos', chapters: 14 },
  { book: 29, testament: 'OT', category: '소선지서', nameKo: '요엘', abbrKo: '욜', nameEn: 'Joel', abbrEn: 'Joel', chapters: 3 },
  { book: 30, testament: 'OT', category: '소선지서', nameKo: '아모스', abbrKo: '암', nameEn: 'Amos', abbrEn: 'Amos', chapters: 9 },
  { book: 31, testament: 'OT', category: '소선지서', nameKo: '오바댜', abbrKo: '옵', nameEn: 'Obadiah', abbrEn: 'Obad', chapters: 1 },
  { book: 32, testament: 'OT', category: '소선지서', nameKo: '요나', abbrKo: '욘', nameEn: 'Jonah', abbrEn: 'Jonah', chapters: 4 },
  { book: 33, testament: 'OT', category: '소선지서', nameKo: '미가', abbrKo: '미', nameEn: 'Micah', abbrEn: 'Mic', chapters: 7 },
  { book: 34, testament: 'OT', category: '소선지서', nameKo: '나훔', abbrKo: '나', nameEn: 'Nahum', abbrEn: 'Nah', chapters: 3 },
  { book: 35, testament: 'OT', category: '소선지서', nameKo: '하박국', abbrKo: '합', nameEn: 'Habakkuk', abbrEn: 'Hab', chapters: 3 },
  { book: 36, testament: 'OT', category: '소선지서', nameKo: '스바냐', abbrKo: '습', nameEn: 'Zephaniah', abbrEn: 'Zeph', chapters: 3 },
  { book: 37, testament: 'OT', category: '소선지서', nameKo: '학개', abbrKo: '학', nameEn: 'Haggai', abbrEn: 'Hag', chapters: 2 },
  { book: 38, testament: 'OT', category: '소선지서', nameKo: '스가랴', abbrKo: '슥', nameEn: 'Zechariah', abbrEn: 'Zech', chapters: 14 },
  { book: 39, testament: 'OT', category: '소선지서', nameKo: '말라기', abbrKo: '말', nameEn: 'Malachi', abbrEn: 'Mal', chapters: 4 },
  { book: 40, testament: 'NT', category: '복음서', nameKo: '마태복음', abbrKo: '마', nameEn: 'Matthew', abbrEn: 'Matt', chapters: 28 },
  { book: 41, testament: 'NT', category: '복음서', nameKo: '마가복음', abbrKo: '막', nameEn: 'Mark', abbrEn: 'Mark', chapters: 16 },
  { book: 42, testament: 'NT', category: '복음서', nameKo: '누가복음', abbrKo: '눅', nameEn: 'Luke', abbrEn: 'Luke', chapters: 24 },
  { book: 43, testament: 'NT', category: '복음서', nameKo: '요한복음', abbrKo: '요', nameEn: 'John', abbrEn: 'John', chapters: 21 },
  { book: 44, testament: 'NT', category: '역사서(신약)', nameKo: '사도행전', abbrKo: '행', nameEn: 'Acts', abbrEn: 'Acts', chapters: 28 },
  { book: 45, testament: 'NT', category: '바울서신', nameKo: '로마서', abbrKo: '롬', nameEn: 'Romans', abbrEn: 'Rom', chapters: 16 },
  { book: 46, testament: 'NT', category: '바울서신', nameKo: '고린도전서', abbrKo: '고전', nameEn: '1 Corinthians', abbrEn: '1Cor', chapters: 16 },
  { book: 47, testament: 'NT', category: '바울서신', nameKo: '고린도후서', abbrKo: '고후', nameEn: '2 Corinthians', abbrEn: '2Cor', chapters: 13 },
  { book: 48, testament: 'NT', category: '바울서신', nameKo: '갈라디아서', abbrKo: '갈', nameEn: 'Galatians', abbrEn: 'Gal', chapters: 6 },
  { book: 49, testament: 'NT', category: '바울서신', nameKo: '에베소서', abbrKo: '엡', nameEn: 'Ephesians', abbrEn: 'Eph', chapters: 6 },
  { book: 50, testament: 'NT', category: '바울서신', nameKo: '빌립보서', abbrKo: '빌', nameEn: 'Philippians', abbrEn: 'Phil', chapters: 4 },
  { book: 51, testament: 'NT', category: '바울서신', nameKo: '골로새서', abbrKo: '골', nameEn: 'Colossians', abbrEn: 'Col', chapters: 4 },
  { book: 52, testament: 'NT', category: '바울서신', nameKo: '데살로니가전서', abbrKo: '살전', nameEn: '1 Thessalonians', abbrEn: '1Thess', chapters: 5 },
  { book: 53, testament: 'NT', category: '바울서신', nameKo: '데살로니가후서', abbrKo: '살후', nameEn: '2 Thessalonians', abbrEn: '2Thess', chapters: 3 },
  { book: 54, testament: 'NT', category: '바울서신', nameKo: '디모데전서', abbrKo: '딤전', nameEn: '1 Timothy', abbrEn: '1Tim', chapters: 6 },
  { book: 55, testament: 'NT', category: '바울서신', nameKo: '디모데후서', abbrKo: '딤후', nameEn: '2 Timothy', abbrEn: '2Tim', chapters: 4 },
  { book: 56, testament: 'NT', category: '바울서신', nameKo: '디도서', abbrKo: '딛', nameEn: 'Titus', abbrEn: 'Titus', chapters: 3 },
  { book: 57, testament: 'NT', category: '바울서신', nameKo: '빌레몬서', abbrKo: '몬', nameEn: 'Philemon', abbrEn: 'Phlm', chapters: 1 },
  { book: 58, testament: 'NT', category: '일반서신', nameKo: '히브리서', abbrKo: '히', nameEn: 'Hebrews', abbrEn: 'Heb', chapters: 13 },
  { book: 59, testament: 'NT', category: '일반서신', nameKo: '야고보서', abbrKo: '약', nameEn: 'James', abbrEn: 'Jas', chapters: 5 },
  { book: 60, testament: 'NT', category: '일반서신', nameKo: '베드로전서', abbrKo: '벧전', nameEn: '1 Peter', abbrEn: '1Pet', chapters: 5 },
  { book: 61, testament: 'NT', category: '일반서신', nameKo: '베드로후서', abbrKo: '벧후', nameEn: '2 Peter', abbrEn: '2Pet', chapters: 3 },
  { book: 62, testament: 'NT', category: '일반서신', nameKo: '요한일서', abbrKo: '요일', nameEn: '1 John', abbrEn: '1John', chapters: 5 },
  { book: 63, testament: 'NT', category: '일반서신', nameKo: '요한이서', abbrKo: '요이', nameEn: '2 John', abbrEn: '2John', chapters: 1 },
  { book: 64, testament: 'NT', category: '일반서신', nameKo: '요한삼서', abbrKo: '요삼', nameEn: '3 John', abbrEn: '3John', chapters: 1 },
  { book: 65, testament: 'NT', category: '일반서신', nameKo: '유다서', abbrKo: '유', nameEn: 'Jude', abbrEn: 'Jude', chapters: 1 },
  { book: 66, testament: 'NT', category: '예언서', nameKo: '요한계시록', abbrKo: '계', nameEn: 'Revelation', abbrEn: 'Rev', chapters: 22 },
];

export const BOOKS_LIST: readonly BookMeta[] = RAW_BOOKS_LIST.map((b) => ({
  ...b,
  osis: b.abbrEn.toUpperCase(),
}));

/**
 * 개역개정(kr)과 NIV(en) 합집합 기준 장별 최대 절 번호 테이블 (66권 1,189장 전수).
 * 구절 ID 유효성 검증을 네트워크 요청 없이 동기적으로 수행하는 데 사용된다.
 */
export const UNION_MAX_VERSES: Readonly<Record<number, readonly number[]>> = {
  1: [31, 25, 24, 26, 32, 22, 24, 22, 29, 32, 32, 20, 18, 24, 21, 16, 27, 33, 38, 18, 34, 24, 20, 67, 34, 35, 46, 22, 35, 43, 55, 32, 20, 31, 29, 43, 36, 30, 23, 23, 57, 38, 34, 34, 28, 34, 31, 22, 33, 26],
  2: [22, 25, 22, 31, 23, 30, 25, 32, 35, 29, 10, 51, 22, 31, 27, 36, 16, 27, 25, 26, 36, 31, 33, 18, 40, 37, 21, 43, 46, 38, 18, 35, 23, 35, 35, 38, 29, 31, 43, 38],
  3: [17, 16, 17, 35, 19, 30, 38, 36, 24, 20, 47, 8, 59, 57, 33, 34, 16, 30, 37, 27, 24, 33, 44, 23, 55, 46, 34],
  4: [54, 34, 51, 49, 31, 27, 89, 26, 23, 36, 35, 16, 33, 45, 41, 50, 13, 32, 22, 29, 35, 41, 30, 25, 18, 65, 23, 31, 40, 16, 54, 42, 56, 29, 34, 13],
  5: [46, 37, 29, 49, 33, 25, 26, 20, 29, 22, 32, 32, 18, 29, 23, 22, 20, 22, 21, 20, 23, 30, 25, 22, 19, 19, 26, 68, 29, 20, 30, 52, 29, 12],
  6: [18, 24, 17, 24, 15, 27, 26, 35, 27, 43, 23, 24, 33, 15, 63, 10, 18, 28, 51, 9, 45, 34, 16, 33],
  7: [36, 23, 31, 24, 31, 40, 25, 35, 57, 18, 40, 15, 25, 20, 20, 31, 13, 31, 30, 48, 25],
  8: [22, 23, 18, 22],
  9: [28, 36, 21, 22, 12, 21, 17, 22, 27, 27, 15, 25, 23, 52, 35, 23, 58, 30, 24, 42, 15, 23, 29, 22, 44, 25, 12, 25, 11, 31, 13],
  10: [27, 32, 39, 12, 25, 23, 29, 18, 13, 19, 27, 31, 39, 33, 37, 23, 29, 33, 43, 26, 22, 51, 39, 25],
  11: [53, 46, 28, 34, 18, 38, 51, 66, 28, 29, 43, 33, 34, 31, 34, 34, 24, 46, 21, 43, 29, 53],
  12: [18, 25, 27, 44, 27, 33, 20, 29, 37, 36, 21, 21, 25, 29, 38, 20, 41, 37, 37, 21, 26, 20, 37, 20, 30],
  13: [54, 55, 24, 43, 26, 81, 40, 40, 44, 14, 47, 40, 14, 17, 29, 43, 27, 17, 19, 8, 30, 19, 32, 31, 31, 32, 34, 21, 30],
  14: [17, 18, 17, 22, 14, 42, 22, 18, 31, 19, 23, 16, 22, 15, 19, 14, 19, 34, 11, 37, 20, 12, 21, 27, 28, 23, 9, 27, 36, 27, 21, 33, 25, 33, 27, 23],
  15: [11, 70, 13, 24, 17, 22, 28, 36, 15, 44],
  16: [11, 20, 32, 23, 19, 19, 73, 18, 38, 39, 36, 47, 31],
  17: [22, 23, 15, 17, 14, 14, 10, 17, 32, 3],
  18: [22, 13, 26, 21, 27, 30, 21, 22, 35, 22, 20, 25, 28, 22, 35, 22, 16, 21, 29, 29, 34, 30, 17, 25, 6, 14, 23, 28, 25, 31, 40, 22, 33, 37, 16, 33, 24, 41, 30, 24, 34, 17],
  19: [6, 12, 8, 8, 12, 10, 17, 9, 20, 18, 7, 8, 6, 7, 5, 11, 15, 50, 14, 9, 13, 31, 6, 10, 22, 12, 14, 9, 11, 12, 24, 11, 22, 22, 28, 12, 40, 22, 13, 17, 13, 11, 5, 26, 17, 11, 9, 14, 20, 23, 19, 9, 6, 7, 23, 13, 11, 11, 17, 12, 8, 12, 11, 10, 13, 20, 7, 35, 36, 5, 24, 20, 28, 23, 10, 12, 20, 72, 13, 19, 16, 8, 18, 12, 13, 17, 7, 18, 52, 17, 16, 15, 5, 23, 11, 13, 12, 9, 9, 5, 8, 28, 22, 35, 45, 48, 43, 13, 31, 7, 10, 10, 9, 8, 18, 19, 2, 29, 176, 7, 8, 9, 4, 8, 5, 6, 5, 6, 8, 8, 3, 18, 3, 3, 21, 26, 9, 8, 24, 13, 10, 7, 12, 15, 21, 10, 20, 14, 9, 6],
  20: [33, 22, 35, 27, 23, 35, 27, 36, 18, 32, 31, 28, 25, 35, 33, 33, 28, 24, 29, 30, 31, 29, 35, 34, 28, 28, 27, 28, 27, 33, 31],
  21: [18, 26, 22, 16, 20, 12, 29, 17, 18, 20, 10, 14],
  22: [17, 17, 11, 16, 16, 13, 13, 14],
  23: [31, 22, 26, 6, 30, 13, 25, 22, 21, 34, 16, 6, 22, 32, 9, 14, 14, 7, 25, 6, 17, 25, 18, 23, 12, 21, 13, 29, 24, 33, 9, 20, 24, 17, 10, 22, 38, 22, 8, 31, 29, 25, 28, 28, 25, 13, 15, 22, 26, 11, 23, 15, 12, 17, 13, 12, 21, 14, 21, 22, 11, 12, 19, 12, 25, 24],
  24: [19, 37, 25, 31, 31, 30, 34, 22, 26, 25, 23, 17, 27, 22, 21, 21, 27, 23, 15, 18, 14, 30, 40, 10, 38, 24, 22, 17, 32, 24, 40, 44, 26, 22, 19, 32, 21, 28, 18, 16, 18, 22, 13, 30, 5, 28, 7, 47, 39, 46, 64, 34],
  25: [22, 22, 66, 22, 22],
  26: [28, 10, 27, 17, 17, 14, 27, 18, 11, 22, 25, 28, 23, 23, 8, 63, 24, 32, 14, 49, 32, 31, 49, 27, 17, 21, 36, 26, 21, 26, 18, 32, 33, 31, 15, 38, 28, 23, 29, 49, 26, 20, 27, 31, 25, 24, 23, 35],
  27: [21, 49, 30, 37, 31, 28, 28, 27, 27, 21, 45, 13],
  28: [11, 23, 5, 19, 15, 11, 16, 14, 17, 15, 12, 14, 16, 9],
  29: [20, 32, 21],
  30: [15, 16, 15, 13, 27, 14, 17, 14, 15],
  31: [21],
  32: [17, 10, 10, 11],
  33: [16, 13, 12, 13, 15, 16, 20],
  34: [15, 13, 19],
  35: [17, 20, 19],
  36: [18, 15, 20],
  37: [15, 23],
  38: [21, 13, 10, 14, 11, 15, 14, 23, 17, 12, 17, 14, 9, 21],
  39: [14, 17, 18, 6],
  40: [25, 23, 17, 25, 48, 34, 29, 34, 38, 42, 30, 50, 58, 36, 39, 28, 27, 35, 30, 34, 46, 46, 39, 51, 46, 75, 66, 20],
  41: [45, 28, 35, 41, 43, 56, 37, 38, 50, 52, 33, 44, 37, 72, 47, 20],
  42: [80, 52, 38, 44, 39, 49, 50, 56, 62, 42, 54, 59, 35, 35, 32, 31, 37, 43, 48, 47, 38, 71, 56, 53],
  43: [51, 25, 36, 54, 47, 71, 53, 59, 41, 42, 57, 50, 38, 31, 27, 33, 26, 40, 42, 31, 25],
  44: [26, 47, 26, 37, 42, 15, 60, 40, 43, 48, 30, 25, 52, 28, 41, 40, 34, 28, 41, 38, 40, 30, 35, 27, 27, 32, 44, 31],
  45: [32, 29, 31, 25, 21, 23, 25, 39, 33, 21, 36, 21, 14, 23, 33, 27],
  46: [31, 16, 23, 21, 13, 20, 40, 13, 27, 33, 34, 31, 13, 40, 58, 24],
  47: [24, 17, 18, 18, 21, 18, 16, 24, 15, 18, 33, 21, 14],
  48: [24, 21, 29, 31, 26, 18],
  49: [23, 22, 21, 32, 33, 24],
  50: [30, 30, 21, 23],
  51: [29, 23, 25, 18],
  52: [10, 20, 13, 18, 28],
  53: [12, 17, 18],
  54: [20, 15, 16, 16, 25, 21],
  55: [18, 26, 17, 22],
  56: [16, 15, 15],
  57: [25],
  58: [14, 18, 19, 16, 14, 20, 28, 13, 28, 39, 40, 29, 25],
  59: [27, 26, 18, 17, 20],
  60: [25, 25, 22, 19, 14],
  61: [21, 22, 18],
  62: [10, 29, 24, 21, 21],
  63: [13],
  64: [15],
  65: [25],
  66: [20, 29, 22, 11, 14, 17, 17, 13, 21, 11, 19, 17, 18, 20, 8, 21, 18, 24, 21, 15, 27, 21],
};

const BOOKS_MAP = new Map<number, BookMeta>(BOOKS_LIST.map((b) => [b.book, b]));
const OSIS_MAP = new Map<string, BookMeta>(BOOKS_LIST.map((b) => [b.osis, b]));

const OSIS_ALIASES: Readonly<Record<string, string>> = {
  EXO: 'EXOD',
  DEU: 'DEUT',
  JOS: 'JOSH',
  JDG: 'JUDG',
  RUT: 'RUTH',
  '1SA': '1SAM',
  '2SA': '2SAM',
  '1KI': '1KGS',
  '2KI': '2KGS',
  '1CH': '1CHR',
  '2CH': '2CHR',
  EZR: 'EZRA',
  EST: 'ESTH',
  PSA: 'PS',
  PRO: 'PROV',
  ECC: 'ECCL',
  SNG: 'SONG',
  EZK: 'EZEK',
  JOL: 'JOEL',
  AMO: 'AMOS',
  OBA: 'OBAD',
  JON: 'JONAH',
  NAM: 'NAH',
  ZEP: 'ZEPH',
  ZEC: 'ZECH',
  MAT: 'MATT',
  MRK: 'MARK',
  LUK: 'LUKE',
  JHN: 'JOHN',
  ACT: 'ACTS',
  '1CO': '1COR',
  '2CO': '2COR',
  PHP: 'PHIL',
  '1TH': '1THESS',
  '2TH': '2THESS',
  '1TI': '1TIM',
  '2TI': '2TIM',
  TIT: 'TITUS',
  PHM: 'PHLM',
  JAM: 'JAS',
  '1PE': '1PET',
  '2PE': '2PET',
  '1JN': '1JOHN',
  '2JN': '2JOHN',
  '3JN': '3JOHN',
  JUD: 'JUDE',
};

export function getBookMeta(book: number): BookMeta {
  return BOOKS_MAP.get(book) ?? BOOKS_LIST[0];
}

export function findBookByOsis(code: string): BookMeta | null {
  const normalized = code.trim().toUpperCase();
  const canonical = OSIS_ALIASES[normalized] ?? normalized;
  return OSIS_MAP.get(canonical) ?? null;
}

export function getMaxVerseInChapter(book: number, chapter: number): number | null {
  const counts = UNION_MAX_VERSES[book];
  if (!counts || chapter < 1 || chapter > counts.length) return null;
  return counts[chapter - 1] ?? null;
}

export function getChapterLabel(book: number, chapter: number, translation: TranslationId = 'kr'): string {
  const meta = getBookMeta(book);
  if (translation === 'en') {
    return `${meta.nameEn} ${chapter}`;
  }
  const unit = meta.book === 19 ? '편' : '장';
  return `${meta.nameKo} ${chapter}${unit}`;
}

export function formatVerseRef(
  book: number,
  chapter: number,
  verse: number,
  translation: TranslationId = 'kr',
  verseEnd?: number,
): string {
  const meta = getBookMeta(book);
  const rangePart = verseEnd && verseEnd > verse ? `${verse}–${verseEnd}` : `${verse}`;
  if (translation === 'en') {
    return `${meta.nameEn} ${chapter}:${rangePart}`;
  }
  return `${meta.nameKo} ${chapter}:${rangePart}`;
}

export function getTranslationLabel(translation: TranslationId): string {
  return translation === 'kr' ? '개역개정' : 'NIV';
}

export function getAdjacentChapter(
  book: number,
  chapter: number,
  direction: 'prev' | 'next',
): { book: number; chapter: number } | null {
  const currentBook = getBookMeta(book);
  if (direction === 'prev') {
    if (chapter > 1) {
      return { book, chapter: chapter - 1 };
    }
    if (book > 1) {
      const prevBook = getBookMeta(book - 1);
      return { book: prevBook.book, chapter: prevBook.chapters };
    }
    return null;
  }

  if (chapter < currentBook.chapters) {
    return { book, chapter: chapter + 1 };
  }
  if (book < 66) {
    return { book: book + 1, chapter: 1 };
  }
  return null;
}
