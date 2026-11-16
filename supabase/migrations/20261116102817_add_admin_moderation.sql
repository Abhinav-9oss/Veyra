/*
# Add admin role to profiles + admin moderation functions

## Overview
Adds a `role` column to profiles supporting 'member' and 'admin' roles.
Introduces SECURITY DEFINER functions that let admins moderate all
conversations and messages, including private/group chats.

## Changes

### profiles
- New column `role text NOT NULL DEFAULT 'member'` with CHECK in ('member','admin').
- Revoke all UPDATE on profiles from authenticated, then re-grant only
  user-editable columns (display_name, username, bio, avatar_url,
  header_url, location, website, is_private). The `role` column is
  server-controlled.

### Admin functions (SECURITY DEFINER, search_path pinned)
1. `is_admin()` — helper returning whether the caller has role = 'admin'.
2. `admin_list_conversations()` — returns all conversations with participants.
3. `admin_get_messages(p_conversation uuid)` — returns messages for a conversation.
4. `admin_update_message(p_message uuid, p_content text)` — edit a message's content.
5. `admin_delete_message(p_message uuid)` — delete a message.
6. `admin_delete_conversation(p_conversation uuid)` — delete a conversation.

All admin functions authorize the caller via `auth.uid()` + role check.
EXECUTE revoked from anon; granted to authenticated.

### Notes
- Role assignment itself is not exposed as an RPC. The first admin is
  bootstrapped by setting role='admin' on a chosen profile via execute_sql.
- Admin moderation bypasses RLS by design (SECURITY DEFINER runs as owner).
*/

-- ============================================================================
-- profiles.role column
-- ============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member'
  CHECK (role IN ('member','admin'));

-- Revoke table-wide UPDATE, re-grant only user-editable columns.
-- The `role` column is now server-controlled.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, username, bio, avatar_url, header_url, location, website, is_private)
  ON public.profiles TO authenticated;

-- Ensure SELECT still includes role (needed to know who is admin)
-- (SELECT grant already exists on the table; column-level not required for SELECT.)

-- ============================================================================
-- is_admin helper
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================================
-- admin_list_conversations
-- Returns all conversations with a comma-separated participant list and counts.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_conversations()
RETURNS TABLE (
  id uuid,
  is_group boolean,
  is_ai boolean,
  name text,
  created_by uuid,
  created_at timestamptz,
  participant_count bigint,
  message_count bigint,
  participants text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.is_group,
    c.is_ai,
    c.name,
    c.created_by,
    c.created_at,
    COALESCE(pc.cnt, 0),
    COALESCE(mc.cnt, 0),
    COALESCE(pnames.names, '')
  FROM public.conversations c
  LEFT JOIN (SELECT conversation_id, count(*) cnt FROM public.conversation_participants GROUP BY conversation_id) pc
    ON pc.conversation_id = c.id
  LEFT JOIN (SELECT conversation_id, count(*) cnt FROM public.messages GROUP BY conversation_id) mc
    ON mc.conversation_id = c.id
  LEFT JOIN LATERAL (
    SELECT string_agg(p.display_name || ' (@' || p.username || ')', ', ') AS names
    FROM public.conversation_participants cp
    JOIN public.profiles p ON p.id = cp.user_id
    WHERE cp.conversation_id = c.id
  ) pnames ON true
  ORDER BY c.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_conversations() TO authenticated;

-- ============================================================================
-- admin_get_messages
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_get_messages(p_conversation uuid)
RETURNS TABLE (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  sender_name text,
  sender_username text,
  sender_avatar text,
  content text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.conversation_id,
    m.sender_id,
    p.display_name,
    p.username,
    p.avatar_url,
    m.content,
    m.created_at
  FROM public.messages m
  LEFT JOIN public.profiles p ON p.id = m.sender_id
  WHERE m.conversation_id = p_conversation
  ORDER BY m.created_at ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_messages(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_messages(uuid) TO authenticated;

-- ============================================================================
-- admin_update_message
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_update_message(p_message uuid, p_content text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_content IS NULL OR trim(p_content) = '' THEN
    RAISE EXCEPTION 'Content cannot be empty';
  END IF;

  UPDATE public.messages
    SET content = trim(p_content)
    WHERE id = p_message;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_message(uuid, text) TO authenticated;

-- ============================================================================
-- admin_delete_message
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_delete_message(p_message uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.messages WHERE id = p_message;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_message(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_message(uuid) TO authenticated;

-- ============================================================================
-- admin_delete_conversation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_delete_conversation(p_conversation uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.conversations WHERE id = p_conversation;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_conversation(uuid) TO authenticated;
