"""통합 성경 역사 연대표 데이터 검증·빌드 파이프라인 단위 테스트."""

from __future__ import annotations

import copy
import json
import pathlib
import sys
import tempfile
import unittest

TOOLS_DIR = pathlib.Path(__file__).resolve().parent
PROJECT_ROOT = TOOLS_DIR.parent
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from validate_history_data import validate_and_compile_history_data  # noqa: E402
from validate_study_data import load_max_verses_lookup, validate_sources  # noqa: E402


class HistoryDataPipelineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest_path = PROJECT_ROOT / "public" / "data" / "bible" / "manifest.json"
        cls.max_verses = load_max_verses_lookup(cls.manifest_path)
        cls.sources = validate_sources(PROJECT_ROOT / "content" / "sources.json")
        cls.history_path = PROJECT_ROOT / "content" / "history" / "timeline.json"

    def test_validates_production_history_dataset_and_required_coverage(self) -> None:
        compiled = validate_and_compile_history_data(
            self.history_path, self.sources, self.max_verses
        )
        self.assertEqual(len(compiled["eras"]), 12)
        self.assertGreaterEqual(len(compiled["items"]), 85)

        item_names = {it["nameKo"] for it in compiled["items"]}
        # 요구사항 §2 필수 신약·구약 인물 및 통치자 포함 검증
        for required_name in (
            "예수 그리스도",
            "베드로 (시몬)",
            "사도 요한",
            "스데반",
            "바울 (사울)",
            "바나바",
            "실라 (실루아노)",
            "디모데",
            "누가",
            "아모스",
            "이사야",
            "본디오 빌라도",
        ):
            self.assertIn(required_name, item_names)

        # 역사 정보가 없는 지혜서(잠언 20, 전도서 21, 아가 22, 욥기 18) 및 연대 미상 요엘(29)은 임의 매핑 금지 검증
        mapped_books = {mp["book"] for mp in compiled["chapterMappings"]}
        for unanchored_book in (18, 20, 21, 22, 29):
            self.assertNotIn(unanchored_book, mapped_books)

    def test_rejects_year_zero_and_primeval_bc_dates_and_invalid_verses(self) -> None:
        base_raw = json.loads(self.history_path.read_text(encoding="utf-8"))

        # 1) 역사적 0년(Year 0) 차단
        bad_zero = copy.deepcopy(base_raw)
        for it in bad_zero["items"]:
            if it["id"] == "person-jesus":
                it["startYear"] = 0
                break
        with tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8") as tf:
            json.dump(bad_zero, tf, ensure_ascii=False)
            tf.flush()
            with self.assertRaisesRegex(ValueError, "0년"):
                validate_and_compile_history_data(
                    pathlib.Path(tf.name), self.sources, self.max_verses
                )

        # 2) 원역사(primeval) 임의 BC 연도 부여 차단
        bad_primeval = copy.deepcopy(base_raw)
        for it in bad_primeval["items"]:
            if "primeval" in it["eraIds"]:
                it["startYear"] = -4004
                it["endYear"] = -4000
                it["datePrecision"] = "estimated"
                break
        with tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8") as tf:
            json.dump(bad_primeval, tf, ensure_ascii=False)
            tf.flush()
            with self.assertRaisesRegex(ValueError, "원역사"):
                validate_and_compile_history_data(
                    pathlib.Path(tf.name), self.sources, self.max_verses
                )

        # 3) 존재하지 않는 성경 구절 차단
        bad_verse = copy.deepcopy(base_raw)
        for it in bad_verse["items"]:
            if it["passages"]:
                it["passages"][0]["verseId"] = "AMOS.99.1"
                break
        with tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8") as tf:
            json.dump(bad_verse, tf, ensure_ascii=False)
            tf.flush()
            with self.assertRaises(ValueError):
                validate_and_compile_history_data(
                    pathlib.Path(tf.name), self.sources, self.max_verses
                )

    def test_enforces_chronological_accuracy_and_duration_semantics(self) -> None:
        base_raw = json.loads(self.history_path.read_text(encoding="utf-8"))
        compiled = validate_and_compile_history_data(
            self.history_path, self.sources, self.max_verses
        )
        by_id = {it["id"]: it for it in compiled["items"]}

        # 1) 아브라함과 요셉 동시대 분리 및 상대 슬롯 비겹침 검증
        abr = by_id["item-abraham"]
        jos = by_id["item-joseph"]
        self.assertNotIn("item-joseph", abr.get("contemporaryItemIds", []))
        self.assertNotIn("item-abraham", jos.get("contemporaryItemIds", []))
        self.assertLessEqual(
            abr["relativeOrder"] + abr.get("relativeSpan", 1),
            jos["relativeOrder"],
        )

        # 2) 모세·아론·여호수아·출애굽·시내산이 250년짜리 가짜 BC 활동 막대로 표시되지 않음을 검증
        for pre_id in ("item-moses", "item-aaron", "item-joshua", "item-exodus", "item-sinai"):
            item = by_id[pre_id]
            self.assertEqual(item["datePrecision"], "undetermined")
            self.assertIsNone(item["startYear"])
            self.assertIsNone(item["endYear"])
            self.assertNotIn("1450–1200", item["displayPeriodKo"])

        self.assertIn("40년", by_id["item-moses"]["displayPeriodKo"])
        self.assertIn("110세", by_id["item-joshua"]["displayPeriodKo"])

        # 3) 아브라함-요셉 억지 동시대 지정 시 검증기가 즉시 차단하는지 확인
        bad_contemp = copy.deepcopy(base_raw)
        for it in bad_contemp["items"]:
            if it["id"] == "item-abraham":
                it["contemporaryItemIds"] = ["item-isaac", "item-joseph"]
                break
        with tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8") as tf:
            json.dump(bad_contemp, tf, ensure_ascii=False)
            tf.flush()
            with self.assertRaisesRegex(ValueError, "아브라함과 요셉"):
                validate_and_compile_history_data(
                    pathlib.Path(tf.name), self.sources, self.max_verses
                )

        # 4) 250년짜리 비정상 개인 사역 기간(actual_duration) 및 '722–722' 중복 연도 표기 차단 확인
        bad_span = copy.deepcopy(base_raw)
        for it in bad_span["items"]:
            if it["id"] == "item-isaiah":
                it["startYear"] = -950
                it["endYear"] = -700
                it["periodScale"] = "actual_duration"
                break
        with tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8") as tf:
            json.dump(bad_span, tf, ensure_ascii=False)
            tf.flush()
            with self.assertRaisesRegex(ValueError, "비정상적으로 깁니다"):
                validate_and_compile_history_data(
                    pathlib.Path(tf.name), self.sources, self.max_verses
                )

        bad_dup_year = copy.deepcopy(base_raw)
        for it in bad_dup_year["items"]:
            if it["id"] == "item-samaria-fall":
                it["displayPeriodKo"] = "약 BC 722–722년"
                break
        with tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8") as tf:
            json.dump(bad_dup_year, tf, ensure_ascii=False)
            tf.flush()
            with self.assertRaisesRegex(ValueError, "중복된 범위"):
                validate_and_compile_history_data(
                    pathlib.Path(tf.name), self.sources, self.max_verses
                )


if __name__ == "__main__":
    unittest.main()
