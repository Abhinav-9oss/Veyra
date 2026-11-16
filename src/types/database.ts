export type Profile = {
  id: string;
  display_name: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  header_url: string | null;
  location: string | null;
  website: string | null;
  is_private: boolean;
  role: "member" | "admin";
  created_at: string;
  updated_at: string;
};

export type Post = {
  id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  author?: Profile;
  like_count?: number;
  comment_count?: number;
  liked_by_me?: boolean;
};

export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: Profile;
};

export type Like = {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
};

export type Follow = {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
};

export type Block = {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

export type Report = {
  id: string;
  reporter_id: string;
  target_type: "post" | "user" | "community";
  target_id: string;
  reason: string;
  created_at: string;
};

export type Community = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  avatar_url: string | null;
  is_private: boolean;
  created_at: string;
  owner?: Profile;
  member_count?: number;
  joined?: boolean;
};

export type CommunityMember = {
  id: string;
  community_id: string;
  user_id: string;
  role: "member" | "admin";
  created_at: string;
  profile?: Profile;
};

export type Conversation = {
  id: string;
  is_group: boolean;
  is_ai: boolean;
  name: string | null;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  participants?: Profile[];
  last_message?: Message | null;
};

export type ConversationParticipant = {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  profile?: Profile;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: Profile;
};

export type AiConversation = {
  id: string;
  user_id: string;
  title: string;
  persona: string;
  created_at: string;
  updated_at: string;
};

export type AiMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: "follow" | "like" | "comment" | "community_invite" | "message";
  entity_id: string | null;
  read: boolean;
  created_at: string;
  actor?: Profile | null;
};

export type Page =
  | "Home"
  | "Messages"
  | "Communities"
  | "Discover"
  | "AI Studio"
  | "Profile"
  | "Admin";

export type AdminConversation = {
  id: string;
  is_group: boolean;
  is_ai: boolean;
  name: string;
  created_by: string;
  created_at: string;
  participant_count: number;
  message_count: number;
  participants: string;
};

export type AdminMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string | null;
  sender_username: string | null;
  sender_avatar: string | null;
  content: string;
  created_at: string;
};
