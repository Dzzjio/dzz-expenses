-- Categories flagged here (e.g. personal stuff) are left out of the Excel export.
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS exclude_from_export boolean NOT NULL DEFAULT false;
