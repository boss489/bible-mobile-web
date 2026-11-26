#!/usr/bin/env python3
"""Scan every Korean Bible chapter for official resource terms and exact verse anchors."""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

from books_meta import BOOKS_META

ROOT = Path(__file__).resolve().parent.parent
OFFICIAL_CODES = "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV".split()
assert len(OFFICIAL_CODES) == len(BOOKS_META) == 66


def first_match(verses: list[dict], term: str) -> int | None:
    for verse in verses:
        if term in verse["text"]:
            return verse["verse"]
    return None


def main() -> None:
    catalog = json.loads((ROOT / "content/bskorea-resource-catalog.json").read_text())
    assert catalog["expected"] == len(catalog["resources"]) + len(catalog["failures"])
    catalog_urls = {item["url"] for item in catalog["resources"]}
    assert len(catalog_urls) == len(catalog["resources"])
    assert all(url.startswith("https://bible.bskorea.or.kr/resources/") for url in catalog_urls)
    assert all(
        f'https://bible.bskorea.or.kr/resources/study/nkt_intro/{"dan-2" if i == 27 else code.lower()}' in catalog_urls
        for i, code in enumerate(OFFICIAL_CODES, 1)
    )
    kinds = {"nkt_glossary": "glossary", "nkt_units": "units", "nkt_maps": "maps", "creatures": "creatures", "things": "things", "plants": "plants"}
    resources = []
    for item in catalog["resources"]:
        if item["kind"] not in kinds or (not item["paragraphs"] and not item["images"]):
            continue
        if item["kind"] == "nkt_units":
            for match in re.finditer(r"🔸\s*([^()]{1,40})\([^)]*\)\s*([^🔸]{0,220})", " ".join(item["paragraphs"])):
                resources.append({"kind": "units", "term": match.group(1).strip(), "title": item["title"], "sourceUrl": item["url"], "summary": match.group(2).strip()})
            continue
        term = item["title"].split(" _ ")[0].strip()
        resources.append({
            "kind": kinds[item["kind"]],
            "term": term,
            "title": item["title"],
            "sourceUrl": item["url"],
            "summary": (item["description"] or (item["paragraphs"][0] if item["paragraphs"] else ""))[:240],
        })
    index = {"collectedAt": catalog["collectedAt"], "scope": "공식 사이트맵의 공개 상세 자료", "resources": resources}
    (ROOT / "content/bskorea-resource-index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    facts = json.loads((ROOT / "content/bskorea-inline-facts.json").read_text())
    assert all(fact["sourceUrl"] in catalog_urls for fact in facts)
    commentary = json.loads((ROOT / "public/data/commentary/index.json").read_text())
    study = json.loads((ROOT / "public/data/study/index.json").read_text())
    reviewed = set(commentary["chaptersWithCommentary"])
    chapters = []

    for book in BOOKS_META:
        for chapter in range(1, book["chapters"] + 1):
            path = ROOT / f'public/data/bible/kr/{book["book"]}/{chapter}.json'
            data = json.loads(path.read_text())
            verses = data["verses"]
            key = f'{book["book"]}_{chapter}'
            candidates = []
            for resource in resources:
                term = resource["term"]
                # shortcut: text matches are editorial candidates; review context before showing a new fact.
                if len(term) < 3 or resource["kind"] == "maps":
                    continue
                verse = first_match(verses, term)
                if verse is not None:
                    candidates.append({"term": term, "kind": resource["kind"], "verse": verse, "summary": resource["summary"], "sourceUrl": resource["sourceUrl"]})
            ready = []
            for fact in facts:
                verse = first_match(verses, fact["term"])
                if verse is not None:
                    ready.append({"term": fact["term"], "verse": verse, "text": fact["text"], "sourceUrl": fact["sourceUrl"]})
            assert all(any(v["verse"] == item["verse"] for v in verses) for item in candidates + ready)
            chapters.append({
                "book": book["book"],
                "chapter": chapter,
                "name": book["nameKo"],
                "officialChapterUrl": f'https://bible.bskorea.or.kr/bible/NKRV/{OFFICIAL_CODES[book["book"] - 1]}.{chapter}',
                "officialIntroUrl": f'https://bible.bskorea.or.kr/resources/study/nkt_intro/{"dan-2" if book["book"] == 27 else OFFICIAL_CODES[book["book"] - 1].lower()}',
                "existingCommentary": key in reviewed,
                "existingStudyVerses": study["studyVersesByChapter"].get(key, []),
                "readyFacts": ready,
                "resourceCandidates": candidates,
            })

    assert len(chapters) == 1189
    assert {c["book"] for c in chapters} == set(range(1, 67))
    output = {
        "scope": "66권 1,189장 로컬 개역개정 본문 전수 대조",
        "sourceIndex": "content/bskorea-resource-index.json",
        "sourceCatalog": "content/bskorea-resource-catalog.json",
        "sourcePages": len(catalog["resources"]),
        "sourcePagesRequested": catalog["expected"],
        "sourceFailures": catalog["failures"],
        "candidateWarning": "resourceCandidates는 문자열 매칭 후보이며 문맥 검수 전에는 화면에 노출하지 않습니다.",
        "chapters": chapters,
    }
    dest = ROOT / "docs/chapter-resource-audit.json"
    dest.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    live = {}
    seen_terms: dict[int, set[str]] = {}
    for chapter in chapters:
        if chapter["existingCommentary"]:
            continue
        seen = seen_terms.setdefault(chapter["book"], set())
        fresh = [fact for fact in chapter["readyFacts"] if fact["term"] not in seen]
        if fresh:
            fact = min(fresh, key=lambda item: item["verse"])
            live[f'{chapter["book"]}_{chapter["chapter"]}'] = fact
            seen.add(fact["term"])
    live_path = ROOT / "public/data/reading-facts/index.json"
    live_path.parent.mkdir(parents=True, exist_ok=True)
    live_path.write_text(json.dumps(live, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    lines = [
        "# 66권 장별 자료 조사 현황",
        "",
        f'로컬 개역개정 본문 1,189장 전부를 검사했다. 공식 사이트맵의 공개 자료 주소 {catalog["expected"]}개 중 {len(catalog["resources"])}개 페이지를 확인했다. 로그인 전용 자료는 포함하지 않는다.',
        "",
        *[f'- {kind}: {count}개' for kind, count in sorted(Counter(item["kind"] for item in catalog["resources"]).items())],
        "",
        f'- 상세 해설: {len(reviewed)}장',
        f'- 절별 탐구: {sum(bool(c["existingStudyVerses"]) for c in chapters)}장',
        f'- 짧은 설명의 용어 일치: {sum(bool(c["readyFacts"]) for c in chapters)}장',
        f'- 실제 읽기 화면의 짧은 설명: {len(live)}장 (같은 책에서 같은 용어 반복 제외)',
        f'- 추가 문맥 검수 후보: {sum(bool(c["resourceCandidates"]) for c in chapters)}장',
        f'- 절별 후보 연결: {sum(len(c["resourceCandidates"]) for c in chapters)}건',
        f'- 자료 확인 실패: {len(catalog["failures"])}개',
        "",
        "| 책 | 장 수 | 상세 해설 | 절별 탐구 | 화면 설명 | 검수 후보 |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for book in BOOKS_META:
        subset = [c for c in chapters if c["book"] == book["book"]]
        visible = sum(f'{c["book"]}_{c["chapter"]}' in live for c in subset)
        lines.append(
            f'| {book["nameKo"]} | {len(subset)} | '
            f'{sum(c["existingCommentary"] for c in subset)} | '
            f'{sum(bool(c["existingStudyVerses"]) for c in subset)} | {visible} | '
            f'{sum(bool(c["resourceCandidates"]) for c in subset)} |'
        )
    lines += [
        "",
        "`docs/chapter-resource-audit.json`에서 장별 절 위치와 출처 후보를 확인할 수 있다. `resourceCandidates`는 문자열 일치 결과이므로 검수 전에는 화면에 표시하지 않는다.",
        "지도·책별 서문·시청각 자료의 상세 내용은 `content/bskorea-resource-catalog.json`에서 원문 주소와 함께 확인할 수 있다.",
        "",
        "## 확인하지 못한 공개 페이지",
        "",
        *[f'- {item["url"]} — {item["error"]}' for item in catalog["failures"]],
    ]
    (ROOT / "docs/chapter-resource-audit.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f'checked={len(chapters)} matchedChapters={sum(bool(c["readyFacts"]) for c in chapters)} candidateChapters={sum(bool(c["resourceCandidates"]) for c in chapters)} visibleChapters={len(live)}')


if __name__ == "__main__":
    main()
