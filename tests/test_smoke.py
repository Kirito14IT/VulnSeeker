"""Smoke tests to verify basic test infrastructure works."""

def test_pytest_runs():
    """Test that pytest can discover and run tests."""
    assert True


def test_can_import_src():
    """Test that we can import the main project modules."""
    
    from src.utils.common_functions import read_file
    from src.vulnseeker import IssueAnalyzer
    from src.llm.llm_analyzer import LLMAnalyzer
    assert read_file and IssueAnalyzer and LLMAnalyzer
