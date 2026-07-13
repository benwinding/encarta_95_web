#!/usr/bin/env python3
"""Split an HDD image file into part files for v86-style chunk loading.

Output layout:
  hd_images/<input_stem>/<start>-<end><input_suffix>

Example output file names for .img:
  hd_images/windows95/0-262144.img
  hd_images/windows95/262144-524288.img
"""

from __future__ import annotations

import argparse
from pathlib import Path


def split_file(input_path: Path, out_root: Path, chunk_size: int) -> None:
    if chunk_size <= 0:
        raise ValueError("chunk_size must be > 0")

    if not input_path.exists() or not input_path.is_file():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    # Always use .img for v86 part loading to match expected URL pattern
    suffix = ".img"
    out_dir = out_root / input_path.stem
    out_dir.mkdir(parents=True, exist_ok=True)

    total = input_path.stat().st_size
    written = 0

    with input_path.open("rb") as src:
        start = 0
        while True:
            chunk = src.read(chunk_size)
            if not chunk:
                break
            end = start + len(chunk)
            (out_dir / f"{start}-{end}{suffix}").write_bytes(chunk)
            start = end
            written += 1

    print(f"input={input_path}")
    print(f"size={total}")
    print(f"chunk_size={chunk_size}")
    print(f"parts={written}")
    print(f"out_dir={out_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Split an HD image into hd_images parts")
    parser.add_argument("hd_file", type=Path, help="Path to HDD file (.img, .bin, etc.)")
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=256 * 1024,
        help="Part size in bytes (default: 262144)",
    )
    parser.add_argument(
        "--out-root",
        type=Path,
        default=Path("hd_images"),
        help="Output root directory (default: hd_images)",
    )
    args = parser.parse_args()

    split_file(args.hd_file, args.out_root, args.chunk_size)


if __name__ == "__main__":
    main()
