import { supabase } from './supabase';
import type { SocialProfile, SocialPost, SocialComment } from './types';

// ── Profile ────────────────────────────────────────────────────────────────
export async function getMyProfile(userId: string): Promise<SocialProfile | null> {
  try {
    const { data } = await supabase
      .from('social_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return data as SocialProfile | null;
  } catch { return null; }
}

export async function upsertProfile(profile: Partial<SocialProfile> & { id: string }): Promise<SocialProfile | null> {
  try {
    const { data } = await supabase
      .from('social_profiles')
      .upsert({ ...profile, updated_at: new Date().toISOString() })
      .select()
      .single();
    return data as SocialProfile | null;
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
    return (data || []) as SocialProfile[];
  } catch { return []; }
}

export async function getProfileById(profileId: string): Promise<SocialProfile | null> {
  try {
    const { data } = await supabase
      .from('social_profiles')
      .select('*')
      .eq('id', profileId)
      .single();
    return data as SocialProfile | null;
  } catch { return null; }
}

// ── Feed ───────────────────────────────────────────────────────────────────
export async function getFeed(userId: string, page = 0): Promise<SocialPost[]> {
  try {
    const { data } = await supabase
      .from('social_posts')
      .select(`
        *,
        profile:social_profiles(id, username, display_name, avatar, is_public),
        likes:social_likes(user_id),
        saves:social_saves(user_id)
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(page * 20, (page + 1) * 20 - 1);

    return ((data || []) as Record<string, unknown>[]).map(p => ({
      ...p,
      isLiked: Array.isArray(p.likes) && (p.likes as {user_id:string}[]).some(l => l.user_id === userId),
      isSaved: Array.isArray(p.saves) && (p.saves as {user_id:string}[]).some(s => s.user_id === userId),
      likesCount: Array.isArray(p.likes) ? (p.likes as unknown[]).length : (p.likes_count || 0),
      commentsCount: p.comments_count || 0,
    })) as SocialPost[];
  } catch { return []; }
}

export async function getFollowingFeed(userId: string, page = 0): Promise<SocialPost[]> {
  try {
    const { data: follows } = await supabase
      .from('social_follows')
      .select('following_id')
      .eq('follower_id', userId);
    
    const ids = (follows || []).map((f: {following_id: string}) => f.following_id);
    if (ids.length === 0) return [];

    const { data } = await supabase
      .from('social_posts')
      .select(`
        *,
        profile:social_profiles(id, username, display_name, avatar),
        likes:social_likes(user_id),
        saves:social_saves(user_id)
      `)
      .in('user_id', ids)
      .order('created_at', { ascending: false })
      .range(page * 20, (page + 1) * 20 - 1);

    return ((data || []) as Record<string, unknown>[]).map(p => ({
      ...p,
      isLiked: Array.isArray(p.likes) && (p.likes as {user_id:string}[]).some(l => l.user_id === userId),
      isSaved: Array.isArray(p.saves) && (p.saves as {user_id:string}[]).some(s => s.user_id === userId),
      likesCount: Array.isArray(p.likes) ? (p.likes as unknown[]).length : (p.likes_count || 0),
    })) as SocialPost[];
  } catch { return []; }
}

// ── Posts ──────────────────────────────────────────────────────────────────
export async function createPost(post: Omit<SocialPost, 'id' | 'likesCount' | 'commentsCount' | 'isLiked' | 'isSaved' | 'profile'>): Promise<SocialPost | null> {
  try {
    const { data } = await supabase
      .from('social_posts')
      .insert({
        user_id: post.userId,
        type: post.type,
        title: post.title,
        content: post.content,
        book_title: post.bookTitle,
        book_author: post.bookAuthor,
        book_emoji: post.bookEmoji,
        tags: post.tags,
        is_public: true,
        created_at: post.createdAt,
      })
      .select()
      .single();
    return data as SocialPost | null;
  } catch { return null; }
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
      .select(`*, profile:social_profiles(id, username, display_name, avatar), likes:social_likes(user_id)`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return ((data || []) as Record<string, unknown>[]).map(p => ({
      ...p,
      isLiked: Array.isArray(p.likes) && (p.likes as {user_id:string}[]).some(l => l.user_id === userId),
      likesCount: Array.isArray(p.likes) ? (p.likes as unknown[]).length : 0,
      commentsCount: p.comments_count || 0,
    })) as SocialPost[];
  } catch { return []; }
}

// ── Likes ──────────────────────────────────────────────────────────────────
export async function toggleLike(postId: string, userId: string, isLiked: boolean): Promise<void> {
  try {
    if (isLiked) {
      await supabase.from('social_likes').delete().eq('post_id', postId).eq('user_id', userId);
    } else {
      await supabase.from('social_likes').insert({ post_id: postId, user_id: userId });
    }
  } catch { /* ignore */ }
}

export async function toggleSave(postId: string, userId: string, isSaved: boolean): Promise<void> {
  try {
    if (isSaved) {
      await supabase.from('social_saves').delete().eq('post_id', postId).eq('user_id', userId);
    } else {
      await supabase.from('social_saves').insert({ post_id: postId, user_id: userId });
    }
  } catch { /* ignore */ }
}

// ── Comments ───────────────────────────────────────────────────────────────
export async function getComments(postId: string, userId: string): Promise<SocialComment[]> {
  try {
    const { data } = await supabase
      .from('social_comments')
      .select(`*, profile:social_profiles(id, username, display_name, avatar), likes:social_comment_likes(user_id)`)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    return ((data || []) as Record<string, unknown>[]).map(c => ({
      ...c,
      isLiked: Array.isArray(c.likes) && (c.likes as {user_id:string}[]).some(l => l.user_id === userId),
      likesCount: Array.isArray(c.likes) ? (c.likes as unknown[]).length : 0,
    })) as SocialComment[];
  } catch { return []; }
}

export async function addComment(postId: string, userId: string, content: string): Promise<SocialComment | null> {
  try {
    const { data } = await supabase
      .from('social_comments')
      .insert({ post_id: postId, user_id: userId, content })
      .select(`*, profile:social_profiles(id, username, display_name, avatar)`)
      .single();
    return data as SocialComment | null;
  } catch { return null; }
}

export async function toggleCommentLike(commentId: string, userId: string, isLiked: boolean): Promise<void> {
  try {
    if (isLiked) {
      await supabase.from('social_comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId);
    } else {
      await supabase.from('social_comment_likes').insert({ comment_id: commentId, user_id: userId });
    }
  } catch { /* ignore */ }
}

// ── Follows ────────────────────────────────────────────────────────────────
export async function toggleFollow(followerId: string, followingId: string, isFollowing: boolean): Promise<void> {
  try {
    if (isFollowing) {
      await supabase.from('social_follows').delete().eq('follower_id', followerId).eq('following_id', followingId);
    } else {
      await supabase.from('social_follows').insert({ follower_id: followerId, following_id: followingId });
    }
  } catch { /* ignore */ }
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
  } catch { return false; }
}

export async function getSavedPosts(userId: string): Promise<SocialPost[]> {
  try {
    const { data } = await supabase
      .from('social_saves')
      .select(`post:social_posts(*, profile:social_profiles(id, username, display_name, avatar), likes:social_likes(user_id))`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return ((data || []) as Record<string, unknown>[]).map(s => {
      const p = s.post as Record<string, unknown>;
      return {
        ...p,
        isLiked: Array.isArray(p?.likes) && (p.likes as {user_id:string}[]).some(l => l.user_id === userId),
        isSaved: true,
        likesCount: Array.isArray(p?.likes) ? (p.likes as unknown[]).length : 0,
        commentsCount: p?.comments_count || 0,
      };
    }) as SocialPost[];
  } catch { return []; }
}
