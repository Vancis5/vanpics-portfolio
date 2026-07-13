export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://vanpics-cms-api.lorzanofrancisevan.workers.dev';

// Client-side file size limits (match worker limits)
export const MAX_IMAGE_BYTES = 30 * 1024 * 1024;  // 30 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

// Local placeholder data URI (no external requests)
export const PLACEHOLDER_SRC = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="%23222"><rect width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23555" font-size="11" font-family="monospace">no img</text></svg>');

export function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

export function plaintextToHtml(text) {
  if (!text) return '';
  
  // 1. Escape entire text first to prevent HTML/XSS injection
  let escaped = escapeHtml(text);
  
  const links = [];
  // 2. Convert Markdown links [Text](URL) to placeholder tokens
  let html = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, label, url) => {
    const rawUrl = url.replace(/&amp;/g, '&');
    links.push(`<a href="${rawUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`);
    return `___LINK_PLACEHOLDER_${links.length - 1}___`;
  });
  
  // 3. Convert remaining raw URLs to placeholder tokens
  html = html.replace(/(https?:\/\/[^\s&<]+(?:&amp;[^\s&<]+)*)/g, (match) => {
    const rawUrl = match.replace(/&amp;/g, '&');
    links.push(`<a href="${rawUrl}" target="_blank" rel="noopener noreferrer">${rawUrl}</a>`);
    return `___LINK_PLACEHOLDER_${links.length - 1}___`;
  });

  // 4. Restore all link tokens in order
  for (let i = 0; i < links.length; i++) {
    html = html.replace(`___LINK_PLACEHOLDER_${i}___`, links[i]);
  }

  // 5. Convert single newlines to <br>
  html = html.replace(/\r?\n/g, ' <br> ');
  
  return html.trim();
}

export function htmlToPlaintext(html) {
  if (!html) return '';
  
  let text = html;
  
  // 1. Convert <a href="URL" ...>Text</a> to [Text](URL)
  text = text.replace(/&lt;a\s+(?:[^&gt;]*?\s+)?href=(['"])(.*?)\1[^&gt;]*?&gt;(.*?)&lt;\/a&gt;/gi, (match, quote, url, label) => {
    if (label.trim() === url.trim()) {
      return url;
    }
    return `[${label}](${url})`;
  });
  text = text.replace(/<a\s+(?:[^>]*?\s+)?href=(['"])(.*?)\1[^>]*?>(.*?)<\/a>/gi, (match, quote, url, label) => {
    if (label.trim() === url.trim()) {
      return url;
    }
    return `[${label}](${url})`;
  });
  
  // 2. Convert <br> or <br/> to \n
  text = text.replace(/<br\s*\/?>/gi, '\n');
  
  // Remove any remaining HTML tags (safety cleanup)
  text = text.replace(/<[^>]*>/g, '');
  
  // Clean up spacing around newlines
  text = text.replace(/ \n /g, '\n').replace(/ \n/g, '\n').replace(/\n /g, '\n');
  
  return text.trim();
}

export function getYearFromDate(dateStr) {
  if (!dateStr) return 'undated';
  const match = dateStr.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : 'undated';
}

export function isUntitled(item) {
  const title = (item.title || '').toLowerCase().trim();
  return !title || title === 'untitled';
}

export function parseDate(item) {
  if (!item) return 0;
  
  const tryParse = (str) => {
    if (!str) return NaN;
    let cleaned = String(str).trim()
      .replace(/-/g, '/')
      .replace(/\s+/g, ' ');
    let d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d.getTime();
    
    d = new Date(str);
    if (!isNaN(d.getTime())) return d.getTime();
    
    return NaN;
  };

  // Try item.date FIRST (actual date the photo was taken)
  if (item.date) {
    const val = tryParse(item.date);
    if (!isNaN(val)) return val;
    
    // Manual fallback for custom formats like "dec 29, 2025"
    const dateStr = String(item.date).trim().toLowerCase();
    const months = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
      january: 0, february: 1, march: 2, april: 3, june: 5,
      july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
    };
    const matchMonthDayYear = dateStr.match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (matchMonthDayYear) {
      const mStr = matchMonthDayYear[1];
      const day = parseInt(matchMonthDayYear[2], 10);
      const year = parseInt(matchMonthDayYear[3], 10);
      const month = months[mStr] !== undefined ? months[mStr] : 0;
      return new Date(year, month, day).getTime();
    }
    
    const matchYear = dateStr.match(/\b\d{4}\b/);
    if (matchYear) {
      const year = parseInt(matchYear[0], 10);
      return new Date(year, 0, 1).getTime();
    }
  }

  // Fallback to created_at (database upload time)
  if (item.created_at) {
    const val = tryParse(item.created_at);
    if (!isNaN(val)) return val;
  }
  
  return 0;
}
