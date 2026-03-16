import { supabase } from './supabase';
import type { SocialPost, SocialComment, SocialProfile } from './types';

// ── Helpers ──────────────────────────────────────────────────────────────────
const log = (...a: unknown[]) => console.log('[Social]', ...a);

function mapProfile(p: Record<string, unknown>): SocialProfile {
  return {
    id:             String(p.id || ''),
    username:       String(p.username || ''),
    displayName:    String(p.display_name || p.username || ''),
    avatar:         String(p.avatar || ''),
    bio:            String(p.bio || ''),
    isPublic:       Boolean(p.is_public ?? true),
    followersCount: Number(p.followers_count || 0),
    followingCount: Number(p.following_count || 0),
    postsCount:     Number(p.posts_count || 0),
    interests:      (p.interests as string[]) || [],
    website:        String(p.website || ''),
    location:       String(p.location || ''),
    specialization: String(p.specialization || ''),
  };
}

function mapPost(p: Record<string, unknown>, userId?: string, likedIds?: Set<string>, savedIds?: Set<string>): SocialPost {
  return {
    id:            String(p.id || ''),
    userId:        String(p.user_id || ''),
    type:          (p.type as SocialPost['type']) || 'note',
    title:         String(p.title || ''),
    content:       String(p.content || ''),
    bookTitle:     String(p.book_title || ''),
    bookAuthor:    String(p.book_author || ''),
    bookEmoji:     String(p.book_emoji || ''),
    tags:          (p.tags as string[]) || [],
    isPublic:      Boolean(p.is_public ?? true),
    likesCount:    Number(p.likes_count || 0),
    commentsCount: Number(p.comments_count || 0),
    viewsCount:    Number(p.views_count || 0),
    createdAt:     String(p.created_at || new Date().toISOString()),
    isLiked:       likedIds ? likedIds.has(String(p.id)) : Boolean(p.is_liked),
    isSaved:       savedIds ? savedIds.has(String(p.id)) : Boolean(p.is_saved),
    profile:       p.profile ? mapProfile(p.profile as Record<string, unknown>) : undefined,
    userId_:       userId,
  } as SocialPost;
}

function mapComment(c: Record<string, unknown>): SocialComment {
  return {
    id:         String(c.id || ''),
    postId:     String(c.post_id || ''),
    userId:     String(c.user_id || ''),
    content:    String(c.content || ''),
    likesCount: Number(c.likes_count || 0),
    isLiked:    Boolean(c.is_liked),
    createdAt:  String(c.created_at || new Date().toISOString()),
    profile:    c.profile ? mapProfile(c.profile as Record<string, unknown>) : undefined,
  };
}

// ── Ensure profile exists ─────────────────────────────────────────────────────
export async function ensureProfile(userId: string): Promise<void> {
  const { data } = await supabase
    .from('social_profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (!data) {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || '';
    const username = email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase().slice(0, 20) || `user${Date.now()}`;
    await supabase.from('social_profiles').upsert({
      id: userId,
      username,
      display_name: username,
      is_public: true,
      followers_count: 0,
      following_count: 0,
      posts_count: 0,
    }, { onConflict: 'id' });
    log('Profile created for', userId);
  }
}

// ── Profile ───────────────────────────────────────────────────────────────────
export async function getMyProfile(userId: string): Promise<SocialProfile | null> {
  try {
    const { data, error } = await supabase
      .from('social_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    return mapProfile(data as Record<string, unknown>);
  } catch (e) {
    log('getMyProfile error:', e);
    return null;
  }
}

export async function getProfile(userId: string): Promise<SocialProfile | null> {
  try {
    const { data, error } = await supabase
      .from('social_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    return mapProfile(data as Record<string, unknown>);
  } catch (e) {
    log('getProfile error:', e);
    return null;
  }
}

export async function upsertProfile(userId: string, updates: Partial<SocialProfile>): Promise<SocialProfile | null> {
  try {
    await ensureProfile(userId);
    const payload: Record<string, unknown> = {};
    if (updates.displayName  !== undefined) payload.display_name    = updates.displayName;
    if (updates.username      !== undefined) payload.username        = updates.username;
    if (updates.bio           !== undefined) payload.bio             = updates.bio;
    if (updates.avatar        !== undefined) payload.avatar          = updates.avatar;
    if (updates.isPublic      !== undefined) payload.is_public       = updates.isPublic;
    if (updates.interests     !== undefined) payload.interests       = updates.interests;
    if (updates.website       !== undefined) payload.website         = updates.website;
    if (updates.location      !== undefined) payload.location        = updates.location;
    if (updates.specialization !== undefined) payload.specialization = updates.specialization;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('social_profiles')
      .update(payload)
      .eq('id', userId)
      .select()
      .single();
    if (error) { log('upsertProfile error:', error); return null; }
    return mapProfile(data as Record<string, unknown>);
  } catch (e) {
    log('upsertProfile error:', e);
    return null;
  }
}

// ── Feed ──────────────────────────────────────────────────────────────────────
export async function getFeed(userId: string, page = 0): Promise<SocialPost[]> {
  try {
    log('getFeed', userId, page);

    // Get posts
    const { data: posts, error } = await supabase
      .from('social_posts')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(page * 20, page * 20 + 19);

    if (error) { log('getFeed posts error:', error); return []; }
    if (!posts || posts.length === 0) return [];

    // Get liked post ids
    const { data: likedData } = await supabase
      .from('social_likes')
      .select('post_id')
      .eq('user_id', userId);
    const likedIds = new Set((likedData || []).map((l: Record<string, unknown>) => String(l.post_id)));

    // Get saved post ids
    const { data: savedData } = await supabase
      .from('social_saves')
      .select('post_id')
      .eq('user_id', userId);
    const savedIds = new Set((savedData || []).map((s: Record<string, unknown>) => String(s.post_id)));

    // Get profiles for post authors
    const authorIds = [...new Set(posts.map((p: Record<string, unknown>) => String(p.user_id)))];
    const { data: profiles } = await supabase
      .from('social_profiles')
      .select('*')
      .in('id', authorIds);
    const profileMap = new Map((profiles || []).map((p: Record<string, unknown>) => [String(p.id), mapProfile(p)]));

    const result = (posts as Record<string, unknown>[]).map(p => {
      const post = mapPost(p, userId, likedIds, savedIds);
      post.profile = profileMap.get(String(p.user_id)) || undefined;
      return post;
    });

    log('getFeed result:', result.length, 'posts');
    return result;
  } catch (e) {
    log('getFeed error:', e);
    return [];
  }
}

// ── Create Post ───────────────────────────────────────────────────────────────
export async function createPost(userId: string, data: {
  type: string;
  title: string;
  content?: string;
  bookTitle?: string;
  bookAuthor?: string;
  bookEmoji?: string;
  tags?: string[];
}): Promise<SocialPost | null> {
  try {
    log('createPost', userId, data);
    await ensureProfile(userId);

    const payload = {
      user_id:     userId,
      type:        data.type || 'note',
      title:       data.title || '',
      content:     data.content || '',
      book_title:  data.bookTitle || '',
      book_author: data.bookAuthor || '',
      book_emoji:  data.bookEmoji || '',
      tags:        data.tags || [],
      is_public:   true,
      likes_count:    0,
      comments_count: 0,
      views_count:    0,
    };

    log('createPost payload:', payload);

    const { data: created, error } = await supabase
      .from('social_posts')
      .insert(payload)
      .select()
      .single();

    if (error) { log('createPost error:', error); return null; }
    log('createPost success:', created);
    return mapPost(created as Record<string, unknown>, userId, new Set(), new Set());
  } catch (e) {
    log('createPost exception:', e);
    return null;
  }
}

// ── Delete Post ───────────────────────────────────────────────────────────────
export async function deletePost(postId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('social_posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', userId);
    if (error) { log('deletePost error:', error); return false; }
    return true;
  } catch (e) {
    log('deletePost error:', e);
    return false;
  }
}

// ── Update Post ───────────────────────────────────────────────────────────────
export async function updatePost(postId: string, updates: { title?: string; content?: string; tags?: string[] }): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('social_posts')
      .update(updates)
      .eq('id', postId);
    if (error) { log('updatePost error:', error); return false; }
    return true;
  } catch (e) {
    log('updatePost error:', e);
    return false;
  }
}

// ── Like ──────────────────────────────────────────────────────────────────────
export async function toggleLike(postId: string, userId: string, isLiked: boolean): Promise<boolean> {
  try {
    log('toggleLike', postId, isLiked);
    if (isLiked) {
      // Unlike
      await supabase.from('social_likes').delete().eq('post_id', postId).eq('user_id', userId);
      await supabase.from('social_posts').update({ likes_count: supabase.rpc as unknown }).eq('id', postId);
      // Update count manually
      const { data: post } = await supabase.from('social_posts').select('likes_count').eq('id', postId).single();
      const newCount = Math.max(0, Number((post as Record<string, unknown>)?.likes_count || 1) - 1);
      await supabase.from('social_posts').update({ likes_count: newCount }).eq('id', postId);
      log('unliked', postId);
      return false;
    } else {
      // Like
      await supabase.from('social_likes').upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id' });
      const { data: post } = await supabase.from('social_posts').select('likes_count').eq('id', postId).single();
      const newCount = Number((post as Record<string, unknown>)?.likes_count || 0) + 1;
      await supabase.from('social_posts').update({ likes_count: newCount }).eq('id', postId);
      log('liked', postId);
      return true;
    }
  } catch (e) {
    log('toggleLike error:', e);
    return isLiked;
  }
}

// ── Save ──────────────────────────────────────────────────────────────────────
export async function toggleSave(postId: string, userId: string, isSaved: boolean): Promise<boolean> {
  try {
    if (isSaved) {
      await supabase.from('social_saves').delete().eq('post_id', postId).eq('user_id', userId);
      return false;
    } else {
      await supabase.from('social_saves').upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id' });
      return true;
    }
  } catch (e) {
    log('toggleSave error:', e);
    return isSaved;
  }
}

// ── Comments ──────────────────────────────────────────────────────────────────
export async function getComments(postId: string): Promise<SocialComment[]> {
  try {
    const { data: comments, error } = await supabase
      .from('social_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error || !comments) return [];

    // Get profiles
    const userIds = [...new Set((comments as Record<string, unknown>[]).map(c => String(c.user_id)))];
    const { data: profiles } = await supabase
      .from('social_profiles')
      .select('*')
      .in('id', userIds);
    const profileMap = new Map((profiles || []).map((p: Record<string, unknown>) => [String(p.id), mapProfile(p)]));

    return (comments as Record<string, unknown>[]).map(c => {
      const comment = mapComment(c);
      comment.profile = profileMap.get(String(c.user_id));
      return comment;
    });
  } catch (e) {
    log('getComments error:', e);
    return [];
  }
}

export async function addComment(postId: string, userId: string, content: string): Promise<SocialComment | null> {
  try {
    log('addComment', postId, content);
    await ensureProfile(userId);

    const { data, error } = await supabase
      .from('social_comments')
      .insert({ post_id: postId, user_id: userId, content, likes_count: 0 })
      .select()
      .single();

    if (error) { log('addComment error:', error); return null; }

    // Update comments count
    const { data: post } = await supabase.from('social_posts').select('comments_count').eq('id', postId).single();
    const newCount = Number((post as Record<string, unknown>)?.comments_count || 0) + 1;
    await supabase.from('social_posts').update({ comments_count: newCount }).eq('id', postId);

    // Get profile
    const profile = await getProfile(userId);
    const comment = mapComment(data as Record<string, unknown>);
    comment.profile = profile || undefined;
    log('addComment success:', comment);
    return comment;
  } catch (e) {
    log('addComment error:', e);
    return null;
  }
}

export async function deleteComment(commentId: string, postId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('social_comments').delete().eq('id', commentId);
    if (error) return false;
    const { data: post } = await supabase.from('social_posts').select('comments_count').eq('id', postId).single();
    const newCount = Math.max(0, Number((post as Record<string, unknown>)?.comments_count || 1) - 1);
    await supabase.from('social_posts').update({ comments_count: newCount }).eq('id', postId);
    return true;
  } catch (e) {
    log('deleteComment error:', e);
    return false;
  }
}

export async function updateComment(commentId: string, content: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('social_comments').update({ content }).eq('id', commentId);
    return !error;
  } catch (e) {
    log('updateComment error:', e);
    return false;
  }
}

export async function toggleCommentLike(commentId: string, userId: string, isLiked: boolean): Promise<boolean> {
  try {
    if (isLiked) {
      await supabase.from('social_comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId);
      return false;
    } else {
      await supabase.from('social_comment_likes').upsert({ comment_id: commentId, user_id: userId }, { onConflict: 'comment_id,user_id' });
      return true;
    }
  } catch (e) {
    return isLiked;
  }
}

// ── Follow ────────────────────────────────────────────────────────────────────
export async function toggleFollow(followerId: string, followingId: string, isFollowing: boolean): Promise<boolean> {
  try {
    if (isFollowing) {
      await supabase.from('social_follows').delete().eq('follower_id', followerId).eq('following_id', followingId);
      return false;
    } else {
      await supabase.from('social_follows').upsert({ follower_id: followerId, following_id: followingId }, { onConflict: 'follower_id,following_id' });
      return true;
    }
  } catch (e) {
    log('toggleFollow error:', e);
    return isFollowing;
  }
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('social_follows')
      .select('follower_id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .single();
    return !!data;
  } catch {
    return false;
  }
}

// ── Search ────────────────────────────────────────────────────────────────────
export async function searchProfiles(query: string, excludeUserId?: string): Promise<SocialProfile[]> {
  try {
    if (!query.trim()) return [];
    let q = supabase
      .from('social_profiles')
      .select('*')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .eq('is_public', true)
      .limit(20);
    const { data } = await q;
    let results = (data || []).map((p: Record<string, unknown>) => mapProfile(p));
    if (excludeUserId) results = results.filter(p => p.id !== excludeUserId);
    return results;
  } catch (e) {
    log('searchProfiles error:', e);
    return [];
  }
}

// ── User Posts ────────────────────────────────────────────────────────────────
export async function getUserPosts(userId: string, currentUserId?: string): Promise<SocialPost[]> {
  try {
    const { data: posts, error } = await supabase
      .from('social_posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !posts) return [];

    let likedIds = new Set<string>();
    if (currentUserId) {
      const { data: liked } = await supabase.from('social_likes').select('post_id').eq('user_id', currentUserId);
      likedIds = new Set((liked || []).map((l: Record<string, unknown>) => String(l.post_id)));
    }

    const profile = await getProfile(userId);
    return (posts as Record<string, unknown>[]).map(p => {
      const post = mapPost(p, currentUserId, likedIds, new Set());
      post.profile = profile || undefined;
      return post;
    });
  } catch (e) {
    log('getUserPosts error:', e);
    return [];
  }
}

// ── Saved Posts ───────────────────────────────────────────────────────────────
export async function getSavedPosts(userId: string): Promise<SocialPost[]> {
  try {
    const { data: saves } = await supabase
      .from('social_saves')
      .select('post_id')
      .eq('user_id', userId);
    if (!saves || saves.length === 0) return [];

    const postIds = saves.map((s: Record<string, unknown>) => String(s.post_id));
    const { data: posts } = await supabase
      .from('social_posts')
      .select('*')
      .in('id', postIds)
      .order('created_at', { ascending: false });

    if (!posts) return [];

    const authorIds = [...new Set((posts as Record<string, unknown>[]).map(p => String(p.user_id)))];
    const { data: profiles } = await supabase.from('social_profiles').select('*').in('id', authorIds);
    const profileMap = new Map((profiles || []).map((p: Record<string, unknown>) => [String(p.id), mapProfile(p)]));

    return (posts as Record<string, unknown>[]).map(p => {
      const post = mapPost(p, userId, new Set(), new Set(postIds));
      post.profile = profileMap.get(String(p.user_id));
      return post;
    });
  } catch (e) {
    log('getSavedPosts error:', e);
    return [];
  }
}

// ── Messages ──────────────────────────────────────────────────────────────────
export async function getConversations(userId: string): Promise<{
  profile: SocialProfile;
  lastMessage: string;
  lastTime: string;
  unread: number;
}[]> {
  try {
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (!msgs || msgs.length === 0) return [];

    // Group by conversation partner
    const convMap = new Map<string, Record<string, unknown>>();
    for (const msg of msgs as Record<string, unknown>[]) {
      const partnerId = String(msg.from_user_id) === userId ? String(msg.to_user_id) : String(msg.from_user_id);
      if (!convMap.has(partnerId)) convMap.set(partnerId, msg);
    }

    // Get profiles
    const partnerIds = [...convMap.keys()];
    const { data: profiles } = await supabase.from('social_profiles').select('*').in('id', partnerIds);
    const profileMap = new Map((profiles || []).map((p: Record<string, unknown>) => [String(p.id), mapProfile(p)]));

    // Count unread
    const { data: unreadData } = await supabase
      .from('messages')
      .select('from_user_id')
      .eq('to_user_id', userId)
      .eq('is_read', false);
    const unreadMap = new Map<string, number>();
    for (const m of unreadData || []) {
      const id = String((m as Record<string, unknown>).from_user_id);
      unreadMap.set(id, (unreadMap.get(id) || 0) + 1);
    }

    return partnerIds
      .filter(id => profileMap.has(id))
      .map(partnerId => {
        const lastMsg = convMap.get(partnerId)!;
        return {
          profile: profileMap.get(partnerId)!,
          lastMessage: String(lastMsg.content || ''),
          lastTime: String(lastMsg.created_at || ''),
          unread: unreadMap.get(partnerId) || 0,
        };
      });
  } catch (e) {
    log('getConversations error:', e);
    return [];
  }
}

export async function getMessages(fromId: string, toId: string): Promise<{
  id: string; senderId: string; content: string; createdAt: string; isRead: boolean;
}[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(from_user_id.eq.${fromId},to_user_id.eq.${toId}),and(from_user_id.eq.${toId},to_user_id.eq.${fromId})`)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    // Mark as read
    await supabase.from('messages').update({ is_read: true })
      .eq('from_user_id', toId).eq('to_user_id', fromId).eq('is_read', false);

    return (data as Record<string, unknown>[]).map(m => ({
      id:        String(m.id),
      senderId:  String(m.from_user_id),
      content:   String(m.content),
      createdAt: String(m.created_at),
      isRead:    Boolean(m.is_read),
    }));
  } catch (e) {
    log('getMessages error:', e);
    return [];
  }
}

export async function sendMessage(fromId: string, toId: string, content: string): Promise<boolean> {
  try {
    await ensureProfile(fromId);
    const { error } = await supabase.from('messages').insert({
      from_user_id: fromId,
      to_user_id:   toId,
      content,
      is_read:      false,
    });
    if (error) { log('sendMessage error:', error); return false; }
    log('sendMessage success');
    return true;
  } catch (e) {
    log('sendMessage error:', e);
    return false;
  }
}

// ── Notifications ─────────────────────────────────────────────────────────────
export async function getNotifications(userId: string): Promise<{
  id: string; type: string; message: string; isRead: boolean; createdAt: string;
}[]> {
  try {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    return (data || []).map((n: Record<string, unknown>) => ({
      id:        String(n.id),
      type:      String(n.type),
      message:   String(n.message || ''),
      isRead:    Boolean(n.is_read),
      createdAt: String(n.created_at),
    }));
  } catch (e) {
    log('getNotifications error:', e);
    return [];
  }
}

export async function markNotificationsRead(userId: string): Promise<void> {
  try {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
  } catch {}
}
