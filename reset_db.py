import asyncio 
from core.database import engine 
from models.models import Base 
async def init_db(): 
    async with engine.begin() as conn: 
        await conn.run_sync(Base.metadata.drop_all) 
        await conn.run_sync(Base.metadata.create_all) 
asyncio.run(init_db()) 
