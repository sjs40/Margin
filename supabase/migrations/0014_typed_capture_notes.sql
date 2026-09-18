-- Capture notes of any length are ordinary typed notes, not a longform source.
-- documents.document_type = 'longform' is unchanged (Import only).

update public.notes
set source_type = 'typed'
where source_type = 'longform';
