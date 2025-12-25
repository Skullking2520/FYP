"""Create and populate MySQL ML-metadata tables from CSV assets.

Creates required tables (UTF8MB4) and imports:
- ESCO skills from app/ml_assets/ESCO_skills_en.csv
- ESCO occupations from app/ml_assets/ESCO_occupations_en.csv
- Major-occupation mapping from app/ml_assets/major_occ_map.csv

Required tables & columns (exact):
- skills(skill_uri PK, preferred_label, alt_labels)
- occupations(occ_uri PK, preferred_label)
- major_occupation_map(major_name, occ_uri) PK(major_name, occ_uri)

Indexes:
- skills(preferred_label)
- occupations(preferred_label)
- major_occupation_map(occ_uri)

Sanity checks:
- skills rows > 10,000
- occupations rows > 1,000
- major_occupation_map rows > 1,000

Usage (PowerShell):
  python scripts/mysql_import_ml_metadata.py --truncate

Notes:
- Uses the same MySQL config as the app (app.db.mysql.load_mysql_config).
- Safe to re-run. With --truncate it reloads from scratch.
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import pymysql
from pymysql.cursors import DictCursor
from pymysql.err import OperationalError


@dataclass(frozen=True)
class _MySQLConfig:
    host: str
    port: int
    name: str
    user: str
    password: str


class DatabaseConnectionError(RuntimeError):
    pass


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _default_paths() -> tuple[Path, Path, Path]:
    base = _repo_root() / "app" / "ml_assets"
    return (
        base / "ESCO_skills_en.csv",
        base / "ESCO_occupations_en.csv",
        base / "major_occ_map.csv",
    )

def _load_cfg_from_env() -> _MySQLConfig:
    host = os.getenv("DB_HOST", "127.0.0.1")
    port = int(os.getenv("DB_PORT", "3306"))
    name = os.getenv("DB_NAME", "fyp_careerpath")
    user = os.getenv("DB_USER", "root")
    password = os.getenv("DB_PASSWORD", "")
    return _MySQLConfig(host=host, port=port, name=name, user=user, password=password)


def _connect(cfg: _MySQLConfig):
    try:
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
    except Exception as exc:
        raise DatabaseConnectionError(
            f"Failed to connect to MySQL ({cfg.host}:{cfg.port}/{cfg.name}): {type(exc).__name__}: {exc}"
        ) from exc


def _exec(cur, sql: str) -> None:
    cur.execute(sql)


def _ensure_tables(cur) -> None:
    # Tables (UTF8MB4) with required PKs and indexes.
    _exec(
        cur,
        """
        CREATE TABLE IF NOT EXISTS skills (
          skill_uri VARCHAR(255) NOT NULL,
          preferred_label VARCHAR(255) NOT NULL,
          alt_labels TEXT NULL,
          PRIMARY KEY (skill_uri),
          INDEX idx_skills_preferred_label (preferred_label)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    )
    _exec(
        cur,
        """
        CREATE TABLE IF NOT EXISTS occupations (
          occ_uri VARCHAR(255) NOT NULL,
          preferred_label VARCHAR(255) NOT NULL,
          PRIMARY KEY (occ_uri),
          INDEX idx_occupations_preferred_label (preferred_label)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    )
    _exec(
        cur,
        """
        CREATE TABLE IF NOT EXISTS major_occupation_map (
          major_name VARCHAR(255) NOT NULL,
          occ_uri VARCHAR(255) NOT NULL,
          PRIMARY KEY (major_name, occ_uri),
          INDEX idx_major_occ_map_occ_uri (occ_uri)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    )


def _truncate(cur) -> None:
    # Order matters due to potential FK constraints in user DBs.
    _exec(cur, "TRUNCATE TABLE major_occupation_map")
    _exec(cur, "TRUNCATE TABLE occupations")
    _exec(cur, "TRUNCATE TABLE skills")


def _batched(rows: Iterable[tuple], batch_size: int):
    batch: list[tuple] = []
    for row in rows:
        batch.append(row)
        if len(batch) >= batch_size:
            yield batch
            batch = []
    if batch:
        yield batch


def import_skills(cur, path: Path, *, batch_size: int) -> int:
    sql = (
        "INSERT INTO skills (skill_uri, preferred_label, alt_labels) "
        "VALUES (%s, %s, %s) "
        "ON DUPLICATE KEY UPDATE preferred_label=VALUES(preferred_label), alt_labels=VALUES(alt_labels)"
    )

    def iter_rows():
        with path.open("r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                uri = (row.get("conceptUri") or "").strip()
                preferred = (row.get("preferredLabel") or "").strip()
                alt = row.get("altLabels")
                alt_labels = alt.strip() if isinstance(alt, str) and alt.strip() else None
                if not uri or not preferred:
                    continue
                yield (uri, preferred, alt_labels)

    total = 0
    for batch in _batched(iter_rows(), batch_size):
        cur.executemany(sql, batch)
        total += len(batch)
    return total


def import_occupations(cur, path: Path, *, batch_size: int) -> int:
    sql = (
        "INSERT INTO occupations (occ_uri, preferred_label) "
        "VALUES (%s, %s) "
        "ON DUPLICATE KEY UPDATE preferred_label=VALUES(preferred_label)"
    )

    def iter_rows():
        with path.open("r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                uri = (row.get("conceptUri") or "").strip()
                preferred = (row.get("preferredLabel") or "").strip()
                if not uri or not preferred:
                    continue
                yield (uri, preferred)

    total = 0
    for batch in _batched(iter_rows(), batch_size):
        cur.executemany(sql, batch)
        total += len(batch)
    return total


def import_major_occ_map(cur, path: Path, *, batch_size: int) -> int:
    # Composite PK(major_name, occ_uri) prevents duplicates.
    sql = "INSERT IGNORE INTO major_occupation_map (major_name, occ_uri) VALUES (%s, %s)"

    def iter_rows():
        with path.open("r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                major = (row.get("major") or "").strip()
                occ_uri = (row.get("occ_uri") or "").strip()
                if not major or not occ_uri:
                    continue
                yield (major, occ_uri)

    total = 0
    for batch in _batched(iter_rows(), batch_size):
        cur.executemany(sql, batch)
        total += len(batch)
    return total


def count_rows(cur, table: str) -> int:
    cur.execute(f"SELECT COUNT(*) AS c FROM {table}")
    row = cur.fetchone()
    return int(row["c"]) if row and "c" in row else 0


def main(argv: list[str]) -> int:
    skills_csv, occ_csv, map_csv = _default_paths()

    parser = argparse.ArgumentParser()
    parser.add_argument("--db-host", type=str, default=None)
    parser.add_argument("--db-port", type=int, default=None)
    parser.add_argument("--db-name", type=str, default=None)
    parser.add_argument("--db-user", type=str, default=None)
    parser.add_argument("--db-password", type=str, default=None)
    parser.add_argument("--skills-csv", type=Path, default=skills_csv)
    parser.add_argument("--occupations-csv", type=Path, default=occ_csv)
    parser.add_argument("--major-map-csv", type=Path, default=map_csv)
    parser.add_argument("--batch-size", type=int, default=2000)
    parser.add_argument("--truncate", action="store_true")
    parser.add_argument("--counts-only", action="store_true")
    parser.add_argument(
        "--skip-ddl",
        action="store_true",
        help="Do not attempt CREATE TABLE / index DDL (useful if DB user lacks CREATE privileges).",
    )
    args = parser.parse_args(argv)

    for p in [args.skills_csv, args.occupations_csv, args.major_map_csv]:
        if not p.exists():
            print(f"ERROR: CSV not found: {p}", file=sys.stderr)
            return 2

    base_cfg = _load_cfg_from_env()
    cfg = _MySQLConfig(
        host=args.db_host or base_cfg.host,
        port=int(args.db_port or base_cfg.port),
        name=args.db_name or base_cfg.name,
        user=args.db_user or base_cfg.user,
        password=args.db_password if args.db_password is not None else base_cfg.password,
    )

    try:
        conn = _connect(cfg)
    except DatabaseConnectionError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    with conn:
        with conn.cursor() as cur:
            if not args.skip_ddl:
                try:
                    _ensure_tables(cur)
                    conn.commit()
                except OperationalError as exc:
                    # Common in restricted DB users: CREATE command denied.
                    if getattr(exc, "args", None) and len(exc.args) >= 1 and exc.args[0] == 1142:
                        print(
                            "ERROR: MySQL user lacks CREATE privilege to create required tables.\n"
                            "- Ask DBA to run scripts/mysql_ml_metadata_ddl.sql as an admin user\n"
                            "- Or re-run this script with --skip-ddl if tables already exist.\n"
                            f"MySQL error: {exc}",
                            file=sys.stderr,
                        )
                        return 2
                    raise

            if args.truncate:
                _truncate(cur)
                conn.commit()

            if not args.counts_only:
                n1 = import_skills(cur, args.skills_csv, batch_size=args.batch_size)
                conn.commit()
                n2 = import_occupations(cur, args.occupations_csv, batch_size=args.batch_size)
                conn.commit()
                n3 = import_major_occ_map(cur, args.major_map_csv, batch_size=args.batch_size)
                conn.commit()
                print(f"imported (attempted) skills: {n1}")
                print(f"imported (attempted) occupations: {n2}")
                print(f"imported (attempted) major_occupation_map: {n3}")

            skills_count = count_rows(cur, "skills")
            occ_count = count_rows(cur, "occupations")
            map_count = count_rows(cur, "major_occupation_map")

            print("row_counts:")
            print(f"  skills: {skills_count}")
            print(f"  occupations: {occ_count}")
            print(f"  major_occupation_map: {map_count}")

            # Sanity checks
            ok = True
            if skills_count <= 10_000:
                print("ERROR: skills rows must be > 10,000", file=sys.stderr)
                ok = False
            if occ_count <= 1_000:
                print("ERROR: occupations rows must be > 1,000", file=sys.stderr)
                ok = False
            if map_count <= 1_000:
                print("ERROR: major_occupation_map rows must be > 1,000", file=sys.stderr)
                ok = False

            return 0 if ok else 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
