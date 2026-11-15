"""
Regenerate the PNG icons in assets/icons (standard library only):

    python tools/generate-icons.py

Draws the same camera as assets/icons/icon.svg, on a 192-unit grid.
"""
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "assets" / "icons"
YELLOW, INK = (245, 197, 24), (10, 10, 10)


def pixel(x, y, scale):
    """Colour at (x, y) in 192-unit space, shrunk by `scale` around the centre."""
    x, y = 96 + (x - 96) / scale, 96 + (y - 96) / scale
    r2 = (x - 96) ** 2 + (y - 104) ** 2
    if r2 <= 18 ** 2:
        return INK
    if r2 <= 30 ** 2:
        return YELLOW
    if 36 <= x < 156 and 62 <= y < 146 or 70 <= x < 122 and 48 <= y < 64:
        return INK
    return YELLOW


def png(path, size, scale=1.0):
    rows = b"".join(
        b"\x00" + b"".join(bytes(pixel((i + .5) * 192 / size, (j + .5) * 192 / size, scale)) for i in range(size))
        for j in range(size))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    path.write_bytes(b"\x89PNG\r\n\x1a\n"
                     + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
                     + chunk(b"IDAT", zlib.compress(rows, 9))
                     + chunk(b"IEND", b""))


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    png(OUT / "icon-192.png", 192)
    png(OUT / "icon-512.png", 512)
    png(OUT / "icon-maskable-512.png", 512, scale=0.75)   # keep the glyph inside the safe zone
    png(OUT / "apple-touch-icon.png", 180)
    print("wrote", *sorted(p.name for p in OUT.glob("*.png")))
