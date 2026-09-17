# Database

Postgres on Supabase. UUID primary keys. `user_id` on user-owned rows.

## Tables

| Table | Role |
| --- | --- |
| `users` | Mirror of `auth.users` |
| `user_ai_keys` | Encrypted per-user Gemini keys (service-role only) |
| `app_settings` | Hosted-AI flag and daily limit |
| `ai_daily_usage` | Hosted trial action counts per user per UTC day |
| `notes` | Captures. `original_raw_text` is immutable after insert; `raw_text` may be edited |
| `source_assets` | Handwritten images (and future audio/attachments) |
| `documents` | Long-form and AI imports |
| `entities` | Shared companies/people/industries. Companies include `cik`, `source` (`sec` \| `user`), `aliases`, `last_synced_at`. Unique on `upper(ticker)` for companies. |
| `note_entities` / `document_entities` | Relationships. `note_entities` also stores `price_at_capture`, `price_currency`, `price_as_of`, `price_provider` |
| `themes` | User-specific themes. `aliases` holds merged names; `merged_into_theme_id` points at the surviving theme after a merge. Archived merged themes redirect. |
| `note_themes` / `document_themes` | Relationships |
| `claims` | Extracted claims with type + confidence + `status` (`active`, `superseded`, `contradicted`, `retracted`) |
| `claim_relations` | AI/user links between claims (`contradicts`, `supersedes`, `supports`) with confirmation state |
| `user_settings` | Per-user pipeline knobs (contradiction detection). Missing row means defaults. |
| `questions` | Open / deferred / resolved / dismissed, with `resolution_comment`, `resolved_by_note_id`, `entity_id`, `theme_id`, `source`. Deferred items live in Inbox. |
| `followups` | Lightweight follow-ups: open / deferred / completed / dismissed, with the same resolution fields as questions |
| `meta_notes` | Daily, company, and theme memory. `user_edited` is set when the owner saves the page. `needs_refresh` is set by theme merge and cleared when synthesis runs. |
| `meta_note_versions` | Historical evolution, including user edits |
| `note_annotations` | Nested comments on a note (not parsed as new notes) |
| `ai_jobs` | Processing ledger |
| `embeddings` | pgvector retrieval records |
| `inbox_items` | Ambiguity, failures, suggested themes, and deferred Loose Ends (`category = loose_end`) |
| `note_links` | URLs pasted into a note, plus fetched title/excerpt |

## Notes extras

Handwriting stores `literal_transcription` and `uncertain_segments` on `notes` so the original page, literal text, and interpretation remain distinct.

## RLS

Owner policies use `user_id = auth.uid()` (or a join to the owning note/document). `entities` are readable by authenticated users. `user_ai_keys` has RLS enabled with no authenticated policies, so only the service role can read encrypted keys. Storage bucket `source-assets` is private; objects live under `{user_id}/...`.

## Retrieval RPC

`match_embeddings(query_embedding, match_user_id, match_count)` returns cosine similarity for hybrid search.

Company lookup RPCs (authenticated + service role): `lookup_company(q)`, `search_companies(q, lim)`, `search_companies_by_name(q)`.

Theme merge RPC (authenticated + service role): `merge_themes(source, target, owner)` repoints notes/claims/questions/followups, appends the source name to target aliases, archives the source, and flags the surviving meta note for refresh. Parameter names are copied to locals so they do not collide with `questions.source` / `followups.source`.

## Idempotency

Daily meta notes are unique on `(user_id, date)`. Company and theme meta notes are unique on `(user_id, entity_id)` and `(user_id, theme_id)`. Re-running synthesis updates the current row and appends a version; it does not duplicate the living page.
