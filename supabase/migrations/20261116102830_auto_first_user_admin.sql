/*
# Auto-admin: first user becomes admin

Adds a trigger that promotes the first profile ever created to role='admin'.
Subsequent users get the default 'member' role. This bootstraps admin access
without manual SQL, since the app requires sign-in and the owner should be admin.
*/

CREATE OR REPLACE FUNCTION public.assign_first_user_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  user_count integer;
BEGIN
  SELECT count(*) INTO user_count FROM public.profiles;
  IF user_count = 0 THEN
    NEW.role := 'admin';
  ELSE
    NEW.role := COALESCE(NEW.role, 'member');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_first_user_admin() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS profiles_assign_admin ON public.profiles;
CREATE TRIGGER profiles_assign_admin
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.assign_first_user_admin();
