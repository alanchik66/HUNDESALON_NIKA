import { jsonResponse } from './_lib/http-security.js';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const lang = (url.searchParams.get('lang') || 'de').toLowerCase().slice(0, 2);
  const slug = url.searchParams.get('slug');

  const postsUrl = new URL('/data/posts.json', url.origin);
  const response = await fetch(postsUrl);
  const posts = await response.json().catch(() => []);
  const localized = Array.isArray(posts)
    ? posts
        .map(post => ({
          slug: post.slug,
          date: post.date,
          ...(post.languages?.[lang] || post.languages?.de || {}),
        }))
        .filter(post => post.title)
    : [];

  if (slug) {
    const post = localized.find(item => item.slug === slug);
    return post
      ? jsonResponse({ success: true, post })
      : jsonResponse({ success: false, message: 'Post not found' }, 404);
  }

  return jsonResponse({ success: true, posts: localized });
}
