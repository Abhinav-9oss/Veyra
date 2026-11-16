/*
# Veyra Schema — RLS Policies & Grants

Adds grants and row-level security policies to all Veyra tables.
App requires sign-in, so all policies target `authenticated`.
*/

-- PROFILES
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- FOLLOWS
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
DROP POLICY IF EXISTS "follows_select" ON public.follows;
CREATE POLICY "follows_select" ON public.follows FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;
CREATE POLICY "follows_insert_own" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
DROP POLICY IF EXISTS "follows_delete_own" ON public.follows;
CREATE POLICY "follows_delete_own" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- BLOCKS
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
DROP POLICY IF EXISTS "blocks_select_own" ON public.blocks;
CREATE POLICY "blocks_select_own" ON public.blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);
DROP POLICY IF EXISTS "blocks_insert_own" ON public.blocks;
CREATE POLICY "blocks_insert_own" ON public.blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "blocks_delete_own" ON public.blocks;
CREATE POLICY "blocks_delete_own" ON public.blocks FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- REPORTS
GRANT SELECT, INSERT ON public.reports TO authenticated;
DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
CREATE POLICY "reports_insert_own" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own" ON public.reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);

-- POSTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
DROP POLICY IF EXISTS "posts_select" ON public.posts;
CREATE POLICY "posts_select" ON public.posts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "posts_update_own" ON public.posts;
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;
CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- LIKES
GRANT SELECT, INSERT, DELETE ON public.likes TO authenticated;
DROP POLICY IF EXISTS "likes_select" ON public.likes;
CREATE POLICY "likes_select" ON public.likes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "likes_insert_own" ON public.likes;
CREATE POLICY "likes_insert_own" ON public.likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "likes_delete_own" ON public.likes;
CREATE POLICY "likes_delete_own" ON public.likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- COMMENTS
GRANT SELECT, INSERT, DELETE ON public.comments TO authenticated;
DROP POLICY IF EXISTS "comments_select" ON public.comments;
CREATE POLICY "comments_select" ON public.comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "comments_insert_own" ON public.comments;
CREATE POLICY "comments_insert_own" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "comments_delete_own" ON public.comments;
CREATE POLICY "comments_delete_own" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- COMMUNITIES
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communities TO authenticated;
DROP POLICY IF EXISTS "communities_select" ON public.communities;
CREATE POLICY "communities_select" ON public.communities FOR SELECT TO authenticated
  USING (
    is_private = false
    OR owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.community_members cm WHERE cm.community_id = communities.id AND cm.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "communities_insert_own" ON public.communities;
CREATE POLICY "communities_insert_own" ON public.communities FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "communities_update_own" ON public.communities;
CREATE POLICY "communities_update_own" ON public.communities FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "communities_delete_own" ON public.communities;
CREATE POLICY "communities_delete_own" ON public.communities FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- COMMUNITY MEMBERS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_members TO authenticated;
DROP POLICY IF EXISTS "cmembers_select_visible" ON public.community_members;
CREATE POLICY "cmembers_select_visible" ON public.community_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_members.community_id
      AND (
        c.is_private = false
        OR c.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.community_members cm2 WHERE cm2.community_id = c.id AND cm2.user_id = auth.uid())
      )
    )
  );
DROP POLICY IF EXISTS "cmembers_insert_own" ON public.community_members;
CREATE POLICY "cmembers_insert_own" ON public.community_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cmembers_update_admin" ON public.community_members;
CREATE POLICY "cmembers_update_admin" ON public.community_members FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_members.community_id AND c.owner_id = auth.uid()))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_members.community_id AND c.owner_id = auth.uid()));
DROP POLICY IF EXISTS "cmembers_delete_own_or_owner" ON public.community_members;
CREATE POLICY "cmembers_delete_own_or_owner" ON public.community_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_members.community_id AND c.owner_id = auth.uid()));

-- CONVERSATIONS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant" ON public.conversations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()));
DROP POLICY IF EXISTS "conversations_insert_own" ON public.conversations;
CREATE POLICY "conversations_insert_own" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "conversations_update_own" ON public.conversations;
CREATE POLICY "conversations_update_own" ON public.conversations FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "conversations_delete_own" ON public.conversations;
CREATE POLICY "conversations_delete_own" ON public.conversations FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- CONVERSATION PARTICIPANTS
GRANT SELECT, INSERT, DELETE ON public.conversation_participants TO authenticated;
DROP POLICY IF EXISTS "cp_select_participant" ON public.conversation_participants;
CREATE POLICY "cp_select_participant" ON public.conversation_participants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = conversation_participants.conversation_id AND cp.user_id = auth.uid()));
DROP POLICY IF EXISTS "cp_insert_participant" ON public.conversation_participants;
CREATE POLICY "cp_insert_participant" ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_participants.conversation_id AND c.created_by = auth.uid()));
DROP POLICY IF EXISTS "cp_delete_own" ON public.conversation_participants;
CREATE POLICY "cp_delete_own" ON public.conversation_participants FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- MESSAGES
GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;
DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()));
DROP POLICY IF EXISTS "messages_insert_participant" ON public.messages;
CREATE POLICY "messages_insert_participant" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()));
DROP POLICY IF EXISTS "messages_delete_own" ON public.messages;
CREATE POLICY "messages_delete_own" ON public.messages FOR DELETE TO authenticated USING (auth.uid() = sender_id);

-- AI CONVERSATIONS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
DROP POLICY IF EXISTS "aiconv_select_own" ON public.ai_conversations;
CREATE POLICY "aiconv_select_own" ON public.ai_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "aiconv_insert_own" ON public.ai_conversations;
CREATE POLICY "aiconv_insert_own" ON public.ai_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "aiconv_update_own" ON public.ai_conversations;
CREATE POLICY "aiconv_update_own" ON public.ai_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "aiconv_delete_own" ON public.ai_conversations;
CREATE POLICY "aiconv_delete_own" ON public.ai_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- AI MESSAGES
GRANT SELECT, INSERT, DELETE ON public.ai_messages TO authenticated;
DROP POLICY IF EXISTS "aimsg_select_own" ON public.ai_messages;
CREATE POLICY "aimsg_select_own" ON public.ai_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_conversations a WHERE a.id = ai_messages.conversation_id AND a.user_id = auth.uid()));
DROP POLICY IF EXISTS "aimsg_insert_own" ON public.ai_messages;
CREATE POLICY "aimsg_insert_own" ON public.ai_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations a WHERE a.id = ai_messages.conversation_id AND a.user_id = auth.uid()));
DROP POLICY IF EXISTS "aimsg_delete_own" ON public.ai_messages;
CREATE POLICY "aimsg_delete_own" ON public.ai_messages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_conversations a WHERE a.id = ai_messages.conversation_id AND a.user_id = auth.uid()));

-- NOTIFICATIONS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications_insert_own_or_any" ON public.notifications;
CREATE POLICY "notifications_insert_own_or_any" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
