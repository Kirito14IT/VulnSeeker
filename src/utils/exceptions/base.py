"""Base exception class for all VulnSeeker-specific errors."""


class VulnSeekerError(Exception):
    """
    Base exception for all VulnSeeker-specific errors.

    Args:
        message: Human-readable error message.
        cause: Optional underlying exception that caused this error.
    """
    def __init__(self, message: str, cause: Exception | None = None) -> None:
        super().__init__(message)
        self.cause = cause
        if cause is not None:
            # Enables chained traceback: VulnSeekerError <- cause
            self.__cause__ = cause

