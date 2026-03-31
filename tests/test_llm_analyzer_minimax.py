"""MiniMax-specific behavior tests for the LLM analyzer."""

from src.llm.llm_analyzer import LLMAnalyzer


def _make_minimax_analyzer() -> LLMAnalyzer:
    analyzer = LLMAnalyzer()
    analyzer.config = {"provider": "minimax"}
    analyzer.model = "minimax/MiniMax-M2.7"
    return analyzer


def test_collapse_system_messages_for_minimax_merges_into_one():
    analyzer = _make_minimax_analyzer()

    messages = [
        {"role": "system", "content": "first rule"},
        {"role": "system", "content": "second rule"},
        {"role": "user", "content": "hello"},
    ]

    normalized = analyzer._collapse_system_messages_for_minimax(messages)

    assert [message["role"] for message in normalized] == ["system", "user"]
    assert "first rule" in normalized[0]["content"]
    assert "second rule" in normalized[0]["content"]


def test_append_system_message_reuses_existing_minimax_system_prompt():
    analyzer = _make_minimax_analyzer()
    messages = [{"role": "system", "content": "base prompt"}]

    analyzer._append_system_message(messages, "follow the instructions")

    assert len(messages) == 1
    assert messages[0]["role"] == "system"
    assert "base prompt" in messages[0]["content"]
    assert "follow the instructions" in messages[0]["content"]


def test_bad_request_errors_are_not_retried():
    error = Exception(
        'litellm.APIConnectionError: MinimaxException - {"type":"error","error":{"type":"bad_request_error","message":"invalid params","http_code":"400"}}'
    )

    assert LLMAnalyzer._is_retryable_llm_error(error) is False
