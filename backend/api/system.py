"""
System helper APIs that mirror legacy CLI support commands.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from api.auth import get_current_user
from api.schemas import ConfigValidationResponse
from models.models import User
from src.utils.config_validator import validate_all_config


router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/validate", response_model=ConfigValidationResponse)
async def validate_config(current_user: User = Depends(get_current_user)):
    valid, errors = validate_all_config()
    return ConfigValidationResponse(valid=valid, errors=errors)
