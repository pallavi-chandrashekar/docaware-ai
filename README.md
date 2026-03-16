# DocAware AI Dev Assistant

Documentation-augmented AI code review, migration helper, and agent memory — powered by real API documentation.

DocAware grounds LLM-based code review in version-specific API documentation, reducing hallucinations and improving detection of deprecated APIs, breaking changes, and anti-patterns.

## Features

- **AI Code Review** — Scans your code with AST parsing, fetches relevant API docs, and uses LLMs to find real issues grounded in documentation
- **Multi-LLM Support** — Works with Claude, GPT-4o, Gemini, or local models via Ollama
- **Migration Helper** — Detects deprecated/removed APIs when upgrading libraries and generates migration plans
- **Agent Memory** — Persistent vector-indexed memory that learns from prior reviews and maintains project context across sessions

## Installation

```bash
npm install -g docaware-ai
```

Requires Node.js >= 18.17.0.

An LLM API key is only needed for AI-powered features (`review` and `migrate`). The `memory` commands and `migrate --no-llm` work without it.

### Supported LLM Providers

| Provider | Env Variable | Install | Models |
|----------|-------------|---------|--------|
| **Claude** (default) | `ANTHROPIC_API_KEY` | Built-in | claude-sonnet-4-5, claude-opus-4-5 |
| **OpenAI** | `OPENAI_API_KEY` | `npm i openai` | gpt-4o, gpt-4, gpt-4o-mini |
| **Gemini** | `GOOGLE_API_KEY` | `npm i @google/generative-ai` | gemini-2.0-flash, gemini-2.5-pro |
| **Ollama** (local) | None | [ollama.com](https://ollama.com) | llama3.1, codellama, mistral |

DocAware **auto-detects** your provider from whichever API key is set:

```bash
# Option 1: Claude (default)
export ANTHROPIC_API_KEY=your-key

# Option 2: OpenAI
export OPENAI_API_KEY=your-key

# Option 3: Gemini
export GOOGLE_API_KEY=your-key

# Option 4: Ollama (no key needed, just install and run Ollama)
```

Or set the provider explicitly in `.docaware.yml` (see Configuration below).

Optionally install [context-hub](https://github.com/andrewyng/context-hub) for curated doc retrieval:

```bash
npm install -g @aisuite/chub
```

## Quick Start

### Code Review

Review a project for API issues, deprecated patterns, and security concerns:

```bash
docaware review --dir ./my-project
docaware review --dir ./my-project --severity high --format json
docaware review --dir ./my-project --lang ts --verbose
```

### Migration Helper

Detect breaking changes when upgrading a library:

```bash
docaware migrate express --from 4.18.0 --to 5.0.0 --dir ./my-project
docaware migrate mongoose --from 6.0.0 --to 7.0.0 --format markdown
docaware migrate openai --from 3.3.0 --to 4.0.0 --no-llm  # diff-only, no AI
```

### Agent Memory

Search, manage, and sync the persistent memory layer:

```bash
docaware memory search "express middleware deprecation"
docaware memory list --type review_finding
docaware memory add "Our project uses Express 4 with custom error handler"
docaware memory stats
docaware memory sync   # sync with context-hub annotations
docaware memory clear
```

## Configuration

Create a `.docaware.yml` in your project root (optional):

```yaml
# LLM provider config (auto-detected from env vars if omitted)
llm:
  provider: claude      # claude, openai, gemini, ollama
  model: claude-sonnet-4-5-20250929  # or gpt-4o, gemini-2.0-flash, llama3.1
  max_tokens: 4096

review:
  severity_threshold: low    # low, medium, high, critical
  languages:
    - js
    - ts
    - py

memory:
  storage_dir: .docaware/memory
  embedding_model: local     # local (all-MiniLM-L6-v2) or hash (fallback)

docs:
  sources:
    - chub        # context-hub (curated docs)
    - npm         # npm registry metadata
    - github      # GitHub changelogs
    - local       # project-local docs
```

## How It Works

```
Project Directory
    |
    v
Dependency Detection (package.json / requirements.txt)
    |
    v
Documentation Retrieval (chub -> npm -> GitHub -> local)
    |
    v
AST Code Scanning (acorn for JS/TS, ast module for Python)
    |
    v
Memory Recall (vector similarity search on prior findings)
    |
    v
LLM Review (Claude + docs + memory context)
    |
    v
Post-Processing (dedup, filter, hallucination check)
    |
    v
Report (terminal / JSON / markdown)
```

### Documentation Retrieval

DocAware fetches version-specific API docs through a multi-source fallback chain:

1. **context-hub** — Curated, AI-optimized API documentation
2. **npm registry** — Package metadata and README
3. **GitHub** — CHANGELOG.md and release notes
4. **Local** — Project-local migration guides

Retrieved docs are split into sections, API names are extracted, and breaking changes are identified through diff analysis.

### AST-Based Scanning

Rather than sending entire files to the LLM, DocAware uses AST parsing to extract only relevant code:

- **JavaScript/TypeScript**: Acorn parser extracts call expressions, member access, imports, and `new` expressions
- **Python**: Built-in `ast` module via subprocess extracts function calls, imports, and attribute access

### Agent Memory

The memory layer uses local embeddings (all-MiniLM-L6-v2, 384 dimensions) with cosine similarity search. Entry types:

- `review_finding` — Issues found in prior reviews
- `migration_decision` — Upgrade paths previously taken
- `pattern` — Recurring code patterns
- `annotation` — Developer-provided context

## Benchmarks

DocAware includes a research benchmark suite for evaluating documentation-augmented code review.

### Running Benchmarks

```bash
# Run all benchmarks (requires ANTHROPIC_API_KEY)
npm run bench

# Run specific fixture
npm run bench -- --fixture openai-v3-project

# Run specific conditions
npm run bench -- --condition A,C,D

# Analyze results
npm run bench:analyze
```

### Experimental Conditions

| Condition | Description |
|-----------|-------------|
| A | Baseline LLM (no docs, no memory) |
| B | LLM + raw docs (naive RAG) |
| C | LLM + structured doc retrieval (DocAware) |
| D | LLM + structured docs + memory (full pipeline) |

### Results (5 libraries, 9 experiments)

| Metric | A: Baseline | B: Raw Docs | C: Structured | D: Full |
|--------|-------------|-------------|----------------|---------|
| Precision | 67.3% | 78.1% | 80.5% | **80.9%** |
| Recall | 76.4% | 98.4% | **98.6%** | **98.6%** |
| F1 Score | 70.9% | 84.8% | 86.5% | **86.8%** |

**22.4% F1 improvement** from baseline to full pipeline across OpenAI, Express, Stripe, Mongoose, and Axios migration scenarios.

### Benchmark Fixtures

| Fixture | Library | Migration | Ground Truth Issues |
|---------|---------|-----------|---------------------|
| openai-v3-project | OpenAI SDK | v3 → v4 | 8 |
| express-v4-project | Express | v4 → v5 | 5 + 1 decoy |
| stripe-v2-project | Stripe | Best practices | 4 + 1 decoy |
| mongoose-v6-project | Mongoose | v6 → v7 | 8 + 2 decoys |
| axios-v0-project | Axios | v0 → v1 | 6 + 2 decoys |

## Development

```bash
git clone https://github.com/pallavi-chandrashekar/docaware-ai.git
cd docaware-ai
npm install

# Run tests
npm test

# Watch mode
npm run test:watch

# Run benchmarks
export ANTHROPIC_API_KEY=your-key
npm run bench
npm run bench:analyze
```

### Project Structure

```
docaware-ai/
├── bin/docaware.js          # CLI entry point
├── lib/
│   ├── core/                # Config, logging
│   ├── docs/                # Doc retrieval (chub, npm, GitHub)
│   ├── analysis/            # AST scanning, diff engine, dep detection
│   ├── llm/                 # Multi-LLM support (Claude, OpenAI, Gemini, Ollama)
│   ├── review/              # Code review orchestration
│   ├── migrate/             # Migration orchestration
│   ├── memory/              # Vector store, embeddings, schemas
│   ├── output/              # Terminal, JSON, markdown formatters
│   ├── cli/                 # Command handlers
│   └── benchmark/           # Experiment runner, analysis, hallucination detection
├── test/                    # 62 tests across 10 files
├── bench/fixtures/          # 5 benchmark fixtures with ground truth
└── paper/                   # Research paper (LaTeX)
```

## Research Paper

This project includes a research paper: *"DocAware: Documentation-Augmented AI Agents for Reliable Code Review and API Migration"*

The paper and LaTeX source are in the `paper/` directory. Generate the benchmark LaTeX table:

```bash
npm run bench:latex
```

## License

MIT
