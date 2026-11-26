import { formatVerseRef, getTranslationLabel } from '../config/books';
import type {
  CanonicalVerseId,
  CrossReferenceItem,
  PassageContext,
  SourceMeta,
  TranslationComparisonResult,
  TranslationId,
} from '../types/bible';
import { filterAndSortCrossReferences, formatCanonicalVerseId } from '../utils/verseId';
import { loadBookStudyBundle, loadChapterData, loadStudyIndex } from './dataLoader';
import { buildTranslationComparison } from './versification';

export interface VerseStudyDataPayload {
  verseId: CanonicalVerseId;
  contentVersion: string;
  crossReferences: CrossReferenceItem[];
  passageContexts: PassageContext[];
  translationComparison: TranslationComparisonResult;
  sources: Record<string, SourceMeta>;
}

export interface StudyDataRepository {
  getVerseStudy(params: {
    book: number;
    chapter: number;
    verse: number;
    activeTranslation: TranslationId;
    signal?: AbortSignal;
  }): Promise<VerseStudyDataPayload>;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const err = new Error('요청이 취소되었습니다.');
    err.name = 'AbortError';
    throw err;
  }
}

/**
 * 정적 검증 JSON 기반 본문 탐구 데이터 리포지토리.
 * - 읽기 화면에서의 런타임 LLM 호출을 일절 수행하지 않는다.
 * - 향후 서버 API 또는 P1 AI 질문 어댑터 확장 시 동일 인터페이스 뒤에서 교체 가능하다.
 */
export class StaticStudyDataRepository implements StudyDataRepository {
  async getVerseStudy(params: {
    book: number;
    chapter: number;
    verse: number;
    activeTranslation: TranslationId;
    signal?: AbortSignal;
  }): Promise<VerseStudyDataPayload> {
    const { book, chapter, verse, activeTranslation, signal } = params;
    throwIfAborted(signal);

    const verseId = formatCanonicalVerseId(book, chapter, verse);
    const studyIndex = await loadStudyIndex();
    throwIfAborted(signal);

    const [bundle, krChapter, enChapter] = await Promise.all([
      loadBookStudyBundle(
        book,
        studyIndex.booksWithStudy.length > 0 ? studyIndex.booksWithStudy : undefined,
      ),
      loadChapterData('kr', book, chapter),
      loadChapterData('en', book, chapter).catch(() => null),
    ]);
    throwIfAborted(signal);

    const rawRefs = bundle?.crossReferencesByVerse[verseId] ?? [];
    const crossReferences = filterAndSortCrossReferences(verseId, rawRefs, 5);

    const passageContexts = (bundle?.passageContexts ?? []).filter(
      (pc) =>
        pc.reviewStatus === 'VERIFIED' &&
        pc.book === book &&
        pc.chapter === chapter &&
        pc.verseStart <= verse &&
        verse <= pc.verseEnd,
    );

    const rawTrNotes = bundle?.translationNotesByVerse[verseId] ?? [];
    const translationComparison = buildTranslationComparison({
      book,
      chapter,
      verse,
      activeTranslation,
      krChapter,
      enChapter,
      notes: rawTrNotes,
    });

    return {
      verseId,
      contentVersion: bundle?.contentVersion ?? studyIndex.contentVersion,
      crossReferences,
      passageContexts,
      translationComparison,
      sources: studyIndex.sources,
    };
  }
}

export const studyRepository: StudyDataRepository = new StaticStudyDataRepository();

export function formatVerseClipboardText(
  book: number,
  chapter: number,
  verse: number,
  translation: TranslationId,
  text: string,
): string {
  const ref = formatVerseRef(book, chapter, verse, translation);
  const tr = getTranslationLabel(translation);
  return `${ref} (${tr})\n${text}`;
}

export async function copyTextToClipboard(content: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
      return true;
    }
  } catch {
    // Fallback below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export async function shareOrCopyVerse(params: {
  book: number;
  chapter: number;
  verse: number;
  translation: TranslationId;
  text: string;
}): Promise<'shared' | 'copied' | 'failed'> {
  const formatted = formatVerseClipboardText(
    params.book,
    params.chapter,
    params.verse,
    params.translation,
    params.text,
  );
  const title = `${formatVerseRef(params.book, params.chapter, params.verse, params.translation)} (${getTranslationLabel(params.translation)})`;

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text: formatted });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'failed';
      }
    }
  }

  const copied = await copyTextToClipboard(formatted);
  return copied ? 'copied' : 'failed';
}
