"""변환 및 해설 검증 파이프라인 단위 테스트."""

from __future__ import annotations

import json
import pathlib
import sys
import unittest

TOOLS_DIR = pathlib.Path(__file__).resolve().parent
PROJECT_ROOT = TOOLS_DIR.parent
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from convert_lfa import parse_lfa_archive  # noqa: E402


class ConvertLfaPipelineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.kr_path = pathlib.Path("/Users/lotte/Downloads/kornkrv.lfa")
        cls.en_path = pathlib.Path("/Users/lotte/Downloads/engNIV.lfa")
        cls.patches = json.loads(
            (PROJECT_ROOT / "patches" / "kornkrv-fixes.json").read_text(encoding="utf-8")
        )
        cls.kr_data, cls.kr_stats = parse_lfa_archive(
            cls.kr_path, "kr", patches=cls.patches, normalize_fullwidth_colon=False
        )
        cls.en_data, cls.en_stats = parse_lfa_archive(
            cls.en_path, "en", patches=None, normalize_fullwidth_colon=True
        )

    def test_total_books_and_chapters(self) -> None:
        self.assertEqual(self.kr_stats.chapter_files, 1189)
        self.assertEqual(self.en_stats.chapter_files, 1189)
        self.assertEqual(self.kr_stats.replacement_chars, 0)
        self.assertEqual(self.en_stats.replacement_chars, 0)

    def test_kornkrv_patches_prevent_overwrite_and_split_isaiah_40_16(self) -> None:
        # 1. 창세기 29:28 & 29:29 모두 보존
        gen29 = {v["verse"]: v["text"] for v in self.kr_data[(1, 29)]["verses"]}
        self.assertTrue(gen29[28].startswith("야곱이 그대로 하여"))
        self.assertTrue(gen29[29].startswith("라반이 또 그의 여종 빌하를"))

        # 2. 출애굽기 40:7 보존 및 40:17 복원
        exo40 = {v["verse"]: v["text"] for v in self.kr_data[(2, 40)]["verses"]}
        self.assertTrue(exo40[7].startswith("또 물두멍을 회막과 제단 사이에 놓고"))
        self.assertTrue(exo40[17].startswith("둘째 해 첫째 달"))

        # 3. 다니엘 3:9 보존 및 3:19 복원
        dan3 = {v["verse"]: v["text"] for v in self.kr_data[(27, 3)]["verses"]}
        self.assertIn("왕이여 만수무강 하옵소서", dan3[9])
        self.assertTrue(dan3[19].startswith("느부갓네살이 분이 가득하여"))

        # 4. 이사야 40:15-16 분리
        isa40 = {v["verse"]: v["text"] for v in self.kr_data[(23, 40)]["verses"]}
        self.assertFalse("16" in isa40[15])
        self.assertTrue(isa40[16].startswith("레바논은 땔감에도 부족하겠고"))

        # 5. 에스겔 16:63 원본 누락 메타데이터 기록
        self.assertEqual(self.kr_data[(26, 16)]["missingVerses"], [63])

    def test_niv_fullwidth_colon_normalized(self) -> None:
        gen1 = {v["verse"]: v["text"] for v in self.en_data[(1, 1)]["verses"]}
        self.assertNotIn("：", gen1[11])
        self.assertIn("vegetation: seed-bearing", gen1[11])
        self.assertEqual(self.en_stats.fullwidth_colons_normalized, 2657)

    def test_omitted_verses_marked(self) -> None:
        acts8 = {v["verse"]: v for v in self.kr_data[(44, 8)]["verses"]}
        self.assertTrue(acts8[37]["isOmitted"])
        self.assertEqual(len(self.kr_stats.omitted_verses), 14)

    def test_commentary_validation_all_66_books_and_chapters(self) -> None:
        from validate_commentaries import (
            validate_book_overviews,
            validate_chapter_commentaries,
            validate_maps,
        )

        maps = validate_maps(PROJECT_ROOT / "content" / "maps-meta.json")
        self.assertGreaterEqual(len(maps), 6)
        overviews = validate_book_overviews(
            PROJECT_ROOT / "content" / "book-overviews", set(maps.keys())
        )
        self.assertEqual(len(overviews), 66)
        chapters, keys = validate_chapter_commentaries(
            PROJECT_ROOT / "content" / "commentaries", set(maps.keys())
        )
        self.assertEqual(len(chapters), 8)
        self.assertIn("1_1", keys)
        self.assertIn("44_8", keys)


if __name__ == "__main__":
    unittest.main()
