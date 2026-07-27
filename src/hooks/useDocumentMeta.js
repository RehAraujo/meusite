import { useEffect } from 'react';

const upsertMeta = (selector, attributes) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.append(element);
  }
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
};

export const useDocumentMeta = ({ title, description, path = '/', noindex = false }) => {
  useEffect(() => {
    const canonicalUrl = `https://renatajoin.com${path === '/' ? '/' : path}`;
    document.title = title;
    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: noindex ? 'noindex, nofollow, noarchive' : 'index, follow',
    });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: description,
    });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    upsertMeta('meta[property="og:image"]', {
      property: 'og:image',
      content: 'https://renatajoin.com/assets/renata-join-social.jpg',
    });
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.append(canonical);
    }
    canonical.href = canonicalUrl;
  }, [description, noindex, path, title]);
};
