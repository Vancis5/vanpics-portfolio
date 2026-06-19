import { escapeHtml, PLACEHOLDER_SRC, isUntitled, parseDate, getYearFromDate } from './utils.js';

export function renderSingleCardHtml(p) {
  const isVideo = p.type === 'video';
  const isDraft = isUntitled(p);
  const typeLabel = isDraft ? 'draft' : (isVideo ? 'video' : (p.category || 'photo'));
  const typeClass = isDraft ? 'badge-draft' : (isVideo ? 'badge-video' : (p.category === 'figures' ? 'badge-figures' : 'badge-photo'));
  const thumbSrc = isVideo ? p.poster : (p.thumb || p.src);

  return `
    <div class="asset-card" data-id="${p.id}" data-type="${p.type}" style="cursor: pointer;">
      <div class="card-preview-wrapper">
        <img class="card-preview-media" src="${thumbSrc}" alt="${escapeHtml(p.title || 'untitled')}" onerror="this.onerror=null;this.src=PLACEHOLDER_SRC">
        ${isVideo ? `
          <div class="video-play-indicator">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        ` : ''}
      </div>
      <div class="card-info" style="padding: 1.2rem 1.2rem 1.4rem 1.2rem;">
        <div class="card-header-row">
          <div class="card-title" title="${escapeHtml(p.title || 'untitled')}">${escapeHtml(p.title || 'untitled')}</div>
          <span class="badge ${typeClass}">${typeLabel}</span>
        </div>
        
        <div class="card-meta-row" style="display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.3rem; overflow: hidden; width: 100%;">
          <div style="display: flex; align-items: center; gap: 0.45rem; overflow: hidden; width: 100%;">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-faint); flex-shrink: 0;"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
            <span class="meta-text" title="${escapeHtml(p.location || 'unknown location')}">${escapeHtml(p.location || 'unknown location')}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.45rem; overflow: hidden; width: 100%;">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-faint); flex-shrink: 0;"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span class="meta-text" title="${escapeHtml(p.date || 'undated')}">${escapeHtml(p.date || 'undated')}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Renders matching and sorted archive items to our Google Drive directory grid
export function renderArchivesList(itemsContainer, list, activeFilter, searchQuery, sortVal, groupVal) {
  if (!itemsContainer) return;

  const filtered = list.filter(item => {
    // Filter by category segment dropdown option
    if (activeFilter === 'photo' && item.type !== 'photo') return false;
    if (activeFilter === 'video' && item.type !== 'video') return false;
    if (activeFilter === 'figures' && (item.type !== 'photo' || item.category !== 'figures')) return false;
    if (activeFilter === 'draft' && !isUntitled(item)) return false;

    // Filter by text search query
    if (searchQuery) {
      const title = (item.title || '').toLowerCase();
      const location = (item.location || '').toLowerCase();
      const desc = (item.desc || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      
      if (!title.includes(query) && !location.includes(query) && !desc.includes(query)) return false;
    }

    return true;
  });

  // Sort filtered items (always placing draft items at the bottom of the list)
  filtered.sort((a, b) => {
    const draftA = isUntitled(a);
    const draftB = isUntitled(b);
    if (draftA && !draftB) return 1;
    if (!draftA && draftB) return -1;

    if (sortVal === 'date-desc') {
      return parseDate(b) - parseDate(a);
    } else if (sortVal === 'date-asc') {
      return parseDate(a) - parseDate(b);
    } else if (sortVal === 'last-modified') {
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    } else if (sortVal === 'name-asc') {
      return (a.title || '').localeCompare(b.title || '');
    } else if (sortVal === 'name-desc') {
      return (b.title || '').localeCompare(a.title || '');
    }
    return 0;
  });

  if (filtered.length === 0) {
    itemsContainer.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: var(--text-muted); font-family: 'DM Mono', monospace; font-size: 0.72rem; text-transform: lowercase; letter-spacing: 0.05em;">no matching archives found.</p>`;
    return;
  }

  if (groupVal === 'none') {
    itemsContainer.innerHTML = filtered.map(p => renderSingleCardHtml(p)).join('');
  } else {
    const groups = {};
    filtered.forEach(item => {
      let groupKey = '';
      if (groupVal === 'year') {
        groupKey = getYearFromDate(item.date);
      } else if (groupVal === 'type') {
        if (isUntitled(item)) {
          groupKey = 'drafts';
        } else {
          groupKey = item.type === 'video' ? 'videos' : (item.category || 'photographs');
        }
      } else if (groupVal === 'carousel') {
        const isHero = item.hero_slide === 1 || item.hero_slide === 'true' || item.hero_slide === true ||
                       item.heroSlide === 1 || item.heroSlide === 'true' || item.heroSlide === true;
        groupKey = isHero ? 'in carousel' : 'not in carousel';
      }
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(item);
    });

    const groupKeys = Object.keys(groups).sort((a, b) => {
      if (groupVal === 'year') {
        if (a === 'undated') return 1;
        if (b === 'undated') return -1;
        return b.localeCompare(a); // Descending years
      }
      if (a === 'drafts') return 1;
      if (b === 'drafts') return -1;
      return a.localeCompare(b);
    });

    itemsContainer.innerHTML = groupKeys.map(groupKey => {
      const groupItems = groups[groupKey];
      const renderedCards = groupItems.map(p => renderSingleCardHtml(p)).join('');
      return `
        <div class="group-section" style="grid-column: 1 / -1; margin-bottom: 2.5rem; width: 100%;">
          <div class="group-header" style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem;">
            <h3 style="font-family: 'DM Mono', monospace; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.2em; color: var(--accent); white-space: nowrap;">${groupKey}</h3>
            <div style="flex-grow: 1; height: 1px; background: var(--border);"></div>
            <span style="font-family: 'DM Mono', monospace; font-size: 0.65rem; color: var(--text-faint); letter-spacing: 0.05em;">${groupItems.length} item${groupItems.length > 1 ? 's' : ''}</span>
          </div>
          <div class="asset-grid">
            ${renderedCards}
          </div>
        </div>
      `;
    }).join('');
  }
}
