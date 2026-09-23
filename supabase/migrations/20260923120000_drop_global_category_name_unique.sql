-- The original schema made categories.name globally unique. Per-user uniqueness
-- (user_id, name) replaced it, but the global constraint was never dropped, so
-- seeding default categories for any user after the first fails and aborts signup.
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_name_key;
