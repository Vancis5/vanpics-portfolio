import { getDocEl, updateBodyScrollState } from './admin/ui.js';
import { initAuth } from './admin/auth.js';
import { initUploader, resetFileSelection } from './admin/uploader.js';
import { initEditor, openEditModal, clearEditPreview } from './admin/editor.js';
import { initCatalog, loadArchives, getArchivesList } from './admin/catalog.js';
import { initUtilities } from './admin/utilities.js';

// Initialize sub-modules
initAuth();

initEditor({
  getArchivesList,
  onArchiveUpdated: loadArchives
});

initUploader({
  onUploadSuccess: loadArchives
});

initCatalog({
  onOpenEdit: (type, id) => openEditModal(type, id, getArchivesList())
});

initUtilities({
  onDbSorted: loadArchives
});

// Modal Overlay Click-to-Dismiss handlers
const uploadModal = getDocEl('upload-modal-overlay');
const editModal = getDocEl('edit-modal-overlay');
const utilitiesModal = getDocEl('utilities-modal-overlay');
const confirmModal = getDocEl('confirm-modal-overlay');
const form = document.getElementById('cms-form') as HTMLFormElement | null;
const editForm = document.getElementById('edit-cms-form') as HTMLFormElement | null;

window.addEventListener('click', (e) => {
  if (e.target === uploadModal) {
    uploadModal.classList.remove('open');
    resetFileSelection();
    form?.reset();
    updateBodyScrollState();
  }
  if (e.target === editModal) {
    editModal.classList.remove('open');
    editForm?.reset();
    clearEditPreview();
    updateBodyScrollState();
  }
  if (e.target === utilitiesModal) {
    utilitiesModal.classList.remove('open');
    updateBodyScrollState();
  }
  if (e.target === confirmModal) {
    confirmModal.classList.remove('open');
    updateBodyScrollState();
  }
});

// Sticky control panel: toggle .stuck class for bottom border when scrolled
const controlPanel = document.querySelector('.control-panel');
if (controlPanel) {
  const sentinel = document.createElement('div');
  sentinel.style.height = '1px';
  sentinel.style.width = '1px';
  sentinel.style.position = 'absolute';
  sentinel.style.top = '0';
  sentinel.style.left = '0';
  sentinel.style.pointerEvents = 'none';
  if (controlPanel.parentElement) {
    controlPanel.parentElement.style.position = 'relative';
  }
  controlPanel.before(sentinel);

  const obs = new IntersectionObserver(([entry]) => {
    controlPanel.classList.toggle('stuck', !entry.isIntersecting);
  }, { threshold: 0 });
  obs.observe(sentinel);
}

// Scroll logic for collapsing the "add media" FAB on mobile
const addMediaBtn = document.getElementById('btn-open-upload-modal');
if (addMediaBtn) {
  let lastScrollY = window.scrollY;
  let accumulatedScroll = 0;
  
  window.addEventListener('scroll', () => {
    if (window.innerWidth <= 768) {
      const currentScrollY = window.scrollY;
      const diff = currentScrollY - lastScrollY;
      
      if ((diff > 0 && accumulatedScroll < 0) || (diff < 0 && accumulatedScroll > 0)) {
        accumulatedScroll = 0;
      }
      accumulatedScroll += diff;
      
      if (currentScrollY <= 50) {
        addMediaBtn.classList.remove('collapsed');
        accumulatedScroll = 0;
      } else if (accumulatedScroll > 30) {
        addMediaBtn.classList.add('collapsed');
        accumulatedScroll = 0;
      } else if (accumulatedScroll < -30) {
        addMediaBtn.classList.remove('collapsed');
        accumulatedScroll = 0;
      }
      
      lastScrollY = currentScrollY;
    }
  }, { passive: true });
}
