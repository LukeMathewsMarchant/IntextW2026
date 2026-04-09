"""Shared PostgreSQL access for ml-service (social media, tier-1 analytics, etc.)."""

from __future__ import annotations

import os
from typing import Any

import pandas as pd
import psycopg


def normalize_connection_value(raw: str) -> str:
    value = raw.strip()
    if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
        return value[1:-1]
    return value


def parse_dotnet_style_conn_str(conn_str: str) -> dict[str, Any]:
    mapping = {
        'host': 'host',
        'server': 'host',
        'port': 'port',
        'database': 'dbname',
        'initial catalog': 'dbname',
        'username': 'user',
        'user id': 'user',
        'userid': 'user',
        'uid': 'user',
        'password': 'password',
    }
    options: dict[str, Any] = {}
    for segment in conn_str.split(';'):
        if '=' not in segment:
            continue
        key, value = segment.split('=', 1)
        key = key.strip().lower()
        value = value.strip()
        if not key:
            continue
        normalized = mapping.get(key)
        if normalized:
            options[normalized] = value
            continue
        if key == 'ssl mode' and value:
            options['sslmode'] = value.lower()
        elif key == 'trust server certificate' and value.lower() == 'true':
            options['sslmode'] = options.get('sslmode', 'require')
    return options


def resolve_db_connection_value() -> str:
    direct = normalize_connection_value(os.getenv('SOCIAL_MEDIA_DB_URL', ''))
    if direct:
        return direct
    return normalize_connection_value(os.getenv('ConnectionStrings__DefaultConnection', ''))


def connect_db(conn_value: str):
    if conn_value.startswith('postgres://') or conn_value.startswith('postgresql://'):
        return psycopg.connect(conn_value)
    if ';' in conn_value:
        kwargs = parse_dotnet_style_conn_str(conn_value)
        return psycopg.connect(**kwargs)
    return psycopg.connect(conn_value)


def fetch_dataframe(conn_value: str, sql: str) -> pd.DataFrame:
    with connect_db(conn_value) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
            cols = [d.name for d in cur.description]
    df = pd.DataFrame(rows, columns=cols)
    df.columns = [str(c).lower() for c in df.columns]
    return df
