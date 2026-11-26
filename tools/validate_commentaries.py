#!/usr/bin/env python3
"""
사전 작성·검토된 해설 콘텐츠(66권 권별 개관 + 장별 5대 상세 해설 + 지도 라이선스 메타데이터) 검증 및 정적 빌드 도구.

요구사항 검증 규칙:
1. 런타임 AI 호출 없이 사전 검토(reviewed: true)된 항목만 배포 JSON에 포함한다.
2. 모든 해설은 근거 장절(scriptureRefs) 또는 참고자료(sources)가 반드시 1개 이상 있어야 한다.
3. 요약·배경 설명은 본문 명시 사실(statedFacts)과 해석(interpretations)을 구분한다.
4. 지도 자료는 웹 게시 허용 라이선스(license, attribution, sourceNote)가 필수다.
5. 인물 설명은 역할·관계·발언/행동을 포함하며 동명이인 여부가 있으면 disambiguation을 명시한다.
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


def validate_ref(ref: dict, ctx: str) -> None:
    book = ref.get("book")
    chapter = ref.get("chapter")
    verse = ref.get("verseStart")
    if book not in BOOKS_BY_NUMBER:
        raise ValueError(f"[{ctx}] 잘못된 권 번호: {book}")
    max_ch = BOOKS_BY_NUMBER[book]["chapters"]
    if not isinstance(chapter, int) or not (1 <= chapter <= max_ch):
        raise ValueError(f"[{ctx}] 잘못된 장 번호: {book}:{chapter} (최대 {max_ch})")
    if not isinstance(verse, int) or verse < 1:
        raise ValueError(f"[{ctx}] 잘못된 시작 절 번호: {verse}")


def validate_maps(maps_path: pathlib.Path) -> dict[str, dict]:
    raw = json.loads(maps_path.read_text(encoding="utf-8"))
    project_root = maps_path.resolve().parent.parent
    maps_by_id: dict[str, dict] = {}
    for item in raw.get("maps", []):
        mid = item.get("id")
        if not mid:
            raise ValueError("지도 ID 누락")
        for req_key in ("title", "regionSummary", "license", "attribution", "sourceNote"):
            if not item.get(req_key):
                raise ValueError(f"[map:{mid}] 필수 저작권·출처 메타데이터 누락: {req_key}")
        if not item.get("backdropImageUrl"):
            raise ValueError(f"[map:{mid}] 지형 레이어 누락")
        for backdrop in (item["backdropImageUrl"], item.get("modernBordersImageUrl")):
            if not backdrop:
                continue
            rel_clean = backdrop[2:] if backdrop.startswith("./") else backdrop.lstrip("/")
            asset_path = project_root / "public" / rel_clean
            if not asset_path.is_file() or asset_path.stat().st_size == 0:
                raise ValueError(f"[map:{mid}] 지도 이미지 파일 누락: {asset_path}")
        bbox = item.get("bbox")
        if not isinstance(bbox, list) or len(bbox) != 4 or bbox[0] >= bbox[2] or bbox[1] >= bbox[3]:
            raise ValueError(f"[map:{mid}] 유효하지 않은 위경도 경계")
        if "defaultRoute" in item:
            raise ValueError(f"[map:{mid}] 근거 없는 기본 이동 경로(defaultRoute) 금지")
        import math
        central_lat = (bbox[1] + bbox[3]) / 2.0
        true_aspect = ((bbox[2] - bbox[0]) * math.cos(math.radians(central_lat))) / (bbox[3] - bbox[1])
        if abs(true_aspect - (360.0 / 220.0)) > 0.015:
            raise ValueError(f"[map:{mid}] 정거 원통 투영 종횡비 왜곡 발생: {true_aspect:.4f}")
        for stop in item.get("stops", []):
            status = stop.get("locationStatus")
            if status not in {"confirmed", "traditional", "estimated", "unknown"}:
                raise ValueError(f"[map:{mid}] 위치 신뢰도 누락: {stop.get('id')}")
            if not all(stop.get(key) for key in ("sourceId", "sourceUrl", "scriptureRef", "historicalBackground", "statusReason", "biblicalName")):
                raise ValueError(f"[map:{mid}] 지명 근거 또는 고대 지명 누락: {stop.get('id')}")
            if "x" in stop or "y" in stop:
                raise ValueError(f"[map:{mid}] 화면 상대 좌표 금지: {stop.get('id')}")
            candidates = stop.get("candidates", [])
            if status == "unknown" and (candidates or "lat" in stop or "lon" in stop):
                raise ValueError(f"[map:{mid}] 위치 미상에 핀 좌표 지정 금지: {stop.get('id')}")
            if status != "unknown" and not candidates:
                raise ValueError(f"[map:{mid}] 후보 좌표 누락: {stop.get('id')}")
            for candidate in candidates:
                if not (-90 <= candidate["lat"] <= 90 and -180 <= candidate["lon"] <= 180 and candidate.get("sourceUrl") and candidate.get("modernName")):
                    raise ValueError(f"[map:{mid}] 유효하지 않은 후보 좌표·현대 지명: {stop.get('id')}")
            if status == "confirmed":
                if len(candidates) != 1 or (stop.get("lat"), stop.get("lon")) != (candidates[0]["lat"], candidates[0]["lon"]):
                    raise ValueError(f"[map:{mid}] 확정 지명은 단일 후보 좌표와 일치해야 함: {stop.get('id')}")
            else:
                if "lat" in stop or "lon" in stop:
                    raise ValueError(f"[map:{mid}] 복수 후보·전통·추정 지명을 단일 좌표로 확정 금지: {stop.get('id')}")
        maps_by_id[mid] = item
    return maps_by_id


def validate_book_overviews(books_dir: pathlib.Path, valid_map_ids: set[str]) -> dict[str, dict]:
    overviews: dict[str, dict] = {}
    for file_path in sorted(books_dir.glob("*.json")):
        items = json.loads(file_path.read_text(encoding="utf-8"))
        for item in items:
            b = item.get("book")
            ctx = f"book-overview:{b}"
            if b not in BOOKS_BY_NUMBER:
                raise ValueError(f"[{ctx}] 존재하지 않는 권 번호")
            if str(b) in overviews:
                raise ValueError(f"[{ctx}] 중복된 권 개관 정의")
            if not item.get("reviewed"):
                continue

            if not item.get("statedFacts") or not item.get("interpretations"):
                raise ValueError(f"[{ctx}] 본문 명시 사실(statedFacts)과 해석(interpretations) 구분 필수")
            if not item.get("eraBackground") or not item.get("chronology"):
                raise ValueError(f"[{ctx}] 시대 배경(eraBackground) 및 연대(chronology) 필수")
            if not item.get("keyVerse") or not item["keyVerse"].get("reason"):
                raise ValueError(f"[{ctx}] 대표 구절 및 선정 이유 필수")
            validate_ref(item["keyVerse"], f"{ctx}.keyVerse")
            if not item.get("sources"):
                raise ValueError(f"[{ctx}] 참고자료·근거 표시(sources) 필수")
            map_id = item.get("mapId")
            if map_id and map_id not in valid_map_ids:
                raise ValueError(f"[{ctx}] 등록되지 않은 mapId 참조: {map_id}")

            overviews[str(b)] = item

    if len(overviews) != 66:
        missing = sorted(set(map(str, range(1, 67))) - set(overviews.keys()), key=int)
        raise ValueError(f"66권 전체 개관 중 누락된 권 존재: {missing}")

    return overviews


def validate_chapter_commentaries(
    chapters_dir: pathlib.Path, valid_map_ids: set[str]
) -> tuple[dict[str, dict], list[str]]:
    published_chapters: dict[str, dict] = {}
    chapter_keys: list[str] = []

    for file_path in sorted(chapters_dir.glob("*.json")):
        raw = json.loads(file_path.read_text(encoding="utf-8"))
        b = raw.get("book")
        c = raw.get("chapter")
        ctx = f"chapter:{file_path.name}({b}:{c})"
        if b not in BOOKS_BY_NUMBER or not (1 <= c <= BOOKS_BY_NUMBER[b]["chapters"]):
            raise ValueError(f"[{ctx}] 유효하지 않은 책·장 번호")

        out_sections: dict = {"book": b, "chapter": c}
        has_any_reviewed = False

        # 1. 장별 요약
        summary = raw.get("summary")
        if summary and summary.get("reviewed"):
            if not summary.get("flow") or not summary.get("statedFacts") or not summary.get("interpretations"):
                raise ValueError(f"[{ctx}.summary] 흐름·본문사실·해석 필드 필수")
            if not summary.get("keyVerses"):
                raise ValueError(f"[{ctx}.summary] 핵심 구절 및 선정 이유 필수")
            for kv in summary["keyVerses"]:
                validate_ref(kv, f"{ctx}.summary.keyVerse")
                if not kv.get("reason"):
                    raise ValueError(f"[{ctx}.summary.keyVerse] 선정 이유 누락")
            if not summary.get("sources"):
                raise ValueError(f"[{ctx}.summary] 근거/참고자료 누락")
            out_sections["summary"] = summary
            has_any_reviewed = True

        # 2. 시대 배경
        bg = raw.get("background")
        if bg and bg.get("reviewed"):
            if not bg.get("statedFacts") or not bg.get("interpretations") or not bg.get("sources"):
                raise ValueError(f"[{ctx}.background] 본문사실·배경설명·참고자료 필수")
            out_sections["background"] = bg
            has_any_reviewed = True

        # 3. 지도·연표
        mt = raw.get("mapTimeline")
        if mt and mt.get("reviewed"):
            map_id = mt.get("mapId")
            if map_id and map_id not in valid_map_ids:
                raise ValueError(f"[{ctx}.mapTimeline] 알 수 없는 mapId: {map_id}")
            if not mt.get("events") and not map_id:
                raise ValueError(f"[{ctx}.mapTimeline] 지도 또는 연표 사건 목록 필수")
            if not mt.get("sources"):
                raise ValueError(f"[{ctx}.mapTimeline] 출처·참고자료 필수")
            for seq in mt.get("attestedSequence", []):
                if not all(seq.get(k) for k in ("from", "to", "verseRef")):
                    raise ValueError(f"[{ctx}.mapTimeline] attestedSequence 근거 구절 누락: {seq}")
            out_sections["mapTimeline"] = mt
            has_any_reviewed = True

        # 4. 인물 설명
        chars = raw.get("characters")
        if chars and chars.get("reviewed"):
            if not chars.get("items") or not chars.get("sources"):
                raise ValueError(f"[{ctx}.characters] 인물 목록 및 참고자료 필수")
            for ch_item in chars["items"]:
                for k in ("name", "role", "relationships", "actionsInChapter"):
                    if not ch_item.get(k):
                        raise ValueError(f"[{ctx}.characters] 필수 필드 누락: {k}")
            out_sections["characters"] = chars
            has_any_reviewed = True

        # 5. 관련 장절
        rel = raw.get("relatedPassages")
        if rel and rel.get("reviewed"):
            if not rel.get("items"):
                raise ValueError(f"[{ctx}.relatedPassages] 관련 구절 목록 필수")
            for r_item in rel["items"]:
                validate_ref(r_item, f"{ctx}.relatedPassages")
                if not r_item.get("connectionType") or not r_item.get("reason"):
                    raise ValueError(f"[{ctx}.relatedPassages] 연결 유형 및 근거 설명 필수")
            out_sections["relatedPassages"] = rel
            has_any_reviewed = True

        if has_any_reviewed:
            key = f"{b}_{c}"
            published_chapters[key] = out_sections
            chapter_keys.append(key)

    return published_chapters, sorted(chapter_keys)


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate and bundle static Bible commentary JSON.")
    parser.add_argument("--books-dir", required=True, type=pathlib.Path)
    parser.add_argument("--chapters-dir", required=True, type=pathlib.Path)
    parser.add_argument("--maps", required=True, type=pathlib.Path)
    parser.add_argument("--out", required=True, type=pathlib.Path)
    args = parser.parse_args()

    maps_by_id = validate_maps(args.maps)
    overviews = validate_book_overviews(args.books_dir, set(maps_by_id.keys()))
    chapters, chapter_keys = validate_chapter_commentaries(args.chapters_dir, set(maps_by_id.keys()))

    args.out.mkdir(parents=True, exist_ok=True)
    chapters_out = args.out / "chapters"
    chapters_out.mkdir(parents=True, exist_ok=True)

    for key, payload in chapters.items():
        (chapters_out / f"{key}.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    index_payload = {
        "version": 1,
        "maps": maps_by_id,
        "bookOverviews": overviews,
        "chaptersWithCommentary": chapter_keys,
    }
    (args.out / "index.json").write_text(
        json.dumps(index_payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(
        f"[OK] 해설 검증 완료: 권별 개관 {len(overviews)}권, "
        f"장별 상세 해설 {len(chapter_keys)}장, 지도 {len(maps_by_id)}종 -> {args.out}"
    )


if __name__ == "__main__":
    main()
