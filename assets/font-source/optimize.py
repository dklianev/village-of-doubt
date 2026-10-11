"""Repack the original delivery fonts without changing their CSS 400-700 faces."""

import argparse
import hashlib
import io
import json
from importlib.metadata import version
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont
from fontTools.varLib.models import normalizeLocation, piecewiseLinearMap


SOURCE = Path(__file__).resolve().parent
DESTINATION = SOURCE.parents[1] / "apps/web/app/fonts"
WEIGHTS = (400, 700)
ORIGINALS = {
    "literata-reading.woff2": "807e17ab87d012615b49a2370dbdd69067a554514a3900501c7e1baebbd4e2c1",
    "sofia-sans-interface.woff2": "cef8cc5bd389946b29e7ba5d12cf3c0d4bb974b17688dce4af292e48a5c4d668",
}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def open_font(data):
    return TTFont(io.BytesIO(data), recalcBBoxes=False, recalcTimestamp=False)


def normalized_range(font):
    axes = font["fvar"].axes
    require(len(axes) == 1 and axes[0].axisTag == "wght", "Expected only a weight axis")
    axis = axes[0]
    space = {"wght": (axis.minValue, axis.defaultValue, axis.maxValue)}
    mapping = font["avar"].segments["wght"]
    return tuple(
        piecewiseLinearMap(normalizeLocation({"wght": weight}, space)["wght"], mapping)
        for weight in WEIGHTS
    )


def unused(variation, interval):
    require(set(variation.axes) == {"wght"}, "Unexpected variation axes")
    start, peak, end = variation.axes["wght"]
    low, high = interval
    # A nonzero peak outside the interval, with support ending at its boundary,
    # contributes exactly zero throughout the CSS face, including both endpoints.
    return (end <= low and peak < low) or (start >= high and peak > high)


def shaping_font(font):
    data = io.BytesIO()
    font.flavor = None
    font.save(data)
    font.flavor = "woff2"
    return hb.Font(hb.Face(data.getvalue()))


def shape(font, text, weight, language, features):
    font.set_variations({"wght": weight})
    buffer = hb.Buffer()
    buffer.add_str(text)
    buffer.guess_segment_properties()
    buffer.language = language
    hb.shape(font, buffer, features)
    return [
        (g.codepoint, g.cluster, p.x_advance, p.y_advance, p.x_offset, p.y_offset)
        for g, p in zip(buffer.glyph_infos, buffer.glyph_positions)
    ]


def validate(original, candidate, interval):
    require(original.keys() == candidate.keys(), "Font tables changed")
    require(original.getGlyphOrder() == candidate.getGlyphOrder(), "Glyph order changed")
    require(original.getBestCmap() == candidate.getBestCmap(), "Character coverage changed")
    for tag in original.reader.tables:
        if tag not in ("head", "gvar"):
            require(original.getTableData(tag) == candidate.getTableData(tag), f"Table changed: {tag}")
    old_head, new_head = dict(vars(original["head"])), dict(vars(candidate["head"]))
    old_head.pop("checkSumAdjustment")
    new_head.pop("checkSumAdjustment")
    require(old_head == new_head, "Font header changed beyond its checksum")
    for name, variations in original["gvar"].variations.items():
        expected = [item for item in variations if not unused(item, interval)]
        actual = candidate["gvar"].variations[name]
        require(len(expected) == len(actual), f"Unexpected variation count: {name}")
        for old, new in zip(expected, actual):
            require(old.axes == new.axes and old.coordinates == new.coordinates,
                    f"Active outline variation changed: {name}")

    outline_cases = 0
    for weight in (400, 400.5, 425, 500, 600, 650, 699.5, 700):
        old_glyphs = original.getGlyphSet(location={"wght": weight})
        new_glyphs = candidate.getGlyphSet(location={"wght": weight})
        for name in original.getGlyphOrder():
            old_pen, new_pen = RecordingPen(), RecordingPen()
            old_glyphs[name].draw(old_pen)
            new_glyphs[name].draw(new_pen)
            require(old_pen.value == new_pen.value, f"Outline changed: {name} at {weight}")
            require(old_glyphs[name].width == new_glyphs[name].width,
                    f"Advance changed: {name} at {weight}")
            outline_cases += 1

    texts = [
        "".join(chr(code) for code in sorted(original.getBestCmap())),
        "\u0431\u0433\u0434\u0436\u0437\u0438\u0439\u043a\u043b\u043f\u0442\u0446\u0448\u0449\u044a\u044c\u044e\u044f",
        "AVATAR To WA ffi ffl office 0123456789 11:59 00:00 123,456.78",
    ]
    old_hb, new_hb = shaping_font(original), shaping_font(candidate)
    shaping_cases = 0
    for weight in range(WEIGHTS[0], WEIGHTS[1] + 1):
        for language in ("bg", "en"):
            for features in ({}, {"tnum": True}, {"kern": True, "liga": True, "locl": True}):
                for text in texts:
                    require(shape(old_hb, text, weight, language, features)
                            == shape(new_hb, text, weight, language, features),
                            f"Shaping changed at {weight}, language {language}, features {features}")
                    shaping_cases += 1
    return {"outlineCases": outline_cases, "shapingCases": shaping_cases}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--write", action="store_true", help="Replace delivery files after validation")
    mode.add_argument("--check", action="store_true", help="Verify delivery files (the default)")
    args = parser.parse_args()
    for requirement in (SOURCE / "requirements.txt").read_text().splitlines():
        package, expected = requirement.split("==")
        require(version(package) == expected, f"Install pinned tooling: {requirement}")

    outputs = []
    for name, expected_hash in ORIGINALS.items():
        data = (SOURCE / name).read_bytes()
        require(hashlib.sha256(data).hexdigest() == expected_hash, f"Original changed: {name}")
        font = open_font(data)
        # Load all original tables before serializing; preserve bounds and timestamps.
        for tag in font.reader.tables:
            font.getTableData(tag)
        interval = normalized_range(font)
        removed = 0
        for glyph, variations in font["gvar"].variations.items():
            kept = [item for item in variations if not unused(item, interval)]
            removed += len(variations) - len(kept)
            font["gvar"].variations[glyph] = kept
        encoded = io.BytesIO()
        font.save(encoded)
        optimized = encoded.getvalue()
        checks = validate(open_font(data), open_font(optimized), interval)
        require(len(optimized) < len(data), f"No size improvement: {name}")
        outputs.append((name, optimized))
        print(json.dumps({"font": name, "originalBytes": len(data),
                          "deliveryBytes": len(optimized), "removedTuples": removed, **checks}))

    for name, optimized in outputs:
        path = DESTINATION / name
        if args.write:
            path.write_bytes(optimized)
        else:
            require(path.read_bytes() == optimized, f"Delivery file is not reproducible: {path}")


if __name__ == "__main__":
    main()
