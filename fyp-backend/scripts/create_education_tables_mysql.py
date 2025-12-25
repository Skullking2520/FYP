from __future__ import annotations

import argparse
import sys
from pathlib import Path


def _bootstrap_import_path() -> None:
    root = Path(__file__).resolve().parents[1]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))


_bootstrap_import_path()

import pymysql  # noqa: E402

from app.config import settings  # noqa: E402


DDL = [
    """
    CREATE TABLE IF NOT EXISTS education_subjects (
      id INT NOT NULL AUTO_INCREMENT,
      stage VARCHAR(16) NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id),
      KEY ix_education_subjects_stage (stage),
      KEY ix_education_subjects_name (name),
      UNIQUE KEY uq_education_subject_stage_name (stage, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,
    """
    CREATE TABLE IF NOT EXISTS education_subject_skill_map (
      id INT NOT NULL AUTO_INCREMENT,
      subject_id INT NOT NULL,
      skill_key VARCHAR(255) NOT NULL,
      base_level INT NOT NULL DEFAULT 0,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id),
      KEY ix_education_subject_skill_map_subject_id (subject_id),
      KEY ix_education_subject_skill_map_skill_key (skill_key),
      UNIQUE KEY uq_education_subject_skill (subject_id, skill_key),
      CONSTRAINT fk_education_subject_skill_subject
        FOREIGN KEY (subject_id) REFERENCES education_subjects(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,
]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create education subject tables in MySQL.")
    parser.add_argument("--host", default=settings.db_host)
    parser.add_argument("--port", type=int, default=int(settings.db_port))
    parser.add_argument("--db", default=settings.db_name)
    parser.add_argument("--user", default="root")
    parser.add_argument("--password", default=None)
    args = parser.parse_args(argv)

    password = args.password if args.password is not None else settings.db_password

    conn = pymysql.connect(
        host=args.host,
        port=int(args.port),
        user=args.user,
        password=password,
        database=args.db,
        charset=settings.db_charset,
        autocommit=True,
        connect_timeout=10,
        read_timeout=30,
        write_timeout=30,
    )

    with conn:
        with conn.cursor() as cur:
            for stmt in DDL:
                cur.execute(stmt)

    print(f"ok: ensured tables exist in {args.db} on {args.host}:{args.port} (user={args.user})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
