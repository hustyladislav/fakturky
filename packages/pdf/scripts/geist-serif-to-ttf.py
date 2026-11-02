#!/usr/bin/env python3
"""Converts Geist Serif Regular (woff2, from the `geist` npm package) to the TTF react-pdf needs.

Usage (from repo root, needs `pip install fonttools brotli`):
  python3 packages/pdf/scripts/geist-serif-to-ttf.py \
    packages/ui/node_modules/geist/dist/fonts/geist-serif/GeistSerif-Regular.woff2 \
    packages/pdf/fonts/GeistSerif-Regular.ttf

Lossless re-wrap (woff2 -> sfnt); glyph outlines and OpenType tables (incl. `tnum`) are untouched.
The license is `fonts/OFL-GeistSerif.txt` (copied from the package's LICENSE.txt).
"""

import sys

from fontTools.ttLib import TTFont

src, dst = sys.argv[1], sys.argv[2]
font = TTFont(src)
if "glyf" not in font:
    sys.exit("expected TrueType outlines (glyf); got CFF - react-pdf/fontkit needs glyf for subsetting")
font.flavor = None
font.save(dst)
print(f"wrote {dst} ({len(font.getGlyphOrder())} glyphs)")
