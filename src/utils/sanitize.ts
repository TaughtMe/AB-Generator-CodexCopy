import DOMPurify from 'dompurify';

/**
 * Strict HTML sanitizer (whitelist approach) for Tiptap content.
 * Must be used before rendering any raw HTML from the store.
 */
export const sanitizeHtml = (dirtyHtml: string): string => {
  return DOMPurify.sanitize(dirtyHtml, {
    ALLOWED_TAGS: ['p', 'b', 'i', 'u', 'em', 'strong', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'br', 'span'],
    ALLOWED_ATTR: ['class', 'style'],
  });
};
