"""Drop all tables and re-create them from scratch, including the default admin user."""

import asyncio

from core.database import engine, init_db
from models.models import Base


async def reset_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    # Re-use the shared init sequence which creates tables, applies
    # incremental schema upgrades and seeds the default admin account.
    await init_db()


asyncio.run(reset_db())
