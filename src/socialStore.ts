import { supabase } from './supabase';
import type { SocialProfile, SocialPost, SocialComment } from './types';

// ── Mappers ─────────────────────────────────────────────────────────────────
function mapProfile(p: Record<string, unknown>): SocialProfile {
  return {
    id: String(p.id || ''),
    username: String(p.username || ''),
    displayName: String(p.display_name || p.username || ''),
    avatar: p.avatar as string | undefined,
    bio: p.bio as string | undefined,
    interests: (p.interests as string[]) || [],
    isPublic: (p.is_public as boolean) ?? true,
    followersCount: Number(p.followers_count) || 0,
    followingCount: Number(p.following_count) || 0,
    postsCount: Number(p.posts_count) || 0,
    createdAt: String(p.created_at || new Date().toISOString()),
  };
}

function mapPost(
  p: Record<string, unknown>,
  profile: SocialProfile | undefined,
  likedByMe: boolean,
  savedByMe: boolean
): SocialPost {
  return {
    id: String(p.id || ''),
    userId: String(p.user_id || ''),
    type: (p.type as SocialPost['type']) || 'note',
    title: String(p.title || ''),
    content: String(p.content || ''),
    bookTitle: p.book_title as string | undefined,
    bookAuthor: p.book_author as string | undefined,
    bookEmoji: p.book_emoji as string | undefined,
    tags: (p.tags as string[]) || [],
    isPublic: (p.is_public as boolean) ?? true,
    likesCount: Number(p.likes_count) || 0,
    commentsCount: Number(p.comments_count) || 0,
    viewsCount: Number(p.views_count) || 0,
    isLiked: likedByMe,
    isSaved: savedByMe,
    profile,
    createdAt: String(p.created_at || new Date().toISOString()),
  };
}

function mapComment(
  c: Record<string, unknown>,
  profile: SocialProfile | undefined,
  likedByMe: boolean
): SocialComment {
  return {
    id: String(c.id || ''),
    postId: String(c.post_id || ''),
    userId: String(c.user_id || ''),
    content: String(c.content || ''),
    likesCount: Number(c.likes_count) || 0,
    isLiked: likedByMe,
    profile,
    createdAt: String(c.created_at || new Date().toISOString()),
  };
}

// ── Ensure profile exists ────────────────────────────────────────────────────
export async function ensureProfile(userId: string, email?: string): Promise<void> {
  try {
    const { data } = await supabase
      .from('social_profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!data) {
      const base = email
        ? email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase().slice(0, 20)
        : 'reader';
      const username = base || 'reader';
      const displayName = username;

      await supabase.from('social_profiles').insert({
        id: userId,
        username: username + '_' + Math.floor(Math.random() * 9999),
        display_name: displayName,
        is_public: true,
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
      });
      console.log('[Profile] Created new profile for', userId);
    }
  } catch (e) {
    console.error('[Profile] ensureProfile error:', e);
  }
}

// ── Profile ──────────────────────────────────────────────────────────────────
export async function getMyProfile(userId: string): Promise<SocialProfile | null> {
  try {
    const { data } = await supabase
      .from('social_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (!data) return null;
    return mapProfile(data as Record<string, unknown>);
  } catch { return null; }
}

export async function upsertProfile(
  profile: Partial<SocialProfile> & { id: string }
): Promise<SocialProfile | null> {
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

    const { data } = await supabase
      .from('social_profiles')
      .upsert(payload)
      .select()
      .single();
    if (!data) return null;
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

export async function getProfileById(id: string): Promise<SocialProfile | null> {
  try {
    const { data } = await supabase
      .from('social_profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!data) return null;
    return mapProfile(data as Record<string, unknown>);
  } catch { return null; }
}

// ── Helpers to fetch profiles in bulk ────────────────────────────────────────
async function fetchProfilesMap(userIds: string[]): Promise<Map<string, SocialProfile>> {
  const map = new Map<string, SocialProfile>();
  if (userIds.length === 0) return map;
  try {
    const unique = [...new Set(userIds)];
    const { data } = await supabase
      .from('social_profiles')
      .select('*')
      .in('id', unique);
    ((data || []) as Record<string, unknown>[]).forEach(p => {
      map.set(String(p.id), mapProfile(p));
    });
  } catch { /* ignore */ }
  return map;
}

async function fetchMyLikes(userId: string, postIds: string[]): Promise<Set<string>> {
  const set = new Set<string>();
  if (postIds.length === 0) return set;
  try {
    const { data } = await supabase
      .from('social_likes')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', postIds);
    ((data || []) as { post_id: string }[]).forEach(l => set.add(l.post_id));
  } catch { /* ignore */ }
  return set;
}

async function fetchMySaves(userId: string, postIds: string[]): Promise<Set<string>> {
  const set = new Set<string>();
  if (postIds.length === 0) return set;
  try {
    const { data } = await supabase
      .from('social_saves')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', postIds);
    ((data || []) as { post_id: string }[]).forEach(s => set.add(s.post_id));
  } catch { /* ignore */ }
  return set;
}

// ── Feed ─────────────────────────────────────────────────────────────────────
export async function getFeed(userId: string, page = 0): Promise<SocialPost[]> {
  try {
    console.log('[Feed] Loading posts, page', page);

    // Step 1: get posts (no joins)
    const { data: posts, error } = await supabase
      .from('social_posts')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(page * 20, (page + 1) * 20 - 1);

    if (error) { console.error('[Feed] error:', error.message, error.details, error.hint); return []; }
    if (!posts || posts.length === 0) { console.log('[Feed] No posts found'); return []; }

    console.log('[Feed] Got', posts.length, 'posts');

    const rawPosts = posts as Record<string, unknown>[];
    const postIds = rawPosts.map(p => String(p.id));
    const userIds = rawPosts.map(p => String(p.user_id));

    // Step 2: fetch profiles, likes, saves in parallel
    const [profilesMap, likedSet, savedSet] = await Promise.all([
      fetchProfilesMap(userIds),
      fetchMyLikes(userId, postIds),
      fetchMySaves(userId, postIds),
    ]);

    return rawPosts.map(p => mapPost(
      p,
      profilesMap.get(String(p.user_id)),
      likedSet.has(String(p.id)),
      savedSet.has(String(p.id))
    ));
  } catch (e) { console.error('[Feed] catch:', e); return []; }
}

export async function getFollowingFeed(userId: string, page = 0): Promise<SocialPost[]> {
  try {
    const { data: follows } = await supabase
      .from('social_follows')
      .select('following_id')
      .eq('follower_id', userId);

    const ids = ((follows || []) as { following_id: string }[]).map(f => f.following_id);
    if (ids.length === 0) return [];

    const { data: posts } = await supabase
      .from('social_posts')
      .select('*')
      .in('user_id', ids)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(page * 20, (page + 1) * 20 - 1);

    if (!posts || posts.length === 0) return [];

    const rawPosts = posts as Record<string, unknown>[];
    const postIds = rawPosts.map(p => String(p.id));
    const userIds = rawPosts.map(p => String(p.user_id));

    const [profilesMap, likedSet, savedSet] = await Promise.all([
      fetchProfilesMap(userIds),
      fetchMyLikes(userId, postIds),
      fetchMySaves(userId, postIds),
    ]);

    return rawPosts.map(p => mapPost(
      p,
      profilesMap.get(String(p.user_id)),
      likedSet.has(String(p.id)),
      savedSet.has(String(p.id))
    ));
  } catch { return []; }
}

export async function getUserPosts(userId: string, viewerId: string): Promise<SocialPost[]> {
  try {
    const { data: posts } = await supabase
      .from('social_posts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (!posts || posts.length === 0) return [];

    const rawPosts = posts as Record<string, unknown>[];
    const postIds = rawPosts.map(p => String(p.id));
    const profile = await getProfileById(userId);
    const [likedSet, savedSet] = await Promise.all([
      fetchMyLikes(viewerId, postIds),
      fetchMySaves(viewerId, postIds),
    ]);

    return rawPosts.map(p => mapPost(
      p,
      profile || undefined,
      likedSet.has(String(p.id)),
      savedSet.has(String(p.id))
    ));
  } catch { return []; }
}

// ── Create / Delete Post ──────────────────────────────────────────────────────
export async function createPost(post: {
  userId: string;
  type: string;
  title: string;
  content: string;
  bookTitle?: string;
  bookAuthor?: string;
  bookEmoji?: string;
  tags: string[];
}): Promise<SocialPost | null> {
  try {
    console.log('[Post] Creating post for user', post.userId);

    const payload = {
      user_id: post.userId,
      type: post.type || 'note',
      title: post.title || 'Без заголовка',
      content: post.content || '',
      book_title: post.bookTitle || null,
      book_author: post.bookAuthor || null,
      book_emoji: post.bookEmoji || null,
      tags: post.tags || [],
      is_public: true,
      likes_count: 0,
      comments_count: 0,
      views_count: 0,
    };

    console.log('[Post] Payload:', payload);

    const { data, error } = await supabase
      .from('social_posts')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('[Post] Insert error:', error.message, error.details, error.hint, error.code);
      return null;
    }
    if (!data) { console.error('[Post] No data returned'); return null; }

    console.log('[Post] Created successfully:', data);

    const profile = await getProfileById(post.userId);
    return mapPost(data as Record<string, unknown>, profile || undefined, false, false);
  } catch (e) {
    console.error('[Post] catch:', e);
    return null;
  }
}

export async function deletePost(postId: string): Promise<void> {
  try {
    await supabase.from('social_posts').delete().eq('id', postId);
  } catch { /* ignore */ }
}

// ── Likes ────────────────────────────────────────────────────────────────────
export async function toggleLike(
  postId: string,
  userId: string,
  isLiked: boolean
): Promise<boolean> {
  try {
    console.log('[Like] Toggle', postId, 'isLiked:', isLiked);

    if (isLiked) {
      // Unlike
      const { error } = await supabase
        .from('social_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);

      if (error) { console.error('[Like] Delete error:', error.message); return true; }
      console.log('[Like] Unliked successfully');
      return false;
    } else {
      // Like
      const { error } = await supabase
        .from('social_likes')
        .insert({ post_id: postId, user_id: userId });

      if (error) {
        if (error.code === '23505') return true; // already liked
        console.error('[Like] Insert error:', error.message);
        return false;
      }
      console.log('[Like] Liked successfully');
      return true;
    }
  } catch (e) {
    console.error('[Like] catch:', e);
    return isLiked;
  }
}

// ── Comments ─────────────────────────────────────────────────────────────────
export async function getComments(
  postId: string,
  userId: string
): Promise<SocialComment[]> {
  try {
    console.log('[Comments] Loading for post', postId);

    const { data: comments, error } = await supabase
      .from('social_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) { console.error('[Comments] error:', error.message); return []; }
    if (!comments || comments.length === 0) return [];

    const rawComments = comments as Record<string, unknown>[];
    const userIds = rawComments.map(c => String(c.user_id));
    const commentIds = rawComments.map(c => String(c.id));

    // Fetch profiles and comment likes in parallel
    const [profilesMap, myCommentLikes] = await Promise.all([
      fetchProfilesMap(userIds),
      fetchMyCommentLikes(userId, commentIds),
    ]);

    console.log('[Comments] Got', rawComments.length, 'comments');

    return rawComments.map(c => mapComment(
      c,
      profilesMap.get(String(c.user_id)),
      myCommentLikes.has(String(c.id))
    ));
  } catch (e) {
    console.error('[Comments] catch:', e);
    return [];
  }
}

async function fetchMyCommentLikes(userId: string, commentIds: string[]): Promise<Set<string>> {
  const set = new Set<string>();
  if (commentIds.length === 0) return set;
  try {
    const { data } = await supabase
      .from('social_comment_likes')
      .select('comment_id')
      .eq('user_id', userId)
      .in('comment_id', commentIds);
    ((data || []) as { comment_id: string }[]).forEach(l => set.add(l.comment_id));
  } catch { /* ignore */ }
  return set;
}

export async function addComment(
  postId: string,
  userId: string,
  content: string
): Promise<SocialComment | null> {
  try {
    console.log('[Comment] Adding to post', postId);

    const { data, error } = await supabase
      .from('social_comments')
      .insert({
        post_id: postId,
        user_id: userId,
        content: content.trim(),
        likes_count: 0,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[Comment] Insert error:', error.message, error.details, error.hint, error.code);
      return null;
    }
    if (!data) return null;

    // Триггер в БД автоматически обновит comments_count

    console.log('[Comment] Added successfully:', data);

    const profile = await getProfileById(userId);
    return mapComment(data as Record<string, unknown>, profile || undefined, false);
  } catch (e) {
    console.error('[Comment] catch:', e);
    return null;
  }
}

export async function deleteComment(
  commentId: string,
  _postId: string
): Promise<void> {
  try {
    await supabase.from('social_comments').delete().eq('id', commentId);
    // Триггер в БД автоматически обновит comments_count
  } catch { /* ignore */ }
}

// ── Follows ───────────────────────────────────────────────────────────────────
export async function followUser(
  followerId: string,
  followingId: string
): Promise<void> {
  try {
    await supabase
      .from('social_follows')
      .insert({ follower_id: followerId, following_id: followingId });
  } catch { /* ignore */ }
}

export async function unfollowUser(
  followerId: string,
  followingId: string
): Promise<void> {
  try {
    await supabase
      .from('social_follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);
  } catch { /* ignore */ }
}

export async function isFollowing(
  followerId: string,
  followingId: string
): Promise<boolean> {
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

// ── Saves ─────────────────────────────────────────────────────────────────────
export async function toggleSave(
  postId: string,
  userId: string,
  isSaved: boolean
): Promise<boolean> {
  try {
    if (isSaved) {
      await supabase
        .from('social_saves')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);
      return false;
    } else {
      await supabase
        .from('social_saves')
        .insert({ post_id: postId, user_id: userId });
      return true;
    }
  } catch { return isSaved; }
}

// ── Notifications ──────────────────────────────────────────────────────────────
export async function getNotifications(userId: string) {
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

export async function markAllRead(userId: string): Promise<void> {
  try {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId);
  } catch { /* ignore */ }
}

export async function toggleCommentLike(
  commentId: string,
  userId: string,
  isLiked: boolean
): Promise<boolean> {
  try {
    if (isLiked) {
      await supabase
        .from('social_comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', userId);
      return false;
    } else {
      await supabase
        .from('social_comment_likes')
        .insert({ comment_id: commentId, user_id: userId });
      return true;
    }
  } catch { return isLiked; }
}

export async function toggleFollow(
  followerId: string,
  followingId: string,
  isFollowing: boolean
): Promise<boolean> {
  try {
    if (isFollowing) {
      await unfollowUser(followerId, followingId);
      return false;
    } else {
      await followUser(followerId, followingId);
      return true;
    }
  } catch { return isFollowing; }
}
