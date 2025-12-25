from __future__ import annotations

import os
import re
import time
from dataclasses import dataclass
from typing import Any, Iterable, Mapping

import pymysql
from pymysql.cursors import DictCursor

from sqlalchemy.engine import make_url

from app.config import settings


@dataclass(frozen=True)
class MySQLConfig:
    host: str
    port: int
    name: str
    user: str
    password: str
    charset: str = "utf8mb4"


class DatabaseConnectionError(RuntimeError):
    pass


class DatabaseQueryError(RuntimeError):
    pass


_NAMED_PARAM_RE = re.compile(r":([a-zA-Z_][a-zA-Z0-9_]*)")


def load_mysql_config_from_env() -> MySQLConfig:
    """Backward-compatible helper.

    NOTE: Prefer `load_mysql_config()` which reads from `app.config.settings`.
    """

    host = os.getenv("DB_HOST", "localhost")
    port = int(os.getenv("DB_PORT", "3306"))
    name = os.getenv("DB_NAME", "fyp_careerpath")
    user = os.getenv("DB_USER", "root")
    password = os.getenv("DB_PASSWORD", "")
    charset = os.getenv("DB_CHARSET", "utf8mb4")
    return MySQLConfig(host=host, port=port, name=name, user=user, password=password, charset=charset)


def load_mysql_config() -> MySQLConfig:
    """Load MySQL config from application settings.

    This ensures `.env` values are respected (pydantic-settings loads env_file).
    """

    if settings.db_url:
        url = make_url(settings.db_url)
        charset = (url.query or {}).get("charset") or settings.db_charset
        return MySQLConfig(
            host=url.host or settings.db_host,
            port=int(url.port or settings.db_port),
            name=url.database or settings.db_name,
            user=url.username or settings.db_user,
            password=url.password or settings.db_password,
            charset=str(charset),
        )

    return MySQLConfig(
        host=settings.db_host,
        port=int(settings.db_port),
        name=settings.db_name,
        user=settings.db_user,
        password=settings.db_password,
        charset=settings.db_charset,
    )


def get_connection(*, retries: int = 3, backoff_seconds: float = 0.3):
    cfg = load_mysql_config()
    last_exc: Exception | None = None

    for attempt in range(1, retries + 1):
        try:
            return pymysql.connect(
                host=cfg.host,
                port=cfg.port,
                user=cfg.user,
                password=cfg.password,
                database=cfg.name,
                charset=cfg.charset,
                cursorclass=DictCursor,
                autocommit=True,
                connect_timeout=5,
                read_timeout=10,
                write_timeout=10,
            )
        except Exception as exc:  # noqa: BLE001 - we want to retry on any connection failure
            last_exc = exc
            if attempt < retries:
                time.sleep(backoff_seconds * attempt)
                continue
            raise DatabaseConnectionError(
                "Failed to connect to MySQL after "
                f"{retries} attempts ({cfg.host}:{cfg.port}/{cfg.name}). "
                f"Last error: {type(exc).__name__}: {exc}"
            ) from exc

    raise DatabaseConnectionError("Failed to connect to MySQL") from last_exc


def expand_in_clause(sql: str, params: dict[str, Any], key: str) -> tuple[str, dict[str, Any]]:
    """Safely expand an IN-clause placeholder.

    Expects SQL to contain `:{key}` and params[{key}] to be a list/tuple.
    Example: `... WHERE s.skill_key IN (:skill_keys)`
      -> `... WHERE s.skill_key IN (:skill_keys_0, :skill_keys_1)`

    This keeps parameterization intact and avoids string-formatting user input.
    """

    values = params.get(key)
    if values is None:
        return sql, params

    if not isinstance(values, (list, tuple)):
        raise ValueError(f"IN-clause parameter '{key}' must be a list or tuple")

    if len(values) == 0:
        raise ValueError(f"IN-clause parameter '{key}' cannot be empty")

    new_params: dict[str, Any] = {k: v for k, v in params.items() if k != key}
    tokens: list[str] = []

    for idx, value in enumerate(values):
        param_name = f"{key}_{idx}"
        tokens.append(f":{param_name}")
        new_params[param_name] = value

    sql = sql.replace(f":{key}", ", ".join(tokens))
    return sql, new_params


def _compile_named_params(sql: str, params: Mapping[str, Any]) -> tuple[str, list[Any]]:
    order: list[str] = []

    def repl(match: re.Match[str]) -> str:
        name = match.group(1)
        order.append(name)
        return "%s"

    compiled_sql = _NAMED_PARAM_RE.sub(repl, sql)

    # PyMySQL uses Python's `%` operator internally for parameter substitution.
    # Any literal percent signs in SQL (e.g. LIKE '%foo%') must be escaped as '%%'
    # or it can raise: ValueError: unsupported format character ...
    sentinel = "__PCT_S_PLACEHOLDER__"
    compiled_sql = compiled_sql.replace("%s", sentinel)
    compiled_sql = compiled_sql.replace("%", "%%")
    compiled_sql = compiled_sql.replace(sentinel, "%s")
    try:
        values = [params[name] for name in order]
    except KeyError as exc:
        raise DatabaseQueryError(f"Missing SQL parameter: {exc}") from exc
    return compiled_sql, values


def query(sql: str, params: Mapping[str, Any] | Iterable[Any] | None = None) -> list[dict[str, Any]]:
    """Run a SELECT query and return rows as dicts.

    - Supports `:name` style parameters when `params` is a mapping.
    - Supports positional `%s` style parameters when `params` is a sequence.
    """

    try:
        conn = get_connection()
    except DatabaseConnectionError:
        raise

    try:
        with conn:
            with conn.cursor() as cur:
                if params is None:
                    cur.execute(sql)
                elif isinstance(params, Mapping):
                    compiled_sql, values = _compile_named_params(sql, params)
                    cur.execute(compiled_sql, values)
                else:
                    cur.execute(sql, list(params))

                rows = cur.fetchall()
                return list(rows)
    except DatabaseConnectionError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise DatabaseQueryError("Database query failed") from exc


def query_one(sql: str, params: Mapping[str, Any] | Iterable[Any] | None = None) -> dict[str, Any] | None:
    rows = query(sql, params)
    return rows[0] if rows else None
