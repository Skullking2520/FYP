"""Populate major and major_occupation_map tables from app/ml_assets/major_occ_map.csv.

This project has multiple "major" schemas across environments. The runtime ML recommender
supports the variant:
- major(id PK auto_increment, major_name, ...)
- major_occupation_map(major_id, occupation_uri, source, ...)

This script loads that schema.

Why this exists:
- In some DBs there is also a table named `major_occupation_map` with different columns,
  and the app can read either. But in this repo's target DB, the `major_id` schema is
  present and is what the app queries first.

Usage (PowerShell):
  python scripts/mysql_import_major_occ_map.py --truncate --db-user root --db-password <pw>

Notes:
- Uses direct connection args (does NOT rely on app/.env loading behavior).
- Safe to re-run. Use --truncate to avoid duplicates.
"""

from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from pathlib import Path

import pymysql
from pymysql.cursors import DictCursor


@dataclass(frozen=True)
class MySQLConfig:
    host: str
    port: int
    name: str
    user: str
    password: str


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _default_csv() -> Path:
    return _repo_root() / "app" / "ml_assets" / "major_occ_map.csv"


def _connect(cfg: MySQLConfig):
    return pymysql.connect(
        host=cfg.host,
        port=cfg.port,
        user=cfg.user,
        password=cfg.password,
        database=cfg.name,
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=False,
        connect_timeout=10,
        read_timeout=60,
        write_timeout=60,
    )


def _batched(items: list[tuple[str, str]], batch_size: int):
    for i in range(0, len(items), batch_size):
        yield items[i : i + batch_size]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-host", type=str, default="127.0.0.1")
    parser.add_argument("--db-port", type=int, default=3306)
    parser.add_argument("--db-name", type=str, default="fyp_careerpath")
    parser.add_argument("--db-user", type=str, required=True)
    parser.add_argument("--db-password", type=str, required=True)

    parser.add_argument("--csv", type=Path, default=_default_csv())
    parser.add_argument("--batch-size", type=int, default=2000)
    parser.add_argument("--truncate", action="store_true")
    parser.add_argument("--source", type=str, default="CSV")

    args = parser.parse_args(argv)

    if not args.csv.exists():
        print(f"ERROR: CSV not found: {args.csv}")
        return 2

    cfg = MySQLConfig(
        host=args.db_host,
        port=int(args.db_port),
        name=args.db_name,
        user=args.db_user,
        password=args.db_password,
    )

    # Read CSV into distinct mappings.
    pairs_set: set[tuple[str, str]] = set()
    majors_set: set[str] = set()
    with args.csv.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            major = (row.get("major") or "").strip()
            occ_uri = (row.get("occ_uri") or "").strip()
            if not major or not occ_uri:
                continue
            majors_set.add(major)
            pairs_set.add((major, occ_uri))

    majors = sorted(majors_set)
    pairs = sorted(pairs_set)

    print(f"majors: {len(majors)}")
    print(f"pairs: {len(pairs)}")

    conn = _connect(cfg)
    with conn:
        with conn.cursor() as cur:
            if args.truncate:
                cur.execute("SET FOREIGN_KEY_CHECKS=0")
                cur.execute("TRUNCATE TABLE major_occupation_map")
                cur.execute("TRUNCATE TABLE major")
                cur.execute("SET FOREIGN_KEY_CHECKS=1")
                conn.commit()

            # Insert majors
            cur.executemany(
                "INSERT INTO major (major_name) VALUES (%s)",
                [(m,) for m in majors],
            )
            conn.commit()

            # Build lookup major_name -> id
            cur.execute("SELECT id, major_name FROM major")
            rows = cur.fetchall()
            name_to_id = {str(r["major_name"]): int(r["id"]) for r in rows}

            missing = [m for m in majors if m not in name_to_id]
            if missing:
                print(f"ERROR: missing inserted majors: {len(missing)}")
                print(missing[:10])
                return 2

            mapping_rows: list[tuple[int, str, str]] = []
            for major, occ_uri in pairs:
                mapping_rows.append((name_to_id[major], occ_uri, str(args.source)))

            for batch in _batched(mapping_rows, args.batch_size):
                cur.executemany(
                    "INSERT INTO major_occupation_map (major_id, occupation_uri, source) VALUES (%s, %s, %s)",
                    batch,
                )
            conn.commit()

            cur.execute("SELECT COUNT(*) AS c FROM major")
            c_major = int(cur.fetchone()["c"])
            cur.execute("SELECT COUNT(*) AS c FROM major_occupation_map")
            c_map = int(cur.fetchone()["c"])

            print("done")
            print("count major:", c_major)
            print("count major_occupation_map:", c_map)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
