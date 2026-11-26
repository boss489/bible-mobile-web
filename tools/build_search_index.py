#!/usr/bin/env python3
"""
장별 성경 JSON(public/data/bible/{kr|en}/{book}/{chapter}.json)을 읽어
클라이언트 지연 로딩용 경량 전문 검색 색인(public/data/bible/search-{kr|en}.json)을 생성한다.

- 사본상 '(없음)' 표기 구절(isOmitted=True)은 검색 결과 오염 방지를 위해 제외한다.
- 각 항목은 [book, chapter, verse, text] 4-튜플로 직렬화하여 용량을 최소화한다.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from books_meta import BOOKS_META  # noqa: E402


def build_translation_index(bible_dir: pathlib.Path, translation: str) -> dict:
    tr_dir = bible_dir / translation
    if not tr_dir.is_dir():
        raise FileNotFoundError(f"번역본 디렉터리를 찾을 수 없습니다: {tr_dir}")

    verses_out: list[list] = []
    chapter_count = 0

    for book_meta in BOOKS_META:
        book_num = book_meta["book"]
        chapters = book_meta["chapters"]
        for ch_num in range(1, chapters + 1):
            ch_file = tr_dir / str(book_num) / f"{ch_num}.json"
            if not ch_file.is_file():
                raise FileNotFoundError(f"장별 JSON 파일 누락: {ch_file}")
            with ch_file.open("r", encoding="utf-8") as f:
                data = json.load(f)
            chapter_count += 1
            for v in data.get("verses", []):
                if v.get("isOmitted"):
                    continue
                text = (v.get("text") or "").strip()
                if not text:
                    continue
                verses_out.append([book_num, ch_num, int(v["verse"]), text])

    if chapter_count != 1189:
        raise ValueError(f"{translation}: 기대 장 수(1189)와 실제 장 수({chapter_count})가 다릅니다.")

    return {
        "version": 1,
        "translation": translation,
        "verses": verses_out,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="성경 본문 전문 검색용 정적 색인 JSON 생성기")
    parser.add_argument(
        "--bible-dir",
        default="public/data/bible",
        help="장별 성경 JSON 루트 경로 (기본값: public/data/bible)",
    )
    args = parser.parse_args()

    bible_dir = pathlib.Path(args.bible_dir).resolve()
    for tr in ("kr", "en"):
        payload = build_translation_index(bible_dir, tr)
        out_path = bible_dir / f"search-{tr}.json"
        raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        out_path.write_text(raw, encoding="utf-8")
        size_mb = out_path.stat().st_size / (1024 * 1024)
        print(
            f"[search-index] {tr}: {len(payload['verses']):,}절 -> {out_path.name} ({size_mb:.2f} MB)"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
