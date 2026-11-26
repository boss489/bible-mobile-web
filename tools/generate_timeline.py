#!/usr/bin/env python3
"""Generate the editorial Bible history timeline from reviewed local chronology.

Dates before the monarchy and disputed composition dates are broad estimates,
not calculated from the reference timeline sites.
"""

import json
import pathlib
import re

from books_meta import BOOKS_BY_NUMBER, BOOKS_BY_OSIS
from validate_study_data import load_max_verses_lookup

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "content/history/timeline.json"
MAX_VERSES = load_max_verses_lookup(ROOT / "public/data/bible/manifest.json")
OVERVIEWS = {v["book"]: v for name in ("ot", "nt") for v in json.loads(
    (ROOT / f"content/book-overviews/{name}.json").read_text(encoding="utf-8"))}
BIBLE = ["biblical-internal-text", "standard-biblical-intro"]
HISTORY = ["standard-biblical-intro", "ane-epigraphic-chronology"]


def passage(ref, role):
    match = re.fullmatch(r"([A-Z0-9]+)\.(\d+)\.(\d+)(?:-(\d+))?", ref)
    assert match, ref
    osis, chapter, first, last = match.groups()
    book = BOOKS_BY_OSIS[osis]["book"]
    chapter, first, last = int(chapter), int(first), int(last or first)
    assert 1 <= chapter <= BOOKS_BY_NUMBER[book]["chapters"] and 1 <= first <= last <= MAX_VERSES[(book, chapter)], ref
    return {"verseId": ref, "titleKo": BOOKS_BY_NUMBER[book]["nameKo"], "roleKo": role}


ERA_ROWS = [
    ("primeval", "원역사", None, None, "GEN.1.1", "창조·타락·홍수·바벨탑 이야기의 순서입니다."),
    ("patriarchs", "족장", -2000, -1700, "GEN.12.1", "아브라함에서 요셉에 이르는 가족 이야기입니다."),
    ("exodus", "출애굽", -1450, -1200, "EXOD.12.1", "출애굽과 광야·시내산 이야기입니다."),
    ("conquest_judges", "정복·사사", -1400, -1050, "JOSH.1.1", "가나안 정착과 사사 시대 이야기입니다."),
    ("united_kingdom", "통일왕국", -1050, -930, "1SAM.10.1", "사울·다윗·솔로몬의 왕국입니다."),
    ("divided_kingdom", "분열왕국", -930, -722, "1KGS.12.1", "남북 왕국이 공존한 시기입니다."),
    ("judah_alone", "유다 단독왕국", -722, -586, "2KGS.18.1", "북왕국 멸망 뒤 유다 왕국의 마지막 시기입니다."),
    ("exile", "포로", -586, -538, "EZEK.1.1", "바벨론 포로와 예루살렘 함락의 여파입니다."),
    ("return_persian", "귀환·페르시아", -538, -430, "EZRA.1.1", "고레스 칙령 이후 귀환과 공동체 재건입니다."),
    ("intertestamental", "신구약 중간기", -430, -6, None, "페르시아 말기부터 로마 지배까지의 외부 역사입니다."),
    ("jesus_life", "예수님의 생애", -6, 33, "LUKE.2.1", "예수님의 탄생·사역·수난·부활을 다룹니다."),
    ("early_church", "초대교회", 30, 100, "ACTS.2.1", "사도들의 사역과 초기 교회의 확장입니다."),
]
COLORS = ["#797d86", "#786a55", "#8a6958", "#68785b", "#735c70", "#7b6657",
          "#925e5c", "#766b85", "#668174", "#72818c", "#9a6d55", "#577b8a"]
eras = []
for order, (eid, name, start, end, ref, summary) in enumerate(ERA_ROWS, 1):
    primeval = eid == "primeval"
    eras.append({"id": eid, "nameKo": name, "shortNameKo": name, "summaryKo": summary,
                 "datePrecision": "undetermined" if primeval else "range",
                 "displayPeriodKo": "연대 미확정 · 본문 순서" if primeval else f"약 BC {-start}–{-end}년" if end < 0 else f"약 AD {start}–{end}년" if start > 0 else f"약 BC {-start}–AD {end}년",
                 "startYear": start, "endYear": end, "color": COLORS[order - 1],
                 "keyPassages": [passage(ref, "이 시대를 이해하는 핵심 본문입니다.")] if ref else [],
                 "sourceIds": BIBLE if ref else HISTORY,
                 **({"relativeRange": [1, 11]} if primeval else {}),
                 **({"divergentViewsKo": "출애굽 연대는 BC 15세기 초기설과 BC 13세기 후기설이 있습니다."} if eid in ("exodus", "conquest_judges") else {})})


def add(item_id, name, category, era, start, end, ref, summary, *, kind=None, record="biblical_record", related=None, secondary=None, note=None):
    era_ids = era.split(",")
    uncertain = start is None
    if uncertain:
        assert end is None
    else:
        assert start != 0 and end != 0 and start <= end
    if ref:
        links = [passage(ref, f"{name}의 역사적 연결을 보여 주는 본문입니다.")]
    else:
        links = []
    period_kind = kind or ("reign" if category == "ruler" else "polity_span" if category == "polity" else "event" if category == "event" else "ministry")
    row = {"id": item_id, "nameKo": name, "roleLabelKo": {"polity": "왕국·제국", "ruler": "왕·통치자", "prophet_priest": "선지자·사사·제사장", "person": "주요 인물", "event": "역사적 사건"}[category],
           "category": category, "eraIds": era_ids, "recordType": record, "periodKind": period_kind,
           "datePrecision": "undetermined" if uncertain else "range", "startYear": start, "endYear": end,
           "displayPeriodKo": "연대 미확정 · 본문 순서" if uncertain else f"약 BC {-start}–{-end}년" if end < 0 else f"약 AD {start}–{end}년" if start > 0 else f"약 BC {-start}–AD {end}년",
           "summaryKo": summary, "passages": links, "sourceIds": HISTORY if record == "external_history" else BIBLE}
    if uncertain:
        row["relativeOrder"] = len([i for i in items if i["datePrecision"] == "undetermined"]) + 1
    if related:
        row["relatedItemIds"] = related
    if secondary:
        row["secondaryPeriods"] = [{"periodKind": "event", "displayKo": secondary}]
    if note:
        row["externalHistoryNoteKo"] = note
    items.append(row)


items = []
# The first entries deliberately have no numeric dates: Genesis 1–11 gives a narrative order, not a calendar.
for row in [
    ("creation", "창조", "GEN.1.1", "창세기 첫 장의 창조 서사입니다."),
    ("fall", "인간의 타락", "GEN.3.1", "에덴 이야기의 후속 사건입니다."),
    ("flood", "노아의 홍수", "GEN.6.1", "홍수와 새 출발을 다루는 본문입니다."),
    ("babel", "바벨탑", "GEN.11.1", "언어와 흩어짐을 설명하는 서사입니다."),
]:
    add("event-" + row[0], row[1], "event", "primeval", None, None, row[2], row[3], kind="narrative_time")

# Broad ranges reflect the reviewed book overviews; pre-monarchic dates remain disputed.
for row in [
    ("abraham", "아브라함", "person", "patriarchs", -2000, -1800, "GEN.12.1", "부르심과 언약의 주인공입니다."),
    ("isaac", "이삭", "person", "patriarchs", -1900, -1750, "GEN.26.2", "아브라함 언약을 이어받는 족장입니다."),
    ("jacob", "야곱", "person", "patriarchs", -1850, -1700, "GEN.28.10", "이스라엘 열두 지파의 조상으로 제시됩니다."),
    ("joseph", "요셉", "person", "patriarchs", -1800, -1700, "GEN.45.4", "가족이 애굽으로 이주하는 이야기의 중심 인물입니다."),
    ("moses", "모세", "person", "exodus", -1450, -1200, "EXOD.3.1", "출애굽과 광야 공동체의 지도자입니다."),
    ("aaron", "아론", "prophet_priest", "exodus", -1450, -1200, "EXOD.28.1", "첫 제사장으로 임명됩니다."),
    ("exodus", "출애굽 사건", "event", "exodus", -1450, -1200, "EXOD.12.31", "초기설과 후기설이 있어 넓은 범위로만 둡니다."),
    ("sinai", "시내산 언약", "event", "exodus", -1450, -1200, "EXOD.19.5", "출애굽 뒤 시내산에서 언약을 맺습니다."),
    ("joshua", "여호수아", "person", "conquest_judges", -1400, -1150, "JOSH.1.1", "가나안 진입 이야기의 지도자입니다."),
    ("deborah", "드보라", "prophet_priest", "conquest_judges", -1250, -1050, "JUDG.4.4", "이스라엘을 이끈 사사이자 선지자입니다."),
    ("gideon", "기드온", "prophet_priest", "conquest_judges", -1250, -1050, "JUDG.6.11", "미디안 압제에서 구원한 사사입니다."),
    ("samson", "삼손", "prophet_priest", "conquest_judges", -1200, -1050, "JUDG.13.24", "블레셋과의 충돌을 다룬 사사 이야기입니다."),
    ("ruth", "룻", "person", "conquest_judges", -1200, -1050, "RUTH.1.1", "사사 시대를 배경으로 하는 이야기의 인물입니다."),
    ("samuel", "사무엘", "prophet_priest", "conquest_judges,united_kingdom", -1100, -990, "1SAM.3.1", "사사 시대와 왕정의 연결 인물입니다."),
    ("saul", "사울", "ruler", "united_kingdom", -1050, -1010, "1SAM.10.1", "이스라엘 초대 왕입니다."),
    ("david", "다윗", "ruler", "united_kingdom", -1010, -970, "2SAM.5.1", "예루살렘을 왕도로 삼은 왕입니다."),
    ("solomon", "솔로몬", "ruler", "united_kingdom", -970, -930, "1KGS.6.1", "성전을 건축한 왕입니다."),
    ("united-israel", "통일 이스라엘 왕국", "polity", "united_kingdom", -1050, -930, "1KGS.11.41", "사울·다윗·솔로몬 왕조의 시기입니다."),
    ("division", "왕국 분열", "event", "divided_kingdom", -931, -930, "1KGS.12.16", "르호보암 시대 남북 왕국이 갈라집니다."),
    ("north-israel", "북이스라엘 왕국", "polity", "divided_kingdom", -930, -722, "1KGS.12.20", "사마리아 함락 때까지 존속한 북왕국입니다."),
    ("judah", "남유다 왕국", "polity", "divided_kingdom,judah_alone", -930, -586, "1KGS.12.21", "예루살렘을 중심으로 이어진 남왕국입니다."),
    ("jeroboam-i", "여로보암 1세", "ruler", "divided_kingdom", -930, -910, "1KGS.12.20", "분열 후 북왕국의 첫 왕입니다."),
    ("rehoboam", "르호보암", "ruler", "divided_kingdom", -930, -913, "1KGS.12.1", "분열 당시 남유다 왕입니다."),
    ("asa", "아사", "ruler", "divided_kingdom", -911, -870, "1KGS.15.9", "유다의 종교 개혁을 추진한 왕입니다."),
    ("omri", "오므리", "ruler", "divided_kingdom", -885, -874, "1KGS.16.23", "사마리아를 북왕국 수도로 삼았습니다."),
    ("ahab", "아합", "ruler", "divided_kingdom", -874, -853, "1KGS.16.29", "엘리야와 대립한 북왕국 왕입니다."),
    ("elijah", "엘리야", "prophet_priest", "divided_kingdom", -875, -850, "1KGS.17.1", "아합 시대에 활동한 선지자입니다."),
    ("elisha", "엘리사", "prophet_priest", "divided_kingdom", -850, -800, "2KGS.2.1", "엘리야 뒤를 이은 선지자입니다."),
    ("jehu", "예후", "ruler", "divided_kingdom", -841, -814, "2KGS.9.1", "북이스라엘 왕조를 교체한 왕입니다."),
    ("jehoshaphat", "여호사밧", "ruler", "divided_kingdom", -870, -848, "1KGS.22.41", "아합과 동시대인 유다 왕입니다."),
    ("joash-judah", "유다 요아스", "ruler", "divided_kingdom", -835, -796, "2KGS.12.1", "성전 수리를 명한 유다 왕입니다."),
    ("jeroboam-ii", "여로보암 2세", "ruler", "divided_kingdom", -793, -753, "2KGS.14.23", "아모스·호세아 시대의 북왕국 왕입니다."),
    ("amos", "아모스", "prophet_priest", "divided_kingdom", -760, -750, "AMOS.1.1", "북왕국의 불의와 심판을 선포했습니다."),
    ("hosea", "호세아", "prophet_priest", "divided_kingdom", -750, -722, "HOS.1.1", "북왕국 말기에 활동했습니다."),
    ("jonah", "요나", "prophet_priest", "divided_kingdom", -790, -750, "2KGS.14.25", "여로보암 2세 시대 인물로 언급됩니다."),
    ("uzziah", "웃시야", "ruler", "divided_kingdom", -792, -740, "2CHR.26.1", "이사야 소명 직전의 유다 왕입니다."),
    ("ahaz", "아하스", "ruler", "divided_kingdom", -735, -715, "2KGS.16.1", "아람·이스라엘 위기의 유다 왕입니다."),
    ("isaiah", "이사야", "prophet_priest", "divided_kingdom,judah_alone", -740, -700, "ISA.6.1", "웃시야 사후부터 히스기야 때까지 활동한 선지자입니다."),
    ("micah", "미가", "prophet_priest", "divided_kingdom,judah_alone", -740, -700, "MIC.1.1", "요담·아하스·히스기야 시대 선지자입니다."),
    ("hezekiah", "히스기야", "ruler", "judah_alone", -715, -686, "2KGS.18.1", "앗수르 침공기에 유다를 다스렸습니다."),
    ("samaria-fall", "사마리아 함락", "event", "divided_kingdom", -722, -722, "2KGS.17.6", "앗수르가 북왕국 수도를 함락했습니다."),
    ("assyrian-empire", "앗수르 제국", "polity", "divided_kingdom,judah_alone", -900, -612, "2KGS.17.3", "북왕국을 정복하고 유다를 압박했습니다."),
    ("sennacherib", "산헤립", "ruler", "judah_alone", -705, -681, "2KGS.18.13", "히스기야 때 예루살렘을 압박한 앗수르 왕입니다."),
    ("manasseh", "므낫세", "ruler", "judah_alone", -697, -642, "2KGS.21.1", "유다의 장기 재위 왕입니다."),
    ("josiah", "요시야", "ruler", "judah_alone", -640, -609, "2KGS.22.1", "율법책 발견 뒤 개혁을 추진했습니다."),
    ("jeremiah", "예레미야", "prophet_priest", "judah_alone,exile", -627, -580, "JER.1.2", "예루살렘 멸망 전후에 활동한 선지자입니다."),
    ("zephaniah", "스바냐", "prophet_priest", "judah_alone", -640, -609, "ZEPH.1.1", "요시야 시대의 심판을 선포했습니다."),
    ("nahum", "나훔", "prophet_priest", "judah_alone", -663, -612, "NAH.1.1", "니느웨 심판을 선포했습니다."),
    ("habakkuk", "하박국", "prophet_priest", "judah_alone", -609, -598, "HAB.1.1", "바벨론 침공 전후의 질문을 제기했습니다."),
    ("jehoiakim", "여호야김", "ruler", "judah_alone", -609, -598, "2KGS.23.36", "바벨론의 부상기에 유다를 다스렸습니다."),
    ("zedekiah", "시드기야", "ruler", "judah_alone", -597, -586, "2KGS.24.18", "예루살렘 함락 당시 유다 왕입니다."),
    ("babylonian-empire", "신바벨론 제국", "polity", "judah_alone,exile", -626, -539, "2KGS.24.1", "유다를 정복해 포로를 데려갔습니다."),
    ("nebuchadnezzar", "느부갓네살 2세", "ruler", "judah_alone,exile", -605, -562, "2KGS.24.1", "예루살렘을 함락한 바벨론 왕입니다."),
    ("jerusalem-fall", "예루살렘 함락", "event", "judah_alone,exile", -587, -586, "2KGS.25.1", "함락 연대는 BC 587/586년으로 병기됩니다."),
    ("ezekiel", "에스겔", "prophet_priest", "exile", -593, -571, "EZEK.1.1", "포로 공동체에서 활동한 선지자입니다."),
    ("daniel", "다니엘", "person", "exile,return_persian", -605, -536, "DAN.1.1", "바벨론과 페르시아 궁정 이야기의 인물입니다."),
    ("persian-empire", "페르시아 제국", "polity", "return_persian", -539, -430, "EZRA.1.1", "귀환을 허용한 제국입니다."),
    ("cyrus", "고레스", "ruler", "return_persian", -559, -530, "EZRA.1.1", "귀환 칙령을 내린 페르시아 왕입니다."),
    ("return", "1차 귀환", "event", "return_persian", -538, -537, "EZRA.2.1", "고레스 칙령 뒤 포로 일부가 돌아왔습니다."),
    ("zerubbabel", "스룹바벨", "person", "return_persian", -538, -515, "EZRA.3.2", "귀환 공동체와 성전 재건을 이끌었습니다."),
    ("haggai", "학개", "prophet_priest", "return_persian", -520, -520, "HAG.1.1", "성전 재건을 독려했습니다."),
    ("zechariah", "스가랴", "prophet_priest", "return_persian", -520, -518, "ZECH.1.1", "귀환 공동체에 예언했습니다."),
    ("temple-complete", "제2성전 완공", "event", "return_persian", -516, -515, "EZRA.6.15", "다리오 왕 제6년에 성전이 완공됩니다."),
    ("xerxes", "크세르크세스 1세", "ruler", "return_persian", -486, -465, "ESTH.1.1", "에스더의 아하수에로와 동일시되는 왕입니다."),
    ("esther", "에스더", "person", "return_persian", -486, -465, "ESTH.4.1", "페르시아 궁정 이야기의 주인공입니다."),
    ("ezra", "에스라", "prophet_priest", "return_persian", -458, -430, "EZRA.7.1", "율법을 가르친 제사장·서기관입니다. 귀환 연대에 이견이 있습니다."),
    ("nehemiah", "느헤미야", "person", "return_persian", -445, -433, "NEH.2.1", "예루살렘 성벽 재건을 이끌었습니다."),
    ("malachi", "말라기", "prophet_priest", "return_persian", -460, -430, "MAL.1.1", "페르시아기 성전 공동체에 예언했습니다."),
    ("jesus", "예수 그리스도", "person", "jesus_life", -6, 33, "LUKE.2.1", "복음서의 탄생·사역·수난·부활의 중심 인물입니다."),
    ("mary", "마리아", "person", "jesus_life", -10, 30, "LUKE.1.26", "예수님의 어머니로 복음서에 등장합니다."),
    ("john-baptist", "세례 요한", "prophet_priest", "jesus_life", 26, 30, "MARK.1.4", "회개와 세례를 선포한 선구자입니다."),
    ("pilate", "본디오 빌라도", "ruler", "jesus_life", 26, 36, "LUKE.3.1", "예수님의 재판 당시 유대 총독입니다."),
    ("herod-great", "헤롯 대왕", "ruler", "jesus_life", -37, -4, "MATT.2.1", "예수님 탄생 기사에 등장하는 왕입니다."),
    ("augustus", "아우구스투스", "ruler", "jesus_life", -27, 14, "LUKE.2.1", "예수님 탄생 기사의 로마 황제입니다."),
    ("tiberius", "티베리우스", "ruler", "jesus_life", 14, 37, "LUKE.3.1", "세례 요한 사역의 연대 기준이 되는 로마 황제입니다."),
    ("herod-antipas", "헤롯 안티파스", "ruler", "jesus_life,early_church", -4, 39, "LUKE.3.1", "갈릴리를 다스린 분봉왕입니다."),
    ("crucifixion", "예수님의 십자가와 부활", "event", "jesus_life", 29, 33, "MARK.15.1", "수난·부활 연대는 AD 30년 또는 33년설이 있습니다."),
    ("peter", "베드로 (시몬)", "person", "jesus_life,early_church", 27, 67, "ACTS.2.14", "예루살렘 초기 교회의 지도자입니다."),
    ("john-apostle", "사도 요한", "person", "jesus_life,early_church", 27, 95, "ACTS.3.1", "예수님의 제자이며 초기 교회 전승의 인물입니다."),
    ("stephen", "스데반", "person", "early_church", 30, 36, "ACTS.7.54", "초기 교회의 순교자로 기록됩니다."),
    ("paul", "바울 (사울)", "person", "early_church", 34, 67, "ACTS.9.1", "이방 선교와 서신 사역의 중심 인물입니다."),
    ("barnabas", "바나바", "person", "early_church", 34, 60, "ACTS.4.36", "바울과 함께 첫 선교 여행에 나섰습니다."),
    ("silas", "실라 (실루아노)", "person", "early_church", 49, 65, "ACTS.15.40", "두 번째 전도여행에서 바울과 동행했습니다."),
    ("timothy", "디모데", "person", "early_church", 50, 90, "ACTS.16.1", "바울의 동역자이자 서신 수신인입니다."),
    ("luke", "누가", "person", "early_church", 50, 90, "COL.4.14", "바울의 동역자로 언급됩니다."),
    ("james", "야고보", "person", "early_church", 30, 62, "ACTS.15.13", "예루살렘 교회의 지도자입니다."),
    ("philip", "빌립", "person", "early_church", 30, 70, "ACTS.8.5", "사마리아에 복음을 전했습니다."),
    ("cornelius", "고넬료", "person", "early_church", 35, 45, "ACTS.10.1", "베드로와 만난 로마 백부장입니다."),
    ("first-journey", "바울 1차 전도여행", "event", "early_church", 46, 49, "ACTS.13.1", "바나바와 함께 소아시아로 향한 여정입니다."),
    ("council", "예루살렘 회의", "event", "early_church", 48, 50, "ACTS.15.1", "이방 신자의 율법 문제를 논의했습니다."),
    ("second-journey", "바울 2차 전도여행", "event", "early_church", 49, 52, "ACTS.16.1", "마게도냐·아가야로 이어진 여정입니다."),
    ("gallio", "갈리오", "ruler", "early_church", 51, 52, "ACTS.18.12", "고린도에서 바울 사건을 접한 아가야 총독입니다."),
    ("third-journey", "바울 3차 전도여행", "event", "early_church", 53, 57, "ACTS.19.1", "에베소 체류와 마게도냐·아가야 방문을 포함합니다."),
    ("felix", "벨릭스", "ruler", "early_church", 52, 60, "ACTS.24.1", "가이사랴에서 바울의 변론을 들은 총독입니다."),
    ("festus", "베스도", "ruler", "early_church", 59, 62, "ACTS.25.1", "바울의 황제 상소를 다룬 총독입니다."),
    ("agrippa-ii", "아그립바 2세", "ruler", "early_church", 50, 90, "ACTS.26.1", "바울의 변론을 들은 왕입니다."),
    ("rome-journey", "바울의 로마행", "event", "early_church", 59, 61, "ACTS.27.1", "가이사랴에서 로마까지의 항해입니다."),
    ("rome-custody", "바울의 로마 연금", "event", "early_church", 60, 63, "ACTS.28.30", "사도행전 마지막의 로마 체류입니다."),
    ("claudius", "클라우디우스", "ruler", "early_church", 41, 54, "ACTS.11.28", "사도행전에 이름이 등장하는 로마 황제입니다."),
]:
    add("person-jesus" if row[0] == "jesus" else "item-" + row[0], *row[1:])

add("external-nero", "네로", "ruler", "early_church", 54, 68, None,
    "바울이 황제에게 상소하던 시기의 로마 황제입니다. 사도행전은 황제의 이름을 밝히지 않습니다.",
    record="external_history", note="사도행전 25장의 황제는 이름이 나오지 않아 외부 연대 자료와 대조해야 합니다.")

# External history has no invented links to canonical passages.
for item_id, name, start, end, summary in [
    ("alexander", "알렉산드로스의 동방 원정", -334, -323, "헬레니즘 문화가 확산된 외부 역사입니다."),
    ("ptolemaic", "프톨레마이오스 왕조", -305, -198, "유대 지역에 영향을 준 이집트계 왕조입니다."),
    ("seleucid", "셀레우코스 왕조", -198, -63, "유대 지역에 영향을 준 시리아계 왕조입니다."),
    ("antiochus", "안티오코스 4세", -175, -164, "성전 모독과 박해의 배경이 되는 통치자입니다."),
    ("maccabean", "마카비 항쟁", -167, -160, "셀레우코스 지배에 맞선 유대인의 항쟁입니다."),
    ("hasmonean", "하스몬 왕조", -142, -63, "유대의 독립 왕조가 형성된 시기입니다."),
    ("roman-conquest", "로마의 예루살렘 점령", -63, -63, "폼페이우스가 예루살렘을 점령했습니다."),
]:
    add("external-" + item_id, name, "ruler" if item_id == "antiochus" else "polity" if item_id in ("ptolemaic", "seleucid", "hasmonean") else "event",
        "intertestamental", start, end, None, summary, record="external_history",
        note="정경 66권의 직접 사건 서술이 아닌 외부 역사입니다. 성경 구절을 연결하지 않습니다.")

# Composition windows and journey/custody events are separate fields.
for book, start, end, related, secondary in [
    (45, 56, 58, "item-third-journey", "고린도 체류와 관련"),
    (46, 54, 55, "item-third-journey", "에베소 체류와 관련"),
    (47, 55, 56, "item-third-journey", "마게도냐 방문과 관련"),
    (48, 48, 56, "item-first-journey", "남갈라디아·북갈라디아 수신지 견해 차이"),
    (49, 60, 62, "item-rome-custody", "로마 연금설 외에 가이사랴·에베소설도 있음"),
    (50, 60, 62, "item-rome-custody", "로마 연금설 외 다른 투옥설도 있음"),
    (51, 60, 62, "item-rome-custody", "로마 연금과 관련"),
    (52, 50, 51, "item-second-journey", "갈리오 재임기의 고린도 체류와 관련"),
    (53, 51, 52, "item-second-journey", "고린도 체류와 관련"),
    (54, 62, 65, "item-rome-custody", "전통적 석방 후 사역설, 후기 편집설 공존"),
    (55, 64, 67, "item-rome-custody", "전통적 마지막 투옥기설, 후기 편집설 공존"),
    (56, 62, 65, "item-rome-custody", "전통적 석방 후 사역설, 후기 편집설 공존"),
    (57, 60, 62, "item-rome-custody", "로마 연금과 관련"),
]:
    overview = OVERVIEWS[book]
    verse = overview["keyVerse"]
    osis = BOOKS_BY_NUMBER[book]["osis"]
    add(f"epistle-{book}", BOOKS_BY_NUMBER[book]["nameKo"] + " 작성 배경", "event", "early_church", start, end,
        f"{osis}.{verse['chapter']}.{verse['verseStart']}", overview["chronology"],
        kind="composition_time", record="epistle_background", related=[related], secondary=secondary)


def mapping(book, first, last, era, primary, start, end, summary, *, kind="narrative_time", relative=None, divergent=None):
    assert book not in {18, 20, 21, 22, 29}
    assert 1 <= first <= last <= BOOKS_BY_NUMBER[book]["chapters"]
    assert primary in {row["id"] for row in items}
    row = {"id": f"history-{book}-{first}-{last}", "book": book, "chapterStart": first, "chapterEnd": last,
           "eraId": era, "periodKind": kind, "datePrecision": "undetermined" if start is None else "range",
           "displayPeriodKo": "연대 미확정 · 본문 순서" if start is None else f"약 BC {-start}–{-end}년" if end < 0 else f"약 AD {start}–{end}년" if start > 0 else f"약 BC {-start}–AD {end}년",
           "focusStartYear": start, "focusEndYear": end, "contextSummaryKo": summary,
           "primaryItemIds": [primary], "sourceIds": BIBLE}
    if relative is not None:
        row["focusRelativeOrder"] = relative
    if divergent:
        row["divergentViewsKo"] = divergent
    mappings.append(row)


mappings = []
for first, last, primary, order in [(1, 2, "event-creation", 1), (3, 5, "event-fall", 2),
                                    (6, 10, "event-flood", 3), (11, 11, "event-babel", 4)]:
    mapping(1, first, last, "primeval", primary, None, None, "창세기 1–11장의 본문 순서만 표시합니다.", relative=order)
for book, first, last, era, primary, start, end in [
    (1, 12, 25, "patriarchs", "item-abraham", -2000, -1800),
    (1, 26, 36, "patriarchs", "item-jacob", -1900, -1700),
    (1, 37, 50, "patriarchs", "item-joseph", -1800, -1700),
    (2, 1, 18, "exodus", "item-exodus", -1450, -1200),
    (2, 19, 40, "exodus", "item-sinai", -1450, -1200),
    (3, 1, 27, "exodus", "item-aaron", -1450, -1200),
    (4, 1, 36, "exodus", "item-moses", -1450, -1200),
    (5, 1, 34, "exodus", "item-moses", -1450, -1200),
    (6, 1, 24, "conquest_judges", "item-joshua", -1400, -1150),
    (7, 4, 5, "conquest_judges", "item-deborah", -1250, -1050),
    (7, 6, 8, "conquest_judges", "item-gideon", -1250, -1050),
    (7, 13, 16, "conquest_judges", "item-samson", -1200, -1050),
    (8, 1, 4, "conquest_judges", "item-ruth", -1200, -1050),
    (9, 1, 7, "conquest_judges", "item-samuel", -1100, -1050),
    (9, 8, 31, "united_kingdom", "item-saul", -1050, -1010),
    (10, 1, 24, "united_kingdom", "item-david", -1010, -970),
    (11, 1, 11, "united_kingdom", "item-solomon", -970, -930),
    (11, 12, 14, "divided_kingdom", "item-division", -930, -910),
    (11, 15, 22, "divided_kingdom", "item-north-israel", -910, -853),
    (12, 1, 17, "divided_kingdom", "item-north-israel", -853, -722),
    (12, 18, 24, "judah_alone", "item-judah", -722, -597),
    (12, 25, 25, "exile", "item-jerusalem-fall", -587, -561),
    (13, 1, 29, "united_kingdom", "item-david", -1050, -970),
    (14, 1, 9, "united_kingdom", "item-solomon", -970, -930),
    (14, 10, 28, "divided_kingdom", "item-judah", -930, -715),
    (14, 29, 36, "judah_alone", "item-judah", -715, -586),
    (15, 1, 6, "return_persian", "item-zerubbabel", -538, -515),
    (15, 7, 10, "return_persian", "item-ezra", -458, -430),
    (16, 1, 13, "return_persian", "item-nehemiah", -445, -433),
    (17, 1, 10, "return_persian", "item-esther", -486, -465),
    (23, 1, 39, "judah_alone", "item-isaiah", -740, -700),
    (24, 1, 39, "judah_alone", "item-jeremiah", -627, -586),
    (24, 40, 52, "exile", "item-jeremiah", -586, -580),
    (25, 1, 5, "exile", "item-jerusalem-fall", -587, -586),
    (26, 1, 48, "exile", "item-ezekiel", -593, -571),
    (27, 1, 12, "exile", "item-daniel", -605, -536),
    (28, 1, 14, "divided_kingdom", "item-hosea", -750, -722),
    (30, 1, 9, "divided_kingdom", "item-amos", -760, -750),
    (32, 1, 4, "divided_kingdom", "item-jonah", -790, -750),
    (33, 1, 7, "divided_kingdom", "item-micah", -740, -700),
    (34, 1, 3, "judah_alone", "item-nahum", -663, -612),
    (35, 1, 3, "judah_alone", "item-habakkuk", -609, -598),
    (36, 1, 3, "judah_alone", "item-zephaniah", -640, -609),
    (37, 1, 2, "return_persian", "item-haggai", -520, -520),
    (38, 1, 8, "return_persian", "item-zechariah", -520, -518),
    (39, 1, 4, "return_persian", "item-malachi", -460, -430),
    (40, 1, 28, "jesus_life", "person-jesus", -6, 33),
    (41, 1, 16, "jesus_life", "person-jesus", 27, 33),
    (42, 1, 24, "jesus_life", "person-jesus", -6, 33),
    (43, 1, 21, "jesus_life", "person-jesus", 27, 33),
    (44, 1, 7, "early_church", "item-peter", 30, 36),
    (44, 8, 9, "early_church", "item-philip", 35, 40),
    (44, 10, 12, "early_church", "item-peter", 35, 45),
    (44, 13, 15, "early_church", "item-first-journey", 46, 50),
    (44, 16, 18, "early_church", "item-second-journey", 49, 52),
    (44, 19, 21, "early_church", "item-third-journey", 53, 57),
    (44, 22, 26, "early_church", "item-paul", 57, 60),
    (44, 27, 28, "early_church", "item-rome-journey", 59, 63),
]:
    summary = OVERVIEWS[book]["statedFacts"].split(".")[0].strip() + "."
    divergent = OVERVIEWS[book]["chronology"] if book in (1, 2, 6, 23, 27) else None
    mapping(book, first, last, era, primary, start, end, summary, divergent=divergent)

# Only psalms whose superscriptions or historical setting provide a concrete anchor.
for psalm, primary, start, end, reason in [
    (3, "item-david", -1010, -970, "표제는 압살롬을 피해 달아날 때를 가리킵니다."),
    (18, "item-david", -1010, -970, "표제는 다윗이 대적에게서 구원받은 때를 가리킵니다."),
    (34, "item-david", -1010, -970, "표제는 다윗이 아비멜렉 앞에서 떠난 때를 가리킵니다."),
    (51, "item-david", -1010, -970, "표제는 나단이 다윗을 찾아온 때를 가리킵니다."),
    (90, "item-moses", -1450, -1200, "표제는 모세의 기도로 전합니다. 작성 연도는 확정되지 않았습니다."),
    (126, "item-return", -538, -430, "포로 귀환을 회상하는 시입니다. 작성 연도는 확정되지 않았습니다."),
    (137, "item-jerusalem-fall", -586, -538, "바벨론 강가의 포로 경험을 회상합니다. 작성 연도는 확정되지 않았습니다."),
]:
    mapping(19, psalm, psalm, "exodus" if psalm == 90 else "exile" if psalm == 137 else "return_persian" if psalm == 126 else "united_kingdom", primary, start, end, reason)

# Obadiah is disputed; map the explicit Edom/Jerusalem setting, but retain both date views.
mapping(31, 1, 1, "exile", "item-jerusalem-fall", -587, -586,
        "예루살렘 환난에 대한 에돔의 태도를 배경으로 읽는 견해입니다.", divergent=OVERVIEWS[31]["chronology"])

for book, start, end in [(45, 56, 58), (46, 54, 55), (47, 55, 56), (48, 48, 56),
                         (49, 60, 62), (50, 60, 62), (51, 60, 62), (52, 50, 51),
                         (53, 51, 52), (54, 62, 65), (55, 64, 67), (56, 62, 65), (57, 60, 62)]:
    mapping(book, 1, BOOKS_BY_NUMBER[book]["chapters"], "early_church", f"epistle-{book}", start, end,
            OVERVIEWS[book]["chronology"], kind="composition_time")
mapping(66, 1, 22, "early_church", "item-john-apostle", 68, 95,
        OVERVIEWS[66]["chronology"], kind="composition_time", divergent=OVERVIEWS[66]["chronology"])

assert len(eras) == 12 and len(items) >= 85 and all(m["book"] not in {18, 20, 21, 22, 29} for m in mappings)
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({"contentVersion": "2026.11-v1", "overviewNoticeKo":
    "연대는 묵상과 본문 이해를 돕는 대략적 범위입니다. 원역사는 연도를 특정하지 않으며, 학설이 다른 사건과 서신 작성 시기는 범위와 설명을 함께 확인하세요.",
    "eras": eras, "items": items, "chapterMappings": mappings}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"[OK] 생성: 시대 {len(eras)}개, 항목 {len(items)}건, 본문 매핑 {len(mappings)}구간 -> {OUT}")
