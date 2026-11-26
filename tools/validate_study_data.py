#!/usr/bin/env python3
"""
P0 절 단위 본문 탐구 데이터(관련 말씀 관주 F02 · 단락 문맥 해설 F03 · 번역 비교 노트 F04) 스키마 및 품질 검증 빌드 도구.

핵심 검증 원칙:
1. 모든 구절 ID(sourceVerseId, targetVerseId, passageId, evidenceVerseIds)의 권·장·절 실재 여부를
   실제 성경 manifest(또는 66권 표준 범위)와 대조 검증한다.
2. 관련 말씀(CrossReference):
   - 허용된 6종 관계 유형(DIRECT_QUOTE, PROPHECY_FULFILLMENT, PARALLEL_EVENT, CONTEXT, PERSON_EVENT, THEME)만 허용
   - 자기 자신 참조 및 동일 구절 중복 등록 즉시 차단
   - 구체적인 한국어 연결 이유(reason, 최소 15자 이상) 및 근거 구절(evidenceVerseIds) 필수
   - reviewStatus == "VERIFIED" 인 항목만 배포 산출물에 포함 (미검수·반려 데이터 노출 차단)
   - 구절당 최대 5개로 제한하며 직접성 우선순위로 정렬
3. 문맥 해설(PassageContext):
   - 본문 명시 사실(statedFacts) 필수, 설교조/근거 없는 단정 배제, 근거 구절 및 출처(sourceIds) 검증
4. 모든 sourceIds가 content/sources.json 에 등록되어 있고 라이선스·귀속 정보가 있는지 검증한다.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from books_meta import BOOKS_BY_NUMBER, BOOKS_BY_OSIS  # noqa: E402

CANONICAL_RE = re.compile(r"^([1-3]?[A-Z]+)\.(\d+)\.(\d+)(?:-(\d+))?$")

ALLOWED_RELATIONS = {
    "DIRECT_QUOTE": 1,
    "PROPHECY_FULFILLMENT": 2,
    "PARALLEL_EVENT": 3,
    "CONTEXT": 4,
    "PERSON_EVENT": 5,
    "THEME": 6,
}

ALLOWED_REVIEW_STATUS = {"VERIFIED", "UNREVIEWED", "REJECTED"}
ALLOWED_BASIS_TYPES = {"STATED_FACT", "SCHOLARLY_INTERPRETATION"}


def load_max_verses_lookup(manifest_path: pathlib.Path | None) -> dict[tuple[int, int], int]:
    lookup: dict[tuple[int, int], int] = {}
    if manifest_path and manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        for book_entry in manifest.get("books", []):
            b_num = book_entry["book"]
            kr_counts = book_entry["verseCounts"]["kr"]
            en_counts = book_entry["verseCounts"]["en"]
            for idx, (k_cnt, e_cnt) in enumerate(zip(kr_counts, en_counts), start=1):
                lookup[(b_num, idx)] = max(k_cnt, e_cnt)
    return lookup


def parse_and_validate_verse_id(
    raw_id: str, max_verses: dict[tuple[int, int], int], ctx: str
) -> dict:
    if not isinstance(raw_id, str):
        raise ValueError(f"[{ctx}] 구절 ID는 문자열이어야 합니다: {raw_id!r}")
    m = CANONICAL_RE.match(raw_id.strip())
    if not m:
        raise ValueError(f"[{ctx}] 잘못된 표준 구절 ID 형식: {raw_id!r}")

    osis, ch_str, vs_str, ve_str = m.group(1), m.group(2), m.group(3), m.group(4)
    if osis not in BOOKS_BY_OSIS:
        raise ValueError(f"[{ctx}] 알 수 없는 성경 OSIS 코드: {osis!r} ({raw_id})")

    meta = BOOKS_BY_OSIS[osis]
    book_num = meta["book"]
    chapter = int(ch_str)
    verse_start = int(vs_str)
    verse_end = int(ve_str) if ve_str else verse_start

    if not (1 <= chapter <= meta["chapters"]):
        raise ValueError(
            f"[{ctx}] 장 범위 초과: {raw_id} ({meta['nameKo']} 최대 {meta['chapters']}장)"
        )
    if verse_start < 1 or verse_end < verse_start:
        raise ValueError(f"[{ctx}] 잘못된 절 범위: {raw_id}")

    max_v = max_verses.get((book_num, chapter))
    if max_v is not None and verse_end > max_v:
        raise ValueError(
            f"[{ctx}] 절 범위 초과: {raw_id} ({meta['nameKo']} {chapter}장 최대 {max_v}절)"
        )

    canonical = (
        f"{osis}.{chapter}.{verse_start}-{verse_end}"
        if verse_end > verse_start
        else f"{osis}.{chapter}.{verse_start}"
    )
    range_label = (
        f"{verse_start}–{verse_end}" if verse_end > verse_start else f"{verse_start}"
    )
    return {
        "canonicalId": canonical,
        "osis": osis,
        "book": book_num,
        "chapter": chapter,
        "verseStart": verse_start,
        "verseEnd": verse_end,
        "labelKo": f"{meta['nameKo']} {chapter}:{range_label}",
        "labelEn": f"{meta['nameEn']} {chapter}:{range_label}",
    }


def ranges_overlap(a: dict, b: dict) -> bool:
    if a["book"] != b["book"] or a["chapter"] != b["chapter"]:
        return False
    return a["verseStart"] <= b["verseEnd"] and b["verseStart"] <= a["verseEnd"]


def validate_sources(sources_path: pathlib.Path) -> dict[str, dict]:
    raw = json.loads(sources_path.read_text(encoding="utf-8"))
    sources_map: dict[str, dict] = {}
    for item in raw.get("sources", []):
        sid = item.get("id")
        if not sid:
            raise ValueError("출처 ID(id) 누락")
        if sid in sources_map:
            raise ValueError(f"중복된 출처 ID: {sid}")
        for req in ("title", "license", "attribution", "version"):
            if not item.get(req):
                raise ValueError(f"[source:{sid}] 필수 필드 누락: {req}")
        sources_map[sid] = item
    if not sources_map:
        raise ValueError("최소 1개 이상의 출처(sources) 등록 필요")
    return sources_map


def validate_and_compile_study_data(
    study_dir: pathlib.Path,
    valid_source_ids: set[str],
    max_verses: dict[tuple[int, int], int],
    content_version: str = "study-v1",
) -> tuple[dict[int, dict], dict[str, list[int]]]:
    cross_refs_by_book: dict[int, dict[str, list[dict]]] = {}
    contexts_by_book: dict[int, list[dict]] = {}
    tr_notes_by_book: dict[int, dict[str, list[dict]]] = {}
    seen_passage_ids: set[str] = set()

    files = sorted(study_dir.glob("*.json"))
    if not files:
        raise ValueError(f"탐구 데이터 JSON 파일이 없습니다: {study_dir}")

    for fp in files:
        payload = json.loads(fp.read_text(encoding="utf-8"))
        ctx_prefix = fp.name

        # 1. 관련 말씀 (crossReferences)
        for idx, cr in enumerate(payload.get("crossReferences", [])):
            c_ctx = f"{ctx_prefix}:crossReferences[{idx}]"
            status = cr.get("reviewStatus")
            if status not in ALLOWED_REVIEW_STATUS:
                raise ValueError(f"[{c_ctx}] 유효하지 않은 reviewStatus: {status!r}")

            src_info = parse_and_validate_verse_id(
                cr.get("sourceVerseId", ""), max_verses, f"{c_ctx}.sourceVerseId"
            )
            if src_info["verseStart"] != src_info["verseEnd"]:
                raise ValueError(
                    f"[{c_ctx}] sourceVerseId는 단일 절이어야 합니다: {src_info['canonicalId']}"
                )

            tgt_info = parse_and_validate_verse_id(
                cr.get("targetVerseId", ""), max_verses, f"{c_ctx}.targetVerseId"
            )
            if ranges_overlap(src_info, tgt_info):
                raise ValueError(
                    f"[{c_ctx}] 자기 자신 참조 금지: {src_info['canonicalId']} -> {tgt_info['canonicalId']}"
                )

            rel_type = cr.get("relationType")
            if rel_type not in ALLOWED_RELATIONS:
                raise ValueError(f"[{c_ctx}] 허용되지 않은 relationType: {rel_type!r}")

            reason = (cr.get("reason") or "").strip()
            if len(reason) < 15:
                raise ValueError(
                    f"[{c_ctx}] 연결 이유(reason)는 두 본문 관계를 15자 이상 구체적으로 설명해야 합니다."
                )

            ev_ids = cr.get("evidenceVerseIds") or []
            if not ev_ids:
                raise ValueError(f"[{c_ctx}] evidenceVerseIds 필수")
            normalized_ev = [
                parse_and_validate_verse_id(eid, max_verses, f"{c_ctx}.evidence")[
                    "canonicalId"
                ]
                for eid in ev_ids
            ]

            s_ids = cr.get("sourceIds") or []
            if not s_ids or any(sid not in valid_source_ids for sid in s_ids):
                raise ValueError(f"[{c_ctx}] 등록되지 않았거나 비어 있는 sourceIds: {s_ids}")

            if status != "VERIFIED":
                continue

            book_bucket = cross_refs_by_book.setdefault(src_info["book"], {})
            verse_list = book_bucket.setdefault(src_info["canonicalId"], [])
            if any(existing["targetVerseId"] == tgt_info["canonicalId"] for existing in verse_list):
                raise ValueError(
                    f"[{c_ctx}] 중복된 관련 구절 등록: {src_info['canonicalId']} -> {tgt_info['canonicalId']}"
                )

            verse_list.append(
                {
                    "sourceVerseId": src_info["canonicalId"],
                    "targetVerseId": tgt_info["canonicalId"],
                    "targetLabelKo": tgt_info["labelKo"],
                    "targetLabelEn": tgt_info["labelEn"],
                    "relationType": rel_type,
                    "reason": reason,
                    "evidenceVerseIds": normalized_ev,
                    "sourceIds": s_ids,
                    "reviewStatus": "VERIFIED",
                }
            )

        # 2. 단락/절 문맥 해설 (passageContexts)
        for idx, pc in enumerate(payload.get("passageContexts", [])):
            p_ctx = f"{ctx_prefix}:passageContexts[{idx}]"
            status = pc.get("reviewStatus")
            if status not in ALLOWED_REVIEW_STATUS:
                raise ValueError(f"[{p_ctx}] 유효하지 않은 reviewStatus: {status!r}")

            p_info = parse_and_validate_verse_id(
                pc.get("passageId", ""), max_verses, f"{p_ctx}.passageId"
            )
            if p_info["canonicalId"] in seen_passage_ids:
                raise ValueError(f"[{p_ctx}] 중복된 passageId: {p_info['canonicalId']}")
            seen_passage_ids.add(p_info["canonicalId"])

            for req_field in ("title", "summary", "statedFacts", "flow"):
                if not (pc.get(req_field) or "").strip():
                    raise ValueError(f"[{p_ctx}] 필수 필드 누락: {req_field}")

            ev_ids = pc.get("evidenceVerseIds") or []
            if not ev_ids:
                raise ValueError(f"[{p_ctx}] evidenceVerseIds 필수")
            normalized_ev = [
                parse_and_validate_verse_id(eid, max_verses, f"{p_ctx}.evidence")[
                    "canonicalId"
                ]
                for eid in ev_ids
            ]

            s_ids = pc.get("sourceIds") or []
            if not s_ids or any(sid not in valid_source_ids for sid in s_ids):
                raise ValueError(f"[{p_ctx}] 등록되지 않았거나 비어 있는 sourceIds: {s_ids}")

            expressions = pc.get("expressions") or []
            for expr in expressions:
                if not expr.get("term") or not expr.get("meaning"):
                    raise ValueError(f"[{p_ctx}.expressions] term 및 meaning 필수")
                if expr.get("basisType") not in ALLOWED_BASIS_TYPES:
                    raise ValueError(
                        f"[{p_ctx}.expressions] 유효하지 않은 basisType: {expr.get('basisType')!r}"
                    )
                expr_v = expr.get("verse")
                if expr_v is not None and not (
                    p_info["verseStart"] <= int(expr_v) <= p_info["verseEnd"]
                ):
                    raise ValueError(
                        f"[{p_ctx}.expressions] 절 번호({expr_v})가 단락 범위({p_info['canonicalId']}) 밖입니다."
                    )

            if status != "VERIFIED":
                continue

            compiled_pc = {
                "passageId": p_info["canonicalId"],
                "book": p_info["book"],
                "chapter": p_info["chapter"],
                "verseStart": p_info["verseStart"],
                "verseEnd": p_info["verseEnd"],
                "title": pc["title"].strip(),
                "summary": pc["summary"].strip(),
                "statedFacts": pc["statedFacts"].strip(),
                "flow": pc["flow"].strip(),
                "evidenceVerseIds": normalized_ev,
                "sourceIds": s_ids,
                "reviewStatus": "VERIFIED",
            }
            for opt_key in (
                "speaker",
                "audience",
                "historicalSituation",
                "interpretations",
                "divergentViews",
            ):
                if pc.get(opt_key):
                    compiled_pc[opt_key] = pc[opt_key].strip()
            if expressions:
                compiled_pc["expressions"] = expressions

            contexts_by_book.setdefault(p_info["book"], []).append(compiled_pc)

        # 3. 번역 비교 노트 (translationNotes)
        for idx, tn in enumerate(payload.get("translationNotes", [])):
            t_ctx = f"{ctx_prefix}:translationNotes[{idx}]"
            status = tn.get("reviewStatus")
            if status not in ALLOWED_REVIEW_STATUS:
                raise ValueError(f"[{t_ctx}] 유효하지 않은 reviewStatus: {status!r}")

            v_info = parse_and_validate_verse_id(
                tn.get("verseId", ""), max_verses, f"{t_ctx}.verseId"
            )
            if v_info["verseStart"] != v_info["verseEnd"]:
                raise ValueError(f"[{t_ctx}] verseId는 단일 절이어야 합니다: {v_info['canonicalId']}")

            for req_field in ("krPhrase", "enPhrase", "explanation"):
                if not (tn.get(req_field) or "").strip():
                    raise ValueError(f"[{t_ctx}] 필수 필드 누락: {req_field}")

            s_ids = tn.get("sourceIds") or []
            if not s_ids or any(sid not in valid_source_ids for sid in s_ids):
                raise ValueError(f"[{t_ctx}] 등록되지 않았거나 비어 있는 sourceIds: {s_ids}")

            if status != "VERIFIED":
                continue

            tr_notes_by_book.setdefault(v_info["book"], {}).setdefault(
                v_info["canonicalId"], []
            ).append(
                {
                    "verseId": v_info["canonicalId"],
                    "krPhrase": tn["krPhrase"].strip(),
                    "enPhrase": tn["enPhrase"].strip(),
                    "explanation": tn["explanation"].strip(),
                    "sourceIds": s_ids,
                    "reviewStatus": "VERIFIED",
                }
            )

    # 권별 번들 병합, 정렬(최대 5개), 장별 탐구 수록 절 인덱스 계산
    all_books = sorted(
        set(cross_refs_by_book.keys())
        | set(contexts_by_book.keys())
        | set(tr_notes_by_book.keys())
    )
    bundles_by_book: dict[int, dict] = {}
    study_verses_by_chapter: dict[str, set[int]] = {}

    for b_num in all_books:
        meta = BOOKS_BY_NUMBER[b_num]
        cr_map = cross_refs_by_book.get(b_num, {})
        for v_id, items in cr_map.items():
            items.sort(key=lambda x: ALLOWED_RELATIONS[x["relationType"]])
            if len(items) > 5:
                raise ValueError(
                    f"[book:{b_num}] {v_id} 관련 말씀 개수가 최대 허용치(5개)를 초과했습니다 ({len(items)}개)"
                )
            parsed_v = parse_and_validate_verse_id(v_id, max_verses, "index")
            study_verses_by_chapter.setdefault(
                f"{b_num}_{parsed_v['chapter']}", set()
            ).add(parsed_v["verseStart"])

        pcs = contexts_by_book.get(b_num, [])
        pcs.sort(key=lambda p: (p["chapter"], p["verseStart"], p["verseEnd"]))
        for pc in pcs:
            ch_set = study_verses_by_chapter.setdefault(f"{b_num}_{pc['chapter']}", set())
            for v_n in range(pc["verseStart"], pc["verseEnd"] + 1):
                ch_set.add(v_n)

        tn_map = tr_notes_by_book.get(b_num, {})
        for v_id in tn_map.keys():
            parsed_v = parse_and_validate_verse_id(v_id, max_verses, "index")
            study_verses_by_chapter.setdefault(
                f"{b_num}_{parsed_v['chapter']}", set()
            ).add(parsed_v["verseStart"])

        bundles_by_book[b_num] = {
            "book": b_num,
            "osis": meta["osis"],
            "contentVersion": content_version,
            "crossReferencesByVerse": cr_map,
            "passageContexts": pcs,
            "translationNotesByVerse": tn_map,
        }

    sorted_chapter_verses = {
        ch_key: sorted(v_set) for ch_key, v_set in sorted(study_verses_by_chapter.items())
    }
    return bundles_by_book, sorted_chapter_verses


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate and compile static Bible study JSON.")
    parser.add_argument("--sources", required=True, type=pathlib.Path)
    parser.add_argument("--study-dir", required=True, type=pathlib.Path)
    parser.add_argument("--manifest", required=False, type=pathlib.Path)
    parser.add_argument("--out", required=True, type=pathlib.Path)
    parser.add_argument("--version", default="study-v1")
    args = parser.parse_args()

    sources_map = validate_sources(args.sources)
    max_verses = load_max_verses_lookup(args.manifest)
    bundles, study_verses_by_chapter = validate_and_compile_study_data(
        args.study_dir,
        set(sources_map.keys()),
        max_verses,
        content_version=args.version,
    )

    books_out = args.out / "books"
    books_out.mkdir(parents=True, exist_ok=True)

    total_cr = 0
    total_pc = 0
    total_tn = 0
    for b_num, bundle in bundles.items():
        total_cr += sum(len(v) for v in bundle["crossReferencesByVerse"].values())
        total_pc += len(bundle["passageContexts"])
        total_tn += sum(len(v) for v in bundle["translationNotesByVerse"].values())
        (books_out / f"{b_num}.json").write_text(
            json.dumps(bundle, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )

    index_payload = {
        "contentVersion": args.version,
        "sources": sources_map,
        "booksWithStudy": sorted(bundles.keys()),
        "studyVersesByChapter": study_verses_by_chapter,
    }
    (args.out / "index.json").write_text(
        json.dumps(index_payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print(
        f"[OK] 본문 탐구 데이터 검증·빌드 완료: {len(bundles)}권 "
        f"(관주 {total_cr}건, 단락문맥 {total_pc}건, 번역노트 {total_tn}건) -> {args.out}"
    )


if __name__ == "__main__":
    main()
