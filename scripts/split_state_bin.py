#!/usr/bin/env python3
"""Split a v86 state .bin file into part files.

Output layout:
  bin_images/<input_stem>/<start>-<end>.bin
"""

from __future__ import annotations

import argparse
from pathlib import Path


def split_file(input_path: Path, out_root: Path, chunk_size: int) -> None:
    if chunk_size <= 0:
        raise ValueError("chunk_size must be > 0")

    if not input_path.exists() or not input_path.is_file():
        raise FileNotFoundError(f"Input file not found: {input_path}")

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
            (out_dir / f"{start}-{end}.bin").write_bytes(chunk)
            start = end
            written += 1

    print(f"input={input_path}")
    print(f"size={total}")
    print(f"chunk_size={chunk_size}")
    print(f"parts={written}")
    print(f"out_dir={out_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Split a state .bin into bin_images parts")
    parser.add_argument("state_bin", type=Path, help="Path to state .bin file")
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=256 * 1024,
        help="Part size in bytes (default: 262144)",
    )
    parser.add_argument(
        "--out-root",
        type=Path,
        default=Path("bin_images"),
        help="Output root directory (default: bin_images)",
    )
    args = parser.parse_args()

    split_file(args.state_bin, args.out_root, args.chunk_size)


if __name__ == "__main__":
    main()
