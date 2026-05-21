-- Run this ONCE in your Supabase dashboard → SQL Editor.
-- Creates the `delete_my_account` RPC the app calls when a user taps
-- "Delete my account" in Settings.
--
-- Required by Apple App Store Review Guideline 5.1.1(v): any app with user
-- accounts must offer in-app account deletion.
--
-- The function runs with SECURITY DEFINER (owner privileges) so it can
-- delete from `auth.users`, which RLS would otherwise block.

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;

  -- Delete any rows owned OR participated in by this user.
  DELETE FROM public.friend_pairings
    WHERE user_id = v_uid OR friend_user_id = v_uid;

  -- Other tables that might hold user data. Wrap each in EXCEPTION block
  -- so a missing table doesn't fail the whole deletion.
  BEGIN
    DELETE FROM public.profiles WHERE user_id = v_uid;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DELETE FROM public.block_settings WHERE user_id = v_uid;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Finally remove the auth.users row. After this the client's JWT is invalid
  -- and any subsequent calls fail with 401, which is the desired outcome.
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

-- Lock down: only an authenticated user can call this, and they can only
-- delete themselves (the function uses auth.uid() internally).
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- Smoke test (run this AFTER creating the function above; it'll just error
-- because there's no auth.uid() in the SQL editor context, but a successful
-- ERROR proves the function was installed):
--   SELECT public.delete_my_account();
