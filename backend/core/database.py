"""
Database connection setup using SQLAlchemy 2.0 with aiomysql.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import inspect, text

from core.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncSession:
    """Dependency for FastAPI routes — yields a session and closes it on exit."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """Create all tables defined in backend/models/models.py."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_upgrade_schema)


def _upgrade_schema(sync_conn) -> None:
    """
    Apply lightweight additive schema updates for installations that already
    created tables before new web fields were introduced.
    """
    inspector = inspect(sync_conn)

    if "tasks" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("tasks")}
        statements = []
        if "source_type" not in columns:
            statements.append("ALTER TABLE tasks ADD COLUMN source_type VARCHAR(32) NOT NULL DEFAULT 'github'")
        else:
            statements.append("ALTER TABLE tasks MODIFY COLUMN source_type VARCHAR(32) NOT NULL DEFAULT 'github'")
        if "status" in columns:
            statements.append("ALTER TABLE tasks MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'pending'")
        if "source_path" not in columns:
            statements.append("ALTER TABLE tasks ADD COLUMN source_path VARCHAR(1024) NULL")
        if "force_run" not in columns and "force" not in columns:
            statements.append("ALTER TABLE tasks ADD COLUMN force_run BOOLEAN NOT NULL DEFAULT FALSE")

        for statement in statements:
            sync_conn.execute(text(statement))

        sync_conn.execute(
            text(
                "UPDATE tasks SET source_type = LOWER(source_type) "
                "WHERE source_type IN ('GITHUB', 'LOCAL_DB', 'LOCAL_SRC')"
            )
        )
        sync_conn.execute(
            text(
                "UPDATE tasks SET status = LOWER(status) "
                "WHERE status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')"
            )
        )
