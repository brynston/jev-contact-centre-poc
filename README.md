# Jev Contact Centre POC

A small evaluation workbench for TypeSafe Jev. It ships with **100 synthetic, labelled contact-centre interactions**, an official Jev SDK adapter, an optional conventional LLM comparator, evaluation metrics, tests, and a local browser UI.

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
- Optional: an OpenAI-compatible API key for the LLM comparator

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

- browse all 100 labelled interactions
- edit the interaction text before running it
- run Jev
- optionally run the conventional LLM comparator
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

Results are written to `results/` as detailed JSONL plus a summary JSON. The evaluator reports:

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

The comparator intentionally uses a generic OpenAI-compatible `/chat/completions` endpoint so you can point it at many providers.

```bash
LLM_API_KEY=...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-5-mini
LLM_INPUT_COST_PER_MILLION=0
LLM_OUTPUT_COST_PER_MILLION=0
```

Set the two cost values for the model you choose if you want meaningful cost comparison numbers.

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

The 100 cases cover billing, technical support, cancellations/retention, fraud/security, account access, complaints, refunds, product information and general service. Twenty cases are technical to increase variation across outages, integrations, API failures and lower-severity product bugs.

The labels are synthetic ground truth, not claims about a real organisation's operating policy. Change both the question criteria and labels to reflect your own routing/escalation policy before treating the evaluation as production evidence.

## Useful experiment sequence

1. Run the untouched 100-case benchmark.
2. Review disagreements, especially borderline billing-vs-refund and access-vs-security cases.
3. Change only the Jev question criteria and rerun. No model retraining is required.
4. Add a conventional LLM comparator and compare accuracy, calibration, latency and cost.
5. Add 20–50 deliberately ambiguous cases and define confidence thresholds for human review.
6. Replace synthetic interactions with de-identified real examples when you want a meaningful production-readiness test.

## Tests

```bash
npm test
```

Tests cover metric calculations and validation of the comparator's structured decision schema.
