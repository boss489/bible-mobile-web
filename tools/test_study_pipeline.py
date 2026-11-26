"""P0 절 단위 탐구 데이터 검증·빌드 파이프라인 단위 테스트."""

from __future__ import annotations

import json
import pathlib
import sys
import tempfile
import unittest

TOOLS_DIR = pathlib.Path(__file__).resolve().parent
PROJECT_ROOT = TOOLS_DIR.parent
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from validate_study_data import (  # noqa: E402
    load_max_verses_lookup,
    parse_and_validate_verse_id,
    validate_and_compile_study_data,
    validate_sources,
)


class StudyDataPipelineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest_path = PROJECT_ROOT / "public" / "data" / "bible" / "manifest.json"
        cls.max_verses = load_max_verses_lookup(cls.manifest_path)
        cls.sources = validate_sources(PROJECT_ROOT / "content" / "sources.json")

    def test_validates_all_production_study_files(self) -> None:
        bundles, study_index = validate_and_compile_study_data(
            PROJECT_ROOT / "content" / "study",
            set(self.sources.keys()),
            self.max_verses,
        )
        # 아모스 7:16 및 마태복음 4:4 검증 케이스가 반드시 수록되어 있어야 함
        self.assertIn(30, bundles)
        amos_cr = bundles[30]["crossReferencesByVerse"]["AMOS.7.16"]
        targets = [item["targetVerseId"] for item in amos_cr]
        self.assertIn("AMOS.7.9", targets)
        self.assertIn("AMOS.2.12", targets)
        self.assertIn(16, study_index["30_7"])

        self.assertIn(40, bundles)
        matt4_cr = bundles[40]["crossReferencesByVerse"]["MATT.4.4"]
        self.assertEqual(matt4_cr[0]["targetVerseId"], "DEUT.8.3")
        self.assertEqual(matt4_cr[0]["relationType"], "DIRECT_QUOTE")

    def test_rejects_nonexistent_verse_and_self_reference_and_duplicates(self) -> None:
        # 아모스 7장은 17절까지만 존재함 -> 18절은 즉시 차단
        with self.assertRaises(ValueError):
            parse_and_validate_verse_id("AMOS.7.18", self.max_verses, "test")

        # 자기 참조 차단 테스트
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = pathlib.Path(tmp)
            (tmp_dir / "bad.json").write_text(
                json.dumps(
                    {
                        "crossReferences": [
                            {
                                "sourceVerseId": "AMOS.7.16",
                                "targetVerseId": "AMOS.7.15-17",
                                "relationType": "CONTEXT",
                                "reason": "자기 자신을 포함하는 범위는 차단되어야 합니다.",
                                "evidenceVerseIds": ["AMOS.7.16"],
                                "sourceIds": ["biblical-internal-text"],
                                "reviewStatus": "VERIFIED",
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )
            with self.assertRaises(ValueError):
                validate_and_compile_study_data(
                    tmp_dir, set(self.sources.keys()), self.max_verses
                )

    def test_filters_out_unreviewed_and_rejected_items(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = pathlib.Path(tmp)
            (tmp_dir / "mixed.json").write_text(
                json.dumps(
                    {
                        "crossReferences": [
                            {
                                "sourceVerseId": "AMOS.7.16",
                                "targetVerseId": "AMOS.7.9",
                                "relationType": "CONTEXT",
                                "reason": "검수 완료된 정상적인 문맥 연결 구절입니다.",
                                "evidenceVerseIds": ["AMOS.7.9", "AMOS.7.16"],
                                "sourceIds": ["biblical-internal-text"],
                                "reviewStatus": "VERIFIED",
                            },
                            {
                                "sourceVerseId": "AMOS.7.16",
                                "targetVerseId": "GEN.21.3",
                                "relationType": "THEME",
                                "reason": "단순히 이삭이라는 이름만 등장하는 미검수 후보 구절입니다.",
                                "evidenceVerseIds": ["GEN.21.3"],
                                "sourceIds": ["biblical-internal-text"],
                                "reviewStatus": "UNREVIEWED",
                            },
                        ]
                    }
                ),
                encoding="utf-8",
            )
            bundles, _ = validate_and_compile_study_data(
                tmp_dir, set(self.sources.keys()), self.max_verses
            )
            items = bundles[30]["crossReferencesByVerse"]["AMOS.7.16"]
            self.assertEqual(len(items), 1)
            self.assertEqual(items[0]["targetVerseId"], "AMOS.7.9")


if __name__ == "__main__":
    unittest.main()
