#!/usr/bin/env python3
"""
.lfa 성경 데이터 아카이브(kornkrv.lfa, engNIV.lfa) 변환 및 원본 1:1 대조 검증기.

- 원본 .lfa 파일은 읽기 전용으로만 접근한다.
- 패치 규칙(patches/kornkrv-fixes.json)을 적용해 절 번호 오기재·줄 병합을 보정한다.
- 장별 JSON(public/data/bible/{kr|en}/{book}/{chapter}.json)과 manifest.json을 생성한다.
- 글자 깨짐(U+FFFD), 수록 권·장 수(66권 1,189장), 절 번호 연속성 및 번역본 간 차이를 대조해 리포트를 작성한다.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re
import sys
import zipfile
from dataclasses import dataclass, field

# Allow running both as script and module
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from books_meta import BOOKS_BY_NUMBER, BOOKS_META  # noqa: E402

ENTRY_RE = re.compile(r"^[A-Za-z]+(\d{2})_(\d+)\.lfb$")
LINE_RE = re.compile(r"^(\d{2})(\S+?)\s+(\d+):(\d+)\s*(.*)$")
OMITTED_TEXTS = {"(없음)", "[없음]", "없음"}


@dataclass
class AuditStats:
    translation: str
    source_path: str
    sha256: str
    size_bytes: int
    chapter_files: int = 0
    total_verses: int = 0
    replacement_chars: int = 0
    omitted_verses: list[tuple[int, int, int]] = field(default_factory=list)
    missing_verses: list[tuple[int, int, int]] = field(default_factory=list)
    applied_fixes: list[str] = field(default_factory=list)
    fullwidth_colons_normalized: int = 0
    sequence_anomalies_after_fix: list[str] = field(default_factory=list)


def sha256_file(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_lfa_archive(
    lfa_path: pathlib.Path,
    translation: str,
    patches: dict | None = None,
    normalize_fullwidth_colon: bool = False,
) -> tuple[dict[tuple[int, int], dict], AuditStats]:
    """ZIP 기반 .lfa 아카이브를 파싱하고 정합성을 검증한다."""
    patches = patches or {}
    verse_fixes = {
        (item["entry"], item["lineIndex1Based"]): item
        for item in patches.get("verseNumberFixes", [])
    }
    line_splits = {
        (item["entry"], item["lineIndex1Based"]): item
        for item in patches.get("mergedLineSplits", [])
    }
    missing_by_entry: dict[str, list[dict]] = {}
    for item in patches.get("missingVerses", []):
        missing_by_entry.setdefault(item["entry"], []).append(item)

    stats = AuditStats(
        translation=translation,
        source_path=str(lfa_path),
        sha256=sha256_file(lfa_path),
        size_bytes=lfa_path.stat().st_size,
    )

    chapters_data: dict[tuple[int, int], dict] = {}

    with zipfile.ZipFile(lfa_path, "r") as zf:
        entries = sorted(zf.namelist())
        for entry in entries:
            m_entry = ENTRY_RE.match(entry)
            if not m_entry:
                raise ValueError(f"예상치 못한 아카이브 엔트리 형식: {entry}")
            book_num = int(m_entry.group(1))
            chapter_num = int(m_entry.group(2))
            if book_num not in BOOKS_BY_NUMBER:
                raise ValueError(f"유효하지 않은 권 번호: {book_num} ({entry})")

            raw_bytes = zf.read(entry)
            decoded = raw_bytes.decode("utf-8-sig")
            if "\ufffd" in decoded:
                stats.replacement_chars += decoded.count("\ufffd")

            non_empty_lines = [ln.strip() for ln in decoded.splitlines() if ln.strip()]
            parsed_verses: list[dict] = []

            for line_idx, line in enumerate(non_empty_lines, start=1):
                m_line = LINE_RE.match(line)
                if not m_line:
                    raise ValueError(f"구절 파싱 실패: {entry}:{line_idx} -> {line!r}")

                line_book = int(m_line.group(1))
                line_ch = int(m_line.group(3))
                line_verse = int(m_line.group(4))
                body = m_line.group(5).strip()

                if (line_book, line_ch) != (book_num, chapter_num):
                    raise ValueError(
                        f"파일명 장절 불일치: {entry}:{line_idx} -> {(line_book, line_ch)}"
                    )

                fix = verse_fixes.get((entry, line_idx))
                if fix:
                    if line_verse != fix["expectedRawVerse"] or not body.startswith(
                        fix["expectedPrefixText"]
                    ):
                        raise ValueError(f"패치 검증 불일치: {entry}:{line_idx}")
                    line_verse = fix["correctedVerse"]
                    stats.applied_fixes.append(
                        f"{BOOKS_BY_NUMBER[book_num]['nameKo']} {chapter_num}:{line_verse} 절 번호 오기재 복원 ({entry}:{line_idx})"
                    )

                split_rule = line_splits.get((entry, line_idx))
                if split_rule:
                    parts = re.split(split_rule["splitDelimiterRegex"], body, maxsplit=1)
                    if len(parts) != 2 or not parts[1].startswith(
                        split_rule["expectedSecondPrefix"]
                    ):
                        raise ValueError(f"병합 줄 분리 검증 실패: {entry}:{line_idx}")
                    first_body, second_body = parts[0].strip(), parts[1].strip()
                    parsed_verses.append((split_rule["verseFirst"], first_body))
                    parsed_verses.append((split_rule["verseSecond"], second_body))
                    stats.applied_fixes.append(
                        f"{BOOKS_BY_NUMBER[book_num]['nameKo']} {chapter_num}:{split_rule['verseFirst']}-{split_rule['verseSecond']} 병합 줄 분리 ({entry}:{line_idx})"
                    )
                else:
                    parsed_verses.append((line_verse, body))

            chapter_missing: list[int] = []
            for miss in missing_by_entry.get(entry, []):
                if miss.get("patchedText"):
                    parsed_verses.append((miss["verse"], miss["patchedText"].strip()))
                    stats.applied_fixes.append(
                        f"{BOOKS_BY_NUMBER[book_num]['nameKo']} {chapter_num}:{miss['verse']} 운영자 패치 본문 반영"
                    )
                else:
                    chapter_missing.append(miss["verse"])
                    stats.missing_verses.append((book_num, chapter_num, miss["verse"]))

            # 절 번호 순서 및 중복 검증
            verse_objs: list[dict] = []
            prev_v = 0
            for v_num, v_text in parsed_verses:
                if normalize_fullwidth_colon and "：" in v_text:
                    cnt = v_text.count("：")
                    stats.fullwidth_colons_normalized += cnt
                    v_text = v_text.replace("：", ":")

                if v_num != prev_v + 1:
                    stats.sequence_anomalies_after_fix.append(
                        f"{entry}: expected verse {prev_v + 1}, got {v_num}"
                    )
                prev_v = v_num

                is_omitted = v_text in OMITTED_TEXTS
                if is_omitted:
                    stats.omitted_verses.append((book_num, chapter_num, v_num))

                verse_objs.append(
                    {
                        "verse": v_num,
                        "text": v_text,
                        "isOmitted": is_omitted,
                    }
                )

            stats.chapter_files += 1
            stats.total_verses += len(verse_objs)
            chapters_data[(book_num, chapter_num)] = {
                "translation": translation,
                "book": book_num,
                "chapter": chapter_num,
                "verses": verse_objs,
                "missingVerses": sorted(chapter_missing),
            }

    # 66권 1,189장 전수 존재 검증
    expected_keys = {
        (b["book"], ch)
        for b in BOOKS_META
        for ch in range(1, b["chapters"] + 1)
    }
    if set(chapters_data.keys()) != expected_keys:
        missing_ch = sorted(expected_keys - set(chapters_data.keys()))
        extra_ch = sorted(set(chapters_data.keys()) - expected_keys)
        raise ValueError(f"장 수록 범위 불일치: missing={missing_ch}, extra={extra_ch}")

    if stats.replacement_chars > 0:
        raise ValueError(f"글자 깨짐(U+FFFD) 발견: {stats.replacement_chars}건")

    if stats.sequence_anomalies_after_fix:
        raise ValueError(
            f"패치 후에도 절 번호 순서 이상 존재: {stats.sequence_anomalies_after_fix}"
        )

    return chapters_data, stats


def write_bible_outputs(
    kr_chapters: dict[tuple[int, int], dict],
    en_chapters: dict[tuple[int, int], dict],
    out_dir: pathlib.Path,
) -> dict:
    """장별 정적 JSON 파일과 manifest.json을 출력한다."""
    out_dir.mkdir(parents=True, exist_ok=True)

    for tr_code, ch_map in [("kr", kr_chapters), ("en", en_chapters)]:
        for (book_num, ch_num), payload in ch_map.items():
            book_dir = out_dir / tr_code / str(book_num)
            book_dir.mkdir(parents=True, exist_ok=True)
            target = book_dir / f"{ch_num}.json"
            target.write_text(
                json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )

    manifest_books = []
    for meta in BOOKS_META:
        b = meta["book"]
        kr_counts = [
            len(kr_chapters[(b, c)]["verses"]) for c in range(1, meta["chapters"] + 1)
        ]
        en_counts = [
            len(en_chapters[(b, c)]["verses"]) for c in range(1, meta["chapters"] + 1)
        ]
        manifest_books.append(
            {
                **meta,
                "verseCounts": {
                    "kr": kr_counts,
                    "en": en_counts,
                },
            }
        )

    manifest = {
        "version": 1,
        "translations": {
            "kr": {
                "id": "kr",
                "label": "개역개정",
                "fullName": "성경전서 개역개정판",
                "lang": "ko",
            },
            "en": {
                "id": "en",
                "label": "NIV",
                "fullName": "New International Version",
                "lang": "en",
            },
        },
        "books": manifest_books,
    }

    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return manifest


def generate_audit_report(
    kr_stats: AuditStats,
    en_stats: AuditStats,
    kr_chapters: dict[tuple[int, int], dict],
    en_chapters: dict[tuple[int, int], dict],
    report_path: pathlib.Path,
) -> None:
    """원본 .lfa 대조 검증 리포트(Markdown)를 생성한다."""
    only_in_kr: list[str] = []
    only_in_en: list[str] = []
    for key in sorted(kr_chapters.keys()):
        b, c = key
        book_name = BOOKS_BY_NUMBER[b]["nameKo"]
        kr_v = {v["verse"] for v in kr_chapters[key]["verses"]}
        en_v = {v["verse"] for v in en_chapters[key]["verses"]}
        for v in sorted(kr_v - en_v):
            only_in_kr.append(f"{book_name} {c}:{v}")
        for v in sorted(en_v - kr_v):
            only_in_en.append(f"{book_name} {c}:{v}")

    omitted_labels = [
        f"{BOOKS_BY_NUMBER[b]['nameKo']} {c}:{v}" for b, c, v in kr_stats.omitted_verses
    ]
    missing_labels = [
        f"{BOOKS_BY_NUMBER[b]['nameKo']} {c}:{v}" for b, c, v in kr_stats.missing_verses
    ]

    lines = [
        "# 성경 데이터(`.lfa`) 변환 및 원본 대조 점검 보고서",
        "",
        "## 1. 입력 원본 파일 요약",
        "",
        "| 항목 | 한국어 개역개정 (`kornkrv.lfa`) | 영어 NIV (`engNIV.lfa`) |",
        "|---|---|---|",
        f"| 파일 크기 | {kr_stats.size_bytes:,} bytes | {en_stats.size_bytes:,} bytes |",
        f"| SHA-256 | `{kr_stats.sha256[:16]}...` | `{en_stats.sha256[:16]}...` |",
        f"| 수록 장 수 | {kr_stats.chapter_files:,}장 (66권 전체) | {en_stats.chapter_files:,}장 (66권 전체) |",
        f"| 변환된 총 절 수 | {kr_stats.total_verses:,}절 | {en_stats.total_verses:,}절 |",
        f"| 글자 깨짐 (`U+FFFD`) | **{kr_stats.replacement_chars}건** | **{en_stats.replacement_chars}건** |",
        f"| 절 순서 연속성 이상 (보정 후) | **{len(kr_stats.sequence_anomalies_after_fix)}건** | **{len(en_stats.sequence_anomalies_after_fix)}건** |",
        "",
        "## 2. 원본 보정 및 정규화 내역",
        "",
        "### 2.1 `kornkrv.lfa` 적용 패치 (`patches/kornkrv-fixes.json`)",
    ]
    for fix in kr_stats.applied_fixes:
        lines.append(f"- {fix}")
    if missing_labels:
        lines.append(
            f"- 원본 미수록 절 표시(`missingVerses`): {', '.join(missing_labels)} (번역본 전환·조회 시 부재 안내 및 인접 절 표시)"
        )

    lines.extend(
        [
            "",
            "### 2.2 `engNIV.lfa` 문자 정규화",
            f"- 파일 구분자 충돌 방지용 전각 콜론(`：`, `U+FF1A`) → 반각 콜론(`:`) 정규화: **{en_stats.fullwidth_colons_normalized:,}회**",
            "",
            "## 3. 번역본 간 절 번호·본문 차이 점검 (웹앱 자동 안내 대상)",
            "",
            f"- **개역개정 전용 절 번호 ({len(only_in_kr)}곳)**: {', '.join(only_in_kr) or '없음'}",
            f"- **NIV 전용 절 번호 ({len(only_in_en)}곳)**: {', '.join(only_in_en) or '없음'}",
            f"- **개역개정 사본상 `(없음)` 표기 절 ({len(omitted_labels)}곳)**: {', '.join(omitted_labels)}",
            "",
        ]
    )

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert .lfa Bible files to per-chapter JSON.")
    parser.add_argument("--kr", required=True, type=pathlib.Path, help="Path to kornkrv.lfa")
    parser.add_argument("--en", required=True, type=pathlib.Path, help="Path to engNIV.lfa")
    parser.add_argument("--patches", required=True, type=pathlib.Path, help="Path to kornkrv-fixes.json")
    parser.add_argument("--out", required=True, type=pathlib.Path, help="Output directory for JSON files")
    parser.add_argument("--report", required=True, type=pathlib.Path, help="Output path for audit markdown report")
    args = parser.parse_args()

    patches = json.loads(args.patches.read_text(encoding="utf-8"))
    kr_chapters, kr_stats = parse_lfa_archive(args.kr, "kr", patches=patches, normalize_fullwidth_colon=False)
    en_chapters, en_stats = parse_lfa_archive(args.en, "en", patches=None, normalize_fullwidth_colon=True)

    write_bible_outputs(kr_chapters, en_chapters, args.out)
    generate_audit_report(kr_stats, en_stats, kr_chapters, en_chapters, args.report)
    print(
        f"[OK] 변환 완료: 개역개정 {kr_stats.chapter_files}장({kr_stats.total_verses}절), "
        f"NIV {en_stats.chapter_files}장({en_stats.total_verses}절) -> {args.out}"
    )


if __name__ == "__main__":
    main()
