"""Source-backed Bible 2D map geographical & historical reliability invariants."""
import json
import math
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent


def load_maps() -> dict[str, dict]:
    return {
        item["id"]: item
        for item in json.loads((ROOT / "content/maps-meta.json").read_text(encoding="utf-8"))["maps"]
    }


class MapAccuracyTest(unittest.TestCase):
    def test_config_contains_zero_hardcoded_point_or_screen_coordinates(self):
        cfg = json.loads((ROOT / "content/maps-config.json").read_text(encoding="utf-8"))
        for mdef in cfg:
            for stop in mdef["stops"]:
                for forbidden in ("lat", "lon", "x", "y"):
                    self.assertNotIn(forbidden, stop, (mdef["id"], stop["id"], forbidden))
            for reg in mdef.get("ancientRegions", []):
                for forbidden in ("lat", "lon", "x", "y"):
                    self.assertNotIn(forbidden, reg, (mdef["id"], reg["sourceSlug"], forbidden))

    def test_isotropic_projection_and_separate_layers(self):
        maps = load_maps()
        self.assertEqual(len(maps), 7)
        for mid, map_item in maps.items():
            min_lon, min_lat, max_lon, max_lat = map_item["bbox"]
            central_lat = (min_lat + max_lat) / 2.0
            true_aspect = ((max_lon - min_lon) * math.cos(math.radians(central_lat))) / (max_lat - min_lat)
            self.assertAlmostEqual(true_aspect, 360.0 / 220.0, delta=0.015, msg=mid)

            # 자연 지형 배경 레이어, 별도 현대 국경 레이어 파일, 반투명 고대 권역 폴리곤(svgPath)이 모두 존재해야 함
            self.assertTrue((ROOT / "public" / map_item["backdropImageUrl"][2:]).is_file(), mid)
            self.assertTrue(map_item.get("modernBordersImageUrl"), mid)
            self.assertTrue((ROOT / "public" / map_item["modernBordersImageUrl"][2:]).is_file(), mid)
            regions = map_item.get("ancientRegions", [])
            self.assertGreater(len(regions), 0, mid)
            self.assertTrue(any(r.get("svgPath") for r in regions), mid)

    def test_multi_candidate_places_not_collapsed_to_single_coordinate(self):
        maps = load_maps()
        seen_statuses = set()
        for mid, map_item in maps.items():
            min_lon, min_lat, max_lon, max_lat = map_item["bbox"]
            for stop in map_item["stops"]:
                self.assertNotIn("x", stop)
                self.assertNotIn("y", stop)
                status = stop["locationStatus"]
                seen_statuses.add(status)
                # OpenBible 내부 동명이인 숫자 접미사(Ur 1, Jericho 2 등)가 성경 지명에 그대로 노출되지 않아야 함
                self.assertIsNone(re.search(r"\b[A-Za-z]+\s+\d+\b", stop["biblicalName"]), stop["biblicalName"])
                self.assertTrue(stop["sourceUrl"].endswith("/" + stop["sourceId"] + "/" + stop["sourceUrl"].split("/")[-1]))

                if status == "confirmed":
                    self.assertEqual(len(stop["candidates"]), 1, (mid, stop["id"]))
                    first = stop["candidates"][0]
                    self.assertEqual((stop["lat"], stop["lon"]), (first["lat"], first["lon"]))
                    x = (stop["lon"] - min_lon) / (max_lon - min_lon) * 360.0
                    y = (max_lat - stop["lat"]) / (max_lat - min_lat) * 220.0
                    self.assertTrue(0 <= x <= 360 and 0 <= y <= 220, (mid, stop["id"]))
                elif status in {"traditional", "estimated"}:
                    self.assertNotIn("lat", stop, f"{stop['id']} should not confirm a single lat")
                    self.assertNotIn("lon", stop, f"{stop['id']} should not confirm a single lon")
                    self.assertGreaterEqual(len(stop["candidates"]), 1)
                elif status == "unknown":
                    self.assertNotIn("lat", stop)
                    self.assertNotIn("lon", stop)
                    self.assertEqual(stop["candidates"], [])

        # 4가지 위치 신뢰도 등급이 모두 실제로 구분되어 사용됨을 검증
        self.assertEqual(seen_statuses, {"confirmed", "traditional", "estimated", "unknown"})

    def test_distinct_places_and_no_arbitrary_routes(self):
        maps = load_maps()
        jesus = {stop["id"]: stop for stop in maps["jesus-palestine"]["stops"]}
        # 수가 != 사마리아 성읍
        self.assertNotEqual(jesus["sychar"]["sourceId"], jesus["samaria_city"]["sourceId"])
        self.assertEqual(jesus["sychar"]["locationStatus"], "estimated")
        self.assertGreater(len(jesus["sychar"]["candidates"]), 1)
        self.assertNotIn("lat", jesus["sychar"])
        self.assertEqual((jesus["samaria_city"]["lat"], jesus["samaria_city"]["lon"]), (32.276111, 35.195))
        self.assertIn("세바스티야", jesus["samaria_city"]["modernNameKo"])

        # 가사 != 애굽
        self.assertEqual(jesus["gaza_road"]["label"], "가사")
        self.assertEqual((jesus["gaza_road"]["lat"], jesus["gaza_road"]["lon"]), (31.504, 34.4644))
        self.assertNotEqual(jesus["gaza_road"]["sourceId"], jesus["egypt"]["sourceId"])
        self.assertEqual(jesus["egypt"]["locationStatus"], "unknown")
        self.assertNotIn("lat", jesus["egypt"])

        # 마라 != 엘림, 시내산 == 전통적 전승 후보
        exodus = {stop["id"]: stop for stop in maps["exodus-sinai"]["stops"]}
        self.assertNotEqual(exodus["marah"]["sourceId"], exodus["elim"]["sourceId"])
        self.assertEqual(exodus["sinai"]["locationStatus"], "traditional")
        self.assertGreater(len(exodus["sinai"]["candidates"]), 3)
        self.assertNotIn("lat", exodus["sinai"])

        # 임의 이동 경로선이 어떤 지도나 장별 해설에도 존재하지 않아야 함
        self.assertTrue(all("defaultRoute" not in map_item for map_item in maps.values()))
        for path in (ROOT / "content/commentaries").glob("*.json"):
            timeline = json.loads(path.read_text(encoding="utf-8")).get("mapTimeline", {})
            if not timeline.get("mapId"):
                continue
            target_map = maps[timeline["mapId"]]
            ids = {stop["id"] for stop in target_map["stops"]}
            reg_ids = {reg["id"] for reg in target_map.get("ancientRegions", [])}
            self.assertTrue(set(timeline.get("highlightStops", [])) <= ids, path.name)
            self.assertTrue(set(timeline.get("highlightRegions", [])) <= reg_ids, path.name)
            for seq in timeline.get("attestedSequence", []):
                self.assertIn(seq["from"], ids, path.name)
                self.assertIn(seq["to"], ids, path.name)
                self.assertTrue(seq.get("verseRef"), path.name)
            self.assertNotIn("showRoute", timeline, path.name)


if __name__ == "__main__":
    unittest.main()
