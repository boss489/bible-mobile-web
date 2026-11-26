#!/usr/bin/env python3
"""
통합 성경 역사 연대표(시대 · 왕국/제국 · 왕/통치자 · 선지자/사사/제사장 · 사도/인물 · 사건 · 장절 배경 매핑) 검증 및 빌드 도구.

핵심 검증 원칙 (docs/bible-history-ui/REQUIREMENTS.md §6 준수):
1. 모든 구절 ID(verseId)는 실제 66권 1,189장 성경 manifest 범위 내에 실재해야 한다.
2. BC/AD 사이에 역사적 0년이 없으므로 0년(year == 0) 표기를 즉시 차단한다.
3. 원역사(primeval) 등 연대 미확정(undetermined) 항목에는 임의의 BC 연도 숫자를 부여하지 못하고
   상대적 순서(relativeOrder)로만 표현해야 한다.
4. 날짜 성격(periodKind: 통치/활동/생존/사건/본문 사건/작성 시기)과 정확도(datePrecision: 확정/추정/범위/미확정)를 필수 구분한다.
5. 신구약 중간기 외부 역사(external_history)와 성경 본문 기록(biblical_record)을 구분하며,
   관련 본문이 없는 외부 역사에 억지 구절 연결을 강제하지 않는다.
6. 서신서 배경(epistle_background) 항목은 작성 시기(composition_time)와 관련 사건(relatedItemIds / secondaryPeriods)을 구분해야 한다.
7. 모든 sourceIds가 content/sources.json 에 등록되어 있는지 검증한다.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from books_meta import BOOKS_BY_NUMBER  # noqa: E402
from validate_study_data import (  # noqa: E402
    load_max_verses_lookup,
    parse_and_validate_verse_id,
    validate_sources,
)

REQUIRED_ERA_IDS = [
    "primeval",
    "patriarchs",
    "exodus",
    "conquest_judges",
    "united_kingdom",
    "divided_kingdom",
    "judah_alone",
    "exile",
    "return_persian",
    "intertestamental",
    "jesus_life",
    "early_church",
]

ALLOWED_CATEGORIES = {
    "polity",
    "ruler",
    "prophet_priest",
    "person",
    "event",
}

ALLOWED_PERIOD_KINDS = {
    "polity_span",
    "reign",
    "ministry",
    "lifespan",
    "event",
    "narrative_time",
    "composition_time",
}

ALLOWED_DATE_PRECISIONS = {
    "confirmed",
    "estimated",
    "range",
    "undetermined",
}

ALLOWED_RECORD_TYPES = {
    "biblical_record",
    "external_history",
    "epistle_background",
}


def _validate_year_pair(
    start_year: int | None,
    end_year: int | None,
    precision: str,
    era_ids: list[str],
    ctx: str,
) -> None:
    if start_year == 0 or end_year == 0:
        raise ValueError(f"[{ctx}] 역사적 연대에 0년(Year 0)은 존재하지 않습니다.")

    if "primeval" in era_ids:
        if start_year is not None or end_year is not None:
            raise ValueError(f"[{ctx}] 원역사(primeval) 항목에는 임의의 BC 연도를 부여할 수 없습니다.")
        if precision != "undetermined":
            raise ValueError(f"[{ctx}] 원역사(primeval) 항목의 datePrecision은 'undetermined'여야 합니다.")
        return

    if precision == "undetermined":
        if start_year is not None or end_year is not None:
            raise ValueError(f"[{ctx}] undetermined 항목은 숫자 연도가 null이어야 합니다.")
        return

    if not isinstance(start_year, int) or not isinstance(end_year, int):
        raise ValueError(f"[{ctx}] 확정/추정/범위 항목은 정수 startYear, endYear가 필요합니다.")
    if start_year > end_year:
        raise ValueError(f"[{ctx}] startYear({start_year})가 endYear({end_year})보다 클 수 없습니다.")
    if start_year < -2500 or end_year > 120:
        raise ValueError(f"[{ctx}] 허용 시간축 범위를 벗어난 연도입니다: {start_year}..{end_year}")


def _validate_passage_link(
    p: dict, max_verses: dict[tuple[int, int], int], ctx: str
) -> dict:
    parsed = parse_and_validate_verse_id(p.get("verseId", ""), max_verses, f"{ctx}.verseId")
    title_ko = (p.get("titleKo") or "").strip()
    role_ko = (p.get("roleKo") or "").strip()
    if len(title_ko) < 2:
        raise ValueError(f"[{ctx}] titleKo 누락")
    if len(role_ko) < 6:
        raise ValueError(f"[{ctx}] 역사적 연결 설명(roleKo)을 구체적으로 입력해야 합니다.")
    return {
        "verseId": parsed["canonicalId"],
        "labelKo": parsed["labelKo"],
        "labelEn": parsed["labelEn"],
        "titleKo": title_ko,
        "roleKo": role_ko,
    }


def validate_and_compile_history_data(
    history_path: pathlib.Path,
    sources_map: dict[str, dict],
    max_verses: dict[tuple[int, int], int],
) -> dict:
    raw = json.loads(history_path.read_text(encoding="utf-8"))
    valid_source_ids = set(sources_map.keys())

    content_version = (raw.get("contentVersion") or "").strip()
    overview_notice = (raw.get("overviewNoticeKo") or "").strip()
    if not content_version or not overview_notice:
        raise ValueError("contentVersion 및 overviewNoticeKo 필수")

    # 1. 시대(eras) 검증
    eras_raw = raw.get("eras") or []
    seen_era_ids: list[str] = []
    compiled_eras: list[dict] = []

    for idx, era in enumerate(eras_raw):
        e_ctx = f"eras[{idx}]({era.get('id')})"
        era_id = era.get("id")
        if era_id not in REQUIRED_ERA_IDS:
            raise ValueError(f"[{e_ctx}] 허용되지 않은 시대 ID: {era_id!r}")
        if era_id in seen_era_ids:
            raise ValueError(f"[{e_ctx}] 중복된 시대 ID: {era_id}")
        seen_era_ids.append(era_id)

        precision = era.get("datePrecision")
        if precision not in ALLOWED_DATE_PRECISIONS:
            raise ValueError(f"[{e_ctx}] 잘못된 datePrecision: {precision!r}")

        _validate_year_pair(
            era.get("startYear"),
            era.get("endYear"),
            precision,
            [era_id],
            e_ctx,
        )

        for req_str in ("nameKo", "shortNameKo", "summaryKo", "displayPeriodKo", "color"):
            if not (era.get(req_str) or "").strip():
                raise ValueError(f"[{e_ctx}] 필수 문자열 누락: {req_str}")

        s_ids = era.get("sourceIds") or []
        if not s_ids or any(sid not in valid_source_ids for sid in s_ids):
            raise ValueError(f"[{e_ctx}] 유효하지 않은 sourceIds: {s_ids}")

        key_passages_raw = era.get("keyPassages") or []
        # 중간기는 정경 66권 직접 서술 시대가 아니므로 keyPassages 빈 배열 허용, 나머지 시대는 최소 1개 이상 필수
        if era_id != "intertestamental" and not key_passages_raw:
            raise ValueError(f"[{e_ctx}] 시대별 주요 말씀(keyPassages) 최소 1개 필요")

        compiled_kp = [
            _validate_passage_link(kp, max_verses, f"{e_ctx}.keyPassages[{k_i}]")
            for k_i, kp in enumerate(key_passages_raw)
        ]

        compiled_era = {
            "id": era_id,
            "order": idx + 1,
            "nameKo": era["nameKo"].strip(),
            "shortNameKo": era["shortNameKo"].strip(),
            "summaryKo": era["summaryKo"].strip(),
            "datePrecision": precision,
            "displayPeriodKo": era["displayPeriodKo"].strip(),
            "startYear": era.get("startYear"),
            "endYear": era.get("endYear"),
            "color": era["color"].strip(),
            "keyPassages": compiled_kp,
            "sourceIds": s_ids,
        }
        if era.get("relativeRange"):
            rr = era["relativeRange"]
            if (
                not isinstance(rr, list)
                or len(rr) != 2
                or not all(isinstance(v, int) and v >= 1 for v in rr)
                or rr[0] > rr[1]
            ):
                raise ValueError(f"[{e_ctx}] 잘못된 relativeRange: {rr}")
            compiled_era["relativeRange"] = rr
        if era.get("divergentViewsKo"):
            compiled_era["divergentViewsKo"] = era["divergentViewsKo"].strip()

        compiled_eras.append(compiled_era)

    if seen_era_ids != REQUIRED_ERA_IDS:
        raise ValueError(
            f"12개 필수 시대 순서·구성이 요구사항과 일치해야 합니다. 현재: {seen_era_ids}"
        )

    # 2. 인물·왕국·사건 항목(items) 검증
    items_raw = raw.get("items") or []
    if not items_raw:
        raise ValueError("items 목록이 비어 있습니다.")

    seen_item_ids: set[str] = set()
    compiled_items: list[dict] = []

    for idx, item in enumerate(items_raw):
        item_id = (item.get("id") or "").strip()
        i_ctx = f"items[{idx}]({item_id})"
        if not item_id:
            raise ValueError(f"[{i_ctx}] id 누락")
        if item_id in seen_item_ids:
            raise ValueError(f"[{i_ctx}] 중복된 item id: {item_id}")
        seen_item_ids.add(item_id)

        cat = item.get("category")
        if cat not in ALLOWED_CATEGORIES:
            raise ValueError(f"[{i_ctx}] 허용되지 않은 category: {cat!r}")

        era_ids = item.get("eraIds") or []
        if not era_ids or any(eid not in REQUIRED_ERA_IDS for eid in era_ids):
            raise ValueError(f"[{i_ctx}] 유효하지 않은 eraIds: {era_ids}")

        rec_type = item.get("recordType")
        if rec_type not in ALLOWED_RECORD_TYPES:
            raise ValueError(f"[{i_ctx}] 허용되지 않은 recordType: {rec_type!r}")

        p_kind = item.get("periodKind")
        if p_kind not in ALLOWED_PERIOD_KINDS:
            raise ValueError(f"[{i_ctx}] 허용되지 않은 periodKind: {p_kind!r}")

        precision = item.get("datePrecision")
        if precision not in ALLOWED_DATE_PRECISIONS:
            raise ValueError(f"[{i_ctx}] 허용되지 않은 datePrecision: {precision!r}")

        _validate_year_pair(
            item.get("startYear"),
            item.get("endYear"),
            precision,
            era_ids,
            i_ctx,
        )

        if precision == "undetermined":
            rel_order = item.get("relativeOrder")
            if not isinstance(rel_order, int) or rel_order < 1:
                raise ValueError(f"[{i_ctx}] undetermined 항목은 양의 정수 relativeOrder 필수")

        for req_str in ("nameKo", "roleLabelKo", "displayPeriodKo", "summaryKo"):
            if not (item.get(req_str) or "").strip():
                raise ValueError(f"[{i_ctx}] 필수 문자열 누락: {req_str}")

        s_ids = item.get("sourceIds") or []
        if not s_ids or any(sid not in valid_source_ids for sid in s_ids):
            raise ValueError(f"[{i_ctx}] 유효하지 않은 sourceIds: {s_ids}")

        passages_raw = item.get("passages") or []
        if rec_type == "biblical_record" and not passages_raw:
            raise ValueError(f"[{i_ctx}] 성경 본문 기록(biblical_record) 항목은 최소 1개의 관련 말씀이 필요합니다.")
        if rec_type == "external_history" and not (item.get("externalHistoryNoteKo") or "").strip():
            raise ValueError(f"[{i_ctx}] 외부 역사(external_history) 항목은 externalHistoryNoteKo 안내가 필수입니다.")
        if rec_type == "epistle_background":
            if p_kind != "composition_time":
                raise ValueError(
                    f"[{i_ctx}] 서신 배경(epistle_background) 항목의 periodKind는 'composition_time'이어야 합니다."
                )
            if not item.get("relatedItemIds") or not item.get("secondaryPeriods"):
                raise ValueError(
                    f"[{i_ctx}] 서신 배경 항목은 작성 시기와 관련 사건(relatedItemIds, secondaryPeriods)을 구분해 명시해야 합니다."
                )
            if not passages_raw:
                raise ValueError(f"[{i_ctx}] 서신 배경 항목은 검증된 관련 서신/사도행전 구절이 필요합니다.")

        seen_vids: set[str] = set()
        compiled_passages: list[dict] = []
        for p_i, p_link in enumerate(passages_raw):
            cp = _validate_passage_link(p_link, max_verses, f"{i_ctx}.passages[{p_i}]")
            if cp["verseId"] in seen_vids:
                raise ValueError(f"[{i_ctx}] 중복된 구절 연결: {cp['verseId']}")
            seen_vids.add(cp["verseId"])
            compiled_passages.append(cp)

        sec_periods = []
        for sp_i, sp in enumerate(item.get("secondaryPeriods") or []):
            sp_kind = sp.get("periodKind")
            sp_disp = (sp.get("displayKo") or "").strip()
            if sp_kind not in ALLOWED_PERIOD_KINDS or not sp_disp:
                raise ValueError(f"[{i_ctx}.secondaryPeriods[{sp_i}]] 잘못된 보조 시기 정보")
            sec_periods.append({"periodKind": sp_kind, "displayKo": sp_disp})

        compiled_item: dict = {
            "id": item_id,
            "nameKo": item["nameKo"].strip(),
            "roleLabelKo": item["roleLabelKo"].strip(),
            "category": cat,
            "eraIds": era_ids,
            "recordType": rec_type,
            "periodKind": p_kind,
            "datePrecision": precision,
            "displayPeriodKo": item["displayPeriodKo"].strip(),
            "startYear": item.get("startYear"),
            "endYear": item.get("endYear"),
            "summaryKo": item["summaryKo"].strip(),
            "passages": compiled_passages,
            "sourceIds": s_ids,
        }
        if item.get("shortLabelKo"):
            compiled_item["shortLabelKo"] = item["shortLabelKo"].strip()
        if item.get("relativeOrder") is not None:
            compiled_item["relativeOrder"] = int(item["relativeOrder"])
        if item.get("relativeSpan") is not None:
            compiled_item["relativeSpan"] = int(item["relativeSpan"])
        if sec_periods:
            compiled_item["secondaryPeriods"] = sec_periods
        if item.get("divergentViewsKo"):
            compiled_item["divergentViewsKo"] = item["divergentViewsKo"].strip()
        if item.get("externalHistoryNoteKo"):
            compiled_item["externalHistoryNoteKo"] = item["externalHistoryNoteKo"].strip()
        if item.get("relatedItemIds"):
            compiled_item["relatedItemIds"] = list(dict.fromkeys(item["relatedItemIds"]))
        if item.get("accentColor"):
            compiled_item["accentColor"] = item["accentColor"].strip()

        compiled_items.append(compiled_item)

    # relatedItemIds 참조 무결성 검증
    for ci in compiled_items:
        for rel_id in ci.get("relatedItemIds", []):
            if rel_id == ci["id"]:
                raise ValueError(f"[item:{ci['id']}] 자기 자신을 relatedItemIds로 참조할 수 없습니다.")
            if rel_id not in seen_item_ids:
                raise ValueError(f"[item:{ci['id']}] 존재하지 않는 relatedItemIds 참조: {rel_id}")

    # 3. 본문 장·절 역사적 배경 매핑(chapterMappings) 검증
    mappings_raw = raw.get("chapterMappings") or []
    if not mappings_raw:
        raise ValueError("chapterMappings 목록이 비어 있습니다.")

    seen_mapping_ids: set[str] = set()
    compiled_mappings: list[dict] = []

    for idx, mp in enumerate(mappings_raw):
        m_id = (mp.get("id") or "").strip()
        m_ctx = f"chapterMappings[{idx}]({m_id})"
        if not m_id or m_id in seen_mapping_ids:
            raise ValueError(f"[{m_ctx}] 누락되었거나 중복된 매핑 ID: {m_id!r}")
        seen_mapping_ids.add(m_id)

        book = mp.get("book")
        if book not in BOOKS_BY_NUMBER:
            raise ValueError(f"[{m_ctx}] 존재하지 않는 권 번호: {book}")
        book_meta = BOOKS_BY_NUMBER[book]
        ch_start = mp.get("chapterStart")
        ch_end = mp.get("chapterEnd")
        if (
            not isinstance(ch_start, int)
            or not isinstance(ch_end, int)
            or ch_start < 1
            or ch_end < ch_start
            or ch_end > book_meta["chapters"]
        ):
            raise ValueError(f"[{m_ctx}] 잘못된 장 범위: {book}:{ch_start}-{ch_end}")

        v_start = mp.get("verseStart")
        v_end = mp.get("verseEnd")
        if v_start is not None or v_end is not None:
            if ch_start != ch_end:
                raise ValueError(f"[{m_ctx}] 절 범위 지정은 단일 장 매핑에서만 허용됩니다.")
            max_v = max_verses.get((book, ch_start))
            if (
                not isinstance(v_start, int)
                or not isinstance(v_end, int)
                or v_start < 1
                or v_end < v_start
                or (max_v is not None and v_end > max_v)
            ):
                raise ValueError(f"[{m_ctx}] 잘못된 절 범위: {book}:{ch_start}:{v_start}-{v_end}")

        era_id = mp.get("eraId")
        if era_id not in REQUIRED_ERA_IDS:
            raise ValueError(f"[{m_ctx}] 유효하지 않은 eraId: {era_id!r}")

        p_kind = mp.get("periodKind")
        if p_kind not in {"narrative_time", "composition_time"}:
            raise ValueError(
                f"[{m_ctx}] 본문 매핑 periodKind는 'narrative_time' 또는 'composition_time'이어야 합니다: {p_kind!r}"
            )

        precision = mp.get("datePrecision")
        if precision not in ALLOWED_DATE_PRECISIONS:
            raise ValueError(f"[{m_ctx}] 잘못된 datePrecision: {precision!r}")

        _validate_year_pair(
            mp.get("focusStartYear"),
            mp.get("focusEndYear"),
            precision,
            [era_id],
            m_ctx,
        )

        if precision == "undetermined" and not isinstance(mp.get("focusRelativeOrder"), int):
            raise ValueError(f"[{m_ctx}] undetermined 본문 매핑은 focusRelativeOrder 필수")

        for req_str in ("displayPeriodKo", "contextSummaryKo"):
            if not (mp.get(req_str) or "").strip():
                raise ValueError(f"[{m_ctx}] 필수 문자열 누락: {req_str}")

        primary_ids = mp.get("primaryItemIds") or []
        if not primary_ids or any(pid not in seen_item_ids for pid in primary_ids):
            raise ValueError(f"[{m_ctx}] 유효하지 않거나 비어 있는 primaryItemIds: {primary_ids}")

        rel_ids = mp.get("relatedItemIds") or []
        if any(rid not in seen_item_ids for rid in rel_ids):
            raise ValueError(f"[{m_ctx}] 유효하지 않은 relatedItemIds: {rel_ids}")

        s_ids = mp.get("sourceIds") or []
        if not s_ids or any(sid not in valid_source_ids for sid in s_ids):
            raise ValueError(f"[{m_ctx}] 유효하지 않은 sourceIds: {s_ids}")

        compiled_mp: dict = {
            "id": m_id,
            "book": book,
            "chapterStart": ch_start,
            "chapterEnd": ch_end,
            "eraId": era_id,
            "periodKind": p_kind,
            "datePrecision": precision,
            "displayPeriodKo": mp["displayPeriodKo"].strip(),
            "focusStartYear": mp.get("focusStartYear"),
            "focusEndYear": mp.get("focusEndYear"),
            "contextSummaryKo": mp["contextSummaryKo"].strip(),
            "primaryItemIds": list(dict.fromkeys(primary_ids)),
            "sourceIds": s_ids,
        }
        if v_start is not None and v_end is not None:
            compiled_mp["verseStart"] = v_start
            compiled_mp["verseEnd"] = v_end
        if mp.get("focusRelativeOrder") is not None:
            compiled_mp["focusRelativeOrder"] = int(mp["focusRelativeOrder"])
        if rel_ids:
            compiled_mp["relatedItemIds"] = list(dict.fromkeys(rel_ids))
        if mp.get("writtenVsEventNoteKo"):
            compiled_mp["writtenVsEventNoteKo"] = mp["writtenVsEventNoteKo"].strip()
        if mp.get("divergentViewsKo"):
            compiled_mp["divergentViewsKo"] = mp["divergentViewsKo"].strip()

        compiled_mappings.append(compiled_mp)

    return {
        "contentVersion": content_version,
        "overviewNoticeKo": overview_notice,
        "sources": sources_map,
        "eras": compiled_eras,
        "items": compiled_items,
        "chapterMappings": compiled_mappings,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate and compile Bible history timeline JSON.")
    parser.add_argument("--sources", required=True, type=pathlib.Path)
    parser.add_argument("--history", required=True, type=pathlib.Path)
    parser.add_argument("--manifest", required=False, type=pathlib.Path)
    parser.add_argument("--out", required=True, type=pathlib.Path)
    args = parser.parse_args()

    sources_map = validate_sources(args.sources)
    max_verses = load_max_verses_lookup(args.manifest)
    compiled = validate_and_compile_history_data(args.history, sources_map, max_verses)

    args.out.mkdir(parents=True, exist_ok=True)
    out_file = args.out / "timeline.json"
    out_file.write_text(
        json.dumps(compiled, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(
        f"[OK] 성경 역사 연대표 검증·빌드 완료: 시대 {len(compiled['eras'])}개, "
        f"항목 {len(compiled['items'])}건, 본문 매핑 {len(compiled['chapterMappings'])}구간 -> {out_file}"
    )


if __name__ == "__main__":
    main()
