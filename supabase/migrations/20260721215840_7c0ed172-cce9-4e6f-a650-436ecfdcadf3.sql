
-- Clear existing rows (no user context) and old policies
DELETE FROM public.expenses;
DELETE FROM public.categories;
DROP POLICY IF EXISTS "Anyone can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Anyone can manage expenses" ON public.expenses;

-- Add user_id ownership
ALTER TABLE public.categories ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.expenses  ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.categories ADD CONSTRAINT categories_user_name_unique UNIQUE (user_id, name);
CREATE INDEX IF NOT EXISTS categories_user_idx ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS expenses_user_idx  ON public.expenses(user_id);

-- Lock down: authenticated-only
REVOKE ALL ON public.categories FROM anon;
REVOKE ALL ON public.expenses   FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses   TO authenticated;
GRANT ALL ON public.categories TO service_role;
GRANT ALL ON public.expenses   TO service_role;

-- RLS: users can only see and manage their own rows
CREATE POLICY "Users manage own categories"
  ON public.categories FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own expenses"
  ON public.expenses FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Auto-set user_id from the authenticated session on insert,
-- so clients never need to (and cannot spoof) it.
CREATE OR REPLACE FUNCTION public.set_user_id_from_auth()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER categories_set_user_id
  BEFORE INSERT ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_from_auth();

CREATE TRIGGER expenses_set_user_id
  BEFORE INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_from_auth();
