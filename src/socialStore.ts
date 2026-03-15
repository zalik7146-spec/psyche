import { supabase } from './supabase';
import type { SocialProfile, SocialPost, SocialComment } from './types';

// ── Helpers ────────────────────────────────────────────────────────────────
function mapProfile(p: Record<string, unknown>): SocialProfile {
  return {
    id: p.id as string,
    username: p.username as string,
    displayName: (p.display_name || p.displayName || p.username) as string,
    avatar: p.avatar as string | undefined,
    bio: p.bio as string | undefined,
    interests: (p.interests || []) as string[],
    isPublic: (p.is_public ?? true) as boolean,
    followersCount: (p.followers_count || 0) as number,
    followingCount: (p.following_count || 0) as number,
    postsCount: (p.posts_count || 0) as number,
    createdAt: p.created_at as string,
  };
}

function mapPost(p: Record<string, unknown>, userId?: string): SocialPost {
  const likes = Array.isArray(p.likes) ? p.likes as { user_id: string }[] : [];
  const saves = Array.isArray(p.saves) ? p.saves as { user_id: string }[] : [];
  const profile = p.profile ? mapProfile(p.profile as Record<string, unknown>) : undefined;
  return {
    id: p.id as string,
    userId: (p.user_id || p.userId) as string,
    type: (p.type || 'note') as SocialPost['type'],
    title: (p.title || '') as string,
    content: (p.content || '') as string,
    bookTitle: (p.book_title || p.bookTitle) as string | undefined,
    bookAuthor: (p.book_author || p.bookAuthor) as string | undefined,
    bookEmoji: (p.book_emoji || p.bookEmoji) as string | undefined,
    tags: (p.tags || []) as string[],
    isPublic: (p.is_public ?? true) as boolean,
    likesCount: likes.length > 0 ? likes.length : ((p.likes_count || 0) as number),
    commentsCount: (p.comments_count || 0) as number,
    viewsCount: (p.views_count || 0) as number,
    isLiked: userId ? likes.some(l => l.user_id === userId) : false,
    isSaved: userId ? saves.some(s => s.user_id === userId) : false,
    profile,
    createdAt: (p.created_at || p.createdAt || new Date().toISOString()) as string,
  };
}

function mapComment(c: Record<string, unknown>, userId?: string): SocialComment {
  const likes = Array.isArray(c.likes) ? c.likes as { user_id: string }[] : [];
  const profile = c.profile ? mapProfile(c.profile as Record<string, unknown>) : undefined;
  return {
    id: c.id as string,
    postId: (c.post_id || c.postId) as string,
    userId: (c.user_id || c.userId) as string,
    content: c.content as string,
    likesCount: likes.length > 0 ? likes.length : ((c.likes_count || 0) as number),
    isLiked: userId ? likes.some(l => l.user_id === userId) : false,
    profile,
    createdAt: (c.created_at || c.createdAt || new Date().toISOString()) as string,
  };
}

// ── Profile ────────────────────────────────────────────────────────────────
export async function getMyProfile(userId: string): Promise<SocialProfile | null> {
  try {
    const { data, error } = await supabase
      .from('social_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    return mapProfile(data as Record<string, unknown>);
  } catch { return null; }
}

export async function upsertProfile(profile: Partial<SocialProfile> & { id: string }): Promise<SocialProfile | null> {
  try {
    const payload: Record<string, unknown> = {
      id: profile.id,
      updated_at: new Date().toISOString(),
    };
    if (profile.username !== undefined) payload.username = profile.username;
    if (profile.displayName !== undefined) payload.display_name = profile.displayName;
    if (profile.avatar !== undefined) payload.avatar = profile.avatar;
    if (profile.bio !== undefined) payload.bio = profile.bio;
    if (profile.interests !== undefined) payload.interests = profile.interests;
    if (profile.isPublic !== undefined) payload.is_public = profile.isPublic;

    const { data, error } = await supabase
      .from('social_profiles')
      .upsert(payload)
      .select()
      .single();
    if (error || !data) return null;
    return mapProfile(data as Record<string, unknown>);
  } catch { return null; }
}

export async function searchProfiles(query: string): Promise<SocialProfile[]> {
  try {
    const { data } = await supabase
      .from('social_profiles')
      .select('*')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .eq('is_public', true)
      .limit(20);
    return ((data || []) as Record<string, unknown>[]).map(p => mapProfile(p));
  } catch { return []; }
}

export async function getProfileById(profileId: string): Promise<SocialProfile | null> {
  try {
    const { data } = await supabase
      .from('social_profiles')
      .select('*')
      .eq('id', profileId)
      .single();
    if (!data) return null;
    return mapProfile(data as Record<string, unknown>);
  } catch { return null; }
}

// ── Feed ───────────────────────────────────────────────────────────────────
export async function getFeed(userId: string, page = 0): Promise<SocialPost[]> {
  try {
    const { data, error } = await supabase
      .from('social_posts')
      .select(`
        *,
        profile:social_profiles(id, username, display_name, avatar, is_public, followers_count, following_count, posts_count),
        likes:social_likes(user_id),
        saves:social_saves(user_id)
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(page * 20, (page + 1) * 20 - 1);

    if (error) { console.error('getFeed error:', error); return []; }
    return ((data || []) as Record<string, unknown>[]).map(p => mapPost(p, userId));
  } catch (e) { console.error('getFeed catch:', e); return []; }
}

export async function getFollowingFeed(userId: string, page = 0): Promise<SocialPost[]> {
  try {
    const { data: follows } = await supabase
      .from('social_follows')
      .select('following_id')
      .eq('follower_id', userId);

    const ids = (follows || []).map((f: { following_id: string }) => f.following_id);
    if (ids.length === 0) return [];

    const { data } = await supabase
      .from('social_posts')
      .select(`
        *,
        profile:social_profiles(id, username, display_name, avatar, is_public, followers_count, following_count, posts_count),
        likes:social_likes(user_id),
        saves:social_saves(user_id)
      `)
      .in('user_id', ids)
      .order('created_at', { ascending: false })
      .range(page * 20, (page + 1) * 20 - 1);

    return ((data || []) as Record<string, unknown>[]).map(p => mapPost(p, userId));
  } catch { return []; }
}

// ── Posts ──────────────────────────────────────────────────────────────────
export async function createPost(post: {
  userId: string; type: string; title: string; content: string;
  bookTitle?: string; bookAuthor?: string; bookEmoji?: string;
  tags: string[]; createdAt: string;
}): Promise<SocialPost | null> {
  try {
    const { data, error } = await supabase
      .from('social_posts')
      .insert({
        user_id: post.userId,
        type: post.type,
        title: post.title || 'Без заголовка',
        content: post.content,
        book_title: post.bookTitle || null,
        book_author: post.bookAuthor || null,
        book_emoji: post.bookEmoji || null,
        tags: post.tags || [],
        is_public: true,
      })
      .select(`
        *,
        profile:social_profiles(id, username, display_name, avatar, is_public, followers_count, following_count, posts_count)
      `)
      .single();

    if (error) { console.error('createPost error:', error); return null; }
    if (!data) return null;
    return mapPost(data as Record<string, unknown>, post.userId);
  } catch (e) { console.error('createPost catch:', e); return null; }
}

export async function deletePost(postId: string): Promise<void> {
  try {
    await supabase.from('social_posts').delete().eq('id', postId);
  } catch { /* ignore */ }
}

export async function getUserPosts(userId: string): Promise<SocialPost[]> {
  try {
    const { data } = await supabase
      .from('social_posts')
      .select(`
        *,
        profile:social_profiles(id, username, display_name, avatar, is_public, followers_count, following_count, posts_count),
        likes:social_likes(user_id)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return ((data || []) as Record<string, unknown>[]).map(p => mapPost(p, userId));
  } catch { return []; }
}

// ── Likes ──────────────────────────────────────────────────────────────────
export async function toggleLike(postId: string, userId: string, currentlyLiked: boolean): Promise<boolean> {
  try {
    if (currentlyLiked) {
      const { error } = await supabase
        .from('social_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);
      if (error) { console.error('unlike error:', error); return currentlyLiked; }
      return false;
    } else {
      const { error } = await supabase
        .from('social_likes')
        .insert({ post_id: postId, user_id: userId });
      if (error) { console.error('like error:', error); return currentlyLiked; }
      return true;
    }
  } catch { return currentlyLiked; }
}

export async function toggleSave(postId: string, userId: string, currentlySaved: boolean): Promise<boolean> {
  try {
    if (currentlySaved) {
      await supabase.from('social_saves').delete().eq('post_id', postId).eq('user_id', userId);
      return false;
    } else {
      await supabase.from('social_saves').insert({ post_id: postId, user_id: userId });
      return true;
    }
  } catch { return currentlySaved; }
}

// ── Comments ───────────────────────────────────────────────────────────────
export async function getComments(postId: string, userId: string): Promise<SocialComment[]> {
  try {
    const { data, error } = await supabase
      .from('social_comments')
      .select(`
        *,
        profile:social_profiles(id, username, display_name, avatar),
        likes:social_comment_likes(user_id)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) { console.error('getComments error:', error); return []; }
    return ((data || []) as Record<string, unknown>[]).map(c => mapComment(c, userId));
  } catch (e) { console.error('getComments catch:', e); return []; }
}

export async function addComment(postId: string, userId: string, content: string): Promise<SocialComment | null> {
  try {
    const { data, error } = await supabase
      .from('social_comments')
      .insert({ post_id: postId, user_id: userId, content })
      .select(`
        *,
        profile:social_profiles(id, username, display_name, avatar)
      `)
      .single();

    if (error) { console.error('addComment error:', error); return null; }
    if (!data) return null;
    return mapComment(data as Record<string, unknown>, userId);
  } catch (e) { console.error('addComment catch:', e); return null; }
}

export async function toggleCommentLike(commentId: string, userId: string, currentlyLiked: boolean): Promise<void> {
  try {
    if (currentlyLiked) {
      await supabase.from('social_comment_likes').delete()
        .eq('comment_id', commentId).eq('user_id', userId);
    } else {
      await supabase.from('social_comment_likes').insert({ comment_id: commentId, user_id: userId });
    }
  } catch { /* ignore */ }
}

// ── Follows ────────────────────────────────────────────────────────────────
export async function toggleFollow(followerId: string, followingId: string, currentlyFollowing: boolean): Promise<boolean> {
  try {
    if (currentlyFollowing) {
      await supabase.from('social_follows').delete()
        .eq('follower_id', followerId).eq('following_id', followingId);
      return false;
    } else {
      await supabase.from('social_follows').insert({ follower_id: followerId, following_id: followingId });
      return true;
    }
  } catch { return currentlyFollowing; }
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('social_follows')
      .select('follower_id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle();
    return !!data;
  } catch { return false; }
}

export async function getSavedPosts(userId: string): Promise<SocialPost[]> {
  try {
    const { data } = await supabase
      .from('social_saves')
      .select(`post:social_posts(
        *, 
        profile:social_profiles(id, username, display_name, avatar, is_public, followers_count, following_count, posts_count),
        likes:social_likes(user_id)
      )`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return ((data || []) as Record<string, unknown>[])
      .filter(s => s.post)
      .map(s => mapPost(s.post as Record<string, unknown>, userId));
  } catch { return []; }
}

export async function getNotifications(userId: string): Promise<unknown[]> {
  try {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  } catch { return []; }
}

export async function markNotificationsRead(userId: string): Promise<void> {
  try {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
  } catch { /* ignore */ }
}
