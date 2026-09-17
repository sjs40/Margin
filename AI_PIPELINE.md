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
  pipeline/knowledge.ts    conservative insight/framework persistence
  pipeline/memory.ts       daily / company / theme / nightly / grounded discovery
  pipeline/search.ts       hybrid retrieval + Ask Margin
  pipeline/backfill.ts     bounded knowledge backfill (admin dry-run, then batches)
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

Prompt versions (`parse-note-v4`, `parse-ai-import-v2`, `company-memory-v3`, `daily-synthesis-v3`, `claim-conflicts-v1`, `discover-connections-v2`, `knowledge-disposition-v1`, `ask-margin-v2`) are stored on `ai_jobs`.

## Retrieval for memory updates

Company/theme updates send:

- current meta note (including user edits)
- recent linked notes (configurable, default 20)
- change summaries via `meta_note_versions`
- prior active claims (company-memory-v3)
- user annotations on those notes (`User annotation (date): text`)
- resolved questions with comments

Not the entire history.

After a note is parsed, `updateCompanyMeta` also runs `detectClaimConflicts` (`claim-conflicts-v1`) against up to N prior active claims for that company. Relations at or above the user's confidence floor are stored on `claim_relations`. `contradicts` relations create an Inbox item. Prior claim status does not change until the user confirms. If contradiction detection is off in `user_settings`, this operation is skipped and does not consume a hosted action.

High-confidence durable insights/frameworks are classified against existing knowledge and stored as **proposed** objects with provenance. Exact duplicates are linked, not multiplied. Meaningful merges require confirmation. `discoverAndInbox()` persists grounded connections as proposed `knowledge_relationships` and grounded loose ends as questions; ungrounded model output is logged, not dumped into Inbox.

Copy Context builds a deterministic core from explicit relationships, then a bounded retrieved layer via hybrid search. It does not spend a hosted AI action to concatenate that core.

Knowledge backfill is an admin dry-run plus batched execute. It is never run by migration or deploy. Each batch consumes hosted/BYOK policy like any other user job.

Adding or editing a note annotation re-embeds the note (`raw_text` + annotations) via `after()`. Annotations are not re-parsed for claims.

After entities are linked, the pipeline stamps `note_entities` with a capture-time quote (Yahoo, then Stooq). This is not an AI call. Failure leaves the note ready with no price.

## Hybrid search

Lexical + ticker/entity match + vector similarity + recency. Ticker-shaped queries (including `$NVTS`) overweight exact entity matches. Ask Margin (`ask-margin-v2`) synthesizes only from retrieved user memory and cites sources inline with `[[n]]`. Invalid citation numbers are stripped.

Theme merge sets `meta_notes.needs_refresh`. Nightly intelligence and Today refresh regenerate flagged company/theme/daily memory and clear the flag.

## Cost

Token usage and estimated cost are recorded on `ai_jobs`. Notes are not re-parsed when the pipeline is skipped for unchanged processing. Diagnostics live at `/dev/ai` in development only.
