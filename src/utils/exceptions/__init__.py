"""VulnSeeker exception hierarchy."""

from src.utils.exceptions.base import VulnSeekerError
from src.utils.exceptions.codeql import (
    CodeQLError,
    CodeQLConfigError,
    CodeQLExecutionError,
)
from src.utils.exceptions.llm import (
    LLMError,
    LLMConfigError,
    LLMApiError,
)

__all__ = [
    "VulnSeekerError",
    "CodeQLError",
    "CodeQLConfigError",
    "CodeQLExecutionError",
    "LLMError",
    "LLMConfigError",
    "LLMApiError",
]


