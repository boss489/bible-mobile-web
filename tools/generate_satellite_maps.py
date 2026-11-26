#!/usr/bin/env python3
"""
BibleMapper Atlas UI 스타일 참고 + OpenBible CC BY 4.0 실측 지오메트리 기반 성경 2D 지도 생성기
- 자연 지형 기본 레이어(.jpg): 따뜻한 양피지·황토 지형 음영기복 + 선명한 하늘빛 바다·자연 호수·하천 (근현대 인공 저수지·운하·국경 제외)
- 고대 권역 옅은 색 영역(SVG Path): OpenBible geometry/*.isobands.geojson 및 *.geometry.geojson 확률 등치선 폴리곤을
  자연 해안선·호수에 맞춰 클리핑하고 내륙 경계를 부드럽게 다듬어 확정 국경처럼 보이지 않는 반투명 권역 데이터로 추출
- 현대 국경 참고 레이어(-modern.png): 기존 분리 방식 유지 (절제된 점선 국경 + '현대 OO' 국가명, 기본 비활성)
"""

from __future__ import annotations

import concurrent.futures
import io
import json
import math
import pathlib
import re
import subprocess
import tempfile
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import distance_transform_edt, gaussian_filter, map_coordinates

PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_IMAGES_DIR = PROJECT_ROOT / "public" / "assets" / "maps"
MAPS_META_PATH = PROJECT_ROOT / "content" / "maps-meta.json"
MAP_CONFIG_PATH = PROJECT_ROOT / "content" / "maps-config.json"

OPENBIBLE_DATA_BASE = "https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/data/"
OPENBIBLE_GEOM_BASE = "https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/geometry/"
NE_BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
DEM_TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"

CACHE_DIR = pathlib.Path(tempfile.gettempdir()) / "bible-map-data"
DEM_CACHE_DIR = CACHE_DIR / "dem"
OB_GEOM_CACHE_DIR = CACHE_DIR / "openbible-geom"

SVG_W = 360.0
SVG_H = 220.0
IMG_W = 1080
IMG_H = 660
SS = 2
RAW_W = IMG_W * SS
RAW_H = IMG_H * SS

NE_URLS = {
    "land": NE_BASE + "ne_10m_land.geojson",
    "minor_islands": NE_BASE + "ne_10m_minor_islands.geojson",
    "coastline": NE_BASE + "ne_10m_coastline.geojson",
    "lakes": NE_BASE + "ne_10m_lakes.geojson",
    "rivers": NE_BASE + "ne_10m_rivers_lake_centerlines.geojson",
    "marine_polys": NE_BASE + "ne_10m_geography_marine_polys.geojson",
    "countries": NE_BASE + "ne_10m_admin_0_countries.geojson",
    "land_borders": NE_BASE + "ne_10m_admin_0_boundary_lines_land.geojson",
    "disputed_borders": NE_BASE + "ne_10m_admin_0_boundary_lines_disputed_areas.geojson",
}

MODERN_ARTIFICIAL_LAKES = {"Lake Razazah"}

MODERN_NAME_KO: dict[str, str] = {
    "Tell el Muqayyar": "텔 엘 무카야르(이라크 나시리야 인근)",
    "Urfa": "우르파(튀르키예 샨르우르파)",
    "Bayburt": "바이부르트 일대(우라 후보)",
    "Urartu": "우라르투 권역 대표점",
    "Harran": "하란(튀르키예 하란 유적)",
    "Damascus": "다마스쿠스 구시가지",
    "Tell Balatah": "텔 발라타(나블루스 동편 유적)",
    "Beitin": "베이틴(라말라 북동쪽)",
    "Al Bira": "알 비라",
    "Burj Beitin": "부르즈 베이틴 유적",
    "Tel Rumeida": "텔 루메이다(헤브론 고대 성터)",
    "Tel Beer Sheva": "텔 브엘세바 고고학 유적",
    "Bir es Seba": "비르 에스 세바(베르셰바 구시가지)",
    "Qantir": "칸티르(피람세스 유적)",
    "Tell el Daba": "텔 엘 다바(아바리스 유적)",
    "Tell el Maskhuta": "텔 엘 마스쿠타(와디 투밀라트)",
    "Jabal Maryam": "자발 마리암 인근",
    "Tell er Retaba": "텔 에르 레타바",
    "Ain Hawarah": "아인 하와라 샘",
    "Bir Mara": "비르 마라",
    "Uyun Musa": "우윤 무사(모세의 샘)",
    "Bitter Lakes": "쓴 호수(그레이트 비터 호 일대)",
    "Wadi Gharandal": "와디 가란달 오아시스",
    "El Tor": "엘 토르(시나이 서해안)",
    "Wadi ar Raynah": "와디 아르 라이나",
    "Jebel Musa": "제벨 무사(시나이산 남부 봉우리)",
    "Har Karkom": "하르 카르콤(네겝 남부)",
    "Jebel Sin Bishar": "제벨 신 비샤르(시나이 서북부)",
    "Ras es Safsafeh": "라스 에스 사프사페(제벨 무사 북봉)",
    "Jebel Serbal": "제벨 세르발",
    "Jebel Katherina": "제벨 카테리나",
    "Jebel Hashem el Tarif": "제벨 하솀 엘 타리프",
    "Jebel Halal": "제벨 할랄",
    "Har ‘Arif": "하르 아리프",
    "Jabal al Magharah": "자발 알 마가라",
    "Jebel Yeleq": "제벨 옐레크",
    "Jabal al Lawz": "자발 알 라우즈(아라비아 북서부)",
    "Ain el Qudeirat": "아인 엘 쿠데이라트(가데스 요새 유적)",
    "Ein Qedeis": "아인 카데스 샘",
    "Jezirat Faraun": "제지라트 파라운(아카바만 산호섬)",
    "Tell el Kheleifeh": "텔 엘 켈레이페 유적",
    "Aqaba": "아카바 연안",
    "Eilat": "에일라트 연안",
    "Tel Dan": "텔 단 유적",
    "Tel Hazor": "텔 하솔 유적",
    "Tel Megiddo": "텔 므깃도 유적",
    "Khirbet Seilun": "키르벳 세일룬(고대 실로 유적)",
    "Tell es Sultan": "텔 에스 술탄(구약 고대 여리고 성터)",
    "Khirbet el Mefjir": "키르벳 엘 메프지르(여리고 동북편)",
    "Bedhat esh Sha’ab": "베다트 에쉬 샤압(요단 계곡 석조 유구)",
    "Samaria": "세바스티야(사마리아·세바스테 유적)",
    "Jerusalem": "예루살렘 구시가지·다윗성",
    "Tell ed Duweir": "텔 에드 두웨이르(텔 라기스)",
    "Nineveh": "니느웨 유적(이라크 모술 동안 쿠윤지크)",
    "Babylon": "바빌론 유적(이라크 힐라 인근)",
    "Shush": "슈시(이란 수사 고고학 유적)",
    "Tell Hum": "텔 훔(크파르 나훔 유적)",
    "Horbat Qana": "키르벳 카나(호르바트 카나 유적)",
    "Kefr Kenna": "케프르 켄나(카프르 칸나)",
    "Ain Qana": "아인 카나",
    "Nazareth": "나사렛 구시가지",
    "Caesarea Maritima": "가이사랴 마리티마 해안 유적",
    "Jaffa": "야파(고대 욥바 항구 구시가지)",
    "Askar": "아스카르(에발산 동남 기슭)",
    "Tell el Alayiq": "툴룰 아부 엘 알라이크(와디 켈트 신약 여리고)",
    "Al Maghtas": "알 마그타스(와디 알 카라르 세례터 유적)",
    "Raphana": "라파나(바산·바타네아 권역 대표점)",
    "Al Eizariya": "알 에이자리야(감람산 동편 베다니)",
    "Makhadhet Abarah": "마카데트 아바라(요단강 여울)",
    "Wadi al Fara": "와디 알 파라",
    "Tall Bleibel": "탈 블레이벨",
    "Tall Nimrin": "탈 님린",
    "Khirbet Batneh": "키르벳 바트네",
    "Bethlehem": "베들레헴(베이트 라흠)",
    "Tell Harube": "텔 하루베(현대 가자 구시가지 언덕)",
    "Antioch on the Orontes": "안타키아(오론테스강변 고대 안디옥)",
    "Antioch in Pisidia": "얄바츠 인근 고대 비시디아 안디옥 유적",
    "Tel Lystra": "하툰사라이 인근 텔 루스드라 유적",
    "Tarsus": "타르수스(고대 다소 유적)",
    "Ephesus": "에베소 유적(튀르키예 셀주크 인근)",
    "Alexandria Troas": "알렉산드리아 드로아 유적(달리안 인근)",
    "Philippi": "필리피 고고학 유적(카발라 북서쪽)",
    "Thessaloniki": "테살로니키(고대 로마 아고라 일대)",
    "Athens": "아테네 아크로폴리스·아레오바고 일대",
    "Corinth": "고대 코린토스 유적(아르카이아 코린토스)",
    "Rome": "로마 고대 포로 로마노 일대",
    "Patmos": "파트모스섬(그리스 도데카니사 제도)",
    "Izmir": "이즈미르(스미르나 아고라 유적)",
    "Pergamon": "베르가마(페르가몬 아크로폴리스 유적)",
    "Akhisar": "아크히사르(고대 티아테이라 유적)",
    "Sardis": "사르트(고대 사르디스 유적)",
    "Alaşehir": "알라셰히르(고대 필라델피아 유적)",
    "Laodicea on the Lycus": "에스키히사르(리코스 계곡 라오디게아 유적)",
}

SOURCE_TYPE_LABELS: dict[str, str] = {
    "wikidata": "Wikidata",
    "daahl": "DAAHL (Digital Archaeological Atlas of the Holy Land)",
    "pleiades": "Pleiades Ancient World Gazetteer (CC BY 3.0)",
    "megajordan": "MEGA-Jordan Archaeological Database",
    "geonames": "GeoNames (CC BY 4.0)",
    "osm": "OpenStreetMap (ODbL 1.0)",
    "wikipedia_article": "Wikipedia Geodata (CC BY-SA)",
}


def fetch_bytes(url: str, cache_path: pathlib.Path) -> bytes:
    if cache_path.exists() and cache_path.stat().st_size > 0:
        return cache_path.read_bytes()
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    data = subprocess.check_output(["curl", "-fLsS", "--retry", "2", "--max-time", "90", url])
    cache_path.write_bytes(data)
    return data


def fetch_json(url: str, cache_dir: pathlib.Path = CACHE_DIR) -> dict:
    name = url.rsplit("/", 1)[-1]
    return json.loads(fetch_bytes(url, cache_dir / name))


def fetch_jsonl(url: str) -> list[dict]:
    name = url.rsplit("/", 1)[-1]
    raw = fetch_bytes(url, CACHE_DIR / name)
    return [json.loads(line) for line in raw.splitlines() if line.strip()]


def verify_isotropic_bbox(map_id: str, bbox: list[float]) -> float:
    min_lon, min_lat, max_lon, max_lat = bbox
    central_lat = (min_lat + max_lat) / 2.0
    true_aspect = ((max_lon - min_lon) * math.cos(math.radians(central_lat))) / (max_lat - min_lat)
    target_aspect = SVG_W / SVG_H
    if abs(true_aspect - target_aspect) > 0.015:
        raise ValueError(
            f"[{map_id}] 투영 종횡비 불일치: true_aspect={true_aspect:.4f}, target={target_aspect:.4f}"
        )
    return round(central_lat, 4)


def compute_scale_bar(bbox: list[float]) -> dict[str, float]:
    min_lon, min_lat, max_lon, max_lat = bbox
    central_lat = (min_lat + max_lat) / 2.0
    total_km = (max_lon - min_lon) * math.cos(math.radians(central_lat)) * 111.32
    target_km = total_km * 0.19
    nice_steps = [10, 20, 25, 40, 50, 100, 150, 200, 250, 300, 400, 500]
    km = min(nice_steps, key=lambda s: abs(s - target_km))
    svg_w = round((km / total_km) * SVG_W, 1)
    return {"km": km, "svgWidth": svg_w}


def proj_raw(lat: float, lon: float, bbox: list[float]) -> tuple[float, float]:
    min_lon, min_lat, max_lon, max_lat = bbox
    return (
        ((lon - min_lon) / (max_lon - min_lon)) * RAW_W,
        ((max_lat - lat) / (max_lat - min_lat)) * RAW_H,
    )


def proj_img(lat: float, lon: float, bbox: list[float]) -> tuple[float, float]:
    min_lon, min_lat, max_lon, max_lat = bbox
    return (
        ((lon - min_lon) / (max_lon - min_lon)) * IMG_W,
        ((max_lat - lat) / (max_lat - min_lat)) * IMG_H,
    )


def project_lat_lon_svg(lat: float, lon: float, bbox: list[float]) -> tuple[float, float]:
    min_lon, min_lat, max_lon, max_lat = bbox
    return (
        round(((lon - min_lon) / (max_lon - min_lon)) * SVG_W, 2),
        round(((max_lat - lat) / (max_lat - min_lat)) * SVG_H, 2),
    )


def svg_to_lat_lon(x: float, y: float, bbox: list[float]) -> tuple[float, float]:
    min_lon, min_lat, max_lon, max_lat = bbox
    lon = min_lon + (x / SVG_W) * (max_lon - min_lon)
    lat = max_lat - (y / SVG_H) * (max_lat - min_lat)
    return round(lat, 5), round(lon, 5)


def geom_bbox(coords, gtype: str) -> tuple[float, float, float, float]:
    lons: list[float] = []
    lats: list[float] = []
    if gtype == "LineString":
        for pt in coords:
            lons.append(pt[0])
            lats.append(pt[1])
    elif gtype in ("MultiLineString", "Polygon"):
        for ring in coords:
            for pt in ring:
                lons.append(pt[0])
                lats.append(pt[1])
    elif gtype == "MultiPolygon":
        for poly in coords:
            for ring in poly:
                for pt in ring:
                    lons.append(pt[0])
                    lats.append(pt[1])
    if not lons:
        return (0.0, 0.0, 0.0, 0.0)
    return (min(lons), min(lats), max(lons), max(lats))


def boxes_intersect(a: tuple[float, float, float, float], b: list[float], pad: float = 0.5) -> bool:
    return not (a[2] < b[0] - pad or a[0] > b[2] + pad or a[3] < b[1] - pad or a[1] > b[3] + pad)


def rdp_simplify(pts: np.ndarray, epsilon: float = 0.65) -> np.ndarray:
    """Ramer-Douglas-Peucker 폴리라인 단순화로 SVG 경로 용량을 최소화한다."""
    if len(pts) <= 3:
        return pts
    start, end = pts[0], pts[-1]
    line_vec = end - start
    line_len = float(np.hypot(line_vec[0], line_vec[1]))
    if line_len < 1e-6:
        dists = np.hypot(pts[:, 0] - start[0], pts[:, 1] - start[1])
    else:
        dists = np.abs(line_vec[0] * (start[1] - pts[:, 1]) - (start[0] - pts[:, 0]) * line_vec[1]) / line_len
    idx = int(np.argmax(dists))
    if float(dists[idx]) > epsilon:
        left = rdp_simplify(pts[: idx + 1], epsilon)
        right = rdp_simplify(pts[idx:], epsilon)
        return np.vstack([left[:-1], right])
    return np.vstack([start, end])


def lonlat_to_merc_tile(lon: float, lat: float, z: int) -> tuple[float, float]:
    n = 2.0 ** z
    x = (lon + 180.0) / 360.0 * n
    lat_rad = math.radians(max(-85.0511, min(85.0511, lat)))
    y = (1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi) / 2.0 * n
    return x, y


def fetch_dem_wgs84(bbox: list[float]) -> np.ndarray:
    min_lon, min_lat, max_lon, max_lat = bbox
    lon_span = max_lon - min_lon
    z = 8 if lon_span <= 6.2 else 7 if lon_span <= 11.0 else 6

    tx0_f, ty0_f = lonlat_to_merc_tile(min_lon, max_lat, z)
    tx1_f, ty1_f = lonlat_to_merc_tile(max_lon, min_lat, z)
    tx_min, tx_max = max(0, int(math.floor(tx0_f))), min((1 << z) - 1, int(math.floor(tx1_f)))
    ty_min, ty_max = max(0, int(math.floor(ty0_f))), min((1 << z) - 1, int(math.floor(ty1_f)))

    tiles_w = tx_max - tx_min + 1
    tiles_h = ty_max - ty_min + 1
    mosaic = np.zeros((tiles_h * 256, tiles_w * 256), dtype=np.float32)

    coords_to_fetch = [(tx, ty) for ty in range(ty_min, ty_max + 1) for tx in range(tx_min, tx_max + 1)]

    def load_one_tile(pair: tuple[int, int]) -> tuple[int, int, np.ndarray]:
        tx, ty = pair
        cpath = DEM_CACHE_DIR / f"{z}_{tx}_{ty}.png"
        url = DEM_TILE_URL.format(z=z, x=tx, y=ty)
        raw = fetch_bytes(url, cpath)
        arr = np.asarray(Image.open(io.BytesIO(raw)).convert("RGB"), dtype=np.float32)
        elev = (arr[:, :, 0] * 256.0 + arr[:, :, 1] + arr[:, :, 2] / 256.0) - 32768.0
        return tx, ty, elev

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for tx, ty, elev in pool.map(load_one_tile, coords_to_fetch):
            r0 = (ty - ty_min) * 256
            c0 = (tx - tx_min) * 256
            mosaic[r0 : r0 + 256, c0 : c0 + 256] = elev

    cols_lon = min_lon + (np.arange(IMG_W, dtype=np.float64) + 0.5) / IMG_W * (max_lon - min_lon)
    rows_lat = max_lat - (np.arange(IMG_H, dtype=np.float64) + 0.5) / IMG_H * (max_lat - min_lat)

    n = 2.0 ** z
    col_px = ((cols_lon + 180.0) / 360.0 * n - tx_min) * 256.0 - 0.5
    lat_rad = np.radians(rows_lat)
    row_px = (
        (1.0 - np.log(np.tan(lat_rad) + 1.0 / np.cos(lat_rad)) / math.pi) / 2.0 * n - ty_min
    ) * 256.0 - 0.5

    grid_y, grid_x = np.meshgrid(row_px, col_px, indexing="ij")
    dem_wgs84 = map_coordinates(mosaic, [grid_y, grid_x], order=1, mode="nearest")
    return dem_wgs84.astype(np.float32)


def color_ramp(values: np.ndarray, stops: list[tuple[float, tuple[int, int, int]]]) -> np.ndarray:
    xs = np.array([s[0] for s in stops], dtype=np.float32)
    rgb = np.zeros(values.shape + (3,), dtype=np.float32)
    for ch in range(3):
        ys = np.array([s[1][ch] for s in stops], dtype=np.float32)
        rgb[:, :, ch] = np.interp(values, xs, ys)
    return rgb


def compute_hillshade(dem: np.ndarray, bbox: list[float]) -> np.ndarray:
    min_lon, min_lat, max_lon, max_lat = bbox
    lat0 = math.radians((min_lat + max_lat) / 2.0)
    dx_m = ((max_lon - min_lon) / IMG_W) * math.cos(lat0) * 111320.0
    dy_m = ((max_lat - min_lat) / IMG_H) * 110574.0

    lon_span = max_lon - min_lon
    z_exag = 4.2 if lon_span < 6.5 else 6.0 if lon_span < 11.0 else 8.4
    smooth = gaussian_filter(dem, sigma=0.95) * z_exag
    dz_dy, dz_dx = np.gradient(smooth, dy_m, dx_m)
    dz_dn = -dz_dy

    slope = np.arctan(np.hypot(dz_dx, dz_dn))
    aspect = np.arctan2(dz_dx, dz_dn)

    def shade_dir(az_deg: float, alt_deg: float) -> np.ndarray:
        az = math.radians(az_deg)
        zen = math.radians(90.0 - alt_deg)
        hs = np.cos(zen) * np.cos(slope) + np.sin(zen) * np.sin(slope) * np.cos(az - aspect)
        return np.clip(hs, 0.0, 1.0)

    return 0.74 * shade_dir(315.0, 41.0) + 0.26 * shade_dir(270.0, 46.0)


def premultiplied_resize_rgba(img: Image.Image, target_size: tuple[int, int]) -> Image.Image:
    arr = np.asarray(img, dtype=np.float32)
    alpha = arr[:, :, 3:4] / 255.0
    premult = np.concatenate([arr[:, :, :3] * alpha, arr[:, :, 3:4]], axis=2)
    premult_u8 = np.clip(np.round(premult), 0, 255).astype(np.uint8)
    resized = np.asarray(
        Image.fromarray(premult_u8, mode="RGBA").resize(target_size, resample=Image.Resampling.LANCZOS),
        dtype=np.float32,
    )
    out_a = resized[:, :, 3:4] / 255.0
    safe_a = np.where(out_a > 1e-3, out_a, 1.0)
    out_rgb = np.where(out_a > 1e-3, resized[:, :, :3] / safe_a, 0.0)
    out = np.concatenate([np.clip(np.round(out_rgb), 0, 255), np.clip(np.round(resized[:, :, 3:4]), 0, 255)], axis=2)
    return Image.fromarray(out.astype(np.uint8), mode="RGBA")


def draw_dashed_polyline(
    draw: ImageDraw.ImageDraw,
    pts: list[tuple[float, float]],
    fill: tuple[int, int, int, int],
    width: int,
    dash_len: float,
    gap_len: float,
) -> None:
    if len(pts) < 2:
        return
    pattern = dash_len + gap_len
    dist_acc = 0.0
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        seg_len = math.hypot(x1 - x0, y1 - y0)
        if seg_len < 1e-3:
            continue
        ux, uy = (x1 - x0) / seg_len, (y1 - y0) / seg_len
        pos = 0.0
        while pos < seg_len:
            phase = (dist_acc + pos) % pattern
            if phase < dash_len:
                step = min(dash_len - phase, seg_len - pos)
                sx, sy = x0 + ux * pos, y0 + uy * pos
                ex, ey = x0 + ux * (pos + step), y0 + uy * (pos + step)
                draw.line([(sx, sy), (ex, ey)], fill=fill, width=width)
                pos += step
            else:
                pos += min(pattern - phase, seg_len - pos)
        dist_acc += seg_len


def find_interior_label_point(
    mask: np.ndarray,
    avoid_points: list[tuple[float, float]],
    margin_px: int = 58,
    min_clearance: float = 10.0,
) -> tuple[float, float] | None:
    if not np.any(mask):
        return None
    bordered = mask.copy()
    if margin_px > 0 and mask.shape[0] > margin_px * 2 and mask.shape[1] > margin_px * 2:
        bordered[:margin_px, :] = False
        bordered[-margin_px:, :] = False
        bordered[:, :margin_px] = False
        bordered[:, -margin_px:] = False
    if not np.any(bordered):
        bordered = mask.copy()
    dist = distance_transform_edt(bordered)
    if avoid_points:
        yy, xx = np.indices(mask.shape, dtype=np.float32)
        marker_dist = np.full(mask.shape, 9999.0, dtype=np.float32)
        for ax, ay in avoid_points:
            d = np.hypot(xx - ax, yy - ay)
            marker_dist = np.minimum(marker_dist, d)
        score = np.minimum(dist, marker_dist * 0.45) * bordered
    else:
        score = dist
    if float(score.max()) < min_clearance:
        return None
    iy, ix = np.unravel_index(int(np.argmax(score)), score.shape)
    return float(ix), float(iy)


def find_river_label_point(
    feat_list: list[dict],
    river_name: str,
    bbox: list[float],
    avoid_points_img: list[tuple[float, float]],
) -> tuple[float, float] | None:
    candidates: list[tuple[float, float]] = []
    for feat in feat_list:
        props = feat.get("properties") or {}
        if props.get("name") != river_name:
            continue
        geom = feat.get("geometry") or {}
        gtype = geom.get("type")
        coords = geom.get("coordinates") or []
        parts = [coords] if gtype == "LineString" else coords if gtype == "MultiLineString" else []
        for part in parts:
            for pt in part:
                px, py = proj_img(pt[1], pt[0], bbox)
                if 80 <= px <= IMG_W - 80 and 45 <= py <= IMG_H - 45:
                    candidates.append((px, py))
    if not candidates:
        return None
    best_pt = None
    best_score = -1.0
    for px, py in candidates[:: max(1, len(candidates) // 40)]:
        edge_clear = min(px - 75, IMG_W - 75 - px, py - 40, IMG_H - 40 - py)
        m_clear = min((math.hypot(px - ax, py - ay) for ax, ay in avoid_points_img), default=240.0)
        sc = min(edge_clear, m_clear * 0.8)
        if sc > best_score and m_clear > 42.0:
            best_score = sc
            best_pt = (px, py - 13.0)
    return best_pt


def rasterize_geojson_polygons(
    features: list[dict],
    bbox: list[float],
    pred,
    size: tuple[int, int] = (IMG_W, IMG_H),
) -> np.ndarray:
    w, h = size
    mask_img = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask_img)
    min_lon, min_lat, max_lon, max_lat = bbox

    def p(lon: float, lat: float) -> tuple[float, float]:
        return (((lon - min_lon) / (max_lon - min_lon)) * w, ((max_lat - lat) / (max_lat - min_lat)) * h)

    for feat in features:
        if not pred(feat):
            continue
        geom = feat.get("geometry") or {}
        gtype = geom.get("type")
        coords = geom.get("coordinates") or []
        if gtype not in ("Polygon", "MultiPolygon"):
            continue
        if not boxes_intersect(geom_bbox(coords, gtype), bbox):
            continue
        polys = [coords] if gtype == "Polygon" else coords
        for poly in polys:
            if not poly:
                continue
            ext = [p(pt[0], pt[1]) for pt in poly[0]]
            if len(ext) >= 3:
                draw.polygon(ext, fill=255)
            for hole in poly[1:]:
                hpts = [p(pt[0], pt[1]) for pt in hole]
                if len(hpts) >= 3:
                    draw.polygon(hpts, fill=0)
    return np.asarray(mask_img) > 127


def build_land_mask_svg(bbox: list[float], datasets: dict[str, dict]) -> np.ndarray:
    """SVG(360x220) 해상도의 자연 육지 마스크(내륙 자연 호수 제외)를 생성한다."""
    w, h = int(SVG_W), int(SVG_H)
    land = rasterize_geojson_polygons(
        datasets["land"].get("features", []) + datasets["minor_islands"].get("features", []),
        bbox,
        lambda _f: True,
        size=(w, h),
    )
    lakes = rasterize_geojson_polygons(
        datasets["lakes"].get("features", []),
        bbox,
        lambda f: (f.get("properties") or {}).get("featurecla") in ("Lake", "Alkaline Lake")
        and (f.get("properties") or {}).get("name") not in MODERN_ARTIFICIAL_LAKES,
        size=(w, h),
    )
    return land & (~lakes)


def sourced_ancient_regions(
    region_defs: list[dict],
    bbox: list[float],
    ancient: dict[str, dict],
    geoms_by_id: dict[str, dict],
    land_mask_svg: np.ndarray,
) -> list[dict]:
    """
    OpenBible ancient.jsonl + geometry/*.isobands.geojson(또는 .geometry.geojson)을 결합하여
    자연 해안선·호수에 정확히 맞물리고 내륙 경계는 부드러운 곡선으로 처리된 반투명 고대 권역 SVG Path를 생성한다.
    """
    w, h = int(SVG_W), int(SVG_H)
    min_lon, min_lat, max_lon, max_lat = bbox

    def p_svg(lon: float, lat: float) -> tuple[float, float]:
        return (((lon - min_lon) / (max_lon - min_lon)) * w, ((max_lat - lat) / (max_lat - min_lat)) * h)

    raw_fields: list[tuple[dict, dict, np.ndarray, tuple[float, float] | None]] = []

    for rdef in region_defs:
        place = ancient[rdef["sourceSlug"]]
        rep_latlon: tuple[float, float] | None = None
        geom_filename: str | None = None

        for ident in place.get("identifications", []):
            for res in ident.get("resolutions", []):
                if rep_latlon is None and res.get("lonlat"):
                    lon_v, lat_v = map(float, res["lonlat"].split(","))
                    if min_lon <= lon_v <= max_lon and min_lat <= lat_v <= max_lat:
                        rep_latlon = (lat_v, lon_v)
                gr = res.get("geojson_roles") or {}
                if geom_filename is None and "geometry" in gr:
                    gid = gr["geometry"]["id"].split(".")[0]
                    gmeta = geoms_by_id.get(gid, {})
                    geom_filename = gmeta.get("isobands_geojson_file") or gmeta.get("geojson_file")

        field = np.zeros((h, w), dtype=np.float32)
        if geom_filename:
            gdata = fetch_json(OPENBIBLE_GEOM_BASE + geom_filename, OB_GEOM_CACHE_DIR)
            geom_obj = gdata.get("geometry") or (gdata.get("features") or [{}])[0].get("geometry") or {}
            gtype = geom_obj.get("type")
            coords = geom_obj.get("coordinates") or []
            polys = [coords] if gtype == "Polygon" else coords if gtype == "MultiPolygon" else []
            if polys:
                weight = 1.0 / len(polys)
                for poly in polys:
                    if not poly or len(poly[0]) < 3:
                        continue
                    band_img = Image.new("L", (w, h), 0)
                    bdraw = ImageDraw.Draw(band_img)
                    ext = [p_svg(pt[0], pt[1]) for pt in poly[0]]
                    bdraw.polygon(ext, fill=255)
                    for hole in poly[1:]:
                        if len(hole) >= 3:
                            bdraw.polygon([p_svg(pt[0], pt[1]) for pt in hole], fill=0)
                    field += (np.asarray(band_img, dtype=np.float32) / 255.0) * weight

        smoothed = gaussian_filter(field, sigma=2.1)
        raw_fields.append((rdef, place, smoothed, rep_latlon))

    if not raw_fields:
        return []

    stack = np.stack([item[2] for item in raw_fields], axis=0)
    out: list[dict] = []

    for idx, (rdef, place, field, rep_latlon) in enumerate(raw_fields):
        if len(raw_fields) > 1:
            others_max = np.max(np.delete(stack, idx, axis=0), axis=0)
            # 인접 고대 권역끼리 겹쳐 탁해지지 않도록 등확률선 기준으로 부드럽게 분할
            region_bool = (field >= 0.24) & (field >= others_max - 0.015) & land_mask_svg
        else:
            region_bool = (field >= 0.24) & land_mask_svg

        # 자연 해안선은 날렵하게 유지하면서 내륙 경계만 매끄럽게 정돈
        soft_mask = (gaussian_filter(region_bool.astype(np.float32), sigma=0.9) >= 0.45) & land_mask_svg

        svg_path_parts: list[str] = []
        if int(soft_mask.sum()) >= 18:
            padded = np.pad(soft_mask.astype(np.float32), 1, mode="constant", constant_values=0.0)
            fig, ax = plt.subplots()
            cs = ax.contour(padded, levels=[0.5])
            plt.close(fig)
            for seg in cs.allsegs[0]:
                if len(seg) < 6:
                    continue
                pts = seg - 1.0  # 패딩 보정
                # 최소 면적 필터 (미세 조각 제거)
                area = 0.5 * abs(
                    float(np.dot(pts[:, 0], np.roll(pts[:, 1], 1)) - np.dot(pts[:, 1], np.roll(pts[:, 0], 1)))
                )
                if area < 14.0:
                    continue
                simp = rdp_simplify(pts, epsilon=0.65)
                if len(simp) >= 4:
                    coords_str = " ".join(f"{ p[0]:.1f},{p[1]:.1f}" for p in simp[:-1])
                    svg_path_parts.append(f"M {coords_str} Z")

        # 권역 라벨 좌표: 클리핑된 고대 권역 폴리곤 내부 중심을 우선 사용하고, 없으면 원자료 대표점 사용
        label_pt = find_interior_label_point(soft_mask, [], margin_px=10, min_clearance=2.5)
        if label_pt is not None:
            lat_out, lon_out = svg_to_lat_lon(label_pt[0], label_pt[1], bbox)
        elif rep_latlon is not None:
            lat_out, lon_out = rep_latlon
        else:
            continue

        entry: dict = {
            "id": rdef["sourceSlug"],
            "label": rdef["label"],
            "biblicalNameEn": rdef["biblicalNameEn"],
            "color": rdef.get("color", "#a6c972"),
            "lat": lat_out,
            "lon": lon_out,
            "sourceId": place["id"],
            "sourceUrl": f'https://www.openbible.info/geo/ancient/{place["id"]}/{place["url_slug"]}',
        }
        if svg_path_parts:
            entry["svgPath"] = " ".join(svg_path_parts)
        out.append(entry)

    return out


def render_physical_base_map(
    bbox: list[float],
    datasets: dict[str, dict],
    water_features: list[dict],
    stop_points_img: list[tuple[float, float]],
    font_water: ImageFont.FreeTypeFont,
) -> Image.Image:
    dem = fetch_dem_wgs84(bbox)
    hillshade = compute_hillshade(dem, bbox)

    land_hi = Image.new("L", (RAW_W, RAW_H), 0)
    ldraw = ImageDraw.Draw(land_hi)
    for key in ("land", "minor_islands"):
        for feat in datasets[key].get("features", []):
            geom = feat.get("geometry") or {}
            gtype = geom.get("type")
            coords = geom.get("coordinates") or []
            if gtype not in ("Polygon", "MultiPolygon") or not boxes_intersect(geom_bbox(coords, gtype), bbox):
                continue
            polys = [coords] if gtype == "Polygon" else coords
            for poly in polys:
                if not poly:
                    continue
                ext = [proj_raw(pt[1], pt[0], bbox) for pt in poly[0]]
                if len(ext) >= 3:
                    ldraw.polygon(ext, fill=255)
                for hole in poly[1:]:
                    hpts = [proj_raw(pt[1], pt[0], bbox) for pt in hole]
                    if len(hpts) >= 3:
                        ldraw.polygon(hpts, fill=0)

    lake_hi = Image.new("L", (RAW_W, RAW_H), 0)
    lkdraw = ImageDraw.Draw(lake_hi)
    for feat in datasets["lakes"].get("features", []):
        props = feat.get("properties") or {}
        if props.get("featurecla") not in ("Lake", "Alkaline Lake") or props.get("name") in MODERN_ARTIFICIAL_LAKES:
            continue
        geom = feat.get("geometry") or {}
        gtype = geom.get("type")
        coords = geom.get("coordinates") or []
        if gtype not in ("Polygon", "MultiPolygon") or not boxes_intersect(geom_bbox(coords, gtype), bbox):
            continue
        polys = [coords] if gtype == "Polygon" else coords
        for poly in polys:
            if not poly:
                continue
            ext = [proj_raw(pt[1], pt[0], bbox) for pt in poly[0]]
            if len(ext) >= 3:
                lkdraw.polygon(ext, fill=255)

    land_alpha = (
        np.asarray(land_hi.resize((IMG_W, IMG_H), resample=Image.Resampling.LANCZOS), dtype=np.float32) / 255.0
    )
    lake_alpha = (
        np.asarray(lake_hi.resize((IMG_W, IMG_H), resample=Image.Resampling.LANCZOS), dtype=np.float32) / 255.0
    )

    # BibleMapper Atlas 스타일의 따뜻한 양피지·황토 지형 색감 + 선명한 하늘빛 수역
    land_stops = [
        (-450.0, (206, 214, 178)),  # 요단 지구대·사해 저지대
        (-20.0, (224, 224, 184)),
        (0.0, (233, 228, 184)),     # 해안·충적 평야
        (200.0, (236, 226, 179)),   # 저지 평원·사막 평지
        (550.0, (227, 212, 164)),   # 구릉·세벨라
        (1050.0, (213, 194, 146)),  # 중앙 산지·고원
        (1800.0, (196, 174, 128)),  # 고산 지대
        (2800.0, (182, 160, 118)),
        (3800.0, (216, 206, 186)),
    ]
    sea_stops = [
        (-3500.0, (175, 211, 242)),
        (-800.0, (183, 217, 245)),
        (0.0, (191, 223, 248)),
    ]

    land_rgb = color_ramp(dem, land_stops)
    neutral_hs = 0.74 * math.cos(math.radians(49.0)) + 0.26 * math.cos(math.radians(44.0))
    relief_gain = np.clip(1.0 + (hillshade - neutral_hs) * 0.56, 0.74, 1.14)[:, :, None]
    land_rgb = np.clip(land_rgb * relief_gain, 0.0, 255.0)

    sea_rgb = color_ramp(np.minimum(dem, 0.0), sea_stops)
    lake_rgb = np.array([186.0, 220.0, 246.0], dtype=np.float32)[None, None, :]

    comp = sea_rgb * (1.0 - land_alpha[:, :, None]) + land_rgb * land_alpha[:, :, None]
    comp = comp * (1.0 - lake_alpha[:, :, None]) + lake_rgb * lake_alpha[:, :, None]
    base_img = Image.fromarray(np.clip(np.round(comp), 0, 255).astype(np.uint8), mode="RGB").convert("RGBA")

    vec_hi = Image.new("RGBA", (RAW_W, RAW_H), (0, 0, 0, 0))
    vdraw = ImageDraw.Draw(vec_hi)

    for feat in datasets["rivers"].get("features", []):
        props = feat.get("properties") or {}
        rname = str(props.get("name") or "")
        if "canal" in rname.lower():
            continue
        scalerank = props.get("scalerank")
        srank = float(scalerank) if isinstance(scalerank, (int, float)) else 7.0
        if srank > 8.5:
            continue
        geom = feat.get("geometry") or {}
        gtype = geom.get("type")
        coords = geom.get("coordinates") or []
        if not boxes_intersect(geom_bbox(coords, gtype), bbox):
            continue
        w = 4 if srank <= 4 else 3 if srank <= 6 else 2
        parts = [coords] if gtype == "LineString" else coords if gtype == "MultiLineString" else []
        for part in parts:
            pts = [proj_raw(pt[1], pt[0], bbox) for pt in part]
            if len(pts) >= 2:
                vdraw.line(pts, fill=(74, 130, 184, 228), width=w, joint="curve")

    for feat in datasets["lakes"].get("features", []):
        props = feat.get("properties") or {}
        if props.get("featurecla") not in ("Lake", "Alkaline Lake") or props.get("name") in MODERN_ARTIFICIAL_LAKES:
            continue
        geom = feat.get("geometry") or {}
        gtype = geom.get("type")
        coords = geom.get("coordinates") or []
        if gtype not in ("Polygon", "MultiPolygon") or not boxes_intersect(geom_bbox(coords, gtype), bbox):
            continue
        polys = [coords] if gtype == "Polygon" else coords
        for poly in polys:
            if not poly:
                continue
            ext = [proj_raw(pt[1], pt[0], bbox) for pt in poly[0]]
            if len(ext) >= 3:
                vdraw.polygon(ext, fill=(186, 220, 246, 255))
                vdraw.line(ext, fill=(74, 126, 176, 240), width=2, joint="curve")

    for feat in datasets["coastline"].get("features", []):
        geom = feat.get("geometry") or {}
        gtype = geom.get("type")
        coords = geom.get("coordinates") or []
        if not boxes_intersect(geom_bbox(coords, gtype), bbox):
            continue
        parts = [coords] if gtype == "LineString" else coords if gtype == "MultiLineString" else []
        for part in parts:
            pts = [proj_raw(pt[1], pt[0], bbox) for pt in part]
            if len(pts) >= 2:
                vdraw.line(pts, fill=(72, 124, 174, 240), width=2, joint="curve")

    for feat in datasets["minor_islands"].get("features", []):
        geom = feat.get("geometry") or {}
        gtype = geom.get("type")
        coords = geom.get("coordinates") or []
        if gtype not in ("Polygon", "MultiPolygon") or not boxes_intersect(geom_bbox(coords, gtype), bbox):
            continue
        polys = [coords] if gtype == "Polygon" else coords
        for poly in polys:
            if poly and len(poly[0]) >= 3:
                pts = [proj_raw(pt[1], pt[0], bbox) for pt in poly[0]]
                vdraw.line(pts, fill=(72, 124, 174, 230), width=2, joint="curve")

    vec_aa = premultiplied_resize_rgba(vec_hi, (IMG_W, IMG_H))
    composed = Image.alpha_composite(base_img, vec_aa)

    txt_layer = Image.new("RGBA", (IMG_W, IMG_H), (0, 0, 0, 0))
    tdraw = ImageDraw.Draw(txt_layer)
    placed_water_pts = list(stop_points_img)

    for wf in water_features:
        kind = wf["kind"]
        ne_name = wf["neName"]
        label = wf["label"]
        pt_xy: tuple[float, float] | None = None

        if kind == "marine":
            m_mask = rasterize_geojson_polygons(
                datasets["marine_polys"].get("features", []),
                bbox,
                lambda f, target=ne_name: (f.get("properties") or {}).get("name") == target,
            )
            m_mask = m_mask & (land_alpha < 0.25)
            pt_xy = find_interior_label_point(m_mask, placed_water_pts, margin_px=64, min_clearance=10.0)
        elif kind == "lake":
            l_mask = rasterize_geojson_polygons(
                datasets["lakes"].get("features", []),
                bbox,
                lambda f, target=ne_name: (f.get("properties") or {}).get("name") == target
                and (f.get("properties") or {}).get("featurecla") in ("Lake", "Alkaline Lake"),
            )
            pt_xy = find_interior_label_point(l_mask, placed_water_pts, margin_px=38, min_clearance=3.0)
        elif kind == "river":
            pt_xy = find_river_label_point(
                datasets["rivers"].get("features", []), ne_name, bbox, placed_water_pts
            )

        if pt_xy is not None:
            wx, wy = pt_xy
            placed_water_pts.append((wx, wy))
            tdraw.text(
                (wx, wy),
                label,
                font=font_water,
                fill=(33, 84, 134, 228),
                anchor="mm",
                stroke_width=3,
                stroke_fill=(220, 238, 251, 218),
            )

    return Image.alpha_composite(composed, txt_layer).convert("RGB")


def render_modern_overlay(
    bbox: list[float],
    datasets: dict[str, dict],
    modern_countries: list[dict],
    font_country: ImageFont.FreeTypeFont,
) -> Image.Image:
    """현대 국경 표시 방식 유지: 별도 투명 PNG 오버레이(절제된 점선 + 현대 OO 국가명, 기본 숨김)."""
    canvas = Image.new("RGBA", (RAW_W, RAW_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    for feat in datasets["land_borders"].get("features", []):
        geom = feat.get("geometry") or {}
        gtype = geom.get("type")
        coords = geom.get("coordinates") or []
        if not boxes_intersect(geom_bbox(coords, gtype), bbox):
            continue
        parts = [coords] if gtype == "LineString" else coords if gtype == "MultiLineString" else []
        for part in parts:
            pts = [proj_raw(pt[1], pt[0], bbox) for pt in part]
            if len(pts) >= 2:
                draw.line(pts, fill=(255, 255, 255, 165), width=7, joint="curve")
                draw_dashed_polyline(draw, pts, fill=(88, 78, 112, 215), width=3, dash_len=18.0, gap_len=10.0)

    for feat in datasets["disputed_borders"].get("features", []):
        geom = feat.get("geometry") or {}
        gtype = geom.get("type")
        coords = geom.get("coordinates") or []
        if not boxes_intersect(geom_bbox(coords, gtype), bbox):
            continue
        parts = [coords] if gtype == "LineString" else coords if gtype == "MultiLineString" else []
        for part in parts:
            pts = [proj_raw(pt[1], pt[0], bbox) for pt in part]
            if len(pts) >= 2:
                draw.line(pts, fill=(255, 255, 255, 145), width=5, joint="curve")
                draw_dashed_polyline(draw, pts, fill=(116, 102, 138, 205), width=2, dash_len=8.0, gap_len=8.0)

    aa_img = premultiplied_resize_rgba(canvas, (IMG_W, IMG_H))

    txt_overlay = Image.new("RGBA", (IMG_W, IMG_H), (0, 0, 0, 0))
    tdraw = ImageDraw.Draw(txt_overlay)
    placed_country_pts: list[tuple[float, float]] = []

    for mc in modern_countries:
        iso = mc["iso"]
        label = mc["label"]
        c_mask = rasterize_geojson_polygons(
            datasets["countries"].get("features", []),
            bbox,
            lambda f, target=iso: (f.get("properties") or {}).get("ADM0_A3") == target,
        )
        pt_xy = find_interior_label_point(c_mask, placed_country_pts, margin_px=54, min_clearance=8.0)
        if pt_xy is not None:
            cx, cy = pt_xy
            placed_country_pts.append((cx, cy))
            tdraw.text(
                (cx, cy),
                label,
                font=font_country,
                fill=(78, 72, 98, 224),
                anchor="mm",
                stroke_width=4,
                stroke_fill=(255, 255, 255, 220),
            )

    return Image.alpha_composite(aa_img, txt_overlay)


def sourced_stops(
    stops: list[dict],
    bbox: list[float],
    ancient: dict[str, dict],
    modern: dict[str, dict],
) -> list[dict]:
    output = []
    for stop in stops:
        place = ancient[stop["sourceSlug"]]
        place_type = stop.get("placeType") or (
            "island"
            if "island" in place.get("types", [])
            else "region"
            if place.get("types") == ["region"]
            else "mountain"
            if "mountain" in place.get("types", [])
            else "settlement"
        )
        candidates = []
        seen: set[tuple[float, float]] = set()

        identifications = sorted(
            place.get("identifications", []),
            key=lambda item: (
                item.get("score", {}).get("time_total", 0),
                item.get("score", {}).get("vote_total", 0),
            ),
            reverse=True,
        )
        for identification in identifications:
            score_obj = identification.get("score", {})
            time_total = score_obj.get("time_total", 0)
            vote_total = score_obj.get("vote_total", 0)
            if vote_total <= 0 or (time_total <= 0 and vote_total < 100):
                continue
            for resolution in identification.get("resolutions", []):
                lonlat_type = resolution.get("lonlat_type")
                if lonlat_type not in {"point", "center", "representative point"} or not resolution.get("lonlat"):
                    continue
                lon, lat = map(float, resolution["lonlat"].split(","))
                key = (round(lon, 6), round(lat, 6))
                if key in seen:
                    continue
                seen.add(key)
                modern_id = resolution.get("modern_basis_id")
                modern_place = modern.get(modern_id, {}) if modern_id else {}
                modern_name = modern_place.get("friendly_id") or re.sub(
                    r"<[^>]*>", "", identification.get("description", "")
                ).strip()
                coord_src_raw = (modern_place.get("coordinates_source") or {}).get("type", "")
                coord_src = SOURCE_TYPE_LABELS.get(coord_src_raw, coord_src_raw or "OpenBible.info")
                precision_m = (modern_place.get("precision") or {}).get("meters")
                src_url = (
                    f'https://www.openbible.info/geo/modern/{modern_place["id"]}/{modern_place["url_slug"]}'
                    if modern_place.get("id") and modern_place.get("url_slug")
                    else f'https://www.openbible.info/geo/ancient/{place["id"]}/{place["url_slug"]}'
                )
                cand_item = {
                    "lat": lat,
                    "lon": lon,
                    "modernName": modern_name,
                    "modernNameKo": MODERN_NAME_KO.get(modern_name, modern_name),
                    "geometryType": lonlat_type,
                    "representative": lonlat_type != "point",
                    "coordinateSource": coord_src,
                    "sourceUrl": src_url,
                }
                if isinstance(precision_m, (int, float)):
                    cand_item["precisionMeters"] = int(precision_m)
                candidates.append(cand_item)

        if stop["id"] in {"egypt", "redsea", "moab"}:
            candidates = []

        if not candidates:
            status = "unknown"
        elif stop.get("statusOverride") in {"traditional", "estimated"}:
            status = stop["statusOverride"]
        elif len(candidates) > 1 or candidates[0]["representative"]:
            status = "estimated"
        else:
            status = "confirmed"

        biblical_ko = stop.get("biblicalNameKo") or stop["label"]
        biblical_en = stop.get("biblicalNameEn") or re.sub(r"\s+\d+$", "", place["friendly_id"])

        result: dict = {
            "id": stop["id"],
            "label": stop["label"],
            "biblicalName": f"{biblical_ko} ({biblical_en})",
            "biblicalNameEn": biblical_en,
            "placeType": place_type,
            "locationStatus": status,
            "statusReason": stop["statusReason"],
            "historicalBackground": stop["historicalBackground"],
            "scriptureRef": stop["scriptureRef"],
            "sourceUrl": f'https://www.openbible.info/geo/ancient/{place["id"]}/{place["url_slug"]}',
            "sourceId": place["id"],
            "candidates": candidates,
        }

        if status == "confirmed" and len(candidates) == 1:
            primary = candidates[0]
            result["lat"] = primary["lat"]
            result["lon"] = primary["lon"]
            result["modernName"] = primary["modernName"]
            result["modernNameKo"] = primary["modernNameKo"]
            sx, sy = project_lat_lon_svg(primary["lat"], primary["lon"], bbox)
            assert 0.0 <= sx <= SVG_W and 0.0 <= sy <= SVG_H, f"{stop['id']} out of SVG bounds"

        output.append(result)
    return output


def load_korean_fonts() -> tuple[ImageFont.FreeTypeFont, ImageFont.FreeTypeFont]:
    ttc_path = pathlib.Path("/System/Library/Fonts/AppleSDGothicNeo.ttc")
    fallback_path = pathlib.Path("/System/Library/Fonts/Supplemental/AppleGothic.ttf")
    if ttc_path.exists():
        return (
            ImageFont.truetype(str(ttc_path), 19, index=6),
            ImageFont.truetype(str(ttc_path), 18, index=5),
        )
    if fallback_path.exists():
        return (
            ImageFont.truetype(str(fallback_path), 19),
            ImageFont.truetype(str(fallback_path), 18),
        )
    default_f = ImageFont.load_default()
    return default_f, default_f


def main() -> None:
    OUT_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    map_definitions = json.loads(MAP_CONFIG_PATH.read_text(encoding="utf-8"))

    print("[1/4] OpenBible Bible Geocoding Data (ancient / modern / geometry) 로드 중...")
    ancient = {item["url_slug"]: item for item in fetch_jsonl(OPENBIBLE_DATA_BASE + "ancient.jsonl")}
    modern = {item["id"]: item for item in fetch_jsonl(OPENBIBLE_DATA_BASE + "modern.jsonl")}
    geoms_by_id = {item["id"]: item for item in fetch_jsonl(OPENBIBLE_DATA_BASE + "geometry.jsonl")}

    print("[2/4] Natural Earth 1:10m 자연 지형 및 현대 경계 데이터 병렬 로드 중...")
    datasets: dict[str, dict] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futs = {pool.submit(fetch_json, url): key for key, url in NE_URLS.items()}
        for fut in concurrent.futures.as_completed(futs):
            key = futs[fut]
            datasets[key] = fut.result()
            print(f"  - 로드 완료: {key} ({len(datasets[key].get('features', []))} features)")

    font_country, font_water = load_korean_fonts()
    output_maps = []

    print("[3/4] 7종 시대별 지형도·반투명 고대 권역 폴리곤·현대 국경 레이어 생성 중...")
    for mdef in map_definitions:
        mid = mdef["id"]
        bbox = mdef["bbox"]
        central_lat = verify_isotropic_bbox(mid, bbox)
        scale_bar = compute_scale_bar(bbox)
        land_mask_svg = build_land_mask_svg(bbox, datasets)

        stops_out = sourced_stops(mdef["stops"], bbox, ancient, modern)
        regions_out = sourced_ancient_regions(
            mdef.get("ancientRegions", []), bbox, ancient, geoms_by_id, land_mask_svg
        )

        avoid_pts_img: list[tuple[float, float]] = []
        for st in stops_out:
            for cand in st["candidates"]:
                px, py = proj_img(cand["lat"], cand["lon"], bbox)
                if 0 <= px <= IMG_W and 0 <= py <= IMG_H:
                    avoid_pts_img.append((px, py))
        for rg in regions_out:
            avoid_pts_img.append(proj_img(rg["lat"], rg["lon"], bbox))

        rendered = render_physical_base_map(
            bbox,
            datasets,
            mdef.get("waterFeatures", []),
            avoid_pts_img,
            font_water,
        )
        out_file = OUT_IMAGES_DIR / f"{mid}.jpg"
        rendered.save(out_file, format="JPEG", quality=93, subsampling=0, optimize=True)

        modern_file = OUT_IMAGES_DIR / f"{mid}-modern.png"
        modern_overlay = render_modern_overlay(
            bbox,
            datasets,
            mdef.get("modernCountries", []),
            font_country,
        )
        modern_overlay.save(modern_file, optimize=True)
        poly_cnt = sum(1 for r in regions_out if r.get("svgPath"))
        print(
            f"  -> {mid}: 지형 {out_file.stat().st_size:,}B / 현대국경 {modern_file.stat().st_size:,}B "
            f"/ 고대권역 폴리곤 {poly_cnt}개 (축척 {scale_bar['km']}km)"
        )

        output_maps.append(
            {
                "id": mid,
                "title": mdef["title"],
                "regionSummary": mdef["regionSummary"],
                "backdropImageUrl": f"./assets/maps/{mid}.jpg",
                "modernBordersImageUrl": f"./assets/maps/{mid}-modern.png",
                "bbox": bbox,
                "scaleBar": scale_bar,
                "projection": {
                    "crs": "WGS84 (EPSG:4326)",
                    "name": "Equidistant Cylindrical (정거 원통 투영)",
                    "standardParallel": central_lat,
                    "viewBox": [0, 0, int(SVG_W), int(SVG_H)],
                },
                "license": (
                    "OpenBible.info Bible Geocoding Data & Region Isobands: CC BY 4.0; "
                    "Natural Earth 1:10m Vector: Public Domain; "
                    "Terrain DEM (USGS SRTM / GMTED2010 / NOAA ETOPO1): Public Domain; "
                    "Underlying gazetteer coordinates: Wikidata (CC0), Pleiades (CC BY 3.0), GeoNames (CC BY 4.0), OpenStreetMap contributors (ODbL 1.0)"
                ),
                "attribution": (
                    "OpenBible.info Bible Geocoding Data (CC BY 4.0); Natural Earth 1:10m; "
                    "USGS/NASA SRTM & NOAA ETOPO1; Pleiades; OpenStreetMap contributors"
                ),
                "sourceNote": (
                    f"지형·수계: Natural Earth 1:10m 자연 지형 + 공개 DEM 음영기복 · "
                    f"성경 지명·고대 권역 범위: OpenBible.info Bible Geocoding Data (확률 등치선 기반 추정 영역) · "
                    f"투영: WGS84 정거 원통 투영(표준위선 {central_lat}°N)"
                ),
                "ancientRegions": regions_out,
                "stops": stops_out,
            }
        )

    print("[4/4] content/maps-meta.json 저장 중...")
    MAPS_META_PATH.write_text(
        json.dumps({"maps": output_maps}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("[OK] 7종 시대별 성경 2D 지도 및 반투명 고대 권역 메타데이터 생성 완료")


if __name__ == "__main__":
    main()
