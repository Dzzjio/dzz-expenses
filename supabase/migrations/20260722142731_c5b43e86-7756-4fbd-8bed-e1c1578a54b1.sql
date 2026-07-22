
-- Update set_user_id_from_auth to only set if NULL (so seed function with explicit user_id works)
CREATE OR REPLACE FUNCTION public.set_user_id_from_auth()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- main_categories
CREATE TABLE public.main_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#1f2937',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.main_categories TO authenticated;
GRANT ALL ON public.main_categories TO service_role;
ALTER TABLE public.main_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own main_categories" ON public.main_categories
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_user_id_main_categories
  BEFORE INSERT ON public.main_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_from_auth();

-- categories: add main_category_id + unique(user_id,name)
ALTER TABLE public.categories
  ADD COLUMN main_category_id uuid REFERENCES public.main_categories(id) ON DELETE RESTRICT;

DO $$
DECLARE u uuid; mc_id uuid;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM public.categories WHERE main_category_id IS NULL LOOP
    INSERT INTO public.main_categories (user_id, name, color)
      VALUES (u, 'Other', '#1f2937')
      ON CONFLICT (user_id, name) DO UPDATE SET color = EXCLUDED.color
      RETURNING id INTO mc_id;
    UPDATE public.categories SET main_category_id = mc_id WHERE user_id = u AND main_category_id IS NULL;
  END LOOP;
END $$;

ALTER TABLE public.categories ALTER COLUMN main_category_id SET NOT NULL;
ALTER TABLE public.categories ADD CONSTRAINT categories_user_id_name_unique UNIQUE (user_id, name);

CREATE TRIGGER set_user_id_categories
  BEFORE INSERT ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_from_auth();
CREATE TRIGGER set_user_id_expenses
  BEFORE INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_from_auth();

-- Seed defaults for new users
CREATE OR REPLACE FUNCTION public.seed_user_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  essentials_id uuid;
  lifestyle_id uuid;
  other_id uuid;
BEGIN
  INSERT INTO public.main_categories(user_id, name, color) VALUES (NEW.id, 'Essentials', '#0f172a') RETURNING id INTO essentials_id;
  INSERT INTO public.main_categories(user_id, name, color) VALUES (NEW.id, 'Lifestyle', '#7c2d12') RETURNING id INTO lifestyle_id;
  INSERT INTO public.main_categories(user_id, name, color) VALUES (NEW.id, 'Other', '#3f3f46') RETURNING id INTO other_id;

  INSERT INTO public.categories(user_id, main_category_id, name, color) VALUES
    (NEW.id, essentials_id, 'Groceries', '#22c55e'),
    (NEW.id, essentials_id, 'House Utilities', '#0ea5e9'),
    (NEW.id, essentials_id, 'Transport', '#3b82f6'),
    (NEW.id, lifestyle_id, 'Eating Out', '#f97316'),
    (NEW.id, lifestyle_id, 'Going Out', '#a855f7'),
    (NEW.id, other_id, 'Other', '#6366f1');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_seed ON auth.users;
CREATE TRIGGER on_auth_user_created_seed
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.seed_user_defaults();
