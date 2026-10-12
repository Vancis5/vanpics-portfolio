import { fetchArchives } from './api.js';
import { renderArchivesList } from './render.js';

let activeFilter = localStorage.getItem('vanpics_cms_filter_type') || 'all';
let searchQuery = localStorage.getItem('vanpics_cms_search') || '';
let globalArchivesList: any[] = [];

export function getArchivesList(): any[] {
  return globalArchivesList;
}

function updateClearButtonVisibility() {
  const btn = document.getElementById('btn-clear-filters');
  const btnMobile = document.getElementById('btn-clear-filters-mobile');

  const isDefaultSearch = searchQuery === '';
  const isDefaultType = activeFilter === 'all';
  
  const sortEl = document.getElementById('filter-sort') as HTMLSelectElement | null;
  const isDefaultSort = !sortEl || sortEl.value === 'date-desc';
  
  const groupEl = document.getElementById('filter-group') as HTMLSelectElement | null;
  const isDefaultGroup = !groupEl || groupEl.value === 'none';

  const shouldBeVisible = !(isDefaultSearch && isDefaultType && isDefaultSort && isDefaultGroup);

  if (btn) {
    if (shouldBeVisible) btn.classList.add('visible');
    else btn.classList.remove('visible');
  }
  if (btnMobile) {
    if (shouldBeVisible) btnMobile.classList.add('visible');
    else btnMobile.classList.remove('visible');
  }
}

export function renderArchives() {
  const itemsContainer = document.getElementById('items-container');
  const sortEl = document.getElementById('filter-sort') as HTMLSelectElement | null;
  const groupEl = document.getElementById('filter-group') as HTMLSelectElement | null;
  const sortVal = sortEl?.value || 'date-desc';
  const groupVal = groupEl?.value || 'none';

  renderArchivesList(itemsContainer, globalArchivesList, activeFilter, searchQuery, sortVal, groupVal);
  updateClearButtonVisibility();
}

export async function loadArchives() {
  const itemsContainer = document.getElementById('items-container');
  try {
    const data = await fetchArchives();

    globalArchivesList = [
      ...data.photos.map((p: any) => ({ ...p, type: 'photo' })),
      ...data.videos.map((v: any) => ({ ...v, type: 'video' }))
    ];

    globalArchivesList.sort((a, b) => new Date((b as any).created_at || 0).getTime() - new Date((a as any).created_at || 0).getTime());

    renderArchives();
  } catch (err) {
    if (itemsContainer) {
      itemsContainer.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: var(--text-muted); font-family: 'DM Mono', monospace; font-size: 0.72rem; text-transform: lowercase;">failed to connect to local database.</p>`;
    }
  }
}

function handleClearFilters() {
  const searchInput = document.getElementById('dashboard-search') as HTMLInputElement | null;
  const filterTypeEl = document.getElementById('filter-type') as HTMLSelectElement | null;
  const filterSortEl = document.getElementById('filter-sort') as HTMLSelectElement | null;
  const filterGroupEl = document.getElementById('filter-group') as HTMLSelectElement | null;

  searchQuery = '';
  if (searchInput) searchInput.value = '';
  localStorage.setItem('vanpics_cms_search', '');

  activeFilter = 'all';
  if (filterTypeEl) filterTypeEl.value = 'all';
  localStorage.setItem('vanpics_cms_filter_type', 'all');

  if (filterSortEl) filterSortEl.value = 'date-desc';
  localStorage.setItem('vanpics_cms_filter_sort', 'date-desc');

  if (filterGroupEl) filterGroupEl.value = 'none';
  localStorage.setItem('vanpics_cms_filter_group', 'none');

  renderArchives();
}

export function initCatalog(options: {
  onOpenEdit: (type: string, id: string | number) => void;
}) {
  const searchInput = document.getElementById('dashboard-search') as HTMLInputElement | null;
  const filterTypeDrop = document.getElementById('filter-type') as HTMLSelectElement | null;
  const filterSortDrop = document.getElementById('filter-sort') as HTMLSelectElement | null;
  const filterGroupDrop = document.getElementById('filter-group') as HTMLSelectElement | null;
  const btnClearFilters = document.getElementById('btn-clear-filters');
  const btnClearFiltersMobile = document.getElementById('btn-clear-filters-mobile');
  const itemsContainer = document.getElementById('items-container');

  // Restore cached search and filter parameters on load
  if (searchInput) searchInput.value = searchQuery;
  if (filterTypeDrop) filterTypeDrop.value = activeFilter;
  if (filterSortDrop) filterSortDrop.value = localStorage.getItem('vanpics_cms_filter_sort') || 'date-desc';
  if (filterGroupDrop) filterGroupDrop.value = localStorage.getItem('vanpics_cms_filter_group') || 'none';

  if (searchInput) {
    searchInput.addEventListener('input', (e: Event) => {
      searchQuery = (e.target as HTMLInputElement).value.trim();
      localStorage.setItem('vanpics_cms_search', searchQuery);
      renderArchives();
    });
  }

  if (filterTypeDrop) {
    filterTypeDrop.addEventListener('change', (e: Event) => {
      activeFilter = (e.target as HTMLSelectElement).value;
      localStorage.setItem('vanpics_cms_filter_type', activeFilter);
      renderArchives();
      (e.target as HTMLElement).blur();
    });
  }

  if (filterSortDrop) {
    filterSortDrop.addEventListener('change', (e: Event) => {
      localStorage.setItem('vanpics_cms_filter_sort', (e.target as HTMLSelectElement).value);
      renderArchives();
      (e.target as HTMLElement).blur();
    });
  }

  if (filterGroupDrop) {
    filterGroupDrop.addEventListener('change', (e: Event) => {
      localStorage.setItem('vanpics_cms_filter_group', (e.target as HTMLSelectElement).value);
      renderArchives();
      (e.target as HTMLElement).blur();
    });
  }

  if (btnClearFilters) btnClearFilters.addEventListener('click', handleClearFilters);
  if (btnClearFiltersMobile) btnClearFiltersMobile.addEventListener('click', handleClearFilters);

  if (itemsContainer) {
    itemsContainer.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      const card = target.closest('.asset-card') as HTMLElement | null;
      if (card) {
        const id = card.dataset.id;
        const type = card.dataset.type;
        if (id && type) {
          options.onOpenEdit(type, id);
        }
      }
    });
  }

  loadArchives();
}
