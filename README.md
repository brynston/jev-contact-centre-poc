# Jev Contact Centre POC

A small evaluation workbench for TypeSafe Jev. It ships with **1,000 synthetic, labelled contact-centre interactions**, an official Jev SDK adapter, an optional conventional LLM comparator, evaluation metrics, tests, and a local browser UI.

## What this tests

Each interaction is sent as state and evaluated on six decisions in one System One request:

- routing team
- urgency
- churn risk
- fraud/security risk
- whether human escalation is required
- customer value tier

Ground-truth labels are included so you can measure classification accuracy and probability calibration rather than relying on demos that merely look plausible.

## Requirements

- Node.js 20+
- A TypeSafe API key for live Jev calls
- Optional: an OpenAI / OpenAI-compatible key, or an OpenRouter key for the LLM comparator

The project uses the official `@typesafe-ai/sdk` package and defaults to `jev-latest`.

## Setup

```bash
cp .env.example .env
npm install
```

Add your key to `.env`:

```bash
TYPESAFE_API_KEY=your_key_here
TYPESAFE_MODEL=jev-latest
```

Do **not** put the key in frontend code. The local Express server owns the SDK call, so the browser never receives the API key.

## Run the UI

```bash
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The UI lets you:

- browse all 1,000 labelled interactions
- edit the interaction text before running it
- run Jev
- toggle the conventional comparator between **Direct APIs** and **OpenRouter**
- choose a suggested model or type a custom model ID, then run the comparator
- inspect probabilities, latency, tokens and estimated cost side-by-side

## Run the full evaluation

Jev only:

```bash
npm run evaluate:jev
```

LLM comparator only:

```bash
npm run evaluate:llm
```

Both configured providers:

```bash
npm run evaluate
```

The evaluator runs all 1,000 records in `data/interactions.json`. Results are written to `results/` as detailed JSONL plus a summary JSON: `jev-*`, `llm-direct-*`, and `llm-openrouter-*`. A rerun overwrites the previous run for that mode, while preserving the other mode. Comparator rows and summaries record the mode and requested model. The evaluator reports:

- accuracy for route, urgency, churn, fraud, customer value and escalation
- binary F1 for human escalation
- multiclass Brier scores for the probabilistic decisions
- binary Brier score for human escalation
- p50 / p95 latency
- token usage
- approximate cost
- failed/invalid output rate

Default evaluation concurrency is 5. Override it if needed:

```bash
CONCURRENCY=10 npm run evaluate:jev
```

## LLM comparator

The comparator supports two independent server-side paths using Chat Completions:

- **Direct APIs** (the default): OpenAI, or another OpenAI-compatible endpoint configured in `LLM_BASE_URL`.
- **OpenRouter**: its own key and endpoint, with provider-prefixed model IDs. See the [OpenRouter quickstart](https://openrouter.ai/docs/quickstart) and [model catalog](https://openrouter.ai/models).

In your repository-root `.env`, configure either or both:

```dotenv
LLM_PROVIDER_MODE=direct

# Direct APIs: existing LLM_* settings remain supported.
LLM_API_KEY=your_direct_key
# Alternatively set OPENAI_API_KEY; LLM_API_KEY takes precedence if both are set.
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-5-mini
LLM_MODELS=gpt-5-mini,gpt-4.1-mini

OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-5-mini
OPENROUTER_MODELS=openai/gpt-5-mini,openai/gpt-4.1-mini

LLM_INPUT_COST_PER_MILLION=0
LLM_OUTPUT_COST_PER_MILLION=0
OPENROUTER_INPUT_COST_PER_MILLION=0
OPENROUTER_OUTPUT_COST_PER_MILLION=0
```

`LLM_PROVIDER_MODE` sets the initial UI selection and the evaluator default. Both modes can be configured at once; switching the UI does not change Jev. `LLM_MODEL` and `OPENROUTER_MODEL` set separate defaults. Optional comma-separated `*_MODELS` lists provide suggestions; the model field also accepts a custom ID. Availability depends on your provider/account. Changing the mode or model clears the previous comparator result. Controls are locked while a request is running.

Restart `npm run dev` after changing `.env`. The selected comparator shows whether its server-side key is configured; the run button is disabled without that key. Only the mode and model ID travel from the browser. Keys and base URLs stay on the server, and health responses contain only readiness flags and model suggestions. Never use `VITE_*` variables for credentials. `.env` is ignored by Git.

No forced `temperature` or other model-specific sampling parameters are sent. Parameter support varies by model; see the [OpenAI Chat Completions reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create). Outputs must pass the existing decision schema; invalid JSON, missing content and API failures count as evaluation failures. Ground-truth labels are kept out of the comparator prompt.

Evaluation examples (both modes use the same `PROVIDERS=llm` comparator):

```bash
# Explicit CLI selection; flags override LLM_PROVIDER_MODE and the default model.
npm run evaluate:llm -- --llm-mode direct --llm-model gpt-5-mini
npm run evaluate:llm -- --llm-mode openrouter --llm-model openai/gpt-5-mini

# Environment selection, with Jev included if configured.
LLM_PROVIDER_MODE=openrouter npm run evaluate
```

A missing key skips only the selected provider; it never falls back to a different mode. Invalid mode names, provider names, CLI options or concurrency fail immediately. Each live full evaluation sends 1,000 requests per selected provider.

The API remains compatible with existing `POST /api/run/llm` callers that send an interaction as the JSON body. To override the server defaults, use `POST /api/run/llm?mode=openrouter&model=openai%2Fgpt-5-mini`. Jev continues to use `POST /api/run/jev`.

Set the cost rates separately for each mode and update them when you change models. These are rough user-supplied estimates per million tokens, not billed costs; zero means no cost estimate has been configured.

## Jev pricing assumption

The current public TypeSafe launch price used by this POC is **US$0.042 per million input tokens**, with output tokens free. The value is configurable rather than hard-coded into the analysis:

```bash
TYPESAFE_INPUT_COST_PER_MILLION=0.042
```

Update this environment variable if TypeSafe pricing changes.

## Dataset

- `data/interactions.json` — human-readable array
- `data/interactions.jsonl` — one case per line
- `scripts/generate-data.ts` — deterministic regeneration script
- `scripts/challenge-scenarios.ts` — 90 authored challenge narratives and their labels

The 1,000 cases cover billing, technical support, cancellations/retention, fraud/security, account access, complaints, refunds, product information and general service. There are 120 technical cases and 110 for each other routing team, across chat, email and call-transcript text.

- **CC-001–CC-100:** the original 100 short cases, preserved unchanged for baseline comparisons.
- **CC-101–CC-1000:** 900 longer cases generated from 90 new narratives, with ten deterministic variants of each. They include multi-turn conversations, resolved issues in forwarded history, misleading subjects, competing issues, negation, changing context and differing time sensitivity. Some include an extended handover note.

Variants change account metadata, amounts, timing/context wording and conversation format. They share underlying scenario narratives, so these are not 900 independent customer situations. Keep variants from the same narrative together if making train/test splits; otherwise near-duplicate cases can leak across the split. Ground-truth routing follows the current unresolved request, rather than resolved historical topics. Other labels are authored for that request; customer value follows the generator's spend/tenure rules.

Regenerate both dataset formats with `npm run generate`. This overwrites dataset edits. The larger and longer benchmark will use more API tokens and may take longer than the original 100-case run.

The labels are synthetic ground truth, not claims about a real organisation's operating policy. Change both the question criteria and labels to reflect your own routing/escalation policy before treating the evaluation as production evidence.

## Useful experiment sequence

1. Run the 1,000-case benchmark and compare the original first 100 cases with the 900 added cases using the detailed results.
2. Review disagreements, especially borderline billing-vs-refund and access-vs-security cases.
3. Change only the Jev question criteria and rerun. No model retraining is required.
4. Add a conventional LLM comparator and compare accuracy, calibration, latency and cost.
5. Add 20–50 deliberately ambiguous cases and define confidence thresholds for human review.
6. Replace synthetic interactions with de-identified real examples when you want a meaningful production-readiness test.

## Tests

```bash
npm test
```

Tests cover dataset integrity, metrics, decision validation, provider selection, credential isolation, API routing, and evaluation output. Provider/API tests use mocks and offline fixtures, so no live keys or credits are needed.

Run `npm run build` for TypeScript checks and the production frontend build.
