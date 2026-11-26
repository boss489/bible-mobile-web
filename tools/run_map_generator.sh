#!/bin/sh
set -eu
if python3 -c 'from PIL import Image' >/dev/null 2>&1; then
  exec python3 tools/generate_satellite_maps.py
fi
if [ -x /opt/anaconda3/bin/python3 ]; then
  exec /opt/anaconda3/bin/python3 tools/generate_satellite_maps.py
fi
printf '%s\n' 'Pillow를 사용할 수 있는 Python이 필요합니다.' >&2
exit 1
