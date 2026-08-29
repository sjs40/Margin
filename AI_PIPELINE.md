# AI Pipeline

Application code calls `ai.*` operations. It does not import the Gemini SDK.

```
src/ai
  providers/gemini.ts      Google Gemini via @google/genai
  providers/openrouter.ts  stub for later
  operations/index.ts      parseNote, interpretHandwriting, ...
  prompts/index.ts         versioned prompts
  schemas/                 Zod structured output
  pipeline/process.ts      note / handwriting / import
  pipeline/memory.ts       daily / company / theme / nightly
  pipeline/search.ts       hybrid retrieval + Ask Margin
```

## Models

All IDs come from env (`src/lib/env.ts`):

| Role | Default |
| --- | --- |
| Fast / structured | `AI_FAST_MODEL=gemini-3.7-flash` |
| Vision | `AI_VISION_MODEL=gemini-3.7-flash` |
| Synthesis | `AI_SYNTHESIS_MODEL=gemini-3.7-flash` |
| Discovery | `AI_DEEP_MODEL=gemini-3.7-flash` |
| Embeddings | `AI_EMBEDDING_MODEL=gemini-embedding-2` at 1536 dimensions |

Fast tasks request low thinking. Synthesis/discovery request medium thinking.

## Structured output

Mechanical operations use Zod schemas. Invalid output is retried once with repair instructions. A second failure marks the job failed, preserves the note, and surfaces Inbox.

Prompt versions (`parse-note-v1`, `daily-synthesis-v1`, and so on) are stored on `ai_jobs`.

## Retrieval for memory updates

Company/theme updates send:

- current meta note (including user edits)
- recent linked notes (configurable, default 20)
- change summaries via `meta_note_versions`

Not the entire history.

## Hybrid search

Lexical + ticker/entity match + vector similarity + recency. Ticker-shaped queries overweight exact entity matches. Ask Margin synthesizes only from retrieved user memory and returns source ids.

## Cost

Token usage and estimated cost are recorded on `ai_jobs`. Notes are not re-parsed when the pipeline is skipped for unchanged processing. Diagnostics live at `/dev/ai` in development only.
