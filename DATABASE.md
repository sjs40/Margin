# Database

Postgres on Supabase. UUID primary keys. `user_id` on user-owned rows even though V0.1 is single-user.

## Tables

| Table | Role |
| --- | --- |
| `users` | Mirror of `auth.users` |
| `notes` | Captures. `original_raw_text` is immutable after insert; `raw_text` may be edited |
| `source_assets` | Handwritten images (and future audio/attachments) |
| `documents` | Long-form and AI imports |
| `entities` | Shared companies/people/industries |
| `note_entities` / `document_entities` | Relationships |
| `themes` | User-specific themes |
| `note_themes` / `document_themes` | Relationships |
| `claims` | Extracted claims with type + confidence |
| `questions` | Open / resolved / dismissed |
| `followups` | Lightweight follow-ups, not a task app |
| `meta_notes` | Daily, company, and theme memory |
| `meta_note_versions` | Historical evolution |
| `ai_jobs` | Processing ledger |
| `embeddings` | pgvector retrieval records |
| `inbox_items` | Ambiguity, failures, suggested themes |
| `note_links` | URLs pasted into a note, plus fetched title/excerpt |

## Notes extras

Handwriting stores `literal_transcription` and `uncertain_segments` on `notes` so the original page, literal text, and interpretation remain distinct.

## RLS

Owner policies use `user_id = auth.uid()` (or a join to the owning note/document). `entities` are readable by authenticated users. Storage bucket `source-assets` is private; objects live under `{user_id}/...`.

## Retrieval RPC

`match_embeddings(query_embedding, match_user_id, match_count)` returns cosine similarity for hybrid search.

## Idempotency

Daily meta notes are unique on `(user_id, date)`. Company and theme meta notes are unique on `(user_id, entity_id)` and `(user_id, theme_id)`. Re-running synthesis updates the current row and appends a version; it does not duplicate the living page.
