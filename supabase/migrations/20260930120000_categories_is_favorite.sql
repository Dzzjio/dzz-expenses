-- Lets users pin categories as quick-pick buttons in the add-expense dialog.
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;
