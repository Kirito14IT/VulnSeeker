# Contributing to Vulnhalla

Thank you for your interest in contributing to Vulnhalla! We are always delighted to welcome new contributors!

For general contributions and community guidelines, please see the [cyberark community documentation](https://github.com/cyberark/community/).

## Found an Issue?

If you have found a bug, please raise an issue on the Vulnhalla repo: https://github.com/cyberark/Vulnhalla/issues

## Found a Vulnerability?

If you think you have found a vulnerability in Vulnhalla, please refer to [Security](SECURITY.md)

We are always very grateful to researchers who report vulnerabilities responsibly.

## Development

We recommend using Python 3.10 – 3.13. Python 3.14+ is not supported (grpcio wheels unavailable).


### Contribution Guidelines

- **Code Style**: Follow Python PEP 8 style guidelines
- **Type Hints**: Add type hints to all new functions (see [Type Checking](#type-checking) below)
- **Testing**: Test your changes using `examples/example.py` and `examples/ui_example.py`
- **Documentation**: Update the README.md if you're adding new features or changing behavior
- **Commit Messages**: Write clear, descriptive commit messages
- **Pull Requests**: 
  - Provide a clear description of your changes
  - Reference any related issues
  - Ensure your code works with Python 3.10-3.13
- **Logging**: Use structured logging instead of `print()` statements (see [Logging Guidelines](#logging-guidelines) below)


### General Steps for Contributing (Creating a Pull Request)

1. Fork the project.

2. Clone your fork.

```
# Clone the repository (fork)
git clone https://github.com/cyberark/Vulnhalla.git
cd Vulnhalla
```

3. Install the project's requirements and configure your environment. See [README.md](README.md) for detailed instructions on installing dependencies, setting up CodeQL packs, and configuring your `.env` file.

4. Make local changes to your fork by editing files

5. Test your changes

```
# Test the full pipeline
python examples/example.py

# Test UI changes (if applicable)
python examples/ui_example.py
```

6. Commit your changes. Use clear, descriptive commit messages.

7. Push your local changes to the remote server.

8. Create a new Pull Request. Please include:
   - A clear description of your changes
   - Reference to any related issues (e.g., "Fixes #123")
   - Any testing you performed

From here, your pull request will be reviewed, and once it is merged into the project. Congratulations, you're a contributor!

### Reporting Issues

Before reporting issues, please:
- Check existing issues to avoid duplicates
- Include Python version, OS, and error messages
- Provide steps to reproduce the issue

## Logging Guidelines

Vulnhalla uses centralized logging. Always use `get_logger(__name__)` instead of `print()` for application messages.

### Basic Usage

```python
from src.utils.logger import get_logger

logger = get_logger(__name__)

# ✅ Good
logger.info("Processing database: %s", db_path)
logger.warning("Rate limit approaching: %d requests remaining", remaining)
logger.error("Failed to process: %s", error_message)
logger.debug("Debug information: %s", debug_data)

# ❌ Bad
print("Processing database:", db_path)  # Don't use print()
```

### Log Levels

- **`logger.debug()`** - Detailed diagnostics (shown with `LOG_LEVEL=DEBUG`)
- **`logger.info()`** - Status updates, progress messages
- **`logger.warning()`** - Warnings (rate limits, missing data)
- **`logger.error()`** - Errors, failures, exceptions

### When Print() is Acceptable

`print()` is only acceptable for:
- Interactive CLI prompts
- Real-time progress indicators with `\r` (e.g., download progress bars)

## Testing

Please test your changes manually using the example scripts:

- `python examples/example.py` - Tests the full pipeline
- `python examples/ui_example.py` - Tests the UI

Ensure your code works with Python 3.10-3.13 before submitting.

**Testing with Different Log Levels:**
```bash
# Test with debug logging
LOG_LEVEL=DEBUG python examples/example.py

# Test with warning level only
LOG_LEVEL=WARNING python examples/example.py
```

## Type Checking

This project uses [mypy](https://mypy.readthedocs.io/) for static type checking. Run mypy before submitting a pull request:

```bash
poetry run mypy src
```

### Guidelines

- **Add type hints** to all new functions (parameters and return types)
- **Run mypy** to ensure no new errors are introduced
- Configuration is in `pyproject.toml` under `[tool.mypy]`

## Releases

Releases should only be created by our core maintainers.

## Legal

Any submission of work, including any modification of, or addition to, an existing work ("Contribution") to "Vulnhalla" shall be governed by and subject to the terms of the Apache License, Version 2.0 (the "License") and to the following complementary terms. In case of any conflict or inconsistency between the provisions of the License and the complementary terms, the complementary terms shall prevail. By submitting the Contribution, you represent and warrant that the Contribution is your original creation and you own all right, title and interest in the Contribution. You represent that you are legally entitled to grant the rights set out in the License and herein, without violation of, or conflict with, the rights of any other party. You represent that your Contribution includes complete details of any third-party license or other restriction associated with any part of your Contribution of which you are personally aware.

## das
