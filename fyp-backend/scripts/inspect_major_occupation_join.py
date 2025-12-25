from __future__ import annotations

"""Read-only check for whether a major can be mapped to skills via ESCO links."""

import argparse
import sys
from pathlib import Path


def _bootstrap_import_path() -> None:
    root = Path(__file__).resolve().parents[1]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))


_bootstrap_import_path()

from app.db import mysql as db  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--major-id", type=int, default=10)
    args = p.parse_args()

    major_id = int(args.major_id)

    c1 = db.query_one("SELECT COUNT(*) AS c FROM major_occupation_map WHERE major_id = :m", {"m": major_id}) or {}
    print("major_occupation_map rows:", int(c1.get("c") or 0))

    c2 = db.query_one(
        """
        SELECT COUNT(*) AS c
        FROM major_occupation_map mom
        JOIN stage_occupation_skill_links_esco link
          ON link.occupationUri = mom.occupation_uri
        WHERE mom.major_id = :m
        """.strip(),
        {"m": major_id},
    ) or {}
    print("joined occ->skill link rows:", int(c2.get("c") or 0))

    c3 = db.query_one(
        """
        SELECT COUNT(DISTINCT link.skillUri) AS c
        FROM major_occupation_map mom
        JOIN stage_occupation_skill_links_esco link
          ON link.occupationUri = mom.occupation_uri
        WHERE mom.major_id = :m
        """.strip(),
        {"m": major_id},
    ) or {}
    print("distinct skillUri via join:", int(c3.get("c") or 0))

    # Sample mismatches: occupations in major_occupation_map without ESCO links
    sample_missing = db.query(
        """
        SELECT mom.occupation_uri
        FROM major_occupation_map mom
        LEFT JOIN stage_occupation_skill_links_esco link
          ON link.occupationUri = mom.occupation_uri
        WHERE mom.major_id = :m
          AND link.occupationUri IS NULL
        LIMIT 5;
        """.strip(),
        {"m": major_id},
    )
    print("sample occupations with no ESCO links:")
    for r in sample_missing:
        print(" -", r.get("occupation_uri"))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
