# VulnSeeker
# Automated CodeQL Analysis with LLM Classification

<div align="center">
  <img src="images/h6yseb2b.png" alt="VulnSeeker" width="400">
</div>

For a detailed overview of the research and motivation behind Vulnhalla, see the official CyberArk Threat Research blog post:

**[Vulnhalla: Picking the True Vulnerabilities from the CodeQL Haystack](https://www.cyberark.com/resources/threat-research-blog/vulnhalla-picking-the-true-vulnerabilities-from-the-codeql-haystack)**

### Vulnhalla automates the complete security analysis pipeline:

1. **Fetching repositories** of a given programming language from GitHub
2. **Downloading** their corresponding [CodeQL](https://github.com/github/codeql) databases (if available)
3. **Running CodeQL queries** on those databases to detect security or code-quality issues
4. **Post-processing** the results with an LLM (ChatGPT, Gemini, etc.) to classify and filter issues

### Supported Analysis Modes

| Mode | Database Source | Build Required | Command Example |
|------|----------------|----------------|----------------|
| **GitHub DB** | Pre-built CodeQL database on GitHub | No | `poetry run vulnhalla redis/redis` |
| **Local DB** | Pre-built CodeQL database on your disk | No | `poetry run vulnhalla --local /path/to/db` |
| **Local Source** | Your own source code (auto-builds CodeQL DB) | Yes | `poetry run vulnhalla --local-src /path/to/src` |

---

## 🚀 Quick Start

### Step 1: Prerequisites

Before starting, ensure you have:

- **Python 3.10 – 3.13** (Python 3.11 or 3.12 recommended)
  - Python 3.14+ is not supported (this tool uses grpcio which is not supported by Python 3.14+)
  - Download from [python.org](https://www.python.org/downloads/)

- **CodeQL CLI**
  - Download from [CodeQL CLI releases](https://github.com/github/codeql-cli-binaries/releases)
  - Make sure `codeql` is in your PATH, or you'll set the path in `.env` (see Step 2)

- **(Optional) GitHub API token**
  - For higher rate limits when downloading databases
  - Get from [GitHub Settings > Tokens](https://github.com/settings/tokens)

- **LLM API key**
  - OpenAI, Azure, Gemini, or Bedrock credentials (depending on your provider)

### Step 2: Configure Environment

All configuration is in a single file: `.env`

1. **Clone the repository:**
```bash
git clone https://github.com/Kirito14IT/VulnSeeker
cd VulnSeeker
```

2. **Copy `.env.example` to `.env`:**
```bash
cp .env.example .env # macOS / Linux
Copy-Item .env.example .env # Windows (PowerShell)
```

3. **Edit `.env` and fill in your values:**

**Example for OpenAI:**
```env
CODEQL_PATH=codeql
GITHUB_TOKEN=ghp_your_token_here
PROVIDER=openai
MODEL=gpt-4o
OPENAI_API_KEY=your-api-key-here
LLM_TEMPERATURE=0.2
LLM_TOP_P=0.2

# Optional: Logging Configuration
LOG_LEVEL=INFO                  # DEBUG, INFO, WARNING, ERROR
LOG_FILE=                       # Optional: path to log file (e.g., logs/vulnhalla.log)
LOG_FORMAT=default              # default or json
# LOG_VERBOSE_CONSOLE=false     # If true, WARNING/ERROR use full format (timestamp - logger - level - message)
```

> **📖 For complete configuration reference:** See [Configuration Reference](#-configuration-reference) below for all supported providers (OpenAI, Azure, Gemini, Bedrock), required/optional variables, and detailed examples.

### Step 3: Install Poetry (Recommended: pipx)


**Windows (PowerShell):**
```powershell
# List available Python versions
py -0p

# Pick any supported Python: 3.10 / 3.11 / 3.12 / 3.13
py -3.12 -m pip install --user -U pipx
py -3.12 -m pipx ensurepath
# Close and reopen terminal (required)
pipx install poetry
poetry --version
```

**macOS / Linux:**
```bash
# Check your Python version
python3 --version

# Use any supported Python: 3.10 / 3.11 / 3.12 / 3.13
python3 -m pip install --user -U pipx
python3 -m pipx ensurepath
# Restart terminal (required)
pipx install poetry
poetry --version
```

### Step 4: Install Dependencies and Setup


**Windows (PowerShell):**
```powershell
# Pick one supported version you have: 3.10 / 3.11 / 3.12 / 3.13
poetry env use 3.12  # Force Poetry to use a supported Python version if you have multiple versions installed
poetry install
poetry run vulnhalla-setup
```

**macOS / Linux:**
```bash
# Pick one supported version you have: 3.10 / 3.11 / 3.12 / 3.13
poetry env use 3.12  # Force Poetry to use a supported Python version if you have multiple versions installed
poetry install
poetry run vulnhalla-setup
```

### Step 5: Run the Pipeline

```bash
# Analyze a specific repository, for example:
poetry run vulnhalla redis/redis

# Re-download even if database already exists
poetry run vulnhalla redis/redis --force

# Show help
poetry run vulnhalla --help
```

This will automatically:
1. Fetch CodeQL databases
2. Run CodeQL queries on all downloaded databases
3. Analyze results with LLM and save to `output/results/`
4. Open the UI to browse results

#### Using a Local CodeQL Database

If you already have a CodeQL database on disk (e.g., created manually or from a previous run), you can skip the GitHub fetch step using the `--local` / `-l` flag:

**Windows (PowerShell):**
```powershell
poetry run vulnhalla --local C:\path\to\my-codeql-db
```

**macOS / Linux:**
```bash
poetry run vulnhalla --local /path/to/my-codeql-db
```

> **Note:** The `--local` flag expects a CodeQL **database** directory, not a source code folder. You can verify by checking that the folder contains a `codeql-database.yml` file.

#### Building a CodeQL Database from Local Source

If you have a local repository's source code and want to analyze it without relying on GitHub's pre-built CodeQL databases, use the `--local-src` flag. Vulnhalla will automatically build a CodeQL database from your source code and then run the full analysis pipeline.

**Windows (PowerShell):**
```powershell
poetry run vulnhalla --local-src C:\path\to\your-repo
```

**macOS / Linux:**
```bash
poetry run vulnhalla --local-src /path/to/your-repo
```

The built database will be saved to `output/databases/c/<repo_name>/`, and the full analysis pipeline (queries + LLM classification) will run automatically.

**Re-build even if database already exists:**
```bash
poetry run vulnhalla --local-src /path/to/your-repo --force
```

> **Note:** `--local-src` expects a **source code directory**, not a CodeQL database folder. CodeQL will automatically detect the language from the source files.

### Additional Commands 

```bash
# Open UI to view existing results (without running analysis)
poetry run vulnhalla-ui

# Validate configuration: CodeQL, LLM, Logging (without running analysis)
poetry run vulnhalla-validate

# List analyzed repositories and their issue counts
poetry run vulnhalla-list

# Run example pipeline (analyzes videolan/vlc and redis/redis)
poetry run vulnhalla-example
```

---

## 🖥️ User Interface (UI)

Vulnhalla includes a full-featured User Interface for browsing and exploring analysis results.

### Running the UI

```bash
poetry run vulnhalla-ui
```

### UI Layout

The UI displays a two-panel top area with a controls bar at the bottom:

**Top Area (side-by-side, resizable):**

- **Left Panel (Issues List):**
  - DataTable showing: **ID**, **Repo**, **Issue Name**, **File**, **LLM decision**, **Manual decision**
  - Issues count and sort indicator
  - Search input box at the bottom, updates as you type (case-insensitive).

- **Right Panel (Details):**
  - **LLM decision Section**: Shows the LLM's classification (True Positive, False Positive, or Needs More Data)
  - **Metadata Section**: Issue name, Repo, File, Line, Type, Function name
  - **Code Section**: 
    - 📌 Initial Code Context (first code snippet the LLM saw)
    - 📥 Additional Code (code that the LLM requested during the conversation) - only shown if additional code exists
    - Vulnerable line highlighted in red
  - **Summary Section**: LLM final answer/decision
  - **Manual Decision Select**: Dropdown at the bottom to set manual verdict (True Positive, False Positive, Uncertain, or Not Set)

**Bottom Controls Bar:**

- Language: C (only language currently supported)
- Filter by llm desicion dropdown: All, True Positive, False Positive, Needs more Info to decide
- Action buttons: Refresh, Run Analysis
- Key bindings help text

### Key Bindings

- `↑`/`↓` - Navigate issue list (row-by-row)
- `Tab` / `Shift+Tab` - Switch focus between panels
- `Enter` - Show details for selected issue
- `/` - Focus search input box (in left panel)
- `Esc` - Clear search and return focus to issues table
- `r` - Reload results from disk
- `[` / `]` - Resize left/right panels (adjust split position)
- `q` - Quit application

### Interactive Features

#### Column Sorting

- **Click any column header** to sort by that column
- Default sorting: by Repo (ascending), then by ID (ascending)

#### Resizable Panels

- **Draggable divider** between Issues List and Details panels
- **Mouse**: Click and drag the divider to resize
- **Keyboard**: Use `[` to move divider left, `]` to move divider right
- Split position is remembered during the session

---

## 📊 Output Structure

After running the pipeline, results are organized in `output/results/<LANG>/<ISSUE_TYPE>/`:

```
output/results/c/Copy_function_using_source_size/
├── 1_raw.json      # Original CodeQL issue data
├── 1_final.json    # LLM conversation and classification
├── 2_raw.json
├── 2_final.json
└── ...
```

Each `*_final.json` contains:
- Full LLM conversation (system prompts, user messages, assistant responses, tool calls)
- Final status code (1337 = vulnerable, 1007 = secure, 7331/3713 = needs more info)

Each `*_raw.json` contains:
- Original CodeQL issue data
- Function context
- Database path (includes org/repo information: `output/databases/<LANG>/<ORG>/<REPO>`)
- Issue location

---

## 🛠 Troubleshooting

- **CodeQL CLI not found**:  
  Set `CODEQL_PATH` in your `.env` file to the full path of your CodeQL executable.
  **On Windows**: The path must end with `.cmd` (e.g., `C:\path\to\codeql\codeql.cmd`).

- **GitHub rate limits**:  
  Set `GITHUB_TOKEN` in your `.env` file (get token from https://github.com/settings/tokens).

- **LLM issues**:  
  Check your API keys in `.env` file match your selected provider.

- **Import errors in UI**:  
  Make sure you're running from the project root directory, or use `python examples/ui_example.py` which handles path setup.

---

## ⚙️ Configuration Reference

### Environment Variables

All configuration is managed through environment variables in your `.env` file. Here's a complete reference:

#### Required Variables

| Variable | Required For | Description |
|----------|--------------|-------------|
| `CODEQL_PATH` | All | Path to CodeQL executable. Defaults to `codeql` if CodeQL is in PATH. Use full path if not in PATH (e.g., `C:\path\to\codeql\codeql.cmd` on Windows) |
| `PROVIDER` | All | LLM provider: `openai`, `azure`, `gemini`, `bedrock`, `anthropic`, `mistral`, `groq`, `openrouter`, `ollama`, etc. |
| `MODEL` | All | Model name (e.g., `gpt-4o`, `gpt-4-turbo`, `gemini-2.5-flash`) |

#### Provider-Specific Required Variables

**OpenAI:**
| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Your OpenAI API key from [platform.openai.com](https://platform.openai.com/api-keys) |

**Azure OpenAI:**
| Variable | Description |
|----------|-------------|
| `AZURE_OPENAI_API_KEY` or `AZURE_API_KEY` | Your Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` or `AZURE_API_BASE` | Your Azure OpenAI endpoint URL (e.g., `https://your-resource.openai.azure.com`) |
| `AZURE_OPENAI_API_VERSION` or `AZURE_API_VERSION` | API version (default: `2024-08-01-preview`) |

**Gemini (Google):**
| Variable | Description |
|----------|-------------|
| `GOOGLE_API_KEY` | Your Google API key from [Google AI Studio](https://makersuite.google.com/app/apikey) |

**AWS Bedrock:**
| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_REGION_NAME` | Yes | AWS region (e.g., `us-east-1`, `us-west-2`) |
| `AWS_PROFILE` | No* | AWS profile name for SSO/credential file auth |
| `AWS_ACCESS_KEY_ID` | No* | AWS access key (if not using profile) |
| `AWS_SECRET_ACCESS_KEY` | No* | AWS secret key (if not using profile) |
| `AWS_SESSION_TOKEN` | No | Session token for temporary STS credentials |

\* Authentication: Use `AWS_PROFILE` **or** `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` (+ optional `AWS_SESSION_TOKEN` for STS).

**Bedrock `.env` example (SSO):**
```env
PROVIDER=bedrock
MODEL=anthropic.claude-3-5-sonnet-20241022-v2:0
AWS_REGION_NAME=us-east-1
AWS_PROFILE=your-profile
```

> **⚠️ Prerequisites:**
> - AWS credentials must be configured (SSO, IAM profile, or access keys) with **permissions to invoke Bedrock models**
> - **For SSO users:** Run `aws sso login --profile your-profile` before using Vulnhalla
>
> **🔧 Important - Model Selection:**
> When selecting a Bedrock model, make sure it supports **tool calling/function calling** (not all Bedrock models do). Tool calling is a key part of Vulnhalla's analysis flow, so choosing a compatible model makes a big difference in functionality and results. Compatible models include: **Claude 3.x**, **Mistral**, or **Cohere Command R**.

#### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_TOKEN` | - | GitHub API token for higher rate limits. Get from [GitHub Settings > Tokens](https://github.com/settings/tokens) |
| `GITHUB_API_URL` | `https://api.github.com` | GitHub API URL. For GitHub Enterprise, set to your server's API URL (e.g., `https://github.your-company.com/api/v3`) |
| `GITHUB_SSL_VERIFY` | `true` | SSL certificate verification. Set to `false` for GitHub Enterprise with self-signed or internal CA certificates |
| `LLM_TEMPERATURE` | `0.2` | LLM temperature (0.0-2.0). Lower = more deterministic. **Recommended: keep at 0.2** |
| `LLM_TOP_P` | `0.2` | LLM top-p sampling (0.0-1.0). Lower = more focused. **Recommended: keep at 0.2** |
| `LLM_TIMEOUT` | `300` | Timeout in seconds for each LLM API request. Defaults to 5 minutes. Increase if network latency is high (e.g., accessing OpenRouter from regions with high latency). |
| `LLM_MAX_RETRIES` | `3` | Maximum number of retries for failed LLM API requests (e.g., timeouts). Uses exponential backoff between retries. Set to `0` to disable retries. |
| `LOG_LEVEL` | `INFO` | Logging level: `DEBUG`, `INFO`, `WARNING`, or `ERROR`. Controls verbosity of console output |
| `LOG_FILE` | - | Optional path to log file (e.g., `logs/vulnhalla.log`). If set, logs are written to both console and file. File logging uses DEBUG level for detailed output |
| `LOG_FORMAT` | `default` | Log format style: `default` (human-readable), or `json` (structured JSON format) |
| `LOG_VERBOSE_CONSOLE` | `false` | If `true`, WARNING/ERROR/CRITICAL use full format (timestamp - logger - level - message). Default: WARNING/ERROR use simple format (LEVEL - message), INFO always minimal (message only) |
| `THIRD_PARTY_LOG_LEVEL` | `ERROR` | Log level for third-party libraries (LiteLLM, urllib3, requests). Options: `DEBUG`, `INFO`, `WARNING`, `ERROR`. Default suppresses most third-party noise |

> **⚠️ Important:** Do not increase `LLM_TEMPERATURE` or `LLM_TOP_P` unless you fully understand the impact. Lower values keep the model stable and deterministic, which is critical for security analysis. Higher values may cause the model to become inconsistent, creative, or hallucinate results.

> **📝 Note:** For additional configuration examples, see the `.env.example` file in the project root.

### Configuration Validation

Vulnhalla validates your configuration at startup. If required variables are missing or invalid, you'll see clear error messages indicating what needs to be fixed.

**Common validation errors:**
- Missing API key for selected provider
- Invalid provider name (see `PROVIDER` for supported values)
- Missing Azure endpoint (required for Azure provider)
- Missing AWS credentials or region (required for Bedrock provider)
- Invalid CodeQL path (if `CODEQL_PATH` is set but file doesn't exist)

---

## 📝 Status Codes

The LLM uses the following status codes:

- **1337**: Security vulnerability found (True Positive)
- **1007**: Code is secure, no vulnerability (False Positive)
- **7331**: More code/information needed to validate security
- **3713**: Likely not a security problem, but more info needed (used with 7331)

The UI maps these to:
- `1337` → "True Positive"
- `1007` → "False Positive"
- `7331` or `3713` → "Needs More Data"

---

## 🔧 Development

### Running Tests

The project includes basic test infrastructure using pytest:

```bash
# Run all tests
poetry run pytest

# Run with verbose output
poetry run pytest -v
```

The test suite includes smoke tests to verify the test infrastructure is set up correctly.

### Type Checking

The project uses mypy for static type checking:

```bash
poetry run mypy src
```

Type checking is configured in `pyproject.toml` under `[tool.mypy]`.
The configuration uses a conservative baseline with per-module overrides to allow gradual adoption.

### Project Dependencies

Dependencies are managed via Poetry in `pyproject.toml`:
- `requests` - HTTP requests for GitHub API
- `pySmartDL` - Smart download manager for CodeQL databases
- `litellm` - Unified LLM interface supporting multiple providers
- `python-dotenv` - Environment variable management
- `PyYAML` - YAML parsing for CodeQL pack files
- `textual` - Terminal UI framework
- `pytest` - Testing framework (dev dependency)
- `mypy` - Static type checker (dev dependency)

### CodeQL Queries

CodeQL queries are organized in `data/queries/<LANG>/`:
- `issues/` - Security issue detection queries
- `tools/` - Helper queries (function trees, classes, global variables, macros)

Each directory contains a `qlpack.yml` file defining the CodeQL pack.

---

## 📄 License

Copyright (c) 2025 CyberArk Software Ltd. All rights reserved.

This repository is licensed under the Apache License, Version 2.0 - see [LICENSE.txt](LICENSE.txt) for more details.

---

## 🤝 Contributing


We welcome contributions of all kinds to this repository. For instructions on how to get started and descriptions of our development workflows, please see our [contributing guide](https://github.com/Kirito14IT/VulnSeeker/blob/main/CONTRIBUTING.md).

---  
### Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md). We are committed to providing a welcoming and inclusive environment for all contributors.

---

## 📧 Contact

Feel free to contact us via GitHub issues if you have any feature requests or project issues.
