"""Tests for provider-specific LLM configuration normalization."""

from src.utils.llm_config import get_model_name, load_llm_config


def test_get_model_name_prefixes_minimax_models():
    """MiniMax models must carry the LiteLLM provider prefix."""
    assert get_model_name("minimax", "MiniMax-M2.7") == "minimax/MiniMax-M2.7"
    assert (
        get_model_name("minimax", "minimax/MiniMax-M2.7")
        == "minimax/MiniMax-M2.7"
    )


def test_load_llm_config_keeps_minimax_as_native_provider(monkeypatch):
    """MiniMax should use LiteLLM's native provider, not the OpenAI alias."""
    for env_name in (
        "PROVIDER",
        "MODEL",
        "MINIMAX_API_KEY",
        "MINIMAX_API_BASE",
        "OPENAI_API_KEY",
        "OPENAI_BASE_URL",
        "OPENAI_API_BASE",
    ):
        monkeypatch.delenv(env_name, raising=False)

    monkeypatch.setenv("PROVIDER", "minimax")
    monkeypatch.setenv("MODEL", "MiniMax-M2.7")
    monkeypatch.setenv("MINIMAX_API_KEY", "test-minimax-key")

    config = load_llm_config()

    assert config["provider"] == "minimax"
    assert config["model"] == "minimax/MiniMax-M2.7"
    assert config["api_key"] == "test-minimax-key"
    assert config["api_base"] == "https://api.minimaxi.com/v1"


def test_load_llm_config_accepts_minimax_openai_compatible_envs(monkeypatch):
    """Accept MiniMax's docs-style OpenAI-compatible environment variables."""
    for env_name in (
        "PROVIDER",
        "MODEL",
        "MINIMAX_API_KEY",
        "MINIMAX_API_BASE",
        "OPENAI_API_KEY",
        "OPENAI_BASE_URL",
        "OPENAI_API_BASE",
    ):
        monkeypatch.delenv(env_name, raising=False)

    monkeypatch.setenv("PROVIDER", "minimax")
    monkeypatch.setenv("MODEL", "MiniMax-M2.7-highspeed")
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-compatible-key")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://api.minimax.io/v1")

    config = load_llm_config()

    assert config["provider"] == "minimax"
    assert config["model"] == "minimax/MiniMax-M2.7-highspeed"
    assert config["api_key"] == "test-openai-compatible-key"
    assert config["api_base"] == "https://api.minimax.io/v1"
