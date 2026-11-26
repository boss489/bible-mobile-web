import type { FontSizeLevel, ReadingPosition } from '../types/bible';

/**
 * 공용 입장 비밀번호 설정
 * - 기본 비밀번호: "1234" (SHA-256 해시)
 * - 변경 방법: VITE_ENTRY_PASSWORD_SHA256 환경 변수를 지정하거나 아래 상수를 교체
 */
export const ENTRY_PASSWORD_SHA256: string =
  import.meta.env.VITE_ENTRY_PASSWORD_SHA256 ??
  '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';

/** 처음 방문한 브라우저에서 기본으로 여는 시작 위치 */
export const DEFAULT_START_POSITION: ReadingPosition = {
  translation: 'kr',
  book: 1,
  chapter: 1,
  verse: 1,
};

export const DEFAULT_FONT_SIZE: FontSizeLevel = 3;

export const FONT_SIZE_OPTIONS: readonly {
  level: FontSizeLevel;
  label: string;
  remSize: string;
  lineHeight: string;
}[] = [
  { level: 1, label: '아주 작게', remSize: '0.9375rem', lineHeight: '1.72' },
  { level: 2, label: '작게', remSize: '1.03125rem', lineHeight: '1.76' },
  { level: 3, label: '보통', remSize: '1.125rem', lineHeight: '1.82' },
  { level: 4, label: '크게', remSize: '1.25rem', lineHeight: '1.86' },
  { level: 5, label: '아주 크게', remSize: '1.4rem', lineHeight: '1.9' },
];

/** 요구사항 §4.4 지정 필수 안내 문구 (원문 일치) */
export const BROWSER_STORAGE_NOTICE =
  '읽기 기록은 이 브라우저에 저장됩니다. 다른 기기나 브라우저에서는 볼 수 없으며, 브라우저 데이터를 지우면 삭제될 수 있습니다.';
