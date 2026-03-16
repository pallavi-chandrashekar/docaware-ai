# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-16

### Added

- **AI Code Review** (`docaware review`)
  - AST-based code scanning for JavaScript, TypeScript, and Python
  - Dependency detection from package.json and requirements.txt
  - Multi-source documentation retrieval (context-hub, npm, GitHub, local)
  - Structured doc processing with section splitting and API extraction
  - Claude-powered review with tool-use for structured JSON output
  - Batched file processing (max 10 files / 50K chars per batch)
  - Finding deduplication via SHA-256 hashing
  - Severity filtering (low, medium, high, critical)
  - Output formats: terminal (colored), JSON, markdown

- **Migration Helper** (`docaware migrate`)
  - Library version diff analysis with Dice coefficient fuzzy matching
  - Breaking change detection from changelogs
  - LLM-generated migration plans with step-by-step instructions
  - `--no-llm` mode for doc-diff-only analysis

- **Agent Memory** (`docaware memory`)
  - Persistent vector-indexed memory store (JSON-backed)
  - Local embeddings via all-MiniLM-L6-v2 (384 dimensions)
  - Hash-based embedding fallback for environments without GPU
  - Cosine similarity semantic search
  - Entry types: review_finding, migration_decision, pattern, annotation, custom
  - Bidirectional sync with context-hub annotations

- **Benchmark Suite**
  - A/B/C/D ablation study framework
  - 5 benchmark fixtures: OpenAI v3→v4, Express v4→v5, Stripe best practices, Mongoose v6→v7, Axios v0→v1
  - Ground truth evaluation with fuzzy matching (3-line tolerance, API suffix matching)
  - Hallucination detection via doc-grounding analysis
  - LaTeX table generation for research papers
  - Structured event logging (JSONL)

- **Core Infrastructure**
  - YAML configuration with `.docaware.yml`
  - CLI with subcommands via `node:util` parseArgs
  - Claude API client with exponential backoff retry
  - Prompt templates with tool-use schema definitions
  - Colored terminal logging with verbose mode
  - GitHub Actions CI (Node 18/20/22)
  - Conventional commits with commitlint + husky

- **Research Paper**
  - LaTeX source (`paper/main.tex`) in ACM sigconf format
  - 17 references (`paper/references.bib`)
  - Benchmark results: 22.4% F1 improvement from baseline to full pipeline

[1.0.0]: https://github.com/pallavi-chandrashekar/docaware-ai/releases/tag/v1.0.0
