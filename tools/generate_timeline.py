#!/usr/bin/env python3
"""
성경 역사 연대표 정밀 데이터 생성기 (TIMELINE_ACCURACY_REVIEW.md & history-timeline-audit-and-improvement.md 종합 반영).

설계 원칙:
1. 발생 가능한 연대 범위(uncertainty_window)와 실제 생존·통치·활동 기간(actual_duration / point_or_brief)을 분리한다.
2. 원역사·족장·출애굽·정복·사사 시대는 확정할 수 없는 개인의 임의 BC 시작·종료 연도를 부여하지 않고,
   성경 본문에서 확인되는 상대적 순서(relativeOrder/relativeSpan)와 본문 기록 연수(수명·사역 연수)를 표시하며,
   절대 연대에 관한 학설(초기설·후기설 등)은 가설 안내(dateHypothesesKo / divergentViewsKo)로 분리 기록한다.
3. 동시대 인물(contemporaryItemIds)은 실제 생존·활동 시기의 겹침이 성경 본문 또는 역사 사료로 확인되는 경우에만 지정한다
   (예: 아브라함과 요셉은 76년 세대 간격이 있으므로 동시대 목록에서 완전 분리).
4. 통일왕국 이후 구간은 고대 근동·그리스-로마 사료와 대조된 비례 연도축을 사용하되, 시대 경계 중첩을 없애고
   단일 연도 표기('BC 722년') 및 연대 정확도(confirmed / estimated / range)를 엄격히 구분한다.
"""

from __future__ import annotations

import json
import pathlib
import re

from books_meta import BOOKS_BY_NUMBER, BOOKS_BY_OSIS
from validate_study_data import load_max_verses_lookup

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "content/history/timeline.json"
MAX_VERSES = load_max_verses_lookup(ROOT / "public/data/bible/manifest.json")
OVERVIEWS = {
    v["book"]: v
    for name in ("ot", "nt")
    for v in json.loads((ROOT / f"content/book-overviews/{name}.json").read_text(encoding="utf-8"))
}

BIBLE = ["biblical-internal-text", "standard-biblical-intro"]
BIBLE_CHRONO = ["biblical-internal-text", "standard-biblical-intro", "ane-epigraphic-chronology"]
EXTERNAL_SRC = ["standard-biblical-intro", "ane-epigraphic-chronology"]


def passage(ref: str, role: str) -> dict:
    match = re.fullmatch(r"([A-Z0-9]+)\.(\d+)\.(\d+)(?:-(\d+))?", ref)
    assert match, f"잘못된 구절 형식: {ref}"
    osis, chapter_s, first_s, last_s = match.groups()
    book = BOOKS_BY_OSIS[osis]["book"]
    chapter, first, last = int(chapter_s), int(first_s), int(last_s or first_s)
    assert (
        1 <= chapter <= BOOKS_BY_NUMBER[book]["chapters"]
        and 1 <= first <= last <= MAX_VERSES[(book, chapter)]
    ), f"구절 범위 초과: {ref}"
    return {
        "verseId": ref,
        "titleKo": BOOKS_BY_NUMBER[book]["nameKo"],
        "roleKo": role,
    }


def format_year_span(start: int, end: int, precision: str, suffix: str = "") -> str:
    prefix = "" if precision == "confirmed" else "약 "
    if start == end:
        base = f"BC {-start}년" if start < 0 else f"AD {start}년"
        return f"{prefix}{base}{suffix}"
    if end < 0:
        base = f"BC {-start}–{-end}년"
    elif start > 0:
        base = f"AD {start}–{end}년"
    else:
        base = f"BC {-start}–AD {end}년"
    return f"{prefix}{base}{suffix}"


# =====================================================================
# 1. 12개 시대(Eras) 정의 — 왕정 이전 상대 순서 4개 시대 + 비례 연도 8개 시대 (경계 중첩 0건)
# =====================================================================
eras: list[dict] = [
    {
        "id": "primeval",
        "nameKo": "원역사",
        "shortNameKo": "원역사",
        "summaryKo": "창조·타락·홍수·바벨탑으로 이어지는 창세기 1–11장의 태초 서사 순서입니다.",
        "datePrecision": "undetermined",
        "displayPeriodKo": "연대 미확정 · 본문 서사 순서",
        "startYear": None,
        "endYear": None,
        "relativeRange": [1, 4],
        "color": "#797d86",
        "keyPassages": [
            passage("GEN.1.1-3", "하나님의 천지 창조 선언과 원역사의 출발점입니다."),
            passage("GEN.6.9-14", "노아 홍수 심판과 보존 언약의 전환점입니다."),
            passage("GEN.11.1-9", "바벨탑 사건과 온 땅으로 흩어진 열방의 배경입니다."),
        ],
        "sourceIds": BIBLE,
    },
    {
        "id": "patriarchs",
        "nameKo": "족장",
        "shortNameKo": "족장",
        "summaryKo": "아브라함의 부르심과 이삭의 탄생, 야곱의 새 이름, 요셉의 애굽 통치와 가족의 이주로 이어지는 언약의 역사입니다.",
        "datePrecision": "undetermined",
        "displayPeriodKo": "본문 계보 순서 (중기 청동기 배경 논의)",
        "startYear": None,
        "endYear": None,
        "relativeRange": [5, 12],
        "divergentViewsKo": "성경 본문 내 세대 연수(아브라함 100세 이삭 출생, 160세 야곱 출생, 사후 약 76년 뒤 요셉 출생)로 상대 순서는 분명하나, 절대 BC 연대는 왕상 6:1 역산 초기 가설(약 BC 2166–1805년경)과 중기 청동기 문화권 일반 비정(약 BC 2000–1700년경) 등 학설 차이가 있습니다.",
        "color": "#786a55",
        "keyPassages": [
            passage("GEN.12.1-3", "아브라함의 부르심과 땅·자손·열방의 복 언약입니다."),
            passage("GEN.28.13-15", "벧엘에서 야곱에게 다시 확인하신 족장 언약입니다."),
            passage("GEN.45.4-8", "요셉을 먼저 애굽에 보내 생명을 보존하신 하나님의 섭리 고백입니다."),
        ],
        "sourceIds": BIBLE,
    },
    {
        "id": "exodus",
        "nameKo": "출애굽",
        "shortNameKo": "출애굽",
        "summaryKo": "출애굽 구원과 시내산 언약·성막 건립, 그리고 약 40년간의 광야 여정을 다룹니다.",
        "datePrecision": "undetermined",
        "displayPeriodKo": "본문 사건 순서 · 광야 약 40년",
        "startYear": None,
        "endYear": None,
        "relativeRange": [13, 16],
        "divergentViewsKo": "본문상 모세·아론의 출애굽 인도 기간은 약 40년 규모로 기록되며, 발생 절대 연대에 관해서는 열왕기상 6:1에 근거한 초기 연대설(약 BC 1446년경 출애굽)과 출애굽기 1:11 성읍 고고학에 근거한 후기 연대설(약 BC 1260년경 출애굽)이 공존합니다.",
        "color": "#8a6958",
        "keyPassages": [
            passage("EXOD.12.40-42", "유월절 밤 애굽에서 나온 출애굽 구원 사건의 중심 기록입니다."),
            passage("EXOD.19.4-6", "시내산에서 이스라엘을 제사장 나라로 부르신 언약 체결 본문입니다."),
            passage("DEUT.6.4-5", "광야 40년 끝에 모압 평지에서 선포된 신명기 쉐마 말씀입니다."),
        ],
        "sourceIds": BIBLE,
    },
    {
        "id": "conquest_judges",
        "nameKo": "정복·사사",
        "shortNameKo": "정복·사사",
        "summaryKo": "여호수아의 가나안 정착 이후 왕정 수립 이전까지 사사들이 각 지파를 구원하던 시기입니다.",
        "datePrecision": "undetermined",
        "displayPeriodKo": "본문 서사 순서 (왕정 수립 약 BC 1050년 이전)",
        "startYear": None,
        "endYear": None,
        "relativeRange": [17, 25],
        "divergentViewsKo": "가나안 정복 시작 시점은 출애굽 연대에 따라 약 BC 1406년경(초기설) 또는 약 BC 1220년경(후기설)으로 논의되며, 사사들의 활동 기간 중 상당수는 전국 통치가 아닌 지역별 부분 중첩으로 해석됩니다.",
        "color": "#68785b",
        "keyPassages": [
            passage("JOSH.21.43-45", "약속하신 땅 분배와 말씀 성취를 요약하는 여호수아서 결론입니다."),
            passage("JUDG.2.16-19", "사사 시대의 배교·압제·부르짖음·구원 순환 구조를 보여 줍니다."),
            passage("RUTH.4.13-17", "사사 시대 말기 베들레헴 가정에서 다윗 계보가 준비되는 장면입니다."),
        ],
        "sourceIds": BIBLE,
    },
    {
        "id": "united_kingdom",
        "nameKo": "통일왕국",
        "shortNameKo": "통일왕국",
        "summaryKo": "사울·다윗·솔로몬 세 왕이 열두 지파 통일 이스라엘을 다스리며 예루살렘 성전을 세운 시기입니다.",
        "datePrecision": "estimated",
        "displayPeriodKo": "약 BC 1050–931년",
        "startYear": -1050,
        "endYear": -931,
        "color": "#735c70",
        "keyPassages": [
            passage("1SAM.10.1", "사무엘이 사울에게 기름을 부어 초대 왕정이 시작되는 장면입니다."),
            passage("2SAM.7.12-16", "다윗의 집과 나라를 영원히 견고케 하시겠다는 다윗 언약입니다."),
            passage("1KGS.8.27-30", "솔로몬의 예루살렘 성전 봉헌 기도입니다."),
        ],
        "sourceIds": BIBLE_CHRONO,
    },
    {
        "id": "divided_kingdom",
        "nameKo": "분열왕국",
        "shortNameKo": "분열왕국",
        "summaryKo": "솔로몬 사후 북이스라엘과 남유다가 나뉘어 공존하다 북왕국이 앗수르에 멸망하기까지의 시기입니다.",
        "datePrecision": "estimated",
        "displayPeriodKo": "약 BC 931–BC 722년",
        "startYear": -931,
        "endYear": -722,
        "divergentViewsKo": "남북 왕들의 세부 재위 연대는 공동 섭정(co-regency) 유무와 유다·이스라엘의 즉위년 계산법 차이에 따라 학자별로 1~5년 내외의 편차가 있습니다.",
        "color": "#7b6657",
        "keyPassages": [
            passage("1KGS.12.16-20", "르호보암과 여로보암 시대에 남북 왕국이 분열되는 사건입니다."),
            passage("1KGS.18.21", "갈멜산에서 엘리야가 여호와 신앙의 결단을 촉구한 장면입니다."),
            passage("2KGS.17.6-8", "BC 722년 앗수르에 의한 사마리아 함락과 북왕국 멸망 기록입니다."),
        ],
        "sourceIds": BIBLE_CHRONO,
    },
    {
        "id": "judah_alone",
        "nameKo": "유다 단독왕국",
        "shortNameKo": "유다 단독왕국",
        "summaryKo": "북이스라엘 멸망 이후 남유다가 히스기야·요시야 개혁을 거쳐 바벨론에 함락되기까지의 시기입니다.",
        "datePrecision": "confirmed",
        "displayPeriodKo": "BC 722–586년",
        "startYear": -722,
        "endYear": -586,
        "divergentViewsKo": "예루살렘 최종 함락 연대는 역법 기준에 따라 BC 586년 또는 BC 587년으로 표기됩니다.",
        "color": "#925e5c",
        "keyPassages": [
            passage("2KGS.18.1-6", "앗수르 침공 위기 속에서 여호와를 의지한 히스기야의 개혁입니다."),
            passage("2KGS.22.8-11", "요시야 시대에 성전에서 율법책을 발견하고 언약을 갱신한 사건입니다."),
            passage("2KGS.25.8-11", "신바벨론에 의한 예루살렘 성전 파괴와 유다 왕국의 종언입니다."),
        ],
        "sourceIds": BIBLE_CHRONO,
    },
    {
        "id": "exile",
        "nameKo": "포로",
        "shortNameKo": "포로",
        "summaryKo": "예루살렘 함락 이후 고레스 귀환 칙령까지 바벨론 포로 공동체가 말씀과 회복 소망을 붙든 시기입니다.",
        "datePrecision": "confirmed",
        "displayPeriodKo": "BC 586–538년",
        "startYear": -586,
        "endYear": -538,
        "divergentViewsKo": "본격 포로 시대는 예루살렘 함락(BC 586년)부터 고레스 칙령(BC 538년)까지이나, 다니엘(BC 605년 1차 포로)과 에스겔·여호야긴(BC 597년 2차 포로)의 이송은 함락 이전에 먼저 시작되었습니다.",
        "color": "#766b85",
        "keyPassages": [
            passage("LAM.3.22-23", "무너진 예루살렘 폐허 위에서 고백한 하나님의 긍휼과 성실하심입니다."),
            passage("EZEK.37.1-5", "바벨론 포로민에게 주신 마른 뼈 골짜기 회복 환상입니다."),
            passage("JER.29.10-11", "바벨론 포로 생활 중 주신 회복과 평안의 언약 말씀입니다."),
        ],
        "sourceIds": BIBLE_CHRONO,
    },
    {
        "id": "return_persian",
        "nameKo": "귀환·페르시아",
        "shortNameKo": "귀환·페르시아",
        "summaryKo": "페르시아 고레스 칙령에 따른 포로 귀환, 제2성전 완공, 에스라·느헤미야 개혁으로 이어진 재건기입니다.",
        "datePrecision": "estimated",
        "displayPeriodKo": "BC 538–약 430년",
        "startYear": -538,
        "endYear": -430,
        "color": "#668174",
        "keyPassages": [
            passage("EZRA.1.1-3", "포로 귀환과 예루살렘 성전 재건을 허락한 고레스 칙령입니다."),
            passage("EZRA.6.14-15", "학개·스가랴의 권면 속에 다리오 제6년(BC 516/515년) 성전이 완공된 기록입니다."),
            passage("NEH.8.1-3", "수문 앞 광장에서 학사 에스라가 율법책을 낭독한 공동체 부흥 장면입니다."),
        ],
        "sourceIds": BIBLE_CHRONO,
    },
    {
        "id": "intertestamental",
        "nameKo": "신구약 중간기",
        "shortNameKo": "신구약 중간기",
        "summaryKo": "구약 말라기 이후 헬레니즘 제국, 마카비 항쟁·하스몬 왕조, 로마 지배에 이르는 신약 직전 배경사입니다.",
        "datePrecision": "estimated",
        "displayPeriodKo": "약 BC 430–5년",
        "startYear": -430,
        "endYear": -5,
        "color": "#72818c",
        "keyPassages": [],
        "sourceIds": EXTERNAL_SRC,
    },
    {
        "id": "jesus_life",
        "nameKo": "예수님의 생애",
        "shortNameKo": "예수님의 생애",
        "summaryKo": "예수 그리스도의 성육신 탄생과 갈릴리·예루살렘 공생애 사역, 십자가 대속과 부활을 다룹니다.",
        "datePrecision": "range",
        "displayPeriodKo": "약 BC 5–AD 30년",
        "startYear": -5,
        "endYear": 30,
        "divergentViewsKo": "헤롯 대왕 사망(BC 4년) 이전에 탄생하셨으므로 탄생은 약 BC 6–4년경이며, 십자가 수난·부활 연대는 유월절 금요일 역산에 따라 AD 30년설과 AD 33년설이 학계에 공존합니다.",
        "color": "#9a6d55",
        "keyPassages": [
            passage("LUKE.2.1-7", "아우구스투스 호적령 시기 베들레헴에서의 예수님 탄생 기사입니다."),
            passage("MARK.1.14-15", "하나님 나라가 가까이 왔음을 선포하신 갈릴리 공생애 출발점입니다."),
            passage("LUKE.24.46-48", "십자가 고난과 사흘 만의 부활, 열방 증인 파송을 요약하는 말씀입니다."),
        ],
        "sourceIds": BIBLE_CHRONO,
    },
    {
        "id": "early_church",
        "nameKo": "초대교회",
        "shortNameKo": "초대교회",
        "summaryKo": "오순절 성령 강림 이후 예루살렘에서 유대·사마리아·로마 세계로 복음이 확장되고 신약 서신이 기록된 시기입니다.",
        "datePrecision": "estimated",
        "displayPeriodKo": "AD 30–약 100년",
        "startYear": 30,
        "endYear": 100,
        "color": "#577b8a",
        "keyPassages": [
            passage("ACTS.1.8", "예루살렘과 온 유대와 사마리아와 땅끝까지 이르는 선교 이정표입니다."),
            passage("ACTS.2.1-4", "오순절 성령 강림과 초대교회 공동체의 탄생 기록입니다."),
            passage("ACTS.28.30-31", "바울이 로마에서 담대히 하나님 나라와 주 예수 그리스도를 전파한 결말입니다."),
        ],
        "sourceIds": BIBLE_CHRONO,
    },
]

ROLE_LABELS = {
    "polity": "왕국·제국",
    "ruler": "왕·통치자",
    "prophet_priest": "선지자·사사·제사장",
    "person": "주요 인물",
    "event": "역사적 사건",
}

items: list[dict] = []


def add_relative_item(
    item_id: str,
    name: str,
    category: str,
    era_id: str,
    rel_order: int,
    rel_span: int,
    period_kind: str,
    display_period: str,
    summary: str,
    passages_list: list[tuple[str, str]],
    *,
    role_label: str | None = None,
    secondary: list[tuple[str, str]] | None = None,
    hypotheses: str | None = None,
    divergent: str | None = None,
    contemporaries: list[str] | None = None,
    related: list[str] | None = None,
) -> None:
    row: dict = {
        "id": item_id,
        "nameKo": name,
        "roleLabelKo": role_label or ROLE_LABELS[category],
        "category": category,
        "eraIds": era_id.split(","),
        "recordType": "biblical_record",
        "periodKind": period_kind,
        "periodScale": "relative_sequence",
        "datePrecision": "undetermined",
        "displayPeriodKo": display_period,
        "startYear": None,
        "endYear": None,
        "relativeOrder": rel_order,
        "relativeSpan": rel_span,
        "summaryKo": summary,
        "passages": [passage(r, desc) for r, desc in passages_list],
        "sourceIds": BIBLE,
    }
    if secondary:
        row["secondaryPeriods"] = [{"periodKind": k, "displayKo": d} for k, d in secondary]
    if hypotheses:
        row["dateHypothesesKo"] = hypotheses
    if divergent:
        row["divergentViewsKo"] = divergent
    if contemporaries:
        row["contemporaryItemIds"] = contemporaries
    if related:
        row["relatedItemIds"] = related
    items.append(row)


def add_dated_item(
    item_id: str,
    name: str,
    category: str,
    era: str,
    start: int,
    end: int,
    passages_list: list[tuple[str, str]],
    summary: str,
    *,
    kind: str | None = None,
    scale: str | None = None,
    precision: str = "estimated",
    display_period: str | None = None,
    role_label: str | None = None,
    record: str = "biblical_record",
    secondary: list[tuple[str, str]] | None = None,
    hypotheses: str | None = None,
    divergent: str | None = None,
    note: str | None = None,
    contemporaries: list[str] | None = None,
    related: list[str] | None = None,
) -> None:
    period_kind = kind or (
        "reign"
        if category == "ruler"
        else "polity_span"
        if category == "polity"
        else "event"
        if category == "event"
        else "ministry"
    )
    period_scale = scale or (
        "point_or_brief"
        if (category == "event" and abs(end - start) <= 1)
        else "actual_duration"
    )
    row: dict = {
        "id": item_id,
        "nameKo": name,
        "roleLabelKo": role_label or ROLE_LABELS[category],
        "category": category,
        "eraIds": era.split(","),
        "recordType": record,
        "periodKind": period_kind,
        "periodScale": period_scale,
        "datePrecision": precision,
        "displayPeriodKo": display_period or format_year_span(start, end, precision),
        "startYear": start,
        "endYear": end,
        "summaryKo": summary,
        "passages": [passage(r, desc) for r, desc in passages_list],
        "sourceIds": EXTERNAL_SRC if record == "external_history" else BIBLE_CHRONO,
    }
    if secondary:
        row["secondaryPeriods"] = [{"periodKind": k, "displayKo": d} for k, d in secondary]
    if hypotheses:
        row["dateHypothesesKo"] = hypotheses
    if divergent:
        row["divergentViewsKo"] = divergent
    if note:
        row["externalHistoryNoteKo"] = note
    if contemporaries:
        row["contemporaryItemIds"] = contemporaries
    if related:
        row["relatedItemIds"] = related
    items.append(row)


# =====================================================================
# 2A. 원역사 (Slots 1..4) — 연도 비부여 상대 순서
# =====================================================================
add_relative_item(
    "event-creation",
    "창조",
    "event",
    "primeval",
    1,
    1,
    "narrative_time",
    "연대 미확정 · 원역사 순서 1",
    "창세기 1–2장에 기록된 하나님의 천지 만물과 인간 창조 서사입니다.",
    [("GEN.1.1-5", "태초에 말씀으로 빛과 천지를 창조하신 선언입니다."), ("GEN.2.7", "사람을 지으시고 생기를 불어넣으신 기사입니다.")],
)
add_relative_item(
    "event-fall",
    "인간의 타락",
    "event",
    "primeval",
    2,
    1,
    "narrative_time",
    "연대 미확정 · 원역사 순서 2",
    "에덴동산에서의 불순종과 원복음 약속(창 3:15), 가인과 아벨 이야기로 이어지는 본문입니다.",
    [("GEN.3.1-6", "선악을 알게 하는 나무 열매 사건과 불순종의 기원입니다."), ("GEN.3.15", "여자의 후손을 통한 구원 약속(원복음)입니다.")],
)
add_relative_item(
    "event-flood",
    "노아의 홍수",
    "event",
    "primeval",
    3,
    1,
    "narrative_time",
    "연대 미확정 · 원역사 순서 3",
    "온 땅의 포악함에 대한 홍수 심판과 방주를 통한 보존, 무지개 언약으로 새 출발을 다루는 본문입니다.",
    [("GEN.6.9-14", "당대에 의인이던 노아에게 방주 건축을 명하신 본문입니다."), ("GEN.9.12-16", "다시는 물로 멸하지 않겠다 하신 무지개 언약입니다.")],
)
add_relative_item(
    "event-babel",
    "바벨탑",
    "event",
    "primeval",
    4,
    1,
    "narrative_time",
    "연대 미확정 · 원역사 순서 4",
    "시날 평지에서 탑을 쌓아 이름을 내려던 인류의 언어를 혼잡하게 하시고 온 지면에 흩으신 사건입니다.",
    [("GEN.11.1-9", "바벨탑 사건과 민족·언어 분화의 배경이며 곧바로 아브라함 계보로 이어집니다.")],
)

# =====================================================================
# 2B. 족장 시대 (Slots 5..12) — 본문 내 세대 연수·순서 반영 (아브라함 [5..8) ↔ 요셉 [9..12) 완전 분리!)
# =====================================================================
add_relative_item(
    "event-abraham-call", "아브라함의 부르심", "event", "patriarchs", 5, 1,
    "event", "본문 서사 순서 · 아브라함 75세",
    "하나님이 아브라함을 부르시고 땅과 자손, 열방에 미칠 복을 약속하셨습니다.",
    [("GEN.12.1-4", "하란을 떠나라는 부르심과 언약의 말씀입니다.")],
    related=["item-abraham"],
)
add_relative_item(
    "event-isaac-birth", "약속의 아들 이삭 탄생", "event", "patriarchs", 6, 1,
    "event", "본문 서사 순서 · 아브라함 100세",
    "하나님이 약속하신 대로 사라가 이삭을 낳아 족장 언약이 다음 세대로 이어졌습니다.",
    [("GEN.21.1-5", "사라가 이삭을 낳았을 때 아브라함은 100세였습니다.")],
    related=["item-abraham", "item-isaac"],
)
add_relative_item(
    "event-jacob-israel", "야곱이 이스라엘로 불림", "event", "patriarchs", 8, 1,
    "event", "본문 서사 순서 · 얍복강 사건",
    "야곱이 얍복강에서 씨름한 뒤 이스라엘이라는 이름을 받았습니다.",
    [("GEN.32.24-30", "야곱이 이스라엘이라는 새 이름을 받은 기록입니다.")],
    related=["item-jacob"],
)
add_relative_item(
    "event-joseph-ruler", "요셉이 애굽 통치자가 됨", "event", "patriarchs", 10, 1,
    "event", "본문 서사 순서 · 요셉 30세",
    "바로의 꿈을 해석한 요셉이 애굽을 다스리게 되어 뒤이은 기근에 대비했습니다.",
    [("GEN.41.39-46", "바로가 요셉에게 애굽 온 땅을 맡긴 기록입니다.")],
    related=["item-joseph"],
)
add_relative_item(
    "event-jacob-egypt", "야곱 가족의 애굽 이주", "event", "patriarchs", 11, 1,
    "event", "본문 서사 순서 · 야곱 130세",
    "기근 중 야곱과 가족이 요셉이 있는 애굽으로 내려가 생명을 보존했습니다.",
    [("GEN.46.1-7", "야곱이 가족과 함께 애굽으로 내려간 기록입니다."),
     ("GEN.47.9", "야곱이 바로 앞에서 자신의 나이를 130세라 밝힌 기록입니다.")],
    related=["item-jacob", "item-joseph"],
)
add_relative_item(
    "item-abraham",
    "아브라함",
    "person",
    "patriarchs",
    5,
    3,
    "lifespan",
    "본문 기록 수명 175세 (가나안 100년)",
    "75세에 부르심을 받아 하란을 떠났고, 100세에 이삭을 얻었으며 175세(손자 야곱 15세 때)에 별세한 믿음의 조상입니다.",
    [
        ("GEN.12.1-4", "75세에 여호와의 말씀을 따라 하란을 떠나 가나안으로 들어간 소명 본문입니다."),
        ("GEN.21.5", "아브라함 100세에 약속의 아들 이삭이 태어난 기록입니다."),
        ("GEN.25.7-8", "향년 175세로 숨을 거두어 막벨라 굴에 장사된 기록입니다."),
    ],
    role_label="족장 · 언약의 시조",
    secondary=[
        ("ministry", "하란 출발(75세)부터 별세(175세)까지 가나안 나그네 여정 100년"),
        ("narrative_time", "본문 세대 관계: 손자 야곱 15세 때 사망 (증손자 요셉은 아브라함 사후 약 76년 뒤 출생)"),
    ],
    hypotheses="절대 연대 가설: 왕상 6:1 역산 초기설 약 BC 2166–1991년 · 중기 청동기 일반 배경설 약 BC 2000–1825년경",
    contemporaries=["item-isaac", "item-jacob"],
    related=["item-joseph"],
)
add_relative_item(
    "item-isaac",
    "이삭",
    "person",
    "patriarchs",
    6,
    3,
    "lifespan",
    "본문 기록 수명 180세",
    "아브라함 100세에 태어나 모리아산 순종을 거쳤고, 60세에 에서와 야곱을 낳았으며 향년 180세(요셉 29세 무렵)에 별세한 족장입니다.",
    [
        ("GEN.22.1-2", "모리아 땅 번제 시험 사건의 당사자로 등장합니다."),
        ("GEN.26.2-5", "그랄 기근 때 아브라함 언약을 계승받은 본문입니다."),
        ("GEN.35.28-29", "이삭이 향년 180세로 기럇아르바(헤브론)에서 별세한 기록입니다."),
    ],
    role_label="족장 · 언약 계승자",
    secondary=[("narrative_time", "아브라함과 75년, 야곱과 120년, 손자 요셉과 약 29년간 생존 기간이 겹침")],
    hypotheses="절대 연대 가설: 초기설 약 BC 2066–1886년 · 중기 청동기 일반 비정 BC 20–18세기경",
    contemporaries=["item-abraham", "item-jacob", "item-joseph"],
)
add_relative_item(
    "item-jacob",
    "야곱",
    "person",
    "patriarchs",
    7,
    3,
    "lifespan",
    "본문 기록 수명 147세 (130세 애굽 이주)",
    "이삭 60세(아브라함 160세)에 태어나 얍복강에서 ‘이스라엘’이라는 이름을 받았고, 열두 아들을 두었으며 130세에 애굽으로 내려가 147세에 별세했습니다.",
    [
        ("GEN.25.26", "이삭이 60세일 때 리브가에게서 에서와 야곱이 태어난 기록입니다."),
        ("GEN.32.28", "얍복강 나루에서 ‘이스라엘’로 개명받은 전환점입니다."),
        ("GEN.47.9", "애굽 바로 앞에서 자신의 나그네 세월이 130년이라 밝힌 본문입니다."),
        ("GEN.47.28", "애굽에서 17년을 더 살고 향년 147세로 별세한 기록입니다."),
    ],
    role_label="족장 · 12지파의 조상",
    secondary=[("narrative_time", "15세까지 조부 아브라함 생존 · 약 91세에 요셉 출생 · 130세 애굽 이주")],
    hypotheses="절대 연대 가설: 초기설 약 BC 2006–1859년 · 중기 청동기 일반 비정 BC 19–18세기경",
    contemporaries=["item-abraham", "item-isaac", "item-joseph"],
)
add_relative_item(
    "item-joseph",
    "요셉",
    "person",
    "patriarchs",
    9,
    3,
    "lifespan",
    "본문 기록 수명 110세 (30세 애굽 총리)",
    "야곱의 노년(약 91세, 아브라함 사후 약 76년)에 태어나 17세에 애굽에 팔려 갔으나, 30세에 총리가 되어 기근 속 야곱 가문을 보존하고 110세에 별세했습니다.",
    [
        ("GEN.37.2", "17세 소년 시절 형들과 함께 양을 치던 서사의 시작입니다."),
        ("GEN.41.46", "30세에 애굽 왕 바로 앞에 서서 총리로 임명된 연대 기준 구절입니다."),
        ("GEN.45.4-8", "형들에게 하나님의 구원 섭리를 고백하며 화해하는 본문입니다."),
        ("GEN.50.26", "출애굽 소망을 유언하고 향년 110세에 별세한 창세기 마지막 절입니다."),
    ],
    role_label="족장 세대 · 애굽 총리",
    secondary=[
        ("reign", "30세 총리 등극부터 110세 별세까지 애굽 총리 재임 약 80년"),
        ("narrative_time", "아브라함 사후 약 76년 뒤 출생 (아브라함과 생존 기간이 겹치지 않음)"),
    ],
    hypotheses="절대 연대 가설: 초기설 약 BC 1915–1805년 · 힉소스/중왕국 말기 비정설 등 학계 논의 존재",
    contemporaries=["item-isaac", "item-jacob"],
    related=["item-abraham"],
)

# =====================================================================
# 2C. 출애굽 시대 (Slots 13..16) — 광야 약 40년 규모 실제 기간 vs 초기·후기 연대 가설 분리
# =====================================================================
add_relative_item(
    "item-exodus",
    "출애굽 사건",
    "event",
    "exodus",
    13,
    1,
    "event",
    "출애굽 당해 단기 사건",
    "열 재앙과 유월절 어린양 피로 구원받아 애굽에서 탈출하고 홍해를 건넌 구약 구속사의 중심 사건입니다(지속 기간이 아닌 발생 시점 사건).",
    [
        ("EXOD.12.31-36", "유월절 밤 이스라엘 자손이 애굽에서 떠나온 출애굽 본문입니다."),
        ("EXOD.14.21-22", "홍해가 갈라져 마른 땅으로 건넌 구원 사건입니다."),
    ],
    hypotheses="발생 연대 가설: 초기설 약 BC 1446년경(왕상 6:1 문자 역산) · 후기설 약 BC 1260년경(출 1:11 국고성 비정 고고학)",
    divergent="기존에 BC 1450–1200년으로 넓게 표기되던 구간은 사건이 250년간 지속되었다는 뜻이 아니라 초기설과 후기설 사이의 발생 가능 연대 폭을 뜻합니다.",
    related=["item-moses", "item-aaron", "item-sinai"],
)
add_relative_item(
    "item-sinai",
    "시내산 언약",
    "event",
    "exodus",
    14,
    1,
    "event",
    "시내산 체류 약 1년",
    "출애굽 첫해 셋째 달 시내 광야 도착(출 19:1)부터 둘째 해 둘째 달 스무날 출발(민 10:11)까지 약 1년간 십계명·언약 체결 및 성막을 건립한 사건입니다.",
    [
        ("EXOD.19.1-6", "출애굽 후 셋째 달 시내산에 이르러 언약을 맺은 기록입니다."),
        ("EXOD.40.17", "출애굽 제2년 첫째 달 초하루에 성막이 세워진 기록입니다."),
        ("NUM.10.11-12", "제2년 둘째 달 스무날 시내 광야를 떠난 시점 기록입니다."),
    ],
    hypotheses="발생 연대 가설: 출애굽 시점 직후 약 1년 (초기설 BC 15세기 중엽 / 후기설 BC 13세기 중엽)",
    related=["item-moses", "item-aaron", "item-exodus"],
)
add_relative_item(
    "event-manna", "만나와 메추라기", "event", "exodus", 13, 1,
    "event", "출애굽 후 · 시내산 도착 전",
    "광야에서 먹을 것이 없어 원망하던 백성에게 하나님이 만나와 메추라기를 공급하셨습니다.",
    [("EXOD.16.13-18", "메추라기가 진을 덮고 아침에는 만나가 내려 백성이 거둔 기록입니다.")],
    related=["item-exodus", "item-moses"],
)
add_relative_item(
    "event-golden-calf", "금송아지와 언약 갱신", "event", "exodus", 14, 1,
    "event", "시내산 체류 중",
    "백성이 금송아지를 만들었으나 모세의 중보 후 하나님이 언약을 새롭게 하셨습니다.",
    [("EXOD.32.1-6", "백성이 금송아지를 만들어 제사를 드린 기록입니다."),
     ("EXOD.34.1-10", "새 돌판을 만들고 언약을 다시 세우신 기록입니다.")],
    related=["item-sinai", "item-moses", "item-aaron"],
)
add_relative_item(
    "event-spies", "정탐꾼과 광야 40년", "event", "exodus", 15, 1,
    "event", "가데스 바네아 · 광야 여정",
    "가나안을 정탐한 뒤 백성이 불신하여 그 세대가 광야에서 40년을 지내게 되었습니다.",
    [("NUM.13.25-33", "정탐꾼들이 가나안에서 돌아와 보고한 기록입니다."),
     ("NUM.14.26-35", "광야에서 40년을 지내게 된 판결입니다.")],
    related=["item-moses"],
)
add_relative_item(
    "event-bronze-serpent", "놋뱀 사건", "event", "exodus", 15, 1,
    "event", "광야 여정 중",
    "불뱀에 물린 백성이 하나님의 명령에 따라 세운 놋뱀을 바라보고 살아났습니다.",
    [("NUM.21.4-9", "모세가 만든 놋뱀을 바라본 사람이 살아난 기록입니다.")],
    related=["item-moses"],
)
add_relative_item(
    "event-moses-farewell", "모세의 고별과 여호수아 위임", "event", "exodus", 16, 1,
    "event", "광야 40년 끝 · 모압 평지",
    "모세가 백성 앞에서 여호수아를 후계자로 세우고 가나안 입성을 앞둔 세대를 격려했습니다.",
    [("DEUT.31.1-8", "모세가 여호수아에게 담대히 백성을 인도하라고 명한 기록입니다.")],
    related=["item-moses", "item-joshua"],
)
add_relative_item(
    "item-moses",
    "모세",
    "person",
    "exodus",
    13,
    3,
    "ministry",
    "출애굽·광야 인도 약 40년 (80–120세)",
    "80세에 호렙산 떨기나무에서 부르심을 받아 출애굽과 시내산 언약, 40년 광야 여정을 인도하고 120세에 느보산에서 별세한 지도자입니다.",
    [
        ("EXOD.3.1-10", "호렙산에서 애굽 백성을 인도하라는 소명을 받은 본문입니다."),
        ("EXOD.7.7", "바로에게 말할 때 모세는 80세, 아론은 83세였음을 명시한 구절입니다."),
        ("DEUT.34.5-7", "모세가 모압 땅에서 죽을 때 나이 120세였다고 기록한 구절입니다."),
    ],
    role_label="출애굽 지도자 · 선지자",
    secondary=[
        ("lifespan", "본문 기록 수명 120세 (애굽 40년 · 미디안 40년 · 출애굽·광야 사역 40년, 행 7:23, 30, 36)"),
    ],
    hypotheses="사역 연대 가설: 초기 연대설 약 BC 1446–1406년 · 후기 연대설 약 BC 1260–1220년경",
    contemporaries=["item-aaron", "item-joshua"],
    related=["item-exodus", "item-sinai"],
)
add_relative_item(
    "item-aaron",
    "아론",
    "prophet_priest",
    "exodus",
    13,
    3,
    "ministry",
    "대제사장·동역 약 40년 (83–123세)",
    "모세의 형으로서 83세부터 출애굽 대변자로 동역하고 이스라엘 초대 대제사장으로 위임받았으며, 출애굽 제40년에 123세로 호르산에서 별세했습니다.",
    [
        ("EXOD.28.1", "아론과 그의 아들들을 제사장 직분에 위임하신 본문입니다."),
        ("LEV.8.1-12", "회막 문에서 아론에게 관유를 부어 성별한 위임식입니다."),
        ("NUM.33.38-39", "출애굽 제40년 다섯째 달 초하루에 아론이 123세로 호르산에서 죽은 기록입니다."),
    ],
    role_label="초대 대제사장",
    secondary=[("lifespan", "본문 기록 수명 123세 (민 33:39)")],
    hypotheses="사역 연대 가설: 초기 연대설 약 BC 1446–1406년 · 후기 연대설 약 BC 1260–1220년경",
    contemporaries=["item-moses", "item-joshua"],
    related=["item-exodus", "item-sinai"],
)

# =====================================================================
# 2D. 정복·사사 시대 (Slots 17..25) — 본문 서사 순서 및 기록 수명·재임 연수 표시 (사사 간 억지 동시대 배제)
# =====================================================================
add_relative_item(
    "item-joshua",
    "여호수아",
    "person",
    "conquest_judges",
    17,
    2,
    "ministry",
    "가나안 정복·분배 영도 (본문 수명 110세)",
    "모세의 수종자로 훈련받은 뒤 요단강 도하, 가나안 정복 전쟁과 열두 지파 땅 분배, 세겜 언약 갱신을 이끌고 110세에 별세했습니다.",
    [
        ("JOSH.1.1-9", "모세 사후 가나안 입성 지도자로 세움받은 본문입니다."),
        ("JOSH.24.14-15", "세겜에서 오직 여호와만 섬기기로 언약을 갱신한 고별 연설입니다."),
        ("JOSH.24.29", "눈의 아들 여호수아가 110세에 별세했음을 기록한 구절입니다."),
    ],
    role_label="정복기 지도자",
    secondary=[("lifespan", "본문 기록 수명 110세 (수 24:29)")],
    hypotheses="정복 시작 가설: 초기 연대설 약 BC 1406년경 · 후기 연대설 약 BC 1220년경",
    contemporaries=["item-moses", "item-aaron"],
    related=["item-othniel"],
)
add_relative_item(
    "item-othniel",
    "옷니엘",
    "prophet_priest",
    "conquest_judges",
    19,
    1,
    "ministry",
    "초기 사사 (본문 기록 평온 40년)",
    "갈렙의 아우 그나스의 아들로서 메소포타미아 왕 구산리사다임의 압제에서 이스라엘을 구원한 사사기의 첫 번째 사사입니다.",
    [("JUDG.3.9-11", "여호와의 영이 임하여 구산리사다임을 이기고 그 땅이 40년간 평온했던 기록입니다.")],
    role_label="사사",
    hypotheses="사사기 서사 순서 1번째 사사 (절대 BC 연도는 미확정)",
    related=["item-joshua"],
)
add_relative_item(
    "item-ehud",
    "에훗",
    "prophet_priest",
    "conquest_judges",
    20,
    1,
    "ministry",
    "사사 (본문 기록 평온 80년)",
    "베냐민 지파 왼손잡이 구원자로서 모압 왕 에글론의 18년 압제로부터 이스라엘을 구원했습니다.",
    [("JUDG.3.15-30", "모압의 압제를 꺾고 그 땅이 80년 동안 평온했던 기록입니다.")],
    role_label="사사",
    hypotheses="사사기 서사 순서 2번째 주요 사사 (절대 BC 연도 미확정)",
)
add_relative_item(
    "item-deborah",
    "드보라",
    "prophet_priest",
    "conquest_judges",
    21,
    1,
    "ministry",
    "사사·여선지자 (본문 기록 평온 40년)",
    "바락과 함께 하솔 왕 야빈의 철병거 군대장관 시스라를 기손강 전투에서 물리치고 승리의 노래를 부른 사사이자 여선지자입니다.",
    [
        ("JUDG.4.4-9", "에브라임 산지에서 이스라엘을 다스리며 바락을 부른 본문입니다."),
        ("JUDG.5.31", "승리 노래 말미에 그 땅이 40년 동안 평온했다고 기록한 구절입니다."),
    ],
    role_label="사사 · 여선지자",
    hypotheses="사사기 중기 서사 (절대 연대 및 다른 지역 사사와의 중첩 여부는 미확정)",
)
add_relative_item(
    "item-gideon",
    "기드온",
    "prophet_priest",
    "conquest_judges",
    22,
    1,
    "ministry",
    "사사 (본문 기록 평온 40년)",
    "부르심을 받아 바알 제단을 헐고 300명의 용사로 미디안 대군의 압제에서 이스라엘을 건져 낸 사사입니다.",
    [
        ("JUDG.6.11-14", "포도주 틀에서 밀을 타작하던 기드온을 부르신 소명 기사입니다."),
        ("JUDG.7.7", "300명으로 미디안을 구원하시겠다는 하나님의 말씀입니다."),
        ("JUDG.8.28", "기드온이 사는 40년 동안 그 땅이 평온했다는 기록입니다."),
    ],
    role_label="사사",
    hypotheses="사사기 중기 서사 (절대 BC 연도 및 타 지역 사사와의 동시대 여부는 확정할 수 없음)",
)
add_relative_item(
    "item-jephthah",
    "입다",
    "prophet_priest",
    "conquest_judges",
    23,
    1,
    "ministry",
    "사사 재임 6년 (본문 기록)",
    "길르앗 출신 용사로서 요단 동편 암몬 자손의 압제를 물리치고 이스라엘의 사사로 6년간 다스렸습니다.",
    [
        ("JUDG.11.29-33", "여호와의 영이 임하여 암몬 자손을 크게 무찌른 기록입니다."),
        ("JUDG.12.7", "입다가 이스라엘의 사사가 된 지 6년이라 명시한 구절입니다."),
    ],
    role_label="사사",
    hypotheses="사사기 후기 요단 동편 사사 (암몬·블레셋 동시 압제기 배경, 삿 10:7)",
    related=["item-samson"],
)
add_relative_item(
    "item-samson",
    "삼손",
    "prophet_priest",
    "conquest_judges",
    24,
    1,
    "ministry",
    "사사 재임 20년 (본문 기록)",
    "출생부터 나실인으로 구별되어 블레셋 사람의 지배 시대에 20년 동안 이스라엘의 사사로 활동하며 구원을 시작했습니다.",
    [
        ("JUDG.13.5", "태에서부터 나실인이 되어 블레셋 손에서 구원하기 시작하리라는 출생 예고입니다."),
        ("JUDG.16.30-31", "블레셋 사람의 때에 삼손이 이스라엘 사사로 20년 동안 지냈음을 명시한 구절입니다."),
    ],
    role_label="사사 · 나실인",
    hypotheses="사사기 말기 블레셋 압제기 (약 BC 11세기경 추정이나 정확한 개인 BC 연도는 미확정)",
    related=["item-jephthah", "item-samuel"],
)
add_relative_item(
    "item-ruth",
    "룻",
    "person",
    "conquest_judges",
    23,
    2,
    "narrative_time",
    "사사 시대 배경 서사 (다윗의 증조모)",
    "사사들이 치리하던 시대에 시어머니 나오미를 따라 베들레헴으로 와 보아스와 혼인하여 오벳(이새의 아버지, 다윗의 할아버지)을 낳은 여인입니다.",
    [
        ("RUTH.1.1", "사사들이 치리하던 때에 흉년이 들었다는 시대 배경 구절입니다."),
        ("RUTH.1.16", "어머니의 하나님이 나의 하나님이 되시리라는 신앙 고백입니다."),
        ("RUTH.4.17-22", "룻과 보아스에게서 오벳–이새–다윗으로 이어지는 계보입니다."),
    ],
    role_label="다윗 왕가의 조상",
    hypotheses="배경 시대는 사사기 후반(다윗 3대조 세대)이며, 책의 기록 시기는 왕정기설과 포로 후기설이 있습니다.",
    related=["item-david"],
)

# =====================================================================
# 3. 사사기 말기 ~ 통일왕국 (비례 연도축 시작: 약 BC 1075 ~ BC 931)
# =====================================================================
add_dated_item(
    "item-samuel",
    "사무엘",
    "prophet_priest",
    "conquest_judges,united_kingdom",
    -1075,
    -1015,
    [
        ("1SAM.3.19-20", "단에서 브엘세바까지 온 이스라엘이 사무엘을 여호와의 선지자로 알았다는 본문입니다."),
        ("1SAM.7.13-15", "미스바 회개 운동 이후 사무엘이 사는 날 동안 사사로 다스린 기록입니다."),
        ("1SAM.16.13", "베들레헴에서 다윗에게 기름을 부은 왕정 전환 사건입니다."),
    ],
    "마지막 사사이자 선지자로서 블레셋 위기 속 영적 각성을 이끌고 초대 왕 사울과 다윗에게 기름을 부어 왕정 시대를 열었습니다.",
    kind="ministry",
    precision="estimated",
    role_label="마지막 사사 · 선지자",
    secondary=[("lifespan", "출생 약 BC 1105년경 ~ 사울 말기(약 BC 1015년경) 별세 추정")],
    contemporaries=["item-saul", "item-david"],
    related=["item-samson"],
)
add_dated_item(
    "item-united-israel",
    "통일 이스라엘 왕국",
    "polity",
    "united_kingdom",
    -1050,
    -931,
    [
        ("2SAM.5.1-5", "온 이스라엘 지파가 헤브론에 모여 다윗을 왕으로 삼고 통일 왕정을 확립한 본문입니다."),
        ("1KGS.4.20-21", "솔로몬 시대에 유프라테스강에서 애굽 경계까지 이른 번영기 기록입니다."),
    ],
    "사울·다윗·솔로몬 세 왕이 열두 지파를 하나로 다스린 약 120년간의 통일 왕정 체제입니다.",
    precision="estimated",
    related=["item-saul", "item-david", "item-solomon", "item-division"],
)
add_dated_item(
    "item-saul",
    "사울",
    "ruler",
    "united_kingdom",
    -1050,
    -1010,
    [
        ("1SAM.10.1", "사무엘에게 기름 부음을 받아 초대 왕으로 세워진 기사입니다."),
        ("1SAM.15.22-23", "아말렉 전투 불순종으로 왕위가 버림받은 전환점입니다."),
        ("1SAM.31.1-6", "길보아산 블레셋 전투에서 아들 요나단과 함께 전사한 기록입니다."),
    ],
    "베냐민 지파 출신 이스라엘 초대 왕으로 암몬·블레셋과 맞섰으나 불순종 이후 길보아산에서 전사했습니다(행 13:21 40년 통치 전승).",
    precision="estimated",
    contemporaries=["item-samuel", "item-david"],
)
add_dated_item(
    "item-david",
    "다윗",
    "ruler",
    "united_kingdom",
    -1010,
    -970,
    [
        ("2SAM.5.4-5", "30세에 왕이 되어 헤브론에서 7년 6개월, 예루살렘에서 33년 도합 40년을 다스린 기록입니다."),
        ("2SAM.7.12-16", "영원한 왕위와 메시아 소망의 기초가 된 다윗 언약 본문입니다."),
        ("PS.51.1-4", "밧세바 사건 뒤 선지자 나단의 책망을 듣고 드린 참회 시편입니다."),
    ],
    "유다 지파 이새의 아들로 예루살렘을 수도로 정하고 언약궤를 안치했으며 영원한 다윗 언약을 받은 왕입니다.",
    precision="estimated",
    secondary=[("lifespan", "약 BC 1040–970년경 (30세 즉위 · 40년 재위, 삼하 5:4)")],
    contemporaries=["item-samuel", "item-saul", "item-solomon"],
    related=["item-ruth", "item-united-israel"],
)
add_dated_item(
    "item-solomon",
    "솔로몬",
    "ruler",
    "united_kingdom",
    -970,
    -931,
    [
        ("1KGS.3.9", "백성을 재판할 지혜롭고 분별력 있는 마음을 구한 기도입니다."),
        ("1KGS.6.1", "솔로몬 즉위 제4년 예루살렘 성전 건축을 시작한 연대 기준 구절입니다."),
        ("1KGS.11.9-13", "말년 우상숭배로 인해 사후 왕국이 분열되리라는 예고입니다."),
    ],
    "다윗의 뒤를 이어 예루살렘 제1성전을 완공하고 지혜와 무역으로 전성기를 누렸으나, 말년 과중한 역역과 우상숭배로 분열의 원인을 남겼습니다.",
    precision="estimated",
    contemporaries=["item-david", "item-rehoboam", "item-jeroboam-i"],
    related=["item-united-israel", "item-division"],
)

# =====================================================================
# 4. 분열왕국 & 유다 단독왕국 (BC 931 ~ BC 586) — 누락 통치자 보완 및 사료 연대 정밀화
# =====================================================================
add_dated_item(
    "item-division",
    "왕국 분열",
    "event",
    "divided_kingdom",
    -931,
    -930,
    [("1KGS.12.16-20", "세겜 협상 결렬로 북쪽 열 지파가 여로보암을 왕으로 세우고 남유다와 갈라진 사건입니다.")],
    "솔로몬 사후 르호보암의 강경책에 반발해 북이스라엘(열 지파)과 남유다(유다·베냐민)로 왕국이 나뉜 사건입니다.",
    scale="point_or_brief",
    precision="estimated",
    display_period="약 BC 931/930년",
    related=["item-solomon", "item-rehoboam", "item-jeroboam-i", "item-north-israel", "item-judah"],
)
add_dated_item(
    "item-north-israel",
    "북이스라엘 왕국",
    "polity",
    "divided_kingdom",
    -931,
    -722,
    [("1KGS.12.20", "온 이스라엘이 여로보암을 왕으로 세워 북왕국이 출범한 기사입니다."), ("2KGS.17.6", "BC 722년 앗수르에 사마리아가 함락되어 멸망한 기록입니다.")],
    "여로보암 1세부터 마지막 왕 호세아까지 19명의 왕이 9개 왕조 교체를 겪으며 존속하다 BC 722년 앗수르에 멸망한 북왕국입니다.",
    precision="estimated",
    display_period="약 BC 931–BC 722년",
    related=["item-division", "item-samaria-fall", "item-assyrian-empire"],
)
add_dated_item(
    "item-judah",
    "남유다 왕국",
    "polity",
    "divided_kingdom,judah_alone",
    -931,
    -586,
    [("1KGS.12.21", "유다와 베냐민 족속을 중심으로 다윗 왕조가 이어진 본문입니다."), ("2KGS.25.8-10", "BC 586년 바벨론에 의해 예루살렘이 함락된 기록입니다.")],
    "예루살렘과 성전을 중심으로 다윗 왕조 혈통이 약 345년간 지속되다 BC 586년 신바벨론에 함락된 남왕국입니다.",
    precision="estimated",
    display_period="약 BC 931–BC 586년",
    related=["item-division", "item-jerusalem-fall", "item-babylonian-empire"],
)
add_dated_item(
    "item-jeroboam-i",
    "여로보암 1세",
    "ruler",
    "divided_kingdom",
    -931,
    -910,
    [("1KGS.12.28-30", "단과 벧엘에 금송아지를 세워 북왕국 혼합 예배의 시초가 된 사건입니다.")],
    "분열된 북이스라엘의 초대 왕으로 22년간 통치하며 단과 벧엘에 금송아지 산당을 세웠습니다.",
    precision="estimated",
    role_label="북이스라엘 초대 왕",
    contemporaries=["item-solomon", "item-rehoboam", "item-asa"],
    related=["item-division"],
)
add_dated_item(
    "item-rehoboam",
    "르호보암",
    "ruler",
    "divided_kingdom",
    -931,
    -913,
    [("1KGS.12.1-15", "원로들의 조언을 버리고 가혹한 역역을 고집해 분열을 초래한 본문입니다."), ("1KGS.14.25-26", "제5년에 애굽 왕 시삭이 예루살렘을 침공해 성전 보물을 탈취한 사건입니다.")],
    "솔로몬의 아들이자 분열 이후 남유다의 첫 왕으로 예루살렘에서 17년간 다스렸습니다.",
    precision="estimated",
    role_label="남유다 왕",
    contemporaries=["item-solomon", "item-jeroboam-i"],
    related=["item-division"],
)
add_dated_item(
    "item-asa",
    "아사",
    "ruler",
    "divided_kingdom",
    -911,
    -870,
    [("1KGS.15.11-14", "우상을 제거하고 조모 마아가를 태후 위에서 폐한 종교 개혁 기록입니다."), ("2CHR.14.11", "구스 사람 세라의 대군 앞에서 여호와께 부르짖은 기도입니다.")],
    "남유다 제3대 왕으로 41년간 재위하며 우상을 타파하는 신앙 개혁을 추진하고 북왕국 바아사와 대치했습니다.",
    precision="estimated",
    role_label="남유다 왕",
    contemporaries=["item-jeroboam-i", "item-baasha", "item-omri"],
)
add_dated_item(
    "item-baasha",
    "바아사",
    "ruler",
    "divided_kingdom",
    -909,
    -886,
    [("1KGS.15.16-17", "일평생 유다 왕 아사와 전쟁하며 라마를 건축해 유다를 압박한 기록입니다.")],
    "여로보암 왕가를 무너뜨리고 북이스라엘 제2왕조를 세워 디르사에서 24년간 다스린 왕입니다.",
    precision="estimated",
    role_label="북이스라엘 왕",
    contemporaries=["item-asa"],
)
add_dated_item(
    "item-omri",
    "오므리",
    "ruler",
    "divided_kingdom",
    -885,
    -874,
    [("1KGS.16.23-24", "사마리아 산을 사서 성을 건축하고 북왕국의 새 수도로 삼은 기록입니다.")],
    "사마리아를 건설해 북이스라엘 수도로 삼고 페니키아와 동맹해 국력을 키운 오므리 왕조의 창시자입니다(모압 비석에도 기록됨).",
    precision="estimated",
    role_label="북이스라엘 왕",
    contemporaries=["item-asa", "item-ahab"],
)
add_dated_item(
    "item-ahab",
    "아합",
    "ruler",
    "divided_kingdom",
    -874,
    -853,
    [("1KGS.16.30-33", "시돈 왕의 딸 이세벨과 혼인해 사마리아에 바알 신전을 세운 기록입니다."), ("1KGS.22.34-37", "길르앗 라못 전투에서 아람 군대의 화살에 맞아 전사한 기록입니다.")],
    "오므리의 아들로 이세벨과 함께 바알 숭배를 국가적으로 확산시켜 선지자 엘리야와 첨예하게 대립한 북이스라엘 왕입니다.",
    precision="confirmed",
    display_period="BC 874–853년",
    role_label="북이스라엘 왕",
    contemporaries=["item-jehoshaphat", "item-elijah", "item-omri"],
)
add_dated_item(
    "item-jehoshaphat",
    "여호사밧",
    "ruler",
    "divided_kingdom",
    -872,
    -848,
    [("2CHR.17.7-9", "방백들과 레위 사람들을 유다 여러 성읍에 보내 율법을 가르치게 한 개혁입니다."), ("2CHR.20.12", "모압·암몬 연합군 앞에서 오직 주만 바라본다고 고백한 기도입니다.")],
    "아사의 아들로 유다에 율법 교육과 사법 제도를 정비한 선한 왕이나, 북왕국 아합 가문과 통혼 동맹을 맺어 후대 위기의 씨앗을 남겼습니다.",
    precision="estimated",
    role_label="남유다 왕",
    contemporaries=["item-ahab", "item-joram-israel", "item-elijah", "item-elisha"],
)
add_dated_item(
    "item-elijah",
    "엘리야",
    "prophet_priest",
    "divided_kingdom",
    -870,
    -850,
    [("1KGS.17.1", "아합 왕 앞에서 수년 동안 비와 이슬이 내리지 않으리라 선포한 등장 구절입니다."), ("1KGS.18.36-39", "갈멜산 제단에 여호와의 불이 내려 온 백성이 엎드린 사건입니다."), ("2KGS.2.11", "회오리바람을 타고 하늘로 올라가며 엘리사에게 사역을 이양한 본문입니다.")],
    "북이스라엘 아합·아하시야 시대에 국가적 바알 숭배에 맞서 오직 여호와만이 참 하나님이심을 증명한 능력의 선지자입니다.",
    precision="estimated",
    role_label="북이스라엘 활동 선지자",
    contemporaries=["item-ahab", "item-jehoshaphat", "item-elisha", "item-joram-israel"],
)
add_dated_item(
    "item-joram-israel",
    "요람 (북이스라엘)",
    "ruler",
    "divided_kingdom",
    -852,
    -841,
    [("2KGS.3.1-3", "아합의 아들로 바알 주상을 제했으나 여로보암의 죄를 떠나지 않은 기록입니다."), ("2KGS.9.24", "예후의 반란 때 이스르엘 나봇의 토지에서 죽임을 당한 본문입니다.")],
    "아합의 아들이자 오므리 왕조의 마지막 왕으로 엘리사 시대에 재위하다 예후에게 숙청되었습니다.",
    precision="confirmed",
    display_period="BC 852–841년",
    role_label="북이스라엘 왕",
    contemporaries=["item-jehoshaphat", "item-elisha", "item-jehu"],
)
add_dated_item(
    "item-elisha",
    "엘리사",
    "prophet_priest",
    "divided_kingdom",
    -850,
    -797,
    [("2KGS.2.9-14", "엘리야의 겉옷을 취하여 갑절의 영감을 이어받은 본문입니다."), ("2KGS.5.14", "아람 장군 나아만의 나병을 요단강에서 치유한 사건입니다."), ("2KGS.13.14-20", "북왕국 요아스 시대에 병들어 죽기까지 예언 사역을 감당한 말년 기록입니다.")],
    "엘리야의 후계자로서 요람·예후·요아스 시대에 걸쳐 약 50여 년간 북이스라엘에서 긍휼과 구원의 기적 사역을 감당한 선지자입니다.",
    precision="estimated",
    role_label="북이스라엘 활동 선지자",
    contemporaries=["item-elijah", "item-joram-israel", "item-jehu", "item-joash-israel", "item-joash-judah"],
)
add_dated_item(
    "item-jehu",
    "예후",
    "ruler",
    "divided_kingdom",
    -841,
    -814,
    [("2KGS.9.1-6", "엘리사가 보낸 선지자의 생도에게 기름 부음을 받아 아합 가문 심판을 명받은 본문입니다."), ("2KGS.10.28", "예후가 이스라엘 중에서 바알을 멸하였으나 금송아지 숭배는 떠나지 않은 기록입니다.")],
    "오므리 왕조와 바알 숭배자들을 숙청하고 북이스라엘 최장수 왕조(예후 왕조)를 열어 28년간 통치한 왕입니다(앗수르 검은 오벨리스크 BC 841년 기록).",
    precision="confirmed",
    display_period="BC 841–814년",
    role_label="북이스라엘 왕",
    contemporaries=["item-elisha", "item-athaliah", "item-joash-judah"],
)
add_dated_item(
    "item-athaliah",
    "아달랴",
    "ruler",
    "divided_kingdom",
    -841,
    -835,
    [("2KGS.11.1-3", "왕의 씨를 진멸하고 왕위를 찬탈했으나 어린 요아스가 성전에 숨겨져 보존된 기록입니다.")],
    "아합과 이세벨의 딸이자 유다 여호람의 왕비로서 아들 아하시야 사후 유다 왕위를 6년간 찬탈한 통치자입니다.",
    precision="confirmed",
    display_period="BC 841–835년",
    role_label="남유다 왕위 찬탈자",
    contemporaries=["item-jehu", "item-joash-judah"],
)
add_dated_item(
    "item-joash-judah",
    "유다 요아스",
    "ruler",
    "divided_kingdom",
    -835,
    -796,
    [("2KGS.11.12", "제사장 여호야다의 주도로 7세에 왕위에 올라 언약을 세운 본문입니다."), ("2KGS.12.4-12", "헌금함을 두어 예루살렘 성전의 퇴락한 곳을 수리한 기록입니다.")],
    "아달랴의 학살에서 살아남아 7세에 즉위한 남유다 왕으로, 대제사장 여호야다 생전에는 성전을 수리하며 정직히 행했습니다.",
    precision="estimated",
    role_label="남유다 왕",
    contemporaries=["item-jehu", "item-elisha", "item-joash-israel"],
)
add_dated_item(
    "item-joash-israel",
    "북이스라엘 요아스",
    "ruler",
    "divided_kingdom",
    -798,
    -782,
    [("2KGS.13.14-19", "임종 직전의 선지자 엘리사를 찾아가 아람 격파 예언을 받은 장면입니다."), ("2KGS.13.25", "아람 왕 벤하닷에게서 빼앗겼던 성읍들을 세 번 쳐서 되찾은 기록입니다.")],
    "예후의 손자로 북이스라엘 국력을 회복하기 시작해 아들 여로보암 2세 번영기의 발판을 놓은 왕입니다.",
    precision="estimated",
    role_label="북이스라엘 왕",
    contemporaries=["item-elisha", "item-joash-judah", "item-amaziah"],
)
add_dated_item(
    "item-amaziah",
    "아마샤",
    "ruler",
    "divided_kingdom",
    -796,
    -767,
    [("2KGS.14.1-7", "유다 요아스의 아들로 에돔을 소금 골짜기에서 물리친 기록입니다.")],
    "남유다 요아스의 아들로 에돔 원정에 승리했으나 교만하여 북이스라엘 요아스와 싸우다 패배한 왕입니다(후반부는 아들 웃시야와 공동 섭정).",
    precision="estimated",
    role_label="남유다 왕",
    contemporaries=["item-joash-israel", "item-jeroboam-ii", "item-uzziah"],
)
add_dated_item(
    "item-jeroboam-ii",
    "여로보암 2세",
    "ruler",
    "divided_kingdom",
    -793,
    -753,
    [("2KGS.14.23-25", "선지자 요나의 예언대로 하맛 어귀에서 아라바 바다까지 북왕국 영토를 회복한 기록입니다.")],
    "공동 섭정을 포함해 41년간 재위하며 북이스라엘 최대의 영토 확장과 경제 호황을 이룬 왕이나 내부 부패가 심화되었습니다.",
    precision="estimated",
    role_label="북이스라엘 왕",
    contemporaries=["item-uzziah", "item-jonah", "item-amos", "item-hosea"],
)
add_dated_item(
    "item-uzziah",
    "웃시야",
    "ruler",
    "divided_kingdom",
    -792,
    -740,
    [("2CHR.26.1-5", "16세에 왕이 되어 하나님을 찾는 동안 형통했던 통치 기록입니다."), ("2CHR.26.16-21", "교만하여 성전 분향단에 분향하려다 나병이 발하여 별궁에 거한 말년 기록입니다.")],
    "아사랴로도 불리며 공동 섭정을 포함해 52년간 남유다의 군사·농업·무역 번영을 이끈 왕입니다. 그가 죽던 해에 이사야가 소명을 받았습니다.",
    precision="estimated",
    role_label="남유다 왕 (아사랴)",
    contemporaries=["item-jeroboam-ii", "item-jotham", "item-amos", "item-hosea", "item-isaiah"],
)
add_dated_item(
    "item-jonah",
    "요나",
    "prophet_priest",
    "divided_kingdom",
    -785,
    -755,
    [("2KGS.14.25", "가드헤벨 사람 아밋대의 아들 선지자 요나가 여로보암 2세 시대에 예언했음을 밝힌 구절입니다."), ("JONAH.1.1-3", "니느웨로 가라는 여호와의 말씀을 피해 다시스로 도망한 요나서 도입부입니다."), ("JONAH.4.11", "니느웨 백성과 가축까지 아끼시는 하나님의 자비를 일깨우는 결말입니다.")],
    "북이스라엘 여로보암 2세 시대에 활동한 선지자로, 적국 앗수르의 수도 니느웨에 회개를 선포한 요나서의 주인공입니다.",
    precision="estimated",
    role_label="선지자",
    divergent="인물 요나는 BC 8세기 전반(왕하 14:25)에 활동했으며, 요나서 본문의 최종 기록 시기에 대해서는 BC 8세기 이후부터 포로 후기까지 학설 차이가 있습니다.",
    contemporaries=["item-jeroboam-ii", "item-uzziah", "item-amos"],
)
add_dated_item(
    "item-amos",
    "아모스",
    "prophet_priest",
    "divided_kingdom",
    -760,
    -750,
    [("AMOS.1.1", "유다 왕 웃시야와 이스라엘 왕 여로보암 2세 시대 지진 전 2년에 받은 말씀 표제입니다."), ("AMOS.5.24", "오직 정의를 물같이, 공의를 마르지 않는 강같이 흐르게 하라는 핵심 선포입니다."), ("AMOS.7.14-15", "원래 목자요 뽕나무 재배자였으나 북이스라엘에 예언하도록 부름받았음을 밝힌 본문입니다.")],
    "남유다 드고아 출신 목자였으나 부름받아 북이스라엘 벧엘에 가서 번영 속 빈민 수탈과 형식적 예배를 준엄하게 꾸짖은 선지자입니다.",
    precision="estimated",
    role_label="선지자",
    contemporaries=["item-uzziah", "item-jeroboam-ii", "item-hosea", "item-jonah"],
)
add_dated_item(
    "item-hosea",
    "호세아",
    "prophet_priest",
    "divided_kingdom",
    -755,
    -722,
    [("HOS.1.1-2", "웃시야·요담·아하스·히스기야와 여로보암 2세 시대에 임한 말씀 표제입니다."), ("HOS.6.6", "나는 인애를 원하고 제사를 원하지 아니하며 하나님 아는 지식을 원한다는 말씀입니다."), ("HOS.11.8", "에브라임을 차마 버리지 못하시는 하나님의 아픈 사랑을 노래한 구절입니다.")],
    "여로보암 2세 말기부터 북이스라엘 멸망 직전까지 고멜과의 결혼 삶을 통해 반역한 백성을 향한 하나님의 신실한 사랑(헤세드)을 선포한 선지자입니다.",
    precision="estimated",
    role_label="선지자",
    contemporaries=["item-jeroboam-ii", "item-uzziah", "item-jotham", "item-ahaz", "item-amos", "item-isaiah", "item-micah", "item-hoshea-king"],
)
add_dated_item(
    "item-menahem",
    "므나헴",
    "ruler",
    "divided_kingdom",
    -752,
    -742,
    [("2KGS.15.19-20", "앗수르 왕 불(디글랏 빌레셀 3세)에게 은 천 달란트 조공을 바쳐 왕권을 유지한 기록입니다.")],
    "여로보암 2세 사후 혼란기에 왕위를 차지하고 앗수르에 무거운 조공을 바친 북이스라엘 왕입니다.",
    precision="confirmed",
    display_period="BC 752–742년",
    role_label="북이스라엘 왕",
    contemporaries=["item-uzziah", "item-jotham", "item-hosea"],
    related=["item-assyrian-empire"],
)
add_dated_item(
    "item-jotham",
    "요담",
    "ruler",
    "divided_kingdom",
    -750,
    -735,
    [("2KGS.15.32-35", "웃시야의 아들로 성전 윗문을 건축하고 여호와 보시기에 정직히 행한 기록입니다.")],
    "부친 웃시야의 나병 발병 이후 섭정을 거쳐 남유다를 다스리며 국방을 강화한 왕입니다(단독 퇴위 후 BC 732년경 사망).",
    precision="estimated",
    role_label="남유다 왕",
    contemporaries=["item-uzziah", "item-ahaz", "item-pekah", "item-isaiah", "item-micah", "item-hosea"],
)
add_dated_item(
    "item-pekah",
    "베가",
    "ruler",
    "divided_kingdom",
    -740,
    -732,
    [("2KGS.16.5", "아람 왕 르신과 동맹해 유다 아하스를 치러 예루살렘을 에워싼 시리아-에브라임 전쟁 기록입니다.")],
    "사마리아에서 반앗수르 노선을 걸으며 아람과 연합해 유다를 침공했다가 앗수르 침략을 초래한 북이스라엘 왕입니다(길르앗 경쟁 통치 포함 시 BC 752년 기산).",
    precision="estimated",
    role_label="북이스라엘 왕",
    contemporaries=["item-jotham", "item-ahaz", "item-isaiah", "item-hosea"],
)
add_dated_item(
    "item-ahaz",
    "아하스",
    "ruler",
    "divided_kingdom,judah_alone",
    -735,
    -715,
    [("2KGS.16.7-9", "이사야의 경고를 무시하고 앗수르 왕 디글랏 빌레셀에게 성전 은금을 바쳐 구원을 청한 사건입니다."), ("ISA.7.10-14", "두려워하던 아하스에게 주신 처녀 잉태 임마누엘 징조 예언입니다.")],
    "아람·북이스라엘 연합 침공 위기에 하나님 대신 앗수르를 의지하고 다메섹 제단을 본떠 예루살렘 성전을 훼손한 남유다 왕입니다.",
    precision="estimated",
    role_label="남유다 왕",
    contemporaries=["item-jotham", "item-pekah", "item-hoshea-king", "item-hezekiah", "item-isaiah", "item-micah", "item-hosea"],
)
add_dated_item(
    "item-hoshea-king",
    "호세아 (북이스라엘 왕)",
    "ruler",
    "divided_kingdom",
    -732,
    -722,
    [("2KGS.17.1-6", "앗수르에 조공을 바치다 애굽에 도움을 청하며 배반하여 사마리아가 3년 포위 끝에 함락된 기록입니다.")],
    "북이스라엘의 제19대 마지막 왕으로(선지자 호세아와 동명이인), 앗수르 살만에셀 5세·사르곤 2세에게 패해 북왕국이 멸망했습니다.",
    precision="confirmed",
    display_period="BC 732–722년",
    role_label="북이스라엘 마지막 왕",
    contemporaries=["item-ahaz", "item-hosea", "item-isaiah", "item-micah"],
    related=["item-samaria-fall", "item-assyrian-empire"],
)
add_dated_item(
    "item-isaiah",
    "이사야",
    "prophet_priest",
    "divided_kingdom,judah_alone",
    -740,
    -698,
    [("ISA.6.1-8", "웃시야 왕이 죽던 해 성전 보좌 환상 가운데 ‘내가 여기 있나이다 나를 보내소서’ 응답한 소명장입니다."), ("ISA.37.14-20", "산헤립의 협박 편지를 성전에 펴 놓고 기도한 히스기야에게 구원 응답을 전한 본문입니다."), ("ISA.53.4-6", "장차 오실 고난받는 여호와의 종의 대속을 노래한 예언입니다.")],
    "웃시야가 죽던 해(BC 740년)부터 요담·아하스·히스기야 시대에 예루살렘에서 사역하며 거룩하신 하나님과 메시아 소망을 선포한 선지자입니다.",
    precision="estimated",
    role_label="선지자",
    contemporaries=["item-uzziah", "item-jotham", "item-ahaz", "item-hezekiah", "item-micah", "item-hosea", "item-sennacherib"],
)
add_dated_item(
    "item-micah",
    "미가",
    "prophet_priest",
    "divided_kingdom,judah_alone",
    -738,
    -698,
    [("MIC.1.1", "유다 왕 요담·아하스·히스기야 시대에 사마리아와 예루살렘에 관해 본 말씀 표제입니다."), ("MIC.5.2", "베들레헴 에브라다에서 이스라엘을 다스릴 자가 나오리라는 메시아 탄생지 예언입니다."), ("MIC.6.8", "정의를 행하며 인자를 사랑하며 겸손하게 하나님과 함께 행하라는 핵심 교훈입니다.")],
    "유다 평지 모레셋 출신으로 이사야와 같은 시기에 사마리아·예루살렘 권력층의 수탈을 고발하고 베들레헴 메시아를 예언한 선지자입니다.",
    precision="estimated",
    role_label="선지자",
    contemporaries=["item-jotham", "item-ahaz", "item-hezekiah", "item-isaiah", "item-hosea"],
)
add_dated_item(
    "item-samaria-fall",
    "사마리아 함락",
    "event",
    "divided_kingdom",
    -722,
    -722,
    [("2KGS.17.5-7", "앗수르 왕이 3년 포위 끝에 사마리아를 함락하고 주민을 사로잡아 간 북왕국 멸망 기록입니다.")],
    "신앗수르 제국이 3년 공성전 끝에 북이스라엘 수도 사마리아를 함락하고 주민을 강제 이주시킨 역사적 분기점입니다.",
    scale="point_or_brief",
    precision="confirmed",
    display_period="BC 722년",
    related=["item-north-israel", "item-hoshea-king", "item-assyrian-empire"],
)
add_dated_item(
    "item-assyrian-empire",
    "신앗수르 제국",
    "polity",
    "divided_kingdom,judah_alone",
    -911,
    -609,
    [("2KGS.17.3-6", "북이스라엘을 정복하고 조공과 강제 이주 정책을 편 본문입니다."), ("2KGS.18.13", "산헤립이 유다의 모든 견고한 성읍을 침공한 기록입니다.")],
    "메소포타미아 북부 니느웨·칼후를 중심으로 근동을 제패하여 북이스라엘을 멸망(BC 722)시키고 유다를 위협하다 BC 612년 니느웨 함락 후 몰락한 제국입니다.",
    precision="confirmed",
    display_period="BC 911–609년",
    related=["item-samaria-fall", "item-sennacherib", "item-nahum"],
)
add_dated_item(
    "item-hezekiah",
    "히스기야",
    "ruler",
    "judah_alone",
    -715,
    -686,
    [("2KGS.18.3-6", "산당과 아세라 목상·놋뱀 느후스단을 부수고 전무후무하게 여호와를 의지한 개혁입니다."), ("2KGS.19.14-19", "앗수르 산헤립의 포위 속에서 성전에 올라가 드린 구원 간구 기도입니다.")],
    "남유다의 대표적 개혁 왕으로 성전 예배를 정화하고 실로암 수로를 팠으며, BC 701년 산헤립 침공 때 이사야와 함께 기도로 예루살렘을 지켜냈습니다(섭정 포함 시 BC 729년 기산).",
    precision="confirmed",
    display_period="BC 715–686년",
    role_label="남유다 왕",
    contemporaries=["item-ahaz", "item-isaiah", "item-micah", "item-sennacherib", "item-manasseh"],
)
add_dated_item(
    "item-sennacherib",
    "산헤립",
    "ruler",
    "judah_alone",
    -705,
    -681,
    [("2KGS.18.13", "히스기야 제14년(BC 701년)에 올라와 유다의 모든 견고한 성읍을 점령한 기사입니다."), ("2KGS.19.35-37", "예루살렘 포위가 풀려 니느웨로 돌아간 뒤 신전에서 암살된 기록입니다.")],
    "BC 701년 유다 원정에 나서 라기스를 함락하고 예루살렘의 히스기야를 포위·협박한 신앗수르 제국 황제입니다(산헤립 육각기둥 비문 대조 확정).",
    precision="confirmed",
    display_period="BC 705–681년",
    role_label="신앗수르 황제",
    contemporaries=["item-hezekiah", "item-isaiah", "item-manasseh"],
    related=["item-assyrian-empire"],
)
add_dated_item(
    "item-manasseh",
    "므낫세",
    "ruler",
    "judah_alone",
    -697,
    -642,
    [("2KGS.21.1-9", "12세에 즉위해 55년간 다스리며 부친 히스기야가 헐었던 산당과 바알 제단을 다시 세운 기록입니다."), ("2CHR.33.11-13", "앗수르 군대에 잡혀 바벨론에 끌려갔다가 환난 중에 겸비하여 기도한 기사입니다.")],
    "공동 섭정을 포함해 55년간 재위한 남유다 최장기 통치 왕으로, 극심한 혼합주의 우상숭배로 유다 심판의 결정적 원인을 제공했습니다.",
    precision="confirmed",
    display_period="BC 697–642년",
    role_label="남유다 왕",
    contemporaries=["item-hezekiah", "item-sennacherib"],
)
add_dated_item(
    "item-nahum",
    "나훔",
    "prophet_priest",
    "judah_alone",
    -663,
    -612,
    [("NAH.1.7", "여호와는 선하시며 환난 날에 산성이시라 위로하는 구절입니다."), ("NAH.3.7-8", "이집트 노아몬(테베, BC 663년 함락)을 예로 들어 니느웨(BC 612년 함락) 멸망을 선포한 연대 기준 구절입니다.")],
    "폭력적 압제자 신앗수르 제국의 수도 니느웨의 멸망을 선포한 엘고스 출신 선지자입니다(표시 구간은 51년 연속 활동이 아니라 선포 가능 상·하한 범위).",
    scale="uncertainty_window",
    precision="range",
    display_period="BC 663–612년 사이 (선포 가능 범위)",
    role_label="선지자",
    divergent="테베 함락(BC 663년) 이후~니느웨 함락(BC 612년) 이전 사이에 선포된 말씀으로, 활동 시점을 므낫세 후기(BC 650년경) 또는 니느웨 함락 직전(BC 620–612년경)으로 보는 견해가 있습니다.",
    related=["item-assyrian-empire"],
)
add_dated_item(
    "item-josiah",
    "요시야",
    "ruler",
    "judah_alone",
    -640,
    -609,
    [("2KGS.22.1-2", "8세에 왕이 되어 31년간 다스리며 다윗의 모든 길로 행한 기록입니다."), ("2KGS.23.1-4", "제18년(BC 622년) 성전 수리 중 발견된 율법책을 읽고 온 백성과 언약을 세운 대개혁입니다."), ("2KGS.23.29", "BC 609년 므깃도에서 애굽 왕 바로느고와 맞서다 전사한 기록입니다.")],
    "8세에 즉위해 제18년(BC 622년) 성전 율법책 발견을 계기로 유다 역사상 가장 철저한 우상 철폐와 유월절 회복을 단행한 개혁 왕입니다.",
    precision="confirmed",
    display_period="BC 640–609년",
    role_label="남유다 왕",
    contemporaries=["item-zephaniah", "item-jeremiah"],
)
add_dated_item(
    "item-zephaniah",
    "스바냐",
    "prophet_priest",
    "judah_alone",
    -632,
    -620,
    [("ZEPH.1.1", "유다 왕 요시야의 시대에 히스기야의 현손 스바냐에게 임한 말씀 표제입니다."), ("ZEPH.3.17", "너의 하나님 여호와가 너로 말미암아 기쁨을 이기지 못하시며 잠잠히 사랑하신다는 구원의 노래입니다.")],
    "히스기야 왕의 현손으로서 요시야 개혁(BC 622년) 전후 유다에 남아 있던 우상숭배를 책망하고 ‘여호와의 큰 날’과 남은 자의 구원을 선포했습니다.",
    precision="estimated",
    role_label="선지자",
    contemporaries=["item-josiah", "item-jeremiah"],
)
add_dated_item(
    "item-jeremiah",
    "예레미야",
    "prophet_priest",
    "judah_alone,exile",
    -627,
    -580,
    [("JER.1.1-3", "요시야 제13년(BC 627년)부터 예루살렘이 사로잡혀 가던 시드기야 제11년(BC 586년)까지 임한 말씀 표제입니다."), ("JER.31.31-34", "마음에 법을 기록하시는 ‘새 언약’ 예언 본문입니다."), ("JER.43.5-7", "예루살렘 함락 뒤 남은 무리에게 끌려 애굽 다바네스로 내려간 말년 기사입니다.")],
    "요시야 제13년(BC 627년) 소명받아 남유다 마지막 네 왕 시기와 예루살렘 함락, 애굽 이주 직후까지 약 47년간 눈물로 심판과 새 언약을 선포한 선지자입니다.",
    precision="estimated",
    display_period="BC 627–약 580년",
    role_label="선지자 · 제사장 가문",
    contemporaries=["item-josiah", "item-zephaniah", "item-habakkuk", "item-jehoiakim", "item-jehoiachin", "item-zedekiah", "item-nebuchadnezzar", "item-ezekiel", "item-daniel"],
    related=["item-jerusalem-fall"],
)
add_dated_item(
    "item-babylonian-empire",
    "신바벨론 제국",
    "polity",
    "judah_alone,exile",
    -626,
    -539,
    [("2KGS.24.1-2", "느부갓네살이 올라와 유다를 복속시킨 기사입니다."), ("DAN.5.30-31", "벨사살 왕이 죽임을 당하고 바벨론 제국이 무너진 기사입니다.")],
    "나보폴라살이 건국하고 느부갓네살 2세 때 근동 패권을 장악해 예루살렘을 멸망시켰으나, BC 539년 페르시아 고레스에게 정복된 제국입니다.",
    precision="confirmed",
    display_period="BC 626–539년",
    related=["item-nebuchadnezzar", "item-jerusalem-fall", "item-persian-empire"],
)
add_dated_item(
    "item-jehoiakim",
    "여호야김",
    "ruler",
    "judah_alone",
    -609,
    -598,
    [("2KGS.23.36", "25세에 왕이 되어 예루살렘에서 11년간 다스린 기록입니다."), ("JER.36.22-24", "예레미야가 기록한 두루마리를 칼로 베어 화로 불에 던진 불순종 사건입니다.")],
    "요시야의 아들로 애굽에 의해 왕이 된 뒤 바벨론에 복속했다가 배반했으며, 그의 제3년(BC 605년)에 다니엘 등이 1차 포로로 끌려갔습니다.",
    precision="confirmed",
    display_period="BC 609–598년",
    role_label="남유다 왕",
    contemporaries=["item-jeremiah", "item-habakkuk", "item-daniel", "item-nebuchadnezzar"],
)
add_dated_item(
    "item-habakkuk",
    "하박국",
    "prophet_priest",
    "judah_alone",
    -608,
    -598,
    [("HAB.1.6", "사납고 성급한 백성 곧 갈대아 사람(바벨론)을 일으키신다는 역사적 배경 구절입니다."), ("HAB.2.4", "의인은 그의 믿음으로 말미암아 살리라는 핵심 선언입니다."), ("HAB.3.17-18", "무화과나무가 무성하지 못해도 구원의 하나님으로 말미암아 기뻐하리라는 찬양입니다.")],
    "여호야김 통치기 바벨론의 유다 침공 임박 상황에서 하나님의 공의에 질문하고 오직 믿음과 소망의 찬양에 이른 선지자입니다.",
    precision="estimated",
    role_label="선지자",
    contemporaries=["item-jehoiakim", "item-jeremiah", "item-daniel"],
)
add_dated_item(
    "item-nebuchadnezzar",
    "느부갓네살 2세",
    "ruler",
    "judah_alone,exile",
    -605,
    -562,
    [("2KGS.24.10-14", "예루살렘을 포위해 여호야긴 왕과 백성·장인들을 바벨론으로 사로잡아 간 2차 포로 기록입니다."), ("2KGS.25.1-9", "시드기야 제9~11년에 예루살렘을 함락하고 성전을 불사른 기록입니다.")],
    "갈그미스 전투 승리(BC 605) 이후 세 차례(BC 605, 597, 586) 유다 포로를 이송하고 예루살렘을 함락한 신바벨론 제국의 전성기 황제입니다.",
    precision="confirmed",
    display_period="BC 605–562년",
    role_label="신바벨론 황제",
    contemporaries=["item-jehoiakim", "item-jehoiachin", "item-zedekiah", "item-jeremiah", "item-ezekiel", "item-daniel"],
    related=["item-babylonian-empire", "item-jerusalem-fall"],
)
add_dated_item(
    "item-jehoiachin",
    "여호야긴",
    "ruler",
    "judah_alone,exile",
    -598,
    -597,
    [("2KGS.24.8-15", "석 달 통치 후 느부갓네살에게 항복해 에스겔 등 지도층과 함께 바벨론으로 끌려간 2차 포로 기사입니다."), ("2KGS.25.27-30", "사로잡혀 간 지 37년째(BC 561년) 바벨론 왕 에윌므로닥에게 옥에서 풀려나 예우받은 열왕기하 결말입니다.")],
    "석 달 재위 후 BC 597년 바벨론에 포로로 잡혀갔으나 37년 뒤 석방되어 다윗 왕가의 생명이 이어지고 있음을 보여 준 남유다 왕입니다(바벨론 배급 점토판 실재 확인).",
    scale="point_or_brief",
    precision="confirmed",
    display_period="BC 598–597년 (재위 3개월)",
    role_label="남유다 왕 · 2차 포로",
    secondary=[("lifespan", "BC 597년 포로 이송 ~ BC 561년 바벨론 왕궁 사면(왕하 25:27)")],
    contemporaries=["item-jeremiah", "item-ezekiel", "item-zedekiah", "item-nebuchadnezzar"],
)
add_dated_item(
    "item-zedekiah",
    "시드기야",
    "ruler",
    "judah_alone",
    -597,
    -586,
    [("2KGS.24.17-20", "느부갓네살이 여호야긴의 숙부 맛다니야를 시드기야로 개명해 왕으로 세웠으나 배반한 기록입니다."), ("2KGS.25.4-7", "예루살렘 함락 때 도주하다 붙잡혀 바벨론으로 끌려간 마지막 왕의 비극입니다.")],
    "남유다의 마지막 왕으로 예레미야의 항복 권고를 끝내 듣지 않고 친애굽 반란을 일으켰다가 BC 586년 왕국 멸망을 맞았습니다.",
    precision="confirmed",
    display_period="BC 597–586년",
    role_label="남유다 마지막 왕",
    contemporaries=["item-jeremiah", "item-ezekiel", "item-nebuchadnezzar"],
    related=["item-jerusalem-fall"],
)
add_dated_item(
    "item-jerusalem-fall",
    "예루살렘 함락",
    "event",
    "judah_alone,exile",
    -587,
    -586,
    [("2KGS.25.8-11", "느부갓네살 제19년에 성전과 왕궁이 불타고 성벽이 헐린 예루살렘 함락 기사입니다.")],
    "신바벨론 군대의 포위 끝에 예루살렘 성벽이 뚫리고 솔로몬 성전이 소실되어 남유다 왕국이 멸망한 사건입니다(역법 기준에 따라 BC 586 또는 587년).",
    scale="point_or_brief",
    precision="confirmed",
    display_period="BC 587/586년",
    related=["item-judah", "item-zedekiah", "item-nebuchadnezzar", "item-jeremiah"],
)

# =====================================================================
# 5. 바벨론 포로기 & 페르시아 귀환기 (BC 605/586 ~ BC 430)
# =====================================================================
add_dated_item(
    "item-ezekiel",
    "에스겔",
    "prophet_priest",
    "judah_alone,exile",
    -593,
    -571,
    [("EZEK.1.1-3", "여호야긴 왕이 사로잡힌 지 제5년(BC 593년) 그발 강가에서 하늘이 열리며 소명받은 본문입니다."), ("EZEK.36.26", "새 영을 너희 속에 두고 굳은 마음을 제하여 부드러운 마음을 주시겠다는 회복 언약입니다."), ("EZEK.29.17", "포로 제27년(BC 571년) 에스겔서 내 가장 늦은 연대 표기 구절입니다.")],
    "BC 597년 여호야긴과 함께 2차 포로로 끌려간 제사장 출신 선지자로, 그발 강가 포로 공동체에서 BC 593–571년간 정밀한 연대 기록과 함께 심판·새 성전 환상을 선포했습니다.",
    precision="confirmed",
    display_period="BC 593–571년",
    role_label="포로기 선지자 · 제사장",
    contemporaries=["item-jehoiachin", "item-zedekiah", "item-jeremiah", "item-daniel", "item-nebuchadnezzar"],
)
add_dated_item(
    "item-daniel",
    "다니엘",
    "person",
    "judah_alone,exile,return_persian",
    -605,
    -536,
    [("DAN.1.1-6", "여호야김 제3년(BC 605년) 1차 포로로 바벨론 왕궁에 선발된 도입부입니다."), ("DAN.6.10", "사자 굴 위협 앞에서도 예루살렘을 향한 창문을 열고 하루 세 번 감사 기도한 본문입니다."), ("DAN.10.1", "바사 왕 고레스 제3년(BC 536년경) 큰 환상을 받은 본문 내 마지막 연대입니다.")],
    "BC 605년 1차 포로로 바벨론에 끌려가 느부갓네살부터 페르시아 고레스 초기까지 궁정에서 신앙 절개를 지키고 하나님 나라의 주권 환상을 본 인물입니다.",
    precision="estimated",
    display_period="BC 605–약 536년",
    role_label="포로기 관료 · 환상 수여자",
    divergent="본문 사건의 시간적 배경은 BC 605–536년경이며, 다니엘서 최종 본문의 기록 시기에 관해서는 BC 6세기 저작설과 BC 2세기 마카비기 편집설이 학계에 병존합니다.",
    contemporaries=["item-jehoiakim", "item-nebuchadnezzar", "item-jeremiah", "item-ezekiel", "item-cyrus"],
)
add_dated_item(
    "item-persian-empire",
    "페르시아 제국",
    "polity",
    "return_persian,intertestamental",
    -539,
    -330,
    [("EZRA.1.1-4", "바사 왕 고레스가 포로 귀환과 예루살렘 성전 재건을 선포한 칙령입니다.")],
    "고레스 대왕이 바벨론을 정복(BC 539)한 뒤 약 200년간 근동을 통치하며 유다 포로 귀환과 성전·성벽 재건을 허용한 아케메네스 왕조 제국입니다.",
    precision="confirmed",
    display_period="BC 539–330년",
    related=["item-cyrus", "item-return", "item-xerxes", "external-alexander"],
)
add_dated_item(
    "item-cyrus",
    "고레스",
    "ruler",
    "exile,return_persian",
    -559,
    -530,
    [("EZRA.1.1-2", "고레스 원년(바벨론 통치 원년 BC 538년)에 예레미야 말씀을 이루려 마음을 감동시키신 칙령 본문입니다."), ("ISA.45.1", "여호와께서 기름 부음을 받은 고레스의 오른손을 붙드신다는 예언 구절입니다.")],
    "페르시아 제국 창건자로 BC 539년 바벨론을 무혈 입성한 뒤 BC 538년 유다 포로민의 본국 귀환과 성전 재건을 허락한 황제입니다(고레스 원통 비문 대조).",
    precision="confirmed",
    display_period="BC 559–530년 (바벨론 정복 BC 539)",
    role_label="페르시아 황제 (키루스 2세)",
    contemporaries=["item-daniel", "item-zerubbabel"],
    related=["item-persian-empire", "item-return"],
)
add_dated_item(
    "item-return",
    "1차 귀환",
    "event",
    "return_persian",
    -538,
    -537,
    [("EZRA.2.1-2", "스룹바벨과 대제사장 예수아의 인도로 바벨론 포로민이 예루살렘과 유다 각 성읍으로 돌아온 명단입니다."), ("EZRA.3.1-3", "일곱째 달에 번제단을 다시 세우고 초막절을 지킨 기록입니다.")],
    "고레스 칙령 직후 스룹바벨과 예수아의 인도로 약 5만 명의 유다 공동체가 예루살렘에 돌아와 번제단과 성전 기초를 놓은 사건입니다.",
    scale="point_or_brief",
    precision="confirmed",
    display_period="BC 538/537년",
    related=["item-cyrus", "item-zerubbabel"],
)
add_dated_item(
    "item-zerubbabel",
    "스룹바벨",
    "person",
    "return_persian",
    -538,
    -515,
    [("EZRA.3.8", "예루살렘에 돌아온 지 둘째 해 둘째 달에 여호와의 성전 공사를 시작한 기록입니다."), ("ZECH.4.6-9", "힘으로도 능으로도 되지 아니하고 오직 나의 영으로 되느니라 스룹바벨을 격려하신 말씀입니다.")],
    "다윗 왕가 여호야긴의 손자이자 유다 총독으로서 1차 포로 귀환을 이끌고 중단되었던 제2성전 건축을 완수한 지도자입니다.",
    precision="estimated",
    role_label="유다 총독 · 귀환 지도자",
    contemporaries=["item-cyrus", "item-haggai", "item-zechariah"],
    related=["item-return", "item-temple-complete"],
)
add_dated_item(
    "item-haggai",
    "학개",
    "prophet_priest",
    "return_persian",
    -520,
    -520,
    [("HAG.1.1-8", "다리오 왕 제2년 여섯째 달 초하루에 성전 황폐함을 방치한 백성을 일깨워 산에 올라가 성전을 건축하라 명한 본문입니다."), ("HAG.2.9", "이 성전의 나중 영광이 이전 영광보다 크리라는 위로의 약속입니다.")],
    "다리오 1세 제2년(BC 520년) 네 차례 말씀을 통해 16년간 멈춰 있던 성전 재건 공사를 다시 일으킨 귀환 공동체 선지자입니다.",
    precision="confirmed",
    display_period="BC 520년",
    role_label="선지자",
    contemporaries=["item-zerubbabel", "item-zechariah"],
    related=["item-temple-complete"],
)
add_dated_item(
    "item-zechariah",
    "스가랴",
    "prophet_priest",
    "return_persian",
    -520,
    -518,
    [("ZECH.1.1", "다리오 왕 제2년 여덟째 달에 스가랴에게 임한 말씀 표제입니다."), ("ZECH.9.9", "겸손하여 나귀를 타시는 시온의 왕 메시아 예언입니다.")],
    "학개와 함께 성전 재건 현장을 여덟 가지 밤의 환상과 메시아 소망으로 격려한 제사장 가문 선지자입니다.",
    precision="confirmed",
    display_period="BC 520–518년 (초기 환상 사역)",
    role_label="선지자",
    divergent="1–8장은 BC 520–518년 다리오 통치기 연대가 명시되어 있으며, 9–14장 후반부의 작성 시기에 대해서는 스가랴 말년설과 후대 편집설이 논의됩니다.",
    contemporaries=["item-zerubbabel", "item-haggai"],
    related=["item-temple-complete"],
)
add_dated_item(
    "item-temple-complete",
    "제2성전 완공",
    "event",
    "return_persian",
    -516,
    -515,
    [("EZRA.6.14-16", "다리오 왕 제6년 아달월 3일에 성전 건축을 마치고 기쁨으로 봉헌식을 드린 기록입니다.")],
    "페르시아 다리오 1세 제6년(BC 516년 말~515년 봄)에 스룹바벨 성전(제2성전)이 완공되어 봉헌된 사건입니다.",
    scale="point_or_brief",
    precision="confirmed",
    display_period="BC 516/515년",
    related=["item-zerubbabel", "item-haggai", "item-zechariah"],
)
add_dated_item(
    "item-xerxes",
    "크세르크세스 1세",
    "ruler",
    "return_persian",
    -486,
    -465,
    [("ESTH.1.1-3", "인도로부터 구스까지 127지방을 다스리던 아하수에로 왕이 수산 궁에서 잔치를 베푼 도입부입니다.")],
    "에스더서의 ‘아하수에로’ 왕과 동일시되는 페르시아 황제로 그리스 원정(살라미스 해전 BC 480)을 치른 통치자입니다.",
    precision="confirmed",
    display_period="BC 486–465년",
    role_label="페르시아 황제 (아하수에로)",
    contemporaries=["item-esther"],
    related=["item-persian-empire"],
)
add_dated_item(
    "item-esther",
    "에스더",
    "person",
    "return_persian",
    -479,
    -465,
    [("ESTH.2.16-17", "아하수에로 왕 제7년(BC 479년) 열째 달에 에스더가 왕후의 자리에 오른 연대 기준 구절입니다."), ("ESTH.4.14-16", "죽으면 죽으리이다 결단하고 유다 민족 구원을 위해 나아간 전환점입니다."), ("ESTH.9.20-22", "모르드개와 함께 부림절 규례를 확정해 보낸 기록입니다.")],
    "페르시아 수도 수산에서 아하수에로 왕 제7년(BC 479년) 왕후가 되어 사촌 모르드개와 함께 하만의 유다인 학살 계획을 역전시킨 인물입니다.",
    precision="estimated",
    display_period="약 BC 479–465년 (왕후 재위기)",
    role_label="페르시아 왕후",
    contemporaries=["item-xerxes"],
)
add_dated_item(
    "item-ezra",
    "에스라",
    "prophet_priest",
    "return_persian",
    -458,
    -430,
    [("EZRA.7.7-10", "아닥사스다 왕 제7년에 예루살렘에 올라와 여호와의 율법을 연구·준행·교육하기로 결심한 본문입니다."), ("NEH.8.5-8", "백성 앞에서 율법책을 펴서 낭독하고 뜻을 해석하여 깨닫게 한 말씀 부흥 사건입니다.")],
    "아론 계통 제사장이자 모세 율법에 익숙한 학사로서 2차 포로 귀환을 이끌고 귀환 공동체를 말씀 위에 재건한 영적 지도자입니다.",
    precision="range",
    display_period="약 BC 458–430년",
    role_label="제사장 · 학사(서기관)",
    divergent="귀환 시점인 ‘아닥사스다 제7년’을 아닥사스다 1세(BC 458년)로 보는 전통적 다수설과 아닥사스다 2세(BC 398년)로 보는 소수설이 있습니다.",
    contemporaries=["item-nehemiah", "item-malachi"],
)
add_dated_item(
    "item-nehemiah",
    "느헤미야",
    "person",
    "return_persian",
    -445,
    -430,
    [("NEH.2.1-5", "아닥사스다 왕 제20년(BC 445년) 술 맡은 관원으로 있다가 예루살렘 성벽 중건 파송을 청한 본문입니다."), ("NEH.6.15", "대적의 방해 속에 52일 만에 예루살렘 성벽 역사를 완공한 기록입니다."), ("NEH.13.6", "아닥사스다 제32년(BC 433년) 바벨론에 다녀온 뒤 2차 개혁을 단행한 기록입니다.")],
    "아닥사스다 1세의 술 맡은 관원 출신 유다 총독으로 BC 445년 귀환해 52일 만에 성벽을 재건하고 에스라와 함께 언약 공동체 개혁을 이끌었습니다.",
    precision="confirmed",
    display_period="BC 445–약 430년",
    role_label="유다 총독",
    contemporaries=["item-ezra", "item-malachi"],
)
add_dated_item(
    "item-malachi",
    "말라기",
    "prophet_priest",
    "return_persian",
    -450,
    -430,
    [("MAL.1.6-8", "총독(페르시아기 행정 용어)까지 언급하며 눈먼 제물을 드리는 성전 타락을 책망한 구절입니다."), ("MAL.4.2-6", "공의의 해가 떠올라 치료하는 광선을 비추리라는 약속과 엘리야 파송 예언으로 구약을 매듭짓는 결말입니다.")],
    "재건 성전 시대의 형식적 제사·십일조 태만·혼인 파기를 책망하고 장차 길을 준비할 사자와 언약의 사자를 예고한 구약 마지막 선지자입니다.",
    precision="estimated",
    role_label="선지자",
    contemporaries=["item-ezra", "item-nehemiah"],
)

# =====================================================================
# 6. 신구약 중간기 외부 역사 (BC 430 ~ BC 5) — 정경 구절 억지 연결 없음
# =====================================================================
EXTERNAL_NOTE = "정경 66권 본문의 직접 사건 서술이 아닌 신구약 중간기 외부 역사 배경입니다. 임의의 성경 구절을 억지로 연결하지 않습니다."

add_dated_item(
    "external-alexander",
    "알렉산드로스의 동방 원정",
    "event",
    "intertestamental",
    -334,
    -323,
    [],
    "마케도니아의 알렉산드로스 대왕이 페르시아 제국을 무너뜨리고 지중해·근동 전역에 헬라어(코이네 그리스어)와 헬레니즘 문화를 확산시킨 사건입니다.",
    record="external_history",
    precision="confirmed",
    display_period="BC 334–323년",
    note=EXTERNAL_NOTE,
    related=["item-persian-empire", "external-ptolemaic", "external-seleucid"],
)
add_dated_item(
    "external-ptolemaic",
    "프톨레마이오스 왕조 (유대 지배기)",
    "polity",
    "intertestamental",
    -301,
    -198,
    [],
    "알렉산드로스 사후 이집트 알렉산드리아를 중심으로 유대 땅을 통치한 헬레니즘 왕조로, 이 시기에 히브리어 구약의 헬라어 번역(70인역)이 시작되었습니다.",
    record="external_history",
    precision="confirmed",
    display_period="BC 301–198년",
    note=EXTERNAL_NOTE,
    related=["external-alexander", "external-seleucid"],
)
add_dated_item(
    "external-seleucid",
    "셀레우코스 왕조",
    "polity",
    "intertestamental",
    -198,
    -63,
    [],
    "BC 198년 파니온 전투 이후 유대 지배권을 장악한 시리아 기반 헬레니즘 왕조로, 급진적 헬라화 강요가 마카비 항쟁을 촉발했습니다.",
    record="external_history",
    precision="confirmed",
    display_period="BC 198–63년",
    note=EXTERNAL_NOTE,
    related=["external-antiochus", "external-maccabean"],
)
add_dated_item(
    "external-antiochus",
    "안티오코스 4세 에피파네스",
    "ruler",
    "intertestamental",
    -175,
    -164,
    [],
    "안식일·할례·율법서 소지를 금하고 BC 167년 예루살렘 성전 제단을 모독하여 유대인의 무장 저항을 불러일으킨 셀레우코스 통치자입니다.",
    record="external_history",
    precision="confirmed",
    display_period="BC 175–164년",
    role_label="셀레우코스 왕",
    note=EXTERNAL_NOTE,
    related=["external-seleucid", "external-maccabean"],
)
add_dated_item(
    "external-maccabean",
    "마카비 항쟁",
    "event",
    "intertestamental",
    -167,
    -160,
    [],
    "제사장 맛다디아와 아들 유다 마카베오가 셀레우코스 박해에 맞서 봉기해 BC 164년 성전을 정화·봉헌(수전절 기원)한 항쟁입니다.",
    record="external_history",
    precision="confirmed",
    display_period="BC 167–160년",
    note=EXTERNAL_NOTE,
    related=["external-antiochus", "external-hasmonean"],
)
add_dated_item(
    "external-hasmonean",
    "하스몬 왕조",
    "polity",
    "intertestamental",
    -142,
    -63,
    [],
    "마카비 가문이 세운 유대 자치·독립 왕조 시기로, 이 무렵 바리새파·사두개파·에세네파 등 신약 배경 분파들이 형성되었습니다.",
    record="external_history",
    precision="confirmed",
    display_period="BC 142–63년",
    note=EXTERNAL_NOTE,
    related=["external-maccabean", "external-roman-conquest"],
)
add_dated_item(
    "external-roman-conquest",
    "로마의 예루살렘 점령",
    "event",
    "intertestamental",
    -63,
    -63,
    [],
    "하스몬 왕가 내분 속에 로마 장군 폼페이우스가 예루살렘을 점령하여 유대가 로마의 영향권 아래 편입된 사건입니다.",
    record="external_history",
    scale="point_or_brief",
    precision="confirmed",
    display_period="BC 63년",
    note=EXTERNAL_NOTE,
    related=["external-hasmonean", "item-herod-great"],
)

# =====================================================================
# 7. 예수님의 생애 & 로마 초기 통치자 (BC 37 ~ AD 30/33)
# =====================================================================
add_dated_item(
    "item-herod-great",
    "헤롯 대왕",
    "ruler",
    "intertestamental,jesus_life",
    -37,
    -4,
    [("MATT.2.1-3", "헤롯 왕 때에 예수께서 유대 베들레헴에서 나시매 동방 박사들이 찾아온 기사입니다.")],
    "로마 원로원 승인으로 유대를 통치하며 예루살렘 제2성전을 대규모로 증축했으나 잔혹한 숙청을 일삼았고 예수님 탄생 직후(BC 4년) 사망한 왕입니다.",
    precision="confirmed",
    display_period="BC 37–4년",
    role_label="유대 분봉왕",
    contemporaries=["item-augustus", "person-jesus", "item-mary", "item-herod-antipas"],
)
add_dated_item(
    "item-augustus",
    "아우구스투스",
    "ruler",
    "intertestamental,jesus_life",
    -27,
    14,
    [("LUKE.2.1", "가이사 아구스도가 천하로 다 호적하라 명하여 요셉과 마리아가 베들레헴으로 간 배경 구절입니다.")],
    "로마 제국의 초대 황제(가이사 아구스도)로 팍스 로마나를 열었으며 그의 재위기에 예수 그리스도께서 탄생하셨습니다.",
    precision="confirmed",
    display_period="BC 27–AD 14년",
    role_label="로마 초대 황제",
    contemporaries=["item-herod-great", "item-tiberius", "item-herod-antipas", "person-jesus"],
)
add_dated_item(
    "person-jesus",
    "예수 그리스도",
    "person",
    "jesus_life",
    -5,
    30,
    [
        ("LUKE.2.4-7", "다윗의 동네 베들레헴에서 탄생하신 성육신 기사입니다."),
        ("LUKE.3.21-23", "세례를 받으시고 약 30세쯤에 공생애 사역을 시작하신 기록입니다."),
        ("MARK.10.45", "섬김을 받으려 함이 아니라 도리어 섬기려 하고 많은 사람의 대속물로 오신 사명 선언입니다."),
        ("JOHN.20.19-20", "부활하신 후 제자들 가운데 오셔서 평강을 선언하신 본문입니다."),
    ],
    "헤롯 대왕 말기(약 BC 6–4년경) 베들레헴에서 탄생하시고 약 3년 반의 공생애 천국 복음 사역 후 십자가 대속 죽음과 부활로 구원을 이루신 하나님의 아들 그리스도이십니다.",
    kind="lifespan",
    precision="range",
    display_period="약 BC 5–AD 30년 (지상 생애)",
    role_label="메시아 · 하나님의 아들",
    secondary=[
        ("ministry", "공생애 사역: 약 AD 27–30년 (또는 AD 29–33년설 · 약 3년 반)"),
    ],
    divergent="탄생 연대는 헤롯 대왕 사망(BC 4년) 직전인 약 BC 6–4년경이며, 십자가 수난과 부활 연대는 유월절 역산에 따라 AD 30년설과 AD 33년설이 학계에 공존합니다.",
    contemporaries=[
        "item-mary",
        "item-john-baptist",
        "item-peter",
        "item-john-apostle",
        "item-james",
        "item-pilate",
        "item-herod-great",
        "item-herod-antipas",
        "item-augustus",
        "item-tiberius",
    ],
    related=["item-crucifixion"],
)
add_dated_item(
    "item-mary",
    "마리아",
    "person",
    "jesus_life,early_church",
    -5,
    35,
    [
        ("LUKE.1.26-38", "천사 가브리엘의 수태고지에 ‘말씀대로 내게 이루어지이다’ 순종한 본문입니다."),
        ("JOHN.19.25-27", "예수님의 십자가 곁을 지킨 기록입니다."),
        ("ACTS.1.14", "예수님 승천 후 예루살렘 다락방에서 제자들과 함께 마음을 같이하여 기도에 힘쓴 기록입니다."),
    ],
    "예수님의 어머니로 성육신 탄생부터 가나 혼인잔치, 십자가 현장, 오순절 직전 예루살렘 다락방 기도 공동체까지 성경 본문에 등장하는 인물입니다.",
    kind="narrative_time",
    precision="estimated",
    display_period="약 BC 5–AD 30년대 (복음서·사도행전 등장기)",
    role_label="예수님의 어머니",
    contemporaries=["person-jesus", "item-john-baptist", "item-peter", "item-john-apostle", "item-james"],
)
add_dated_item(
    "item-herod-antipas",
    "헤롯 안티파스",
    "ruler",
    "jesus_life,early_church",
    -4,
    39,
    [("LUKE.3.1", "갈릴리 분봉왕으로 세례 요한 사역 시작 연대 기준에 언급된 구절입니다."), ("MARK.6.17-27", "세례 요한을 옥에 가두고 처형한 사건입니다."), ("LUKE.23.7-11", "예루살렘에서 빌라도가 보낸 예수님을 심문한 기록입니다.")],
    "헤롯 대왕의 아들로 갈릴리와 베레아를 43년간 다스린 분봉왕이며 세례 요한을 처형하고 예수님 재판에 관여했습니다.",
    precision="confirmed",
    display_period="BC 4–AD 39년",
    role_label="갈릴리·베레아 분봉왕",
    contemporaries=["person-jesus", "item-john-baptist", "item-pilate", "item-tiberius", "item-augustus"],
)
add_dated_item(
    "item-tiberius",
    "티베리우스",
    "ruler",
    "jesus_life,early_church",
    14,
    37,
    [("LUKE.3.1", "디베료 가이사가 통치한 지 열다섯 해에 하나님의 말씀이 요한에게 임했다는 핵심 연대 기준 구절입니다.")],
    "아우구스투스의 뒤를 이은 로마 제2대 황제(디베료 가이사)로, 그의 재위기에 세례 요한과 예수님의 전체 공생애 사역이 이루어졌습니다.",
    precision="confirmed",
    display_period="AD 14–37년",
    role_label="로마 황제",
    contemporaries=["person-jesus", "item-john-baptist", "item-pilate", "item-herod-antipas"],
)
add_dated_item(
    "item-pilate",
    "본디오 빌라도",
    "ruler",
    "jesus_life,early_church",
    26,
    36,
    [("LUKE.3.1", "본디오 빌라도가 유대의 총독으로 있을 때를 명시한 연대 구절입니다."), ("LUKE.23.22-24", "예수님의 무죄를 세 번 밝히고도 무리의 요구에 내어준 재판 기사입니다.")],
    "티베리우스 황제 시기 유대 속주를 10년간 다스린 로마 총독으로(가이사랴 빌라도 비문 실재 확인) 예수님의 십자가 처형을 선고했습니다.",
    precision="confirmed",
    display_period="AD 26–36년",
    role_label="로마 유대 총독",
    contemporaries=["person-jesus", "item-john-baptist", "item-herod-antipas", "item-tiberius"],
    related=["item-crucifixion"],
)
add_dated_item(
    "item-john-baptist",
    "세례 요한",
    "prophet_priest",
    "jesus_life",
    26,
    29,
    [("LUKE.3.1-3", "디베료 제15년에 요단강 부근에서 죄 사함을 받게 하는 회개의 세례를 전파한 본문입니다."), ("JOHN.1.29", "예수님을 보며 ‘세상 죄를 지고 가는 하나님의 어린양이로다’ 증언한 구절입니다.")],
    "요단강 광야에서 회개의 세례를 베풀며 주의 길을 예비하고 예수님께 세례를 베푼 선구자입니다.",
    precision="estimated",
    display_period="약 AD 26–29년",
    role_label="선구자 · 세례자",
    contemporaries=["person-jesus", "item-mary", "item-herod-antipas", "item-pilate", "item-tiberius"],
)
add_dated_item(
    "item-crucifixion",
    "예수님의 십자가와 부활",
    "event",
    "jesus_life",
    30,
    30,
    [("MARK.15.22-26", "골고다에서 십자가에 못 박히신 대속 수난 기록입니다."), ("MARK.16.6", "십자가에 못 박히신 나사렛 예수가 살아나셨음을 알리는 빈 무덤 선언입니다.")],
    "유월절 절기에 본디오 빌라도 치하 예루살렘에서 십자가에 달려 죽으시고 사흘 만에 부활하신 복음의 핵심 사건입니다.",
    scale="point_or_brief",
    precision="range",
    display_period="약 AD 30년 (또는 AD 33년설)",
    divergent="빌라도 재임기(AD 26–36) 중 유월절 준비일이 금요일이었던 해를 천문학적으로 역산하면 AD 30년(4월 7일)과 AD 33년(4월 3일) 두 해가 유력 후보로 꼽힙니다.",
    related=["person-jesus", "item-pilate"],
)

# =====================================================================
# 8. 초대교회 사도 · 동역자 · 통치자 · 선교여행 (AD 30 ~ AD 100)
# =====================================================================
add_dated_item(
    "item-peter",
    "베드로 (시몬)",
    "person",
    "jesus_life,early_church",
    27,
    65,
    [("MATT.16.16", "주는 그리스도시요 살아 계신 하나님의 아들이시니이다 고백한 본문입니다."), ("ACTS.2.14-36", "오순절 성령 강림 날 예루살렘 무리 앞에서 전한 첫 설교입니다."), ("ACTS.10.34-43", "이방인 백부장 고넬료 가정에 복음을 전하고 세례를 베푼 사건입니다.")],
    "예수님의 수제자이자 오순절 이후 예루살렘 초대교회와 유대·이방 선교의 문을 연 사도로, 네로 박해기 로마에서 순교한 것으로 전해집니다.",
    precision="estimated",
    display_period="약 AD 27–65년",
    role_label="사도",
    contemporaries=["person-jesus", "item-john-apostle", "item-james", "item-stephen", "item-philip", "item-cornelius", "item-paul", "item-barnabas", "item-silas", "external-nero"],
    related=["item-council", "epistle-60", "epistle-61"],
)
add_dated_item(
    "item-john-apostle",
    "사도 요한",
    "person",
    "jesus_life,early_church",
    27,
    95,
    [("ACTS.3.1-8", "베드로와 함께 성전 미문 앞 나면서 못 걷게 된 이를 일으킨 초기 사역입니다."), ("GAL.2.9", "야고보·베드로와 함께 예루살렘 교회의 기둥으로 언급된 구절입니다."), ("REV.1.9", "하나님의 말씀과 예수를 증언하였음으로 말미암아 밧모섬에 있었음을 밝힌 본문입니다.")],
    "세베대의 아들이자 예수님의 제자로 예루살렘 교회의 기둥 역할을 감당했고, 말년까지 소아시아 에베소 일대에서 복음서·서신·계시록 전승의 중심이 된 사도입니다.",
    precision="estimated",
    display_period="약 AD 27–95년",
    role_label="사도",
    contemporaries=["person-jesus", "item-peter", "item-james", "item-paul", "item-mary"],
    related=["epistle-62", "epistle-63", "epistle-64", "epistle-66"],
)
add_dated_item(
    "item-stephen",
    "스데반",
    "person",
    "early_church",
    30,
    35,
    [("ACTS.6.5-8", "믿음과 성령이 충만하여 일곱 집사 중 한 사람으로 택함받은 기록입니다."), ("ACTS.7.55-60", "구약 구속사를 설교한 뒤 하늘을 우러러보며 용서를 구하고 순교한 장면입니다.")],
    "예루살렘 교회의 일곱 일꾼 중 한 사람으로 지혜와 성령으로 말씀을 전하다 기독교 최초의 순교자가 되었으며, 이를 계기로 복음이 유대·사마리아로 흩어져 전파되었습니다.",
    precision="estimated",
    display_period="약 AD 30–35년",
    role_label="일곱 일꾼 · 최초 순교자",
    contemporaries=["item-peter", "item-philip", "item-paul"],
)
add_dated_item(
    "item-philip",
    "빌립",
    "person",
    "early_church",
    30,
    60,
    [("ACTS.8.5-8", "사마리아 성에 내려가 그리스도를 백성에게 전파한 선교 기록입니다."), ("ACTS.8.26-39", "광야 길에서 이사야서를 읽던 에티오피아 내시에게 예수를 전하고 세례를 베푼 사건입니다."), ("ACTS.21.8", "훗날 가이사랴에서 전도자 빌립의 집에 바울 일행이 유숙한 기록입니다.")],
    "예루살렘 일곱 일꾼 출신의 ‘전도자 빌립’(12사도 빌립과 동명이인)으로 사마리아와 에티오피아 내시에게 복음을 전하고 가이사랴에서 사역했습니다.",
    precision="estimated",
    display_period="약 AD 30–60년 (사도행전 기록기)",
    role_label="일곱 일꾼 · 전도자",
    contemporaries=["item-stephen", "item-peter", "item-paul", "item-luke"],
)
add_dated_item(
    "item-james",
    "야고보",
    "person",
    "early_church",
    30,
    62,
    [("GAL.1.19", "주의 형제 야고보로 언급된 구절입니다."), ("ACTS.15.13-21", "예루살렘 회의에서 이방인 신자를 향한 최종 결의안을 정리해 발표한 본문입니다.")],
    "예수님의 동생으로 부활하신 주님을 만난 뒤 예루살렘 교회의 대표 지도자가 되었고 예루살렘 회의를 주재했으며 AD 62년 순교했습니다(요세푸스 『유대 고대사』 대조).",
    precision="confirmed",
    display_period="AD 30–62년",
    role_label="예루살렘 교회 지도자 (주의 형제)",
    contemporaries=["person-jesus", "item-peter", "item-john-apostle", "item-paul", "item-barnabas"],
    related=["item-council", "epistle-59"],
)
add_dated_item(
    "item-paul",
    "바울 (사울)",
    "person",
    "early_church",
    34,
    67,
    [("ACTS.9.3-6", "다메섹 도상에서 부활하신 예수님의 빛을 만나 회심·소명받은 사건입니다."), ("ACTS.13.2-3", "안디옥 교회에서 성령의 지시로 바나바와 함께 선교사로 따로 세움받은 본문입니다."), ("2TIM.4.7-8", "선한 싸움을 싸우고 나의 달려갈 길을 마쳤다고 고백한 순교 직전 유언입니다.")],
    "다메섹 도상 회심 이후 세 차례 지중해 전도여행과 로마행을 통해 이방 세계 선교를 이끌고 13권의 바울 서신을 남긴 사도입니다.",
    precision="estimated",
    display_period="약 AD 34–67년",
    role_label="이방인의 사도",
    contemporaries=[
        "item-barnabas",
        "item-silas",
        "item-timothy",
        "item-luke",
        "item-peter",
        "item-james",
        "item-gallio",
        "item-felix",
        "item-festus",
        "item-agrippa-ii",
        "item-claudius",
        "external-nero",
    ],
    related=["item-first-journey", "item-council", "item-second-journey", "item-third-journey", "item-rome-journey", "item-rome-custody"],
)
add_dated_item(
    "item-barnabas",
    "바나바",
    "person",
    "early_church",
    34,
    55,
    [("ACTS.4.36-37", "구브로 출신 레위족 요셉이 사도들에게 ‘위로의 아들(바나바)’이라 일컬음받은 기록입니다."), ("ACTS.11.22-26", "안디옥 교회에 파송되어 다소에 있던 사울을 데려와 1년간 큰 무리를 가르친 본문입니다."), ("ACTS.15.39", "2차 여행 직전 마가 문제로 바울과 갈라져 구브로로 선교를 떠난 기사입니다.")],
    "회심 초기의 바울을 예루살렘 사도들에게 중재하고 안디옥 교회 목회와 1차 전도여행을 함께 이끈 격려의 동역자입니다.",
    precision="estimated",
    display_period="약 AD 34–55년 (본문 사역기)",
    role_label="안디옥 교사 · 선교 동역자",
    contemporaries=["item-paul", "item-peter", "item-james", "item-silas"],
    related=["item-first-journey", "item-council"],
)
add_dated_item(
    "item-cornelius",
    "고넬료",
    "person",
    "early_church",
    37,
    41,
    [("ACTS.10.1-4", "가이사랴에 주둔한 이달리야 부대 백부장으로 경건하여 구제와 기도에 힘쓴 기록입니다."), ("ACTS.10.44-48", "베드로가 말씀을 전할 때 이방인들에게도 성령이 내려 세례를 받은 사건입니다.")],
    "가이사랴 주둔 로마 백부장으로 베드로를 초청해 말씀을 듣던 중 온 집안이 성령을 받아 이방인 직접 복음 수용의 전환점이 된 인물입니다.",
    kind="narrative_time",
    scale="uncertainty_window",
    precision="estimated",
    display_period="약 AD 37–41년경 (회심 사건 추정 시기)",
    role_label="로마 백부장 · 초기 이방 신자",
    contemporaries=["item-peter"],
)
add_dated_item(
    "item-claudius",
    "클라우디우스",
    "ruler",
    "early_church",
    41,
    54,
    [("ACTS.11.28", "선지자 아가보가 예언한 큰 흉년이 글라우디오 때에 든 기록입니다."), ("ACTS.18.2", "글라우디오가 모든 유대인을 명하여 로마에서 떠나라 한 추방령으로 아굴라 부부가 고린도에 온 배경입니다.")],
    "사도행전에 ‘글라우디오’로 기록된 로마 제4대 황제로, 재위 중 기근과 AD 49년경 로마 유대인 추방령이 초대교회 선교 이동의 배경이 되었습니다.",
    precision="confirmed",
    display_period="AD 41–54년",
    role_label="로마 황제",
    contemporaries=["item-paul", "item-barnabas", "item-gallio", "item-felix"],
)
add_dated_item(
    "item-first-journey",
    "바울 1차 전도여행",
    "event",
    "early_church",
    46,
    48,
    [("ACTS.13.1-4", "안디옥 교회의 파송을 받아 실루기아에서 구브로로 출항한 시작점입니다."), ("ACTS.14.21-27", "루스드라·이고니온·비시디아 안디옥 각 교회에 장로들을 세우고 수리아 안디옥으로 귀환 보고한 본문입니다.")],
    "바울과 바나바가 구브로 섬과 남갈라디아(비시디아 안디옥·이고니온·루스드라·더베) 지역에 이방 교회를 개척한 첫 선교 여정입니다.",
    precision="estimated",
    display_period="약 AD 46–48년",
    related=["item-paul", "item-barnabas", "epistle-48"],
)
add_dated_item(
    "item-council",
    "예루살렘 회의",
    "event",
    "early_church",
    49,
    49,
    [("ACTS.15.6-11", "사도와 장로들이 모여 유대인이나 이방인이나 주 예수의 은혜로 구원받는 줄 믿노라 확인한 본문입니다."), ("ACTS.15.28-29", "이방 신자에게 할례를 강요하지 않고 필수 권고 사항만 담은 공문을 보낸 기록입니다.")],
    "이방인 그리스도인에게 모세 율법의 할례를 부과할 것인지를 논의해 은혜로 말미암는 구원 원칙과 교회 일치를 확정한 공의회입니다.",
    scale="point_or_brief",
    precision="estimated",
    display_period="약 AD 49년 (AD 48–50년경)",
    related=["item-peter", "item-james", "item-paul", "item-barnabas", "item-silas"],
)
add_dated_item(
    "item-second-journey",
    "바울 2차 전도여행",
    "event",
    "early_church",
    49,
    52,
    [("ACTS.16.9-12", "드로아에서 마게도냐 환상을 보고 유럽 첫 성 빌립보로 건너간 전환점입니다."), ("ACTS.18.1-11", "고린도에서 아굴라·브리스길라와 동역하며 1년 6개월간 말씀을 가르친 기록입니다.")],
    "바울과 실라가 루스드라에서 디모데와 합류하고 드로아에서 누가를 만나 마게도냐(빌립보·데살로니가·베뢰아)와 아가야(아덴·고린도)에 복음을 전한 여정입니다.",
    precision="estimated",
    display_period="약 AD 49–52년",
    related=["item-paul", "item-silas", "item-timothy", "item-luke", "item-gallio", "epistle-52", "epistle-53"],
)
add_dated_item(
    "item-silas",
    "실라 (실루아노)",
    "person",
    "early_church",
    49,
    64,
    [("ACTS.15.22", "예루살렘 교회의 지도자 중 한 사람으로 안디옥 공문 전달 대표로 뽑힌 구절입니다."), ("ACTS.16.25", "빌립보 감옥에서 한밤중에 바울과 함께 기도하고 하나님을 찬송한 장면입니다."), ("1PET.5.12", "베드로전서 말미에 신실한 형제 실루아노로 언급된 구절입니다.")],
    "예루살렘 교회 지도자이자 로마 시민권자로 바울의 2차 전도여행 핵심 동역자였으며, 데살로니가전·후서와 베드로전서 발송에도 동역했습니다.",
    precision="estimated",
    display_period="약 AD 49–64년 (본문 사역기)",
    role_label="선지자 · 선교 동역자",
    contemporaries=["item-paul", "item-timothy", "item-peter", "item-james", "item-barnabas"],
    related=["item-council", "item-second-journey", "epistle-52", "epistle-53", "epistle-60"],
)
add_dated_item(
    "item-timothy",
    "디모데",
    "person",
    "early_church",
    49,
    67,
    [("ACTS.16.1-3", "루스드라에서 칭찬받는 제자 디모데를 바울이 데리고 떠난 동역 시작 본문입니다."), ("PHIL.2.19-22", "자식이 아버지에게 함같이 바울과 함께 복음을 위하여 수고한 신실함이 증언된 구절입니다."), ("1TIM.1.3", "에베소에 머물며 다른 교훈을 경계하고 교회를 돌보도록 위임받은 구절입니다.")],
    "어머니 유니게와 외조모 로이스에게서 성경을 배운 젊은 사역자로 2·3차 여행과 로마 투옥기에 바울을 보좌하고 에베소 교회를 목회했습니다.",
    precision="estimated",
    display_period="약 AD 49–67년 (신약 본문 동역기)",
    role_label="목회자 · 바울의 동역자",
    secondary=[("lifespan", "초기 교회 전승상 1세기 말까지 에베소 사역 지속 추정")],
    contemporaries=["item-paul", "item-silas", "item-luke"],
    related=["item-second-journey", "item-third-journey", "epistle-54", "epistle-55"],
)
add_dated_item(
    "item-luke",
    "누가",
    "person",
    "early_church",
    49,
    67,
    [("ACTS.16.10", "드로아에서부터 ‘우리가’ 주어(우리 본문)로 바울 일행에 직접 합류한 기록입니다."), ("COL.4.14", "사랑을 받는 의사 누가라고 소개된 구절입니다."), ("2TIM.4.11", "바울의 마지막 투옥 때 ‘누가만 나와 함께 있느니라’고 증언된 구절입니다.")],
    "사랑받는 의사 출신 이방인 그리스도인으로 바울의 전도여행·로마 항해·최후 투옥까지 동행했으며 누가복음과 사도행전의 저자로 전해집니다.",
    precision="estimated",
    display_period="약 AD 49–67년 (동행·집필 활동기)",
    role_label="의사 · 복음서·사도행전 저자",
    contemporaries=["item-paul", "item-timothy", "item-philip"],
    related=["item-second-journey", "item-rome-journey", "item-rome-custody"],
)
add_dated_item(
    "item-gallio",
    "갈리오",
    "ruler",
    "early_church",
    51,
    52,
    [("ACTS.18.12-17", "갈리오가 아가야 총독 되었을 때 유대인들이 바울을 고발했으나 로마법 소관이 아니라며 기각한 사건입니다.")],
    "철학자 세네카의 형이자 아가야 속주 총독으로, 델피 갈리오 비문을 통해 재임 연대(AD 51–52)가 확정되어 신약 연대기 전체의 핵심 기준점(anchor)이 됩니다.",
    precision="confirmed",
    display_period="AD 51–52년",
    role_label="로마 아가야 총독",
    contemporaries=["item-paul", "item-claudius"],
    related=["item-second-journey", "epistle-52"],
)
add_dated_item(
    "item-third-journey",
    "바울 3차 전도여행",
    "event",
    "early_church",
    53,
    57,
    [("ACTS.19.8-10", "에베소 두란노 서원에서 두 해 동안 날마다 강론하여 아시아 주민이 주의 말씀을 들은 기록입니다."), ("ACTS.20.17-35", "밀레도에서 에베소 장로들을 청하여 전한 눈물의 고별 설교입니다.")],
    "에베소 약 3년 집중 사역을 중심으로 마게도냐와 고린도를 순회하며 고린도전·후서, 로마서를 집필하고 예루살렘 구제 헌금을 모은 여정입니다.",
    precision="estimated",
    display_period="약 AD 53–57년",
    related=["item-paul", "item-timothy", "item-luke", "epistle-45", "epistle-46", "epistle-47"],
)
add_dated_item(
    "item-felix",
    "벨릭스",
    "ruler",
    "early_church",
    52,
    59,
    [("ACTS.24.24-27", "바울에게 의와 절제와 장차 오는 심판 강론을 듣고 두려워하면서도 2년간 구류해 둔 기록입니다.")],
    "가이사랴에서 예루살렘으로부터 호송된 바울의 재판을 담당하고 후임 베스도 부임 때까지 2년간 바울을 구류한 유대 총독입니다.",
    precision="estimated",
    display_period="약 AD 52–59년",
    role_label="로마 유대 총독",
    contemporaries=["item-paul", "item-festus", "item-claudius", "external-nero"],
)
add_dated_item(
    "external-nero",
    "네로",
    "ruler",
    "early_church",
    54,
    68,
    [],
    "바울이 가이사에게 상소하던 시기(행 25:11)의 로마 제5대 황제로, AD 64년 로마 대화재 이후 기독교인 박해를 일으켜 베드로와 바울 순교의 배경이 되었습니다.",
    record="external_history",
    precision="confirmed",
    display_period="AD 54–68년",
    role_label="로마 황제",
    note="사도행전 25–28장의 ‘가이사(황제)’는 본문에 실명이 적혀 있지 않으나 외부 로마사 연대 대조상 네로 황제에 해당합니다.",
    contemporaries=["item-paul", "item-peter", "item-felix", "item-festus", "item-agrippa-ii"],
)
add_dated_item(
    "item-agrippa-ii",
    "아그립바 2세",
    "ruler",
    "early_church",
    50,
    93,
    [("ACTS.25.13", "아그립바 왕과 버니게가 신임 총독 베스도에게 문안하러 가이사랴에 온 기사입니다."), ("ACTS.26.27-28", "선지자를 믿으시나이까 묻는 바울의 간증 변론을 들은 본문입니다.")],
    "헤롯 가문의 마지막 왕(헤롯 아그립바 1세의 아들)으로 북방 영토를 다스리며 가이사랴에서 베스도와 함께 바울의 변론을 청취했습니다.",
    precision="estimated",
    display_period="AD 50–약 93년",
    role_label="헤롯 가문 분봉왕",
    contemporaries=["item-paul", "item-festus", "external-nero"],
)
add_dated_item(
    "item-festus",
    "베스도",
    "ruler",
    "early_church",
    59,
    62,
    [("ACTS.25.11-12", "가이사에게 상소한 바울에게 ‘가이사에게 갈 것이니라’ 결정한 재판 본문입니다.")],
    "벨릭스의 후임 유대 총독(포르키우스 페스투스)으로 바울의 로마 황제 상소를 수리하여 로마 이송을 결정했습니다.",
    precision="estimated",
    display_period="약 AD 59–62년",
    role_label="로마 유대 총독",
    contemporaries=["item-paul", "item-felix", "item-agrippa-ii", "external-nero"],
    related=["item-rome-journey"],
)
add_dated_item(
    "item-rome-journey",
    "바울의 로마행",
    "event",
    "early_church",
    59,
    60,
    [("ACTS.27.22-25", "유라굴로 광풍 한가운데서 안심하라 외치며 하나님의 약속을 믿노라 증언한 항해 본문입니다."), ("ACTS.28.14-16", "멜리데 섬을 거쳐 마침내 로마에 입성한 기사입니다.")],
    "가이사랴를 출발해 유라굴로 태풍 난파와 멜리데 섬 겨울 체류를 거쳐 로마에 도착한 바울과 누가 일행의 항해 여정입니다.",
    scale="point_or_brief",
    precision="estimated",
    display_period="약 AD 59–60년",
    related=["item-paul", "item-luke", "item-festus", "item-rome-custody"],
)
add_dated_item(
    "item-rome-custody",
    "바울의 로마 연금",
    "event",
    "early_church",
    60,
    62,
    [("ACTS.28.30-31", "바울이 온 이태를 자기 셋집에 머물며 찾아오는 사람을 다 영접하고 담대히 복음을 전한 사도행전 마지막 구절입니다.")],
    "바울이 로마 셋집에서 2년간 가택 연금 상태로 복음을 전하고 옥중서신(에베소서·빌립보서·골로새서·빌레몬서)을 보낸 시기입니다.",
    precision="estimated",
    display_period="약 AD 60–62년 (2년간)",
    related=["item-paul", "item-luke", "epistle-49", "epistle-50", "epistle-51", "epistle-57"],
)

# =====================================================================
# 9. 신약 서신서 작성 배경 (바울 서신 45..57 + 일반서신·계시록 58..66) — 작성 가능 범위(uncertainty_window) 구분
# =====================================================================
EPISTLE_SPECS = [
    (45, 56, 57, ["item-third-journey", "item-paul"], "3차 전도여행 말기 고린도 겨울 체류와 관련"),
    (46, 54, 55, ["item-third-journey", "item-paul"], "3차 전도여행 중 에베소 체류 말기와 관련 (고전 16:8)"),
    (47, 55, 56, ["item-third-journey", "item-paul"], "3차 전도여행 중 마게도냐 방문과 관련"),
    (48, 48, 56, ["item-first-journey", "item-council", "item-paul"], "남갈라디아 초기설(AD 48–49)과 북갈라디아 후기설(AD 53–56) 견해 차이"),
    (49, 60, 62, ["item-rome-custody", "item-paul"], "로마 가택 연금기 다수설 외 가이사랴·에베소 투옥설 및 회람서신 논의 존재"),
    (50, 60, 62, ["item-rome-custody", "item-paul", "item-timothy"], "로마 가택 연금기 다수설 외 에베소·가이사랴 투옥설 병존"),
    (51, 60, 62, ["item-rome-custody", "item-paul", "item-luke"], "로마 가택 연금 중 빌레몬서와 함께 발송"),
    (52, 50, 51, ["item-second-journey", "item-gallio", "item-paul", "item-silas"], "2차 전도여행 고린도 체류기(갈리오 재임 전후) 작성"),
    (53, 51, 52, ["item-second-journey", "item-paul", "item-silas"], "전서 발송 직후 고린도 체류기 작성 다수설"),
    (54, 62, 65, ["item-rome-custody", "item-paul", "item-timothy"], "1차 로마 석방 후 사역기 전통설과 후기 편집설 공존"),
    (55, 64, 67, ["item-rome-custody", "item-paul", "item-timothy", "item-luke"], "네로 박해기 마지막 로마 투옥 유언 서신 전통설과 후기 편집설 공존"),
    (56, 62, 65, ["item-rome-custody", "item-paul"], "그레데 교회 장로 임명 지침 · 목회서신 연대 논의 공유"),
    (57, 60, 62, ["item-rome-custody", "item-paul"], "로마 가택 연금 중 오네시모 중재 서신으로 발송"),
    (58, 63, 69, ["item-timothy", "item-paul"], "성전 제사 현재형 서술 및 성전 파괴(AD 70) 미언급에 따른 AD 60년대 작성설 우세"),
    (59, 45, 62, ["item-james"], "주의 형제 야고보 순교(AD 62) 이전 초기 작성설과 후기 편집설 병존"),
    (60, 62, 64, ["item-peter", "item-silas", "external-nero"], "베드로가 로마(‘바벨론’, 5:13)에서 네로 박해 전후 발송한 전통설과 후기설 병존"),
    (61, 64, 67, ["item-peter"], "베드로 순교 직전 유언 서신 전통설과 1세기 말 이후 후기설 공존"),
    (62, 85, 95, ["item-john-apostle"], "사도 요한의 에베소 사역 말기 소아시아 공동체 회람 서신"),
    (63, 85, 95, ["item-john-apostle"], "요한일서와 같은 시기 소아시아 가정교회 분별 권면 서신"),
    (64, 85, 95, ["item-john-apostle"], "가이오에게 순회 사역자 환대를 권면한 요한 공동체 서신"),
    (65, 65, 80, ["item-james"], "주의 형제 유다의 거짓 교사 경계 서신 (AD 60년대 중후반~80년대 추정)"),
    (66, 68, 95, ["item-john-apostle"], "도미티안 말기(약 AD 95년) 다수설과 네로 직후(AD 68–69년) 초기설 병존"),
]

for book_num, start_y, end_y, rel_ids, sec_note in EPISTLE_SPECS:
    overview = OVERVIEWS[book_num]
    kv = overview["keyVerse"]
    osis = BOOKS_BY_NUMBER[book_num]["osis"]
    b_name = BOOKS_BY_NUMBER[book_num]["nameKo"]
    v_ref = (
        f"{osis}.{kv['chapter']}.{kv['verseStart']}-{kv['verseEnd']}"
        if kv.get("verseEnd")
        else f"{osis}.{kv['chapter']}.{kv['verseStart']}"
    )
    add_dated_item(
        f"epistle-{book_num}",
        f"{b_name} 작성 배경",
        "event",
        "early_church",
        start_y,
        end_y,
        [(v_ref, kv["reason"])],
        overview["chronology"],
        kind="composition_time",
        scale="uncertainty_window",
        precision="range",
        display_period=format_year_span(start_y, end_y, "range"),
        role_label="신약 서신 작성 시기",
        record="epistle_background",
        secondary=[("event", sec_note)],
        related=rel_ids,
    )

# 4–12시대 차트의 사건 행: 본문에 명시된 전환점만 추가하고 왕정 이전은 상대 순서로 둔다.
for item_id, name, slot, ref, summary in [
    ("event-jordan-crossing", "요단강 도하", 17, "JOSH.3.14-17", "이스라엘이 언약궤를 앞세워 마른 땅으로 요단강을 건넜습니다."),
    ("event-jericho", "여리고 함락", 17, "JOSH.6.20", "백성이 나팔 소리에 외치자 여리고 성벽이 무너졌습니다."),
    ("event-gideon-300", "기드온의 삼백 용사", 22, "JUDG.7.19-22", "기드온의 삼백 명이 미디안 진영을 공격해 승리했습니다."),
    ("event-mizpah", "미스바 회개와 에벤에셀", 25, "1SAM.7.5-12", "사무엘이 미스바에 백성을 모아 회개를 이끌고 블레셋을 물리쳤습니다."),
]:
    add_relative_item(item_id, name, "event", "conquest_judges", slot, 1, "event", "본문 사건 순서", summary, [(ref, summary)])

for item_id, name, era, year, ref, summary in [
    ("event-david-covenant", "다윗 언약", "united_kingdom", -1000, "2SAM.7.12-16", "하나님이 다윗의 집과 왕위를 견고하게 하겠다고 약속하셨습니다."),
    ("event-first-temple", "솔로몬 성전 봉헌", "united_kingdom", -960, "1KGS.8.10-13", "솔로몬이 세운 성전에 여호와의 영광이 가득했습니다."),
    ("event-golden-calves-dan-bethel", "단·벧엘 금송아지", "divided_kingdom", -930, "1KGS.12.28-30", "여로보암이 단과 벧엘에 금송아지를 세워 북왕국의 예배를 예루살렘에서 분리했습니다."),
    ("event-samaria-capital", "사마리아 수도 건설", "divided_kingdom", -880, "1KGS.16.24", "오므리가 사마리아 산을 사서 성읍을 세우고 북왕국의 수도로 삼았습니다."),
    ("event-carmel", "갈멜산 대결", "divided_kingdom", -860, "1KGS.18.36-39", "엘리야의 기도에 불이 내려와 백성이 여호와를 하나님으로 고백했습니다."),
    ("event-jehu", "예후의 쿠데타", "divided_kingdom", -841, "2KGS.9.21-29", "예후가 요람과 아하시야를 죽이며 북이스라엘 왕조가 바뀌었습니다."),
    ("event-joash-temple-repair", "요아스의 성전 수리", "divided_kingdom", -812, "2KGS.12.9-12", "남유다 요아스가 헌금을 모아 훼손된 예루살렘 성전을 수리하게 했습니다."),
    ("event-amos-justice", "아모스의 공의 선포", "divided_kingdom", -760, "AMOS.5.21-24", "아모스가 북왕국의 형식적 예배와 사회 불의를 꾸짖고 공의를 촉구했습니다."),
    ("event-ahaz-assyria", "아하스의 앗수르 원조 요청", "divided_kingdom", -734, "2KGS.16.7-9", "남유다 아하스가 아람과 북이스라엘의 압박에 맞서 앗수르에 원조를 청했습니다."),
    ("event-galilee-captivity", "앗수르의 갈릴리 점령", "divided_kingdom", -732, "2KGS.15.29", "앗수르가 갈릴리와 길르앗을 점령하고 북왕국 주민을 사로잡아 갔습니다."),
    ("event-jerusalem-deliverance", "앗수르 포위에서 예루살렘 구원", "judah_alone", -701, "2KGS.19.32-36", "산헤립의 군대가 예루살렘을 점령하지 못하고 물러났습니다."),
    ("event-josiah-reform", "율법책 발견과 요시야 개혁", "judah_alone", -622, "2KGS.22.8-13", "성전에서 율법책을 발견한 요시야가 언약에 따른 개혁을 시작했습니다."),
    ("event-second-deportation", "여호야긴의 바벨론 포로", "judah_alone", -597, "2KGS.24.10-15", "여호야긴과 지도층이 바벨론으로 사로잡혀 갔습니다."),
    ("event-jehoiachin-release", "여호야긴 석방", "exile", -561, "2KGS.25.27-30", "바벨론 왕이 포로였던 여호야긴을 석방하고 예우했습니다."),
    ("event-babylon-fall", "바벨론 함락", "exile", -539, "DAN.5.30-31", "벨사살이 죽고 메대·바사의 통치로 넘어가는 전환점입니다."),
    ("event-esther-deliverance", "에스더와 유다인 구원", "return_persian", -473, "ESTH.9.20-28", "에스더와 모르드개를 통해 유다인들이 위기를 넘기고 부림절을 세웠습니다."),
    ("event-wall-complete", "예루살렘 성벽 완공", "return_persian", -445, "NEH.6.15-16", "느헤미야가 이끈 공동체가 52일 만에 성벽을 완공했습니다."),
    ("event-torah-reading", "에스라의 율법 낭독", "return_persian", -445, "NEH.8.1-8", "에스라가 율법을 낭독하고 레위인들이 백성에게 그 뜻을 설명했습니다."),
    ("event-jesus-birth", "예수님의 탄생", "jesus_life", -5, "LUKE.2.1-7", "예수님이 베들레헴에서 태어나셨습니다."),
    ("event-jesus-baptism", "예수님의 세례와 공생애 시작", "jesus_life", 27, "MATT.3.13-17", "예수님이 요단강에서 세례를 받으실 때 하늘의 증언이 있었습니다."),
    ("event-triumphal-entry", "예루살렘 입성", "jesus_life", 30, "MATT.21.1-11", "예수님이 나귀를 타고 예루살렘에 들어가셨습니다."),
    ("event-pentecost", "오순절 성령 강림", "early_church", 30, "ACTS.2.1-4", "오순절에 성령이 임해 예루살렘 교회의 복음 증언이 시작됐습니다."),
    ("event-stephen-martyrdom", "스데반 순교와 교회 흩어짐", "early_church", 34, "ACTS.8.1-4", "스데반의 순교 뒤 박해로 흩어진 성도들이 곳곳에 복음을 전했습니다."),
    ("event-cornelius", "고넬료 집의 이방인 성령 강림", "early_church", 40, "ACTS.10.44-48", "베드로의 설교를 듣던 이방인들에게도 성령이 임했습니다."),
]:
    add_dated_item(item_id, name, "event", era, year, year, [(ref, summary)], summary, precision="estimated")

for item_id, name, start, end, ref, summary in [
    ("event-jesus-temptation", "광야 시험", 27, 28, "MATT.4.1-11", "예수님이 광야에서 시험을 받으시고 말씀으로 이기셨습니다."),
    ("event-first-disciples", "첫 제자들을 부르심", 27, 28, "MARK.1.16-20", "예수님이 시몬·안드레·야고보·요한을 부르셨습니다."),
    ("event-cana", "가나 혼인잔치 첫 표적", 27, 28, "JOHN.2.1-11", "예수님이 물을 포도주로 바꾸시는 첫 표적을 행하셨습니다."),
    ("event-sermon-mount", "산상수훈", 27, 29, "MATT.5.1-12", "예수님이 제자들과 무리에게 하나님 나라의 복을 가르치셨습니다."),
    ("event-feeding-five-thousand", "오병이어", 28, 29, "MARK.6.34-44", "예수님이 떡 다섯 개와 물고기 두 마리로 큰 무리를 먹이셨습니다."),
    ("event-peter-confession", "베드로의 그리스도 고백", 28, 30, "MATT.16.13-20", "베드로가 예수님을 그리스도이자 하나님의 아들로 고백했습니다."),
    ("event-transfiguration", "변화산 사건", 28, 30, "MATT.17.1-8", "예수님이 산 위에서 영광스러운 모습으로 변화되셨습니다."),
]:
    add_dated_item(item_id, name, "event", "jesus_life", start, end, [(ref, summary)], summary,
                   scale="uncertainty_window", precision="range")

for item_id, name, ref, summary in [
    ("event-lazarus", "나사로를 살리심", "JOHN.11.38-44", "예수님이 죽은 지 나흘 된 나사로를 무덤에서 불러내셨습니다."),
    ("event-last-supper", "마지막 만찬", "LUKE.22.14-20", "예수님이 제자들과 유월절 식사를 하시며 새 언약을 말씀하셨습니다."),
    ("event-ascension", "예수님의 승천", "ACTS.1.9-11", "부활하신 예수님이 제자들이 보는 가운데 하늘로 올라가셨습니다."),
]:
    add_dated_item(item_id, name, "event", "jesus_life", 30, 30, [(ref, summary)], summary,
                   precision="estimated", display_period="약 AD 30년 (수난 AD 33년설 병존)")

for item_id, name, year, summary in [
    ("external-temple-rededication", "성전 재봉헌", -164, "마카비 항쟁 뒤 예루살렘 성전이 다시 봉헌되었습니다."),
    ("external-judean-independence", "유대 독립 선언", -142, "시몬 시대 유대가 셀레우코스 왕조의 지배에서 벗어났습니다."),
]:
    add_dated_item(item_id, name, "event", "intertestamental", year, year, [], summary,
                   record="external_history", precision="confirmed", note=EXTERNAL_NOTE)

# =====================================================================
# 10. 장별 역사적 배경 매핑 (chapterMappings) — 비역사 지혜서(18, 20, 21, 22) 및 요엘(29) 제외
# =====================================================================
ITEM_IDS = {row["id"] for row in items}
mappings: list[dict] = []


def add_mapping(
    book: int,
    first_ch: int,
    last_ch: int,
    era: str,
    primaries: list[str],
    display_period: str,
    summary: str,
    *,
    kind: str = "narrative_time",
    precision: str = "undetermined",
    start: int | None = None,
    end: int | None = None,
    relative_order: int | None = None,
    contemporaries: list[str] | None = None,
    related: list[str] | None = None,
    written_note: str | None = None,
    divergent: str | None = None,
) -> None:
    assert book not in {18, 20, 21, 22, 29}, f"비역사/연대미상 권 매핑 금지: {book}"
    assert 1 <= first_ch <= last_ch <= BOOKS_BY_NUMBER[book]["chapters"]
    for pid in primaries:
        assert pid in ITEM_IDS, f"없는 primary item: {pid}"
    row: dict = {
        "id": f"history-{book}-{first_ch}-{last_ch}",
        "book": book,
        "chapterStart": first_ch,
        "chapterEnd": last_ch,
        "eraId": era,
        "periodKind": kind,
        "datePrecision": precision,
        "displayPeriodKo": display_period,
        "focusStartYear": start,
        "focusEndYear": end,
        "contextSummaryKo": summary,
        "primaryItemIds": primaries,
        "sourceIds": BIBLE_CHRONO if precision != "undetermined" else BIBLE,
    }
    if relative_order is not None:
        row["focusRelativeOrder"] = relative_order
    if contemporaries:
        row["contemporaryItemIds"] = contemporaries
    if related:
        row["relatedItemIds"] = related
    if written_note:
        row["writtenVsEventNoteKo"] = written_note
    if divergent:
        row["divergentViewsKo"] = divergent
    mappings.append(row)


# 10A. 왕정 이전 서사 매핑 (상대 순서 + 본문 명시 연수 + 절대 연대 가설 분리)
add_mapping(1, 1, 2, "primeval", ["event-creation"], "연대 미확정 · 창조 서사", "하나님의 천지 창조와 에덴동산 언약을 다루는 태초 서사로 수치 BC 연도를 부여하지 않습니다.", relative_order=1)
add_mapping(1, 3, 5, "primeval", ["event-fall"], "연대 미확정 · 타락과 초기 계보", "인간의 불순종 이후 가인·아벨 사건과 아담에서 노아로 이어지는 계보 순서입니다.", relative_order=2)
add_mapping(1, 6, 10, "primeval", ["event-flood"], "연대 미확정 · 노아 홍수와 열방 분화", "홍수 심판과 방주 구원, 무지개 언약 및 노아 세 아들의 열방 계보를 기록합니다.", relative_order=3)
add_mapping(1, 11, 11, "primeval", ["event-babel"], "연대 미확정 · 바벨탑과 셈 계보", "시날 평지 바벨탑 사건에서 데라·아브라함 가문으로 연결되는 전환 장입니다.", relative_order=4)

add_mapping(
    1, 12, 25, "patriarchs", ["item-abraham"],
    "아브라함 가나안 여정 100년 (75–175세 · 계보 순서)",
    "아브라함이 75세에 부르심을 받아 하란을 떠나고 100세에 이삭을 얻어 175세에 별세하기까지의 언약 서사입니다.",
    relative_order=6,
    contemporaries=["item-isaac", "item-jacob"],
    divergent=OVERVIEWS[1]["chronology"],
)
add_mapping(
    1, 26, 27, "patriarchs", ["item-isaac"],
    "이삭의 언약 계승기 (본문 수명 180세 · 계보 순서)",
    "이삭이 그랄에서 아브라함의 언약과 복을 계승하고 노년에 야곱과 에서에게 축복하는 본문입니다.",
    relative_order=7,
    contemporaries=["item-jacob"],
    divergent=OVERVIEWS[1]["chronology"],
)
add_mapping(
    1, 28, 36, "patriarchs", ["item-jacob"],
    "야곱의 밧단아람 체류와 귀환 (본문 수명 147세)",
    "야곱이 벧엘 언약을 거쳐 밧단아람에서 열두 지파의 기초가 되는 자녀들을 얻고 가나안으로 돌아오는 서사입니다.",
    relative_order=8,
    contemporaries=["item-isaac", "item-joseph"],
    divergent=OVERVIEWS[1]["chronology"],
)
add_mapping(
    1, 37, 50, "patriarchs", ["item-joseph"],
    "요셉의 애굽 총리 사역과 가족 이주 (수명 110세)",
    "아브라함 사후 약 76년 뒤 태어난 요셉이 17세에 애굽으로 팔려 간 뒤 30세에 총리가 되어 흉년 중 야곱(130세) 일가를 애굽 고센에 정착시킨 서사입니다.",
    relative_order=10,
    contemporaries=["item-jacob"],
    related=["item-abraham"],
    divergent=OVERVIEWS[1]["chronology"],
)

add_mapping(
    2, 1, 18, "exodus", ["item-exodus", "item-moses"],
    "출애굽 사건과 홍해 도하 (모세 80세 소명)",
    "애굽 고역 중에 부름받은 모세(80세)와 아론(83세)을 통해 열 재앙과 유월절 구원, 홍해 도하가 이루어진 사건 시점입니다.",
    relative_order=13,
    contemporaries=["item-aaron", "item-joshua"],
    related=["item-sinai"],
    divergent=OVERVIEWS[2]["chronology"],
)
add_mapping(
    2, 19, 40, "exodus", ["item-sinai", "item-moses"],
    "시내산 체류기 약 1년 (출애굽 첫해 3월~제2년 1월)",
    "시내산에서 십계명과 언약서를 받고 출애굽 제2년 첫째 달 초하루에 성막을 세우기까지 약 1년간의 기록입니다.",
    relative_order=14,
    contemporaries=["item-aaron"],
    related=["item-exodus"],
    divergent=OVERVIEWS[2]["chronology"],
)
add_mapping(
    3, 1, 27, "exodus", ["item-aaron", "item-moses"],
    "시내산 성막 건립 직후 (출애굽 제2년 첫째 달)",
    "성막 완공 직후 회막에서 주신 제사법·제사장 위임·정결례·성결 규례를 다루는 본문입니다.",
    relative_order=14,
    related=["item-sinai"],
    written_note=OVERVIEWS[3]["chronology"],
)
add_mapping(
    4, 1, 36, "exodus", ["item-moses"],
    "광야 여정 약 39년 (출애굽 제2년 둘째 달~제40년)",
    "시내산 출발부터 가데스 바네아 정탐 실패, 세대교체 광야 유랑을 거쳐 모압 평지에 이르기까지 약 39년의 여정을 다룹니다.",
    relative_order=15,
    contemporaries=["item-aaron", "item-joshua"],
    divergent=OVERVIEWS[2]["chronology"],
)
add_mapping(
    5, 1, 34, "exodus", ["item-moses"],
    "출애굽 제40년 열한째 달 · 모압 평지 고별 설교",
    "요단강 도하 직전 모압 평지에서 120세의 모세가 출애굽 2세대에게 율법을 재강해하고 여호수아에게 직분을 위임한 시기입니다.",
    relative_order=16,
    contemporaries=["item-joshua"],
    written_note=OVERVIEWS[5]["chronology"],
)

add_mapping(
    6, 1, 24, "conquest_judges", ["item-joshua"],
    "가나안 정복과 땅 분배 (여호수아 수명 110세)",
    "여호수아의 인도로 요단강을 건너 주요 성읍을 정복하고 열두 지파 기업 분배 및 세겜 언약 갱신을 이룬 시기입니다.",
    relative_order=18,
    divergent=OVERVIEWS[6]["chronology"],
)
add_mapping(7, 1, 3, "conquest_judges", ["item-othniel", "item-ehud"], "정복 직후 정착기와 초기 사사 (옷니엘·에훗)", "불완전한 가나안 정착 배경과 초기 사사 옷니엘·에훗·삼갈의 구원 활동을 다룹니다.", relative_order=19, divergent=OVERVIEWS[7]["chronology"])
add_mapping(7, 4, 5, "conquest_judges", ["item-deborah"], "사사 드보라와 바락의 활동기 (평온 40년)", "하솔 왕 야빈의 철병거 군대장관 시스라를 기손강에서 물리치고 승리의 노래를 부른 시기입니다.", relative_order=21, divergent=OVERVIEWS[7]["chronology"])
add_mapping(7, 6, 8, "conquest_judges", ["item-gideon"], "사사 기드온의 활동기 (평온 40년)", "미디안의 약탈 속에서 부름받은 기드온이 300명의 용사로 구원을 이룬 본문입니다.", relative_order=22, divergent=OVERVIEWS[7]["chronology"])
add_mapping(7, 9, 12, "conquest_judges", ["item-jephthah"], "아비멜렉 사건과 사사 입다 재임기 (입다 6년)", "기드온 사후 세겜의 혼란과 길르앗 용사 입다가 암몬 자손을 물리친 후기 사사 서사입니다.", relative_order=23, divergent=OVERVIEWS[7]["chronology"])
add_mapping(7, 13, 16, "conquest_judges", ["item-samson"], "블레셋 시대 사사 삼손 활동기 (재임 20년)", "블레셋 지배기 동안 나실인 삼손이 20년간 사사로 활동하며 구원을 시작한 본문입니다.", relative_order=24, divergent=OVERVIEWS[7]["chronology"])
add_mapping(7, 17, 21, "conquest_judges", ["item-othniel"], "사사 시대 초기 영적 혼란 부록", "단 지파 이주와 베냐민 지파 내전을 통해 왕이 없던 시대의 도덕적·영적 혼란상을 보여 주는 사사기 결론부입니다(연대순 말기가 아닌 사사 시대 초기 배경 부록).", relative_order=19, divergent=OVERVIEWS[7]["chronology"])
add_mapping(8, 1, 4, "conquest_judges", ["item-ruth"], "사사 시대 베들레헴 서사 (다윗 3대조 세대)", "사사들이 치리하던 시대에 나오미·룻·보아스를 통해 다윗 왕가의 계보가 준비된 이야기입니다.", relative_order=24, related=["item-david"], written_note=OVERVIEWS[8]["chronology"])
add_mapping(9, 1, 7, "conquest_judges", ["item-samuel"], "사사 시대 말기 · 사무엘의 초기 사역", "실로 성막 시대의 종언과 사무엘이 이끌어 낸 미스바 회개 운동을 다루는 왕정 직전 전환기입니다.", relative_order=25, related=["item-saul"])

# 10B. 통일왕국 ~ 페르시아 귀환기 수치 연대 매핑
DATED_OT_MAPPINGS = [
    (9, 8, 31, "united_kingdom", ["item-saul"], -1050, -1010, "estimated", "초대 왕 사울의 등극부터 다윗의 도피 생활과 길보아산 전사까지의 통일왕국 전반기입니다.", ["item-samuel", "item-david"], ["item-united-israel"], None, None),
    (10, 1, 24, "united_kingdom", ["item-david"], -1010, -970, "estimated", "다윗의 헤브론·예루살렘 40년 통치와 다윗 언약, 가문의 시련을 다루는 시기입니다.", ["item-samuel", "item-solomon"], ["item-united-israel"], None, None),
    (11, 1, 11, "united_kingdom", ["item-solomon"], -970, -931, "estimated", "솔로몬의 즉위와 예루살렘 제1성전 건축, 지혜 통치와 말년 변질을 다룹니다.", ["item-david", "item-rehoboam", "item-jeroboam-i"], ["item-united-israel"], None, None),
    (11, 12, 16, "divided_kingdom", ["item-rehoboam", "item-jeroboam-i"], -931, -874, "estimated", "남북 왕국 분열(BC 931/930)부터 아사·바아사·오므리로 이어지는 초기 분열왕국 시기입니다.", ["item-asa", "item-baasha", "item-omri"], ["item-division", "item-north-israel", "item-judah"], None, OVERVIEWS[11]["chronology"]),
    (11, 17, 22, "divided_kingdom", ["item-elijah", "item-ahab"], -874, -853, "confirmed", "북왕국 아합의 바알 숭배 정책에 맞선 선지자 엘리야의 갈멜산·호렙산 사역과 남유다 여호사밧 시기입니다.", ["item-jehoshaphat", "item-elisha"], ["item-north-israel"], None, None),
    (12, 1, 13, "divided_kingdom", ["item-elisha", "item-jehu"], -853, -782, "estimated", "엘리사의 기적 사역과 예후의 북왕국 왕조 교체, 남유다 아달랴 찬탈 및 요아스의 성전 수리를 다룹니다.", ["item-joram-israel", "item-athaliah", "item-joash-judah", "item-joash-israel"], ["item-north-israel", "item-judah"], None, None),
    (12, 14, 17, "divided_kingdom", ["item-jeroboam-ii", "item-hoshea-king"], -796, -722, "confirmed", "여로보암 2세·웃시야 번영기 이후 북왕국의 급격한 혼란과 BC 722년 앗수르에 의한 사마리아 함락을 다룹니다.", ["item-amaziah", "item-uzziah", "item-jotham", "item-ahaz", "item-menahem", "item-pekah", "item-hosea", "item-amos", "item-isaiah"], ["item-samaria-fall", "item-assyrian-empire"], None, None),
    (12, 18, 24, "judah_alone", ["item-hezekiah", "item-josiah"], -722, -597, "confirmed", "히스기야의 신앙 개혁과 산헤립 침공 극복, 므낫세의 타락, 요시야의 율법책 개혁, 바벨론 1·2차 침공을 다룹니다.", ["item-isaiah", "item-micah", "item-sennacherib", "item-manasseh", "item-zephaniah", "item-jeremiah", "item-jehoiakim", "item-jehoiachin", "item-nebuchadnezzar"], ["item-judah", "item-assyrian-empire", "item-babylonian-empire"], None, None),
    (12, 25, 25, "exile", ["item-zedekiah"], -588, -561, "confirmed", "BC 586년 예루살렘 함락·성전 소실부터 BC 561년 바벨론에서 여호야긴 왕이 옥에서 풀려나기까지를 다룹니다.", ["item-jeremiah", "item-jehoiachin", "item-nebuchadnezzar"], ["item-jerusalem-fall", "item-babylonian-empire"], None, None),
    (13, 1, 29, "united_kingdom", ["item-david"], -1010, -970, "estimated", "족보(1–9장)에 이어 다윗의 언약궤 안치와 성전 예배 직제 준비를 집중 조명합니다.", ["item-samuel", "item-saul", "item-solomon"], ["item-united-israel"], OVERVIEWS[13]["chronology"], None),
    (14, 1, 9, "united_kingdom", ["item-solomon"], -970, -931, "estimated", "솔로몬의 예루살렘 성전 건축과 봉헌 기도를 중심으로 다룹니다.", ["item-david"], ["item-united-israel"], OVERVIEWS[14]["chronology"], None),
    (14, 10, 28, "divided_kingdom", ["item-asa", "item-jehoshaphat", "item-uzziah"], -931, -715, "estimated", "분열 이후 남유다 다윗 왕가의 왕들과 성전 중심 신앙 개혁의 역사를 다룹니다.", ["item-rehoboam", "item-joash-judah", "item-jotham", "item-ahaz", "item-isaiah"], ["item-judah", "item-division"], OVERVIEWS[14]["chronology"], None),
    (14, 29, 36, "judah_alone", ["item-hezekiah", "item-josiah"], -715, -538, "confirmed", "히스기야·요시야의 성전 개혁과 유월절 준수, 예루살렘 함락, 그리고 마지막 절의 고레스 귀환 칙령까지 이어집니다.", ["item-manasseh", "item-jeremiah", "item-zedekiah", "item-cyrus"], ["item-judah", "item-jerusalem-fall", "item-return"], OVERVIEWS[14]["chronology"], None),
    (15, 1, 6, "return_persian", ["item-zerubbabel", "item-cyrus"], -538, -515, "confirmed", "BC 538년 고레스 칙령에 따른 1차 포로 귀환과 방해를 이겨 낸 BC 516/515년 제2성전 완공을 기록합니다.", ["item-haggai", "item-zechariah"], ["item-return", "item-temple-complete", "item-persian-empire"], None, None),
    (15, 7, 10, "return_persian", ["item-ezra"], -458, -430, "range", "학사 에스라의 2차 귀환과 율법 교육·공동체 정결 개혁을 다룹니다.", ["item-nehemiah", "item-malachi"], ["item-persian-empire"], None, OVERVIEWS[15]["chronology"]),
    (16, 1, 13, "return_persian", ["item-nehemiah"], -445, -430, "confirmed", "아닥사스다 제20년(BC 445년) 느헤미야의 귀환, 52일 성벽 완공, 에스라의 율법 낭독과 언약 갱신을 다룹니다.", ["item-ezra", "item-malachi"], ["item-persian-empire"], None, None),
    (17, 1, 10, "return_persian", ["item-esther", "item-xerxes"], -486, -465, "confirmed", "페르시아 크세르크세스 1세(아하수에로) 통치기 수도 수산에서 유다 민족이 구원받고 부림절이 제정된 배경입니다.", [], ["item-persian-empire"], None, None),
    (23, 1, 39, "judah_alone", ["item-isaiah"], -740, -698, "estimated", "웃시야 사후부터 아하스·히스기야 통치기에 걸쳐 앗수르 위기 속 유다와 열방을 향해 선포된 예언과 역사 기사입니다.", ["item-uzziah", "item-jotham", "item-ahaz", "item-hezekiah", "item-micah", "item-sennacherib"], ["item-assyrian-empire"], None, OVERVIEWS[23]["chronology"]),
    (23, 40, 66, "exile", ["item-isaiah", "item-cyrus"], -586, -515, "range", "바벨론 포로 귀환 위로, 고난받는 여호와의 종의 노래(53장), 새 하늘과 새 땅 회복 비전을 다룹니다.", ["item-zerubbabel"], ["item-return", "item-persian-empire"], "예언이 겨냥하는 역사적 지평은 바벨론 포로 말기~귀환 이후 공동체입니다.", OVERVIEWS[23]["chronology"]),
    (24, 1, 39, "judah_alone", ["item-jeremiah"], -627, -586, "confirmed", "요시야 제13년(BC 627년) 소명부터 시드기야 제11년 예루살렘 함락까지 40여 년간 선포된 경고와 새 언약 약속입니다.", ["item-josiah", "item-jehoiakim", "item-jehoiachin", "item-zedekiah", "item-zephaniah", "item-habakkuk", "item-nebuchadnezzar"], ["item-jerusalem-fall", "item-babylonian-empire"], None, None),
    (24, 40, 52, "exile", ["item-jeremiah"], -586, -580, "estimated", "예루살렘 함락 직후 그달랴 피살과 남은 백성의 애굽 이주, 열방 심판 신탁 및 함락 역사 부록(52장)입니다.", ["item-zedekiah", "item-jehoiachin", "item-nebuchadnezzar"], ["item-jerusalem-fall"], None, None),
    (25, 1, 5, "exile", ["item-jeremiah"], -586, -580, "estimated", "BC 587/586년 바벨론에 의해 파괴된 예루살렘 성과 성전의 참상을 애도하며 여호와의 인자를 구하는 탄원시입니다.", ["item-zedekiah", "item-ezekiel"], ["item-jerusalem-fall"], None, None),
    (26, 1, 48, "exile", ["item-ezekiel"], -593, -571, "confirmed", "바벨론 그발 강가 포로 공동체에서 BC 593–571년 사이 선포된 심판 환상과 마른 뼈·새 성전 회복 비전입니다.", ["item-jehoiachin", "item-zedekiah", "item-jeremiah", "item-daniel", "item-nebuchadnezzar"], ["item-jerusalem-fall", "item-babylonian-empire"], None, None),
    (27, 1, 12, "exile", ["item-daniel"], -605, -536, "estimated", "BC 605년 1차 포로 이송부터 페르시아 고레스 초기까지 바벨론·바사 궁정 신앙 이야기와 하나님 나라 환상을 다룹니다.", ["item-jehoiakim", "item-nebuchadnezzar", "item-cyrus", "item-ezekiel", "item-jeremiah"], ["item-babylonian-empire", "item-persian-empire"], None, OVERVIEWS[27]["chronology"]),
    (28, 1, 14, "divided_kingdom", ["item-hosea"], -755, -722, "estimated", "여로보암 2세 말기부터 사마리아 함락 직전까지 북이스라엘의 우상숭배를 책망하고 하나님의 인애를 호소한 예언입니다.", ["item-jeroboam-ii", "item-uzziah", "item-jotham", "item-ahaz", "item-hoshea-king", "item-amos", "item-isaiah", "item-micah"], ["item-north-israel", "item-samaria-fall"], None, None),
    (30, 1, 9, "divided_kingdom", ["item-amos"], -760, -750, "estimated", "유다 왕 웃시야와 북이스라엘 왕 여로보암 2세 번영기에 사회 불의와 거짓 예배를 꾸짖고 공의를 선포한 예언입니다.", ["item-uzziah", "item-jeroboam-ii", "item-hosea", "item-jonah"], ["item-north-israel"], None, None),
    (31, 1, 1, "exile", ["item-jeremiah"], -587, -586, "range", "예루살렘 환난의 날에 형제 나라 유다의 재앙을 방관·약탈한 에돔에 대한 심판과 시온 구원 예언입니다.", ["item-zedekiah", "item-ezekiel"], ["item-jerusalem-fall"], None, OVERVIEWS[31]["chronology"]),
    (32, 1, 4, "divided_kingdom", ["item-jonah"], -785, -755, "estimated", "여로보암 2세 시대 선지자 요나가 적국 앗수르 수도 니느웨에 회개를 선포하고 하나님의 보편적 긍휼을 배운 서사입니다.", ["item-jeroboam-ii", "item-uzziah", "item-amos"], ["item-assyrian-empire"], OVERVIEWS[32]["chronology"], None),
    (33, 1, 7, "divided_kingdom", ["item-micah"], -738, -698, "estimated", "남유다 요담·아하스·히스기야 시대에 지도층의 수탈을 책망하고 베들레헴 메시아 탄생을 선포한 예언입니다.", ["item-jotham", "item-ahaz", "item-hezekiah", "item-isaiah", "item-hosea"], ["item-samaria-fall"], None, None),
    (34, 1, 3, "judah_alone", ["item-nahum"], -663, -612, "range", "테베 함락(BC 663) 이후~니느웨 함락(BC 612) 이전 사이에 신앗수르 수도 니느웨의 멸망을 선포한 예언입니다(선포 가능 범위).", ["item-josiah"], ["item-assyrian-empire"], None, OVERVIEWS[34]["chronology"]),
    (35, 1, 3, "judah_alone", ["item-habakkuk"], -608, -598, "estimated", "여호야김 통치기 바벨론 침공 직전에 불의한 현실 속 하나님의 섭리를 묻고 믿음의 찬양에 이른 예언입니다.", ["item-jehoiakim", "item-jeremiah", "item-daniel"], ["item-babylonian-empire"], None, None),
    (36, 1, 3, "judah_alone", ["item-zephaniah"], -632, -620, "estimated", "요시야 종교개혁 전후 유다의 우상숭배에 대한 ‘여호와의 날’ 심판과 겸손한 남은 자의 기쁨을 선포한 예언입니다.", ["item-josiah", "item-jeremiah"], ["item-judah"], None, None),
    (37, 1, 2, "return_persian", ["item-haggai"], -520, -520, "confirmed", "다리오 1세 제2년(BC 520년) 귀환 공동체를 독려하여 멈춰 있던 제2성전 건축을 재개시킨 예언입니다.", ["item-zerubbabel", "item-zechariah"], ["item-temple-complete"], None, None),
    (38, 1, 8, "return_persian", ["item-zechariah"], -520, -518, "confirmed", "다리오 제2~4년(BC 520–518년) 여덟 환상을 통해 스룹바벨과 예수아의 성전 재건을 격려한 예언입니다.", ["item-zerubbabel", "item-haggai"], ["item-temple-complete"], None, None),
    (38, 9, 14, "return_persian", ["item-zechariah"], -518, -480, "range", "겸손한 왕의 입성(9:9), 선한 목자 비유와 종말론적 시온의 정결·여호와의 왕권을 선포하는 스가랴 후반부입니다.", ["item-zerubbabel"], ["item-temple-complete"], None, "스가랴 9–14장은 주전 5세기 초 스가랴 말년설과 헬라기 이전 후대 예언 편집설이 함께 논의됩니다."),
    (39, 1, 4, "return_persian", ["item-malachi"], -450, -430, "estimated", "페르시아 통치기 재건 성전 공동체의 해이해진 예배와 윤리를 일깨우고 주의 길을 예비할 사자를 예고한 본문입니다.", ["item-ezra", "item-nehemiah"], ["item-persian-empire"], None, None),
]

for b, c1, c2, era_id, prims, sy, ey, prec, summ, conts, rels, w_note, div_note in DATED_OT_MAPPINGS:
    add_mapping(
        b, c1, c2, era_id, prims,
        format_year_span(sy, ey, prec),
        summ,
        precision=prec,
        start=sy,
        end=ey,
        contemporaries=conts,
        related=rels,
        written_note=w_note,
        divergent=div_note,
    )

# 10C. 표제·배경이 명확한 시편 개별 매핑
add_mapping(
    19, 90, 90, "exodus", ["item-moses"],
    "모세의 기도 표제 시편 (광야 배경 · 작성 연대 미확정)",
    "‘하나님의 사람 모세의 기도’라는 표제를 지닌 시편으로 영원하신 하나님 앞에서 인생의 연약함과 지혜를 구합니다.",
    relative_order=15,
    written_note="표제는 모세 시대를 가리키며 시편 제4권 수집·편집 시기는 왕정기 이후입니다.",
)
for ps_num, reason in [
    (3, "표제가 ‘다윗이 그의 아들 압살롬을 피할 때에 지은 시’로 명시되어 있습니다(삼하 15장 배경)."),
    (18, "표제가 ‘여호와께서 다윗을 사울과 모든 원수의 손에서 건져 주신 날에 드린 노래’를 가리킵니다(삼하 22장 병행)."),
    (34, "표제가 ‘다윗이 아비멜렉(아기스) 앞에서 미친 체하다가 쫓겨나서 지은 시’를 가리킵니다(삼상 21장 배경)."),
    (51, "표제가 ‘다윗이 밧세바에게 들어간 후 선지자 나단이 그에게 왔을 때’의 참회시임을 명시합니다(삼하 12장 배경)."),
]:
    add_mapping(
        19, ps_num, ps_num, "united_kingdom", ["item-david"],
        "약 BC 1010–970년 (다윗 생애 표제 배경)",
        reason,
        precision="estimated",
        start=-1010,
        end=-970,
        contemporaries=["item-samuel", "item-saul"],
    )
add_mapping(
    19, 126, 126, "return_persian", ["item-zerubbabel"],
    "BC 538년 이후 (시온 포로 귀환 회상)",
    "여호와께서 시온의 포로를 돌려보내실 때 꿈꾸는 것 같았도다 노래하는 귀환 공동체의 찬양시입니다.",
    precision="estimated",
    start=-538,
    end=-430,
    related=["item-return"],
)
add_mapping(
    19, 137, 137, "exile", ["item-ezekiel"],
    "BC 586–538년 배경 (바벨론 포로 경험 회상)",
    "바벨론 여러 강변에 앉아 시온을 기억하며 울었다고 회상하는 포로 공동체의 탄원시입니다.",
    precision="confirmed",
    start=-586,
    end=-538,
    related=["item-jerusalem-fall"],
)

# 10D. 복음서 · 사도행전 · 신약 서신서 전체(45..66권) 매핑
NT_NARRATIVE_MAPPINGS = [
    (40, 1, 2, "jesus_life", ["person-jesus", "item-mary"], -6, -4, "estimated", "아브라함과 다윗의 자손 예수 그리스도의 베들레헴 탄생과 헤롯 대왕 말기의 사건을 다룹니다.", ["item-herod-great", "item-augustus"], [], OVERVIEWS[40]["chronology"], None),
    (40, 3, 28, "jesus_life", ["person-jesus"], 26, 30, "range", "세례 요한의 사역과 예수님의 갈릴리·예루살렘 천국 복음 사역, 십자가 대속과 부활·지상명령을 다룹니다.", ["item-john-baptist", "item-peter", "item-john-apostle", "item-pilate", "item-herod-antipas", "item-tiberius"], ["item-crucifixion"], OVERVIEWS[40]["chronology"], "공생애·수난 연대는 AD 27–30년설과 AD 29–33년설이 병존합니다."),
    (41, 1, 16, "jesus_life", ["person-jesus"], 26, 30, "range", "세례 요한의 광야 외침부터 예수님의 갈릴리 권능 사역과 예루살렘 수난·빈 무덤 부활을 집중 기록합니다.", ["item-john-baptist", "item-peter", "item-john-apostle", "item-pilate", "item-herod-antipas"], ["item-crucifixion"], OVERVIEWS[41]["chronology"], None),
    (42, 1, 2, "jesus_life", ["person-jesus", "item-mary"], -6, -4, "estimated", "아우구스투스 황제와 헤롯 대왕 시기를 배경으로 세례 요한과 예수님의 탄생·유년기를 기록합니다.", ["item-john-baptist", "item-herod-great", "item-augustus"], [], OVERVIEWS[42]["chronology"], None),
    (42, 3, 24, "jesus_life", ["person-jesus"], 26, 30, "range", "디베료 황제 제15년 세례 요한 등장부터 예수님의 공생애·수난·부활·승천까지를 역사적 순서로 증언합니다.", ["item-john-baptist", "item-peter", "item-john-apostle", "item-pilate", "item-herod-antipas", "item-tiberius"], ["item-crucifixion"], OVERVIEWS[42]["chronology"], None),
    (43, 1, 21, "jesus_life", ["person-jesus"], 27, 30, "range", "성육신하신 말씀(로고스)이신 예수님의 일곱 표적과 다락방 강화, 십자가 영광과 부활 현현을 증언합니다.", ["item-john-baptist", "item-peter", "item-john-apostle", "item-mary", "item-pilate"], ["item-crucifixion"], OVERVIEWS[43]["chronology"], None),
    (44, 1, 7, "early_church", ["item-peter", "item-stephen"], 30, 35, "estimated", "예수님 승천과 오순절 성령 강림, 예루살렘 초대교회의 성장과 일곱 일꾼 선출, 스데반의 순교를 다룹니다.", ["item-john-apostle", "item-mary", "item-philip", "item-james"], [], OVERVIEWS[44]["chronology"], None),
    (44, 8, 12, "early_church", ["item-philip", "item-peter", "item-paul"], 34, 44, "estimated", "사마리아·에티오피아 내시 전도, 사울(바울)의 다메섹 회심, 고넬료 가정 이방인 오순절, 안디옥 교회 성장을 다룹니다.", ["item-cornelius", "item-barnabas", "item-james", "item-claudius"], [], None, None),
    (44, 13, 15, "early_church", ["item-paul", "item-barnabas"], 46, 49, "estimated", "안디옥 교회의 파송에 따른 바울과 바나바의 1차 전도여행 및 AD 49년경 예루살렘 공의회를 다룹니다.", ["item-peter", "item-james", "item-silas"], ["item-first-journey", "item-council"], None, None),
    (44, 16, 18, "early_church", ["item-paul", "item-silas"], 49, 52, "confirmed", "디모데·누가가 합류해 빌립보·데살로니가·고린도(갈리오 총독 재임 AD 51–52)로 이어진 2차 전도여행입니다.", ["item-timothy", "item-luke", "item-gallio", "item-claudius"], ["item-second-journey", "epistle-52", "epistle-53"], None, None),
    (44, 19, 21, "early_church", ["item-paul"], 53, 57, "estimated", "에베소 두란노 서원 사역과 마게도냐·아가야 순회 후 예루살렘으로 올라간 3차 전도여행 시기입니다.", ["item-timothy", "item-luke", "item-philip", "item-james"], ["item-third-journey", "epistle-45", "epistle-46", "epistle-47"], None, None),
    (44, 22, 26, "early_church", ["item-paul"], 57, 59, "estimated", "예루살렘 체포 이후 가이사랴에서 총독 벨릭스·베스도와 아그립바 2세 왕 앞에 서서 변론하고 가이사에게 상소한 시기입니다.", ["item-felix", "item-festus", "item-agrippa-ii", "item-luke", "external-nero"], [], None, None),
    (44, 27, 28, "early_church", ["item-paul", "item-luke"], 59, 62, "estimated", "가이사랴에서 로마로의 항해 여정과 로마 셋집에서의 2년간 가택 연금 복음 전파를 다룹니다.", ["external-nero", "item-timothy"], ["item-rome-journey", "item-rome-custody", "epistle-49", "epistle-50", "epistle-51", "epistle-57"], None, None),
]

for b, c1, c2, era_id, prims, sy, ey, prec, summ, conts, rels, w_note, div_note in NT_NARRATIVE_MAPPINGS:
    add_mapping(
        b, c1, c2, era_id, prims,
        format_year_span(sy, ey, prec),
        summ,
        precision=prec,
        start=sy,
        end=ey,
        contemporaries=conts,
        related=rels,
        written_note=w_note,
        divergent=div_note,
    )

for book_num, start_y, end_y, rel_ids, _sec_note in EPISTLE_SPECS:
    people_contemp = [rid for rid in rel_ids if not rid.startswith("item-first-") and not rid.startswith("item-second-") and not rid.startswith("item-third-") and not rid.startswith("item-rome-") and rid != "item-council"]
    event_rel = [rid for rid in rel_ids if rid not in people_contemp]
    add_mapping(
        book_num,
        1,
        BOOKS_BY_NUMBER[book_num]["chapters"],
        "early_church",
        [f"epistle-{book_num}"],
        format_year_span(start_y, end_y, "range", " (작성 추정 범위)"),
        OVERVIEWS[book_num]["chronology"],
        kind="composition_time",
        precision="range",
        start=start_y,
        end=end_y,
        contemporaries=people_contemp,
        related=event_rel,
        divergent=OVERVIEWS[book_num]["chronology"] if book_num in {48, 49, 54, 58, 59, 61, 66} else None,
    )

assert len(eras) == 12
assert len(items) >= 95
assert all(m["book"] not in {18, 20, 21, 22, 29} for m in mappings)

# =====================================================================
# 11. 시대별 연대 산출 근거 노트(anchorBasisKo, studyNotesKo) 주입
# =====================================================================
ERA_STUDY_META: dict[str, tuple[str, list[str]]] = {
    "primeval": (
        "창세기 1–11장 서사 순서 (절대 BC 연도 비부여)",
        [
            "창세기 1–11장은 천지 창조, 에덴 타락, 노아 홍수, 바벨탑 사건을 구속사의 기원으로 서술합니다.",
            "히브리 맛소라 사본·사마리아 오경·70인역(LXX) 간 족보 연수 표기 방식과 신학적 해석 차이가 크므로, 본 연대표는 임의의 BC 연도를 부여하지 않고 본문 서사 순서(1→4단계)로만 배치합니다.",
        ],
    ),
    "patriarchs": (
        "창세기 12–50장 족장 연령 좌표 (창 12:4 · 21:5 · 25:26 · 41:46 · 47:9)",
        [
            "성경은 족장기에 BC 연도 대신 인물 나이를 기록합니다: 아브라함 75세 하란 출발(창 12:4) → 100세 이삭 출생(창 21:5) → 이삭 60세(아브라함 160세) 야곱 출생(창 25:26) → 아브라함 175세 별세(야곱 15세 때, 창 25:7).",
            "요셉은 30세에 총리가 되었고(창 41:46) 풍년 7년·흉년 2년 뒤인 39세에 130세 부친 야곱을 맞았으므로(창 47:9), 야곱 약 91세(아브라함 사후 약 76년)에 태어났습니다. 따라서 아브라함과 요셉은 생존 기간이 겹치지 않습니다.",
            "절대 BC 연대는 열왕기상 6:1 문자 역산(초기설 약 BC 2166–1805년경)과 중기 청동기 배경 비정(약 BC 2000–1700년경) 등 학설이 갈리므로 상대 세대 슬롯으로 표시합니다.",
        ],
    ),
    "exodus": (
        "출애굽기·민수기 여정 연월일 기록 (출 7:7 · 12:40 · 19:1 · 40:17 · 민 10:11 · 33:38 · 신 34:7)",
        [
            "모세(80–120세)와 아론(83–123세)의 출애굽·광야 인도 기간은 성경 본문상 약 40년 규모입니다(출 7:7; 민 33:38–39; 신 34:7).",
            "성경 본문은 시내산 여정을 월·일 단위로 기록합니다: 제1년 1월 14일 유월절 → 제1년 3월 시내 광야 도착(출 19:1) → 제2년 1월 1일 성막 건립(출 40:17) → 제2년 2월 20일 출발(민 10:11) → 제40년 5월 1일 아론 별세(민 33:38).",
            "출애굽의 절대 BC 연대에 관해서는 왕상 6:1(솔로몬 제4년 전 480년)에 따른 초기설(약 BC 1446년)과 출 1:11 비돔·라암셋 고고학에 따른 후기설(약 BC 1260년)을 병기해 안내합니다.",
        ],
    ),
    "conquest_judges": (
        "여호수아·사사기·룻기 서사 및 사사별 통치·평온 연수 (수 24:29 · 삿 2:16–19 · 룻 4:17–22)",
        [
            "사사기에 기록된 압제·구원·평온 연수를 단순 합산하면 400년을 넘기나, 입다와 삼손 시기(삿 10:7 암몬·블레셋 동시 압제)처럼 여러 지파·지역에서 사사들이 부분 중첩 활동한 것으로 해석하는 견해가 유력합니다.",
            "지역 간 정확한 동시 겹침 범위는 본문만으로 단정할 수 없으므로 사사들 사이에 억지 동시대 관계를 부여하지 않고 서사 순서대로 배열합니다.",
        ],
    ),
    "united_kingdom": (
        "사무엘상하·열왕기상 통치 연수 (행 13:21 · 삼하 5:4–5 · 왕상 6:1 · 11:42)",
        [
            "사울(전승 약 40년, 행 13:21), 다윗(헤브론 7년 6개월 + 예루살렘 33년 = 40년, 삼하 5:4–5), 솔로몬(40년, 왕상 11:42) 세 왕의 통일 왕정 시기입니다.",
            "솔로몬 사후 왕국 분열 시점(약 BC 931/930년)이 후대 앗수르 연대기와 맞물리면서 이 시기부터 비례 연도축 표기가 가능해집니다.",
        ],
    ),
    "divided_kingdom": (
        "열왕기 동기화 연대 + 고대 근동 비문 (쿠르크 비문 BC 853 · 검은 오벨리스크 BC 841 · 앗수르 일식 BC 763 · 사마리아 함락 BC 722)",
        [
            "북이스라엘(19왕)과 남유다(다윗 왕조)의 재위 연대는 아합의 카르카르 전투(BC 853), 예후의 조공(BC 841), 사마리아 함락(BC 722) 등 앗수르 연대기 고정점과 정밀하게 대조됩니다.",
            "성경의 왕년 합산 차이는 부자 간 공동 섭정(co-regency, 예: 웃시야-요담) 및 즉위년 계산식(즉위년 산입 여부) 차이로 설명됩니다.",
        ],
    ),
    "judah_alone": (
        "산헤립 육각기둥(BC 701) · 바벨론 연대기 점토판(BC 605 · 597 · 586)",
        [
            "북왕국 멸망(BC 722) 이후 남유다 단독기에는 히스기야 제14년 산헤립 침공(BC 701, 왕하 18:13), 요시야의 므깃도 전사(BC 609), 여호야긴 2차 포로(BC 597년 3월, 바벨론 연대기 점토판 일치), 예루살렘 함락(BC 587/586) 등 확정 사료 연대가 집중되어 있습니다.",
            "나훔 등 선지자의 ‘활동 가능 범위(BC 663 테베 함락 ~ BC 612 니느웨 함락)’는 실제 51년 연속 사역이 아닌 상·하한 창(uncertainty window)으로 구분해 표시합니다.",
        ],
    ),
    "exile": (
        "에스겔 포로기 연월일 표기 (겔 1:1–2 · 29:17) · 왕하 25:27 여호야긴 사면(BC 561)",
        [
            "유다 포로 이송은 세 차례(1차 BC 605 다니엘, 2차 BC 597 여호야긴·에스겔, 3차 BC 586 예루살렘 함락)에 걸쳐 진행되었습니다.",
            "에스겔서는 여호야긴 포로 연도를 기준으로 포로 제5년(BC 593)부터 제27년(BC 571)까지 날짜를 정밀하게 기록하며, 바벨론 배급 문서에서도 여호야긴 왕가의 실재가 확인됩니다.",
        ],
    ),
    "return_persian": (
        "고레스 원통 비문(BC 539/538) · 다리오 재위기(학 1:1 · 스 6:15) · 아닥사스다 재위기(스 7:7 · 느 2:1)",
        [
            "바벨론 함락(BC 539) 직후 고레스 칙령(BC 538)으로 1차 귀환이 이루어졌고, 학개·스가랴의 권면 속에 다리오 1세 제6년(BC 516/515) 제2성전이 완공되었습니다.",
            "아하수에로(크세르크세스 1세, BC 486–465) 재위기 수산 궁 에스더 사건 이후, 아닥사스다 1세 제7년(BC 458, 다수설) 에스라 귀환과 제20년(BC 445) 느헤미야 성벽 재건으로 이어집니다.",
        ],
    ),
    "intertestamental": (
        "그리스·헬레니즘·로마 사료 및 요세푸스 『유대 고대사』 (외부 역사 배경)",
        [
            "말라기 이후 세례 요한 등장 이전 약 400년은 개신교 정경 66권의 직접 서술 공백기이나, 알렉산드로스 원정(BC 334–323)으로 확산된 코이네 헬라어, 프톨레마이오스기의 70인역 번역, 마카비 항쟁(수전절 배경), 로마 정복(BC 63)이 신약 시대의 역사적 토양을 형성했습니다.",
            "정경 본문에 없는 외부 역사 사건에는 임의의 성경 장절을 억지로 연결하지 않고 ‘외부 역사’로 투명하게 표기합니다.",
        ],
    ),
    "jesus_life": (
        "눅 2:1–2(아우구스투스) · 마 2:1(헤롯 대왕 BC 4 사망) · 눅 3:1(디베료 15년) · 빌라도 재임(AD 26–36)",
        [
            "헤롯 대왕이 BC 4년에 사망했으므로 예수님의 베들레헴 탄생은 약 BC 6–4년경으로 산출됩니다(역사적 연대에는 0년이 없으므로 BC 1년 다음 해는 AD 1년입니다).",
            "디베료 황제 제15년(눅 3:1, 계산법에 따라 AD 27–29년경)에 세례 요한과 예수님의 공생애가 시작되었고, 빌라도 재임기 유월절 준비일 금요일 역산에 따라 십자가·부활 연대는 AD 30년설과 AD 33년설이 학계에 공존합니다.",
        ],
    ),
    "early_church": (
        "행 11:28 · 18:2(글라우디오 추방령 AD 49) · 18:12(갈리오 총독 비문 AD 51–52) · 벨릭스/베스도 교체기",
        [
            "델포이에서 발견된 클라우디우스 황제 서한 비문을 통해 아가야 총독 갈리오의 재임기(AD 51–52년)가 확정되면서, 바울의 고린도 체류(행 18:11–12)와 1–3차 전도여행 연대의 핵심 기준점이 세워졌습니다.",
            "신약 서신서 항목은 본문이 다루는 구속사 내용과 책이 기록된 ‘작성 추정 시기(composition_time)’를 구분하고, 연결된 전도여행·투옥 사건을 함께 안내합니다.",
        ],
    ),
}

for era_obj in eras:
    basis, notes = ERA_STUDY_META[era_obj["id"]]
    era_obj["anchorBasisKo"] = basis
    era_obj["studyNotesKo"] = notes

# =====================================================================
# 12. 특집 연대기(specialChronicles): ① 성막·성전사 (단계 차트) · ② 고난주간 (8일 요일별 조화 보드)
# =====================================================================
special_chronicles: list[dict] = [
    {
        "id": "sanctuary_history",
        "nameKo": "성막과 성전의 역사",
        "shortNameKo": "성막·성전사",
        "subtitleKo": "시내산 성막부터 솔로몬·스룹바벨 성전, 성육신하신 그리스도와 성령의 전까지",
        "displayPeriodKo": "출애굽 시내산 ~ AD 70년 · 종말 성취",
        "layout": "stages",
        "color": "#7b5e3b",
        "summaryKo": "구약의 이동식 성막과 예루살렘 제1·2성전을 거쳐, 참 성전이신 예수 그리스도와 성령이 거하시는 교회, 새 예루살렘으로 이어지는 하나님 임재 처소의 구속사 흐름입니다.",
        "anchorBasisKo": "출 25:8 · 왕상 6:1 · 왕하 25:9 · 스 6:15 · 요 2:19–21 · 고전 3:16 · 계 21:22",
        "studyNotesKo": [
            "구약 성소 역사는 ‘시내산 광야 성막 → 실로 회막·다윗 장막 → 솔로몬 제1성전(약 BC 966–586) → 스룹바벨 제2성전(BC 516/515 봉헌) 및 헤롯 증축 성전(BC 20경 착공 ~ AD 70 파괴)’의 뚜렷한 단계를 이룹니다.",
            "신약 복음서와 서신서는 물리적 성전 역사가 성육신하신 말씀(요 1:14, ‘우리 가운데 장막을 치시매’)과 부활하신 그리스도의 몸(요 2:21), 그리고 성령이 거하시는 공동체(고전 3:16)로 성취됨을 증언합니다.",
        ],
        "stages": [
            {"index": 1, "labelKo": "시내산 성막", "periodKo": "출애굽 제2년"},
            {"index": 2, "labelKo": "실로·다윗 장막", "periodKo": "정복~통일왕국"},
            {"index": 3, "labelKo": "솔로몬 제1성전", "periodKo": "약 BC 966–586"},
            {"index": 4, "labelKo": "제1성전 파괴", "periodKo": "BC 587/586"},
            {"index": 5, "labelKo": "스룹바벨 제2성전", "periodKo": "BC 538–515"},
            {"index": 6, "labelKo": "헤롯 증축·성육신", "periodKo": "BC 20경~AD 30"},
            {"index": 7, "labelKo": "AD 70 파괴·새 성전", "periodKo": "초대교회~새 하늘"},
        ],
        "groups": [
            {"key": "sanctuary_place", "labelKo": "성소 · 성전 체계", "subLabelKo": "임재 처소의 형태", "color": "#6d5637"},
            {"key": "sanctuary_event", "labelKo": "봉헌 · 정화 · 파괴", "subLabelKo": "역사적 분기 사건", "color": "#9a4d24"},
            {"key": "sanctuary_theology", "labelKo": "언약 · 신학적 성취", "subLabelKo": "구속사적 의미", "color": "#2c6252"},
        ],
        "events": [
            {
                "id": "sanc-tabernacle-plan",
                "groupKey": "sanctuary_place",
                "stageIndex": 1,
                "timeLabelKo": "시내산 언약 · 출애굽 제2년",
                "titleKo": "광야 회막(성막) 건립",
                "summaryKo": "‘내가 그들 중에 거할 성소를 지으라’는 말씀대로 성막을 세우자 여호와의 영광 구름이 회막에 충만했습니다.",
                "datePrecision": "undetermined",
                "recordType": "biblical_record",
                "linkedItemId": "item-sinai",
                "passages": [
                    passage("EXOD.25.8-9", "백성 중에 거하실 성소와 기구 식양을 명하신 본문입니다."),
                    passage("EXOD.40.34-38", "출애굽 제2년 첫째 달 성막 완공 후 여호와의 영광이 충만한 기록입니다."),
                ],
            },
            {
                "id": "sanc-shiloh-ark",
                "groupKey": "sanctuary_place",
                "stageIndex": 2,
                "timeLabelKo": "가나안 정착 ~ 다윗 통치기",
                "titleKo": "실로 회막과 다윗의 예루살렘 장막",
                "summaryKo": "가나안 정착 후 실로에 세워졌던 회막 시대를 거쳐, 다윗이 언약궤를 예루살렘 장막에 모시고 성전 건축을 준비했습니다.",
                "datePrecision": "estimated",
                "recordType": "biblical_record",
                "linkedItemId": "item-david",
                "passages": [
                    passage("JOSH.18.1", "온 회중이 실로에 모여 회막을 세운 정복기 기록입니다."),
                    passage("2SAM.6.17", "다윗이 여호와의 궤를 예루살렘 장막 가운데 안치한 기록입니다."),
                ],
            },
            {
                "id": "sanc-davidic-promise",
                "groupKey": "sanctuary_theology",
                "stageIndex": 2,
                "timeLabelKo": "약 BC 1000년경",
                "titleKo": "다윗 언약과 성전 건축 예고",
                "summaryKo": "다윗의 후손이 여호와의 이름을 위해 집을 건축하고 그 나라 위가 영원하리라는 언약이 주어졌습니다.",
                "datePrecision": "estimated",
                "recordType": "biblical_record",
                "linkedItemId": "item-david",
                "passages": [
                    passage("2SAM.7.12-13", "네 몸에서 날 씨가 내 이름을 위하여 집을 건축하리라는 다윗 언약입니다."),
                ],
            },
            {
                "id": "sanc-first-temple",
                "groupKey": "sanctuary_place",
                "stageIndex": 3,
                "timeLabelKo": "약 BC 966–586년",
                "titleKo": "솔로몬 제1성전 건축과 봉헌",
                "summaryKo": "솔로몬 즉위 제4년에 착공해 7년 만에 예루살렘 모리아산에 완공·봉헌된 제1성전입니다.",
                "datePrecision": "estimated",
                "recordType": "biblical_record",
                "linkedItemId": "item-solomon",
                "passages": [
                    passage("1KGS.6.1", "솔로몬 제4년 성전 건축을 시작한 구약 연대 핵심 구절입니다."),
                    passage("1KGS.8.10-11", "성전 봉헌 때 여호와의 영광 구름이 성전에 가득한 장면입니다."),
                ],
            },
            {
                "id": "sanc-josiah-cleanse",
                "groupKey": "sanctuary_event",
                "stageIndex": 3,
                "timeLabelKo": "BC 715년 · BC 622년",
                "titleKo": "히스기야·요시야의 성전 정화 개혁",
                "summaryKo": "남유다 혼합주의로 더럽혀진 성전을 히스기야와 요시야가 정화하고 성전에서 발견된 율법책으로 언약을 갱신했습니다.",
                "datePrecision": "confirmed",
                "recordType": "biblical_record",
                "linkedItemId": "item-josiah",
                "passages": [
                    passage("2KGS.22.8", "대제사장 힐기야가 여호와의 성전에서 율법책을 발견한 기사입니다."),
                    passage("2KGS.23.1-3", "요시야 왕이 성전 기둥 곁에서 언약을 세우고 우상을 철폐한 본문입니다."),
                ],
            },
            {
                "id": "sanc-babylon-destroy",
                "groupKey": "sanctuary_event",
                "stageIndex": 4,
                "timeLabelKo": "BC 587/586년",
                "titleKo": "바벨론 침공과 제1성전 소실",
                "summaryKo": "신바벨론 느부갓네살 군대에 의해 솔로몬 성전이 불타고 성전 기명이 바벨론으로 옮겨졌습니다.",
                "datePrecision": "confirmed",
                "recordType": "biblical_record",
                "linkedItemId": "item-jerusalem-fall",
                "passages": [
                    passage("2KGS.25.8-10", "시위대장 느부사라단이 여호와의 성전을 불사른 기록입니다."),
                    passage("EZEK.37.26-28", "포로민 가운데 내 성소를 영원히 두시겠다는 회복 약속입니다."),
                ],
            },
            {
                "id": "sanc-second-temple",
                "groupKey": "sanctuary_place",
                "stageIndex": 5,
                "timeLabelKo": "BC 538년 착수 ~ BC 516/515년 완공",
                "titleKo": "스룹바벨 제2성전 재건 완공",
                "summaryKo": "고레스 칙령 후 귀환 공동체가 기초를 놓고 학개·스가랴의 격려 속에 다리오 제6년 성전을 완공했습니다.",
                "datePrecision": "confirmed",
                "recordType": "biblical_record",
                "linkedItemId": "item-temple-complete",
                "passages": [
                    passage("EZRA.3.10-11", "건축자가 여호와의 성전 기초를 놓을 때 찬송하고 통곡한 기록입니다."),
                    passage("EZRA.6.14-16", "다리오 왕 제6년 아달월 3일에 성전 건축을 마치고 봉헌한 기록입니다."),
                ],
            },
            {
                "id": "sanc-herod-christ",
                "groupKey": "sanctuary_theology",
                "stageIndex": 6,
                "timeLabelKo": "약 BC 20년 증축 ~ AD 30년경",
                "titleKo": "헤롯 성전 증축과 참 성전이신 그리스도",
                "summaryKo": "헤롯 대왕이 확장한 예루살렘 성전에서 예수님은 성전을 정화하시고 자기 육체를 가리켜 사흘 만에 일으킬 성전이라 선언하셨습니다.",
                "datePrecision": "range",
                "recordType": "biblical_record",
                "linkedItemId": "person-jesus",
                "passages": [
                    passage("JOHN.1.14", "말씀이 육신이 되어 우리 가운데 거하시매(장막을 치시매) 영광을 본다는 선언입니다."),
                    passage("JOHN.2.19-21", "이 성전을 헐라 내가 사흘 동안에 일으키리라 하신 성전 본체 선언입니다."),
                ],
            },
            {
                "id": "sanc-ad70-destruction",
                "groupKey": "sanctuary_event",
                "stageIndex": 7,
                "timeLabelKo": "AD 70년",
                "titleKo": "로마군에 의한 제2성전 파괴 예고와 성취",
                "summaryKo": "돌 하나도 돌 위에 남지 않으리라 하신 예수님의 예고 이후 AD 70년 로마 티투스 군대에 의해 예루살렘 성전이 파괴되었습니다.",
                "datePrecision": "confirmed",
                "recordType": "biblical_record",
                "passages": [
                    passage("MATT.24.1-2", "성전 건물들을 가리켜 돌 하나도 돌 위에 남지 않고 무너지리라 하신 예수님 말씀입니다."),
                ],
            },
            {
                "id": "sanc-church-new-jerusalem",
                "groupKey": "sanctuary_theology",
                "stageIndex": 7,
                "timeLabelKo": "초대교회 ~ 새 하늘과 새 땅",
                "titleKo": "성령의 전인 교회와 새 예루살렘",
                "summaryKo": "성령이 거하시는 성도 공동체가 하나님의 성전으로 세워지며, 장차 새 예루살렘에서는 하나님과 어린양이 친히 성전이 되십니다.",
                "datePrecision": "undetermined",
                "recordType": "biblical_record",
                "passages": [
                    passage("1COR.3.16-17", "너희는 너희가 하나님의 성전인 것과 성령이 거하시는 줄을 알지 못하느냐는 말씀입니다."),
                    passage("EPH.2.19-22", "그리스도 예수 안에서 함께 지어져 성령 안에서 하나님이 거하실 처소가 된다는 말씀입니다."),
                    passage("REV.21.22-23", "전능하신 하나님과 어린양이 새 예루살렘의 성전이심을 선포하는 계시록 말씀입니다."),
                ],
            },
        ],
        "sourceIds": BIBLE_CHRONO,
    },
    {
        "id": "passion_week",
        "nameKo": "고난주간 일별 조화",
        "shortNameKo": "고난주간 (일별)",
        "subtitleKo": "예루살렘 입성부터 십자가 대속과 부활 새벽까지 4복음서 8일 행적",
        "displayPeriodKo": "유월절 주간 (니산월 9–17일 · AD 30 또는 33년 봄)",
        "layout": "day_columns",
        "color": "#8b3a2e",
        "summaryKo": "복음서 전체 분량의 큰 비중을 차지하는 예수님의 지상 마지막 한 주간을 종려주일부터 부활주일까지 요일별 컬럼으로 정렬하여 4복음서 본문을 한눈에 대조합니다.",
        "anchorBasisKo": "마태복음 21–28장 · 마가복음 11–16장 · 누가복음 19–24장 · 요한복음 12–20장",
        "divergentViewsKo": "십자가 수난 연대는 AD 30년(4월 7일)설과 AD 33년(4월 3일)설이 유력하며, 유대식 일몰 기준 하루 계산과 로마식 시간 표기(요한복음) 해석에 따라 세부 시각 대조 방식이 학자마다 조금씩 다릅니다.",
        "studyNotesKo": [
            "마가복음 11장은 입성(첫째 날) → 무화과나무 저주와 성전 정화(이튿날, 막 11:12) → 말라버린 무화과나무와 성전 변론(그 이튿날 아침, 막 11:20)으로 초반 사흘의 일자 흐름을 명시합니다.",
            "유대 명절 하루는 해 질 녘(일몰)에 시작되므로, 목요일 저녁 다락방 유월절 만찬과 겟세마네 기도·체포는 유대력으로 금요일(유월절 당일) 초저녁~밤에 걸쳐 이어집니다.",
        ],
        "groups": [
            {"key": "day_sun", "labelKo": "종려주일", "subLabelKo": "제1일 · 예루살렘 입성", "color": "#7c5a32"},
            {"key": "day_mon", "labelKo": "월요일", "subLabelKo": "제2일 · 성전 정화", "color": "#6f5f46"},
            {"key": "day_tue", "labelKo": "화요일", "subLabelKo": "제3일 · 변론과 강화", "color": "#526b7a"},
            {"key": "day_wed", "labelKo": "수요일", "subLabelKo": "제4일 · 침묵과 예비", "color": "#686d76"},
            {"key": "day_thu", "labelKo": "목요일", "subLabelKo": "제5일 · 만찬과 기도", "color": "#4c6f94"},
            {"key": "day_fri", "labelKo": "금요일", "subLabelKo": "제6일 · 십자가 대속", "color": "#8b3a2e"},
            {"key": "day_sat", "labelKo": "토요일", "subLabelKo": "제7일 · 무덤 안식", "color": "#5d576b"},
            {"key": "day_res", "labelKo": "부활주일", "subLabelKo": "제8일 · 빈 무덤과 현현", "color": "#2c6252"},
        ],
        "events": [
            {
                "id": "pw-triumphal-entry",
                "groupKey": "day_sun",
                "timeLabelKo": "종려주일 낮",
                "titleKo": "나귀 새끼를 타고 예루살렘 입성",
                "summaryKo": "스가랴 9:9 예언대로 겸손의 왕으로 입성하실 때 무리가 종려나무 가지를 흔들며 호산나를 외쳤고, 예수님은 성을 보시며 우셨습니다.",
                "datePrecision": "range",
                "recordType": "biblical_record",
                "gospelTags": ["마태", "마가", "누가", "요한"],
                "linkedItemId": "person-jesus",
                "passages": [
                    passage("MATT.21.1-9", "나귀를 타신 겸손의 왕과 무리의 호산나 찬송 기록입니다."),
                    passage("LUKE.19.41-44", "예루살렘을 가까이 보시고 평화의 일을 알지 못함을 두고 우신 본문입니다."),
                    passage("JOHN.12.12-15", "종려나무 가지를 가지고 맞이하러 나온 유월절 무리 기록입니다."),
                ],
            },
            {
                "id": "pw-temple-cleansing",
                "groupKey": "day_mon",
                "timeLabelKo": "월요일 아침 · 낮",
                "titleKo": "잎만 무성한 무화과나무와 성전 정화",
                "summaryKo": "베다니에서 나오시며 열매 없는 무화과나무를 꾸짖으시고, 성전 뜰의 매매하는 자들을 내쫓으시며 ‘만민이 기도하는 집’을 회복하셨습니다.",
                "datePrecision": "range",
                "recordType": "biblical_record",
                "gospelTags": ["마태", "마가", "누가"],
                "linkedItemId": "person-jesus",
                "passages": [
                    passage("MARK.11.12-18", "베다니에서 나오신 이튿날 무화과나무 사건과 성전 정화 본문입니다."),
                    passage("MATT.21.12-16", "성전 정화 직후 맹인과 저는 자들을 고치신 마태복음 기록입니다."),
                ],
            },
            {
                "id": "pw-temple-debates",
                "groupKey": "day_tue",
                "timeLabelKo": "화요일 낮 · 성전 뜰",
                "titleKo": "권위·세금·부활 논쟁과 가장 큰 계명",
                "summaryKo": "대제사장·바리새인·사두개인들의 시험 질문에 지혜로 답하시고 하나님 사랑·이웃 사랑의 대계명과 과부의 두 렙돈을 칭찬하셨습니다.",
                "datePrecision": "range",
                "recordType": "biblical_record",
                "gospelTags": ["마태", "마가", "누가"],
                "linkedItemId": "person-jesus",
                "passages": [
                    passage("MATT.22.15-22", "가이사의 것은 가이사에게, 하나님의 것은 하나님께 바치라 하신 답변입니다."),
                    passage("MARK.12.28-34", "마음을 다해 주 너의 하나님을 사랑하고 네 이웃을 사랑하라 하신 첫째·둘째 계명입니다."),
                    passage("LUKE.21.1-4", "가난한 과부가 넣은 두 렙돈을 가장 많이 넣었다 칭찬하신 본문입니다."),
                ],
            },
            {
                "id": "pw-olivet-discourse",
                "groupKey": "day_tue",
                "timeLabelKo": "화요일 저녁 · 감람산",
                "titleKo": "감람산 강화 (종말과 깨어 있음)",
                "summaryKo": "성전을 나와 감람산에 앉으셔서 예루살렘 멸망과 인자의 재림, 열 처녀·달란트·양과 염소 비유로 깨어 준비할 것을 가르치셨습니다.",
                "datePrecision": "range",
                "recordType": "biblical_record",
                "gospelTags": ["마태", "마가", "누가"],
                "linkedItemId": "person-jesus",
                "passages": [
                    passage("MATT.24.3-14", "감람산에서 제자들에게 세상 끝의 징조와 천국 복음 전파를 일러주신 강화입니다."),
                    passage("MATT.25.31-40", "지극히 작은 자 하나에게 한 것이 곧 내게 한 것이라 하신 심판 비유입니다."),
                ],
            },
            {
                "id": "pw-wednesday-plot",
                "groupKey": "day_wed",
                "timeLabelKo": "수요일 · 베다니와 예루살렘",
                "titleKo": "베다니 쉼과 대제사장·유다의 배반 모의",
                "summaryKo": "예수님이 베다니에 머무시는 동안 대제사장들과 장로들이 흉계를 꾸미고 가룟 유다가 은 삼십에 넘겨줄 기회를 찾았습니다.",
                "datePrecision": "range",
                "recordType": "biblical_record",
                "gospelTags": ["마태", "마가", "누가"],
                "linkedItemId": "person-jesus",
                "passages": [
                    passage("MATT.26.1-5", "이틀이 지나면 유월절이라 인자가 십자가에 못 박히기 위해 팔리리라 예고하신 본문입니다."),
                    passage("LUKE.22.3-6", "가룟 유다가 대제사장들과 군관들에게 예수를 넘겨줄 방도를 의논한 기록입니다."),
                ],
            },
            {
                "id": "pw-last-supper",
                "groupKey": "day_thu",
                "timeLabelKo": "목요일 저녁 · 다락방",
                "titleKo": "세족식 · 성만찬 제정(새 언약) · 다락방 강화",
                "summaryKo": "제자들의 발을 씻기시며 새 계명을 주시고, 떡과 잔으로 새 언약 성만찬을 제정하신 뒤 보혜사 성령 약속과 대제사장적 기도를 드리셨습니다.",
                "datePrecision": "range",
                "recordType": "biblical_record",
                "gospelTags": ["마태", "마가", "누가", "요한"],
                "linkedItemId": "person-jesus",
                "passages": [
                    passage("JOHN.13.1-5", "자기 사람들을 끝까지 사랑하시어 제자들의 발을 씻기신 세족식입니다."),
                    passage("LUKE.22.19-20", "내 몸과 내 피로 세우는 새 언약이라 하시며 성찬을 제정하신 본문입니다."),
                    passage("JOHN.17.1-5", "십자가를 앞두고 아버지께 올려 드리신 대제사장적 기도입니다."),
                ],
            },
            {
                "id": "pw-gethsemane-arrest",
                "groupKey": "day_thu",
                "timeLabelKo": "목요일 심야 · 겟세마네",
                "titleKo": "겟세마네 고뇌의 기도와 체포",
                "summaryKo": "감람산 겟세마네 동산에서 ‘나의 원대로 마시옵고 아버지의 원대로 하옵소서’ 땀이 핏방울같이 되도록 기도하신 후 체포되셨습니다.",
                "datePrecision": "range",
                "recordType": "biblical_record",
                "gospelTags": ["마태", "마가", "누가", "요한"],
                "linkedItemId": "person-jesus",
                "passages": [
                    passage("MARK.14.32-36", "겟세마네에서 아빠 아버지여 아버지의 원대로 하옵소서 기도하신 장면입니다."),
                    passage("JOHN.18.4-11", "체포 현장에서도 제자들을 보호하시고 아버지께서 주신 잔을 마시겠다 하신 기록입니다."),
                ],
            },
            {
                "id": "pw-trials-crucifixion",
                "groupKey": "day_fri",
                "timeLabelKo": "금요일 새벽 ~ 오후 3시",
                "titleKo": "공회·빌라도 재판과 골고다 십자가 대속",
                "summaryKo": "가야바 공회와 총독 빌라도·헤롯 안티파스 앞 심문을 거쳐 오전 9시(제3시) 골고다에서 못 박히시고 오후 3시(제9시) ‘다 이루었다’ 하시며 영혼을 맡기셨습니다.",
                "datePrecision": "range",
                "recordType": "biblical_record",
                "gospelTags": ["마태", "마가", "누가", "요한"],
                "linkedItemId": "item-crucifixion",
                "passages": [
                    passage("LUKE.23.20-25", "빌라도가 무죄를 알면서도 무리의 소리에 내어준 재판 기록입니다."),
                    passage("MARK.15.25-39", "제3시에 못 박히시고 제6~9시 어둠 뒤 성소 휘장이 찢어진 수난 기록입니다."),
                    passage("JOHN.19.28-30", "다 이루었다 하시고 머리를 숙이니 영혼이 떠나가신 대속 완성 본문입니다."),
                ],
            },
            {
                "id": "pw-burial-sabbath",
                "groupKey": "day_sat",
                "timeLabelKo": "금요일 해 질 무렵 ~ 토요일 안식일",
                "titleKo": "아리마대 요셉의 새 무덤 장사와 안식일 경비",
                "summaryKo": "안식일이 시작되기 전 아리마대 요셉과 니고데모가 예수님의 시신을 세마포로 싸서 새 무덤에 모셨고, 돌을 인봉하고 경비병이 지켰습니다.",
                "datePrecision": "range",
                "recordType": "biblical_record",
                "gospelTags": ["마태", "마가", "누가", "요한"],
                "linkedItemId": "item-crucifixion",
                "passages": [
                    passage("JOHN.19.38-42", "아리마대 요셉과 니고데모가 향품과 세마포로 예수님을 새 무덤에 장사한 기록입니다."),
                    passage("MATT.27.62-66", "대제사장들이 빌라도에게 청하여 돌을 인봉하고 경비병으로 무덤을 굳게 지킨 기록입니다."),
                ],
            },
            {
                "id": "pw-resurrection-sunday",
                "groupKey": "day_res",
                "timeLabelKo": "안식 후 첫날 새벽 · 저녁",
                "titleKo": "빈 무덤 부활 선언과 엠마오·예루살렘 현현",
                "summaryKo": "안식 후 첫날 이른 새벽 돌이 굴려진 빈 무덤에서 부활 소식이 선포되었고, 부활하신 주님이 막달라 마리아와 엠마오 두 제자, 다락방 제자들에게 친히 나타나셨습니다.",
                "datePrecision": "range",
                "recordType": "biblical_record",
                "gospelTags": ["마태", "마가", "누가", "요한"],
                "linkedItemId": "item-crucifixion",
                "passages": [
                    passage("MATT.28.5-8", "그가 여기 계시지 않고 말씀하시던 대로 살아나셨느니라 선포한 빈 무덤 기사입니다."),
                    passage("LUKE.24.27-32", "엠마오로 가던 제자들에게 모세와 모든 선지자의 글로 자기에 관한 것을 풀어주신 본문입니다."),
                    passage("JOHN.20.19-22", "안식 후 첫날 저녁 제자들 가운데 오사 너희에게 평강이 있을지어다 선언하신 본문입니다."),
                ],
            },
        ],
        "sourceIds": BIBLE_CHRONO,
    },
]

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(
    json.dumps(
        {
            "contentVersion": "2026.11-v3",
            "overviewNoticeKo": (
                "왕정 이전(원역사·족장·출애굽·사사) 구간은 확정할 수 없는 개인 BC 연도 대신 성경 본문의 상대 순서와 기록 연수를 표시하며, "
                "통일왕국 이후 구간은 사료 대조 비례 연도축(BC/AD 사이 0년 없음)으로 표시합니다. 발생 가능 연대 범위와 실제 활동 기간은 구분해 확인하세요."
            ),
            "eras": eras,
            "items": items,
            "chapterMappings": mappings,
            "specialChronicles": special_chronicles,
        },
        ensure_ascii=False,
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)
print(
    f"[OK] 생성 완료: 시대 {len(eras)}개, 항목 {len(items)}건, 본문 매핑 {len(mappings)}구간, "
    f"특집 연대기 {len(special_chronicles)}편 -> {OUT}"
)
