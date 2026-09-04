import {
  API_BASE_URL,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  PLACEHOLDER_SRC,
  escapeHtml,
  unescapeHtml,
  plaintextToHtml,
  htmlToPlaintext,
  getYearFromDate,
  isUntitled,
  parseDate
} from './admin/utils.js';

import {
  fetchArchives,
  deleteArchiveItem,
  updateArchiveItem,
  uploadArchiveItem,
  replacePhotoItem
} from './admin/api.js';

import { renderArchivesList } from './admin/render.js';
import { resizeImage } from './admin/pipeline.js';

function getDocEl<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Required element with id "${id}" was not found in the DOM.`);
  }
  return el as T;
}

// Form mode state
let currentMode = 'photo'; // 'photo' or 'video'
let currentAdminToken = localStorage.getItem('vanpics_admin_token') || sessionStorage.getItem('vanpics_admin_token') || '';

// Dashboard navigation state
let activeFilter = localStorage.getItem('vanpics_cms_filter_type') || 'all';
let searchQuery = localStorage.getItem('vanpics_cms_search') || '';
let globalArchivesList: any[] = []; // Caches all items for instantaneous filtering

// Modal elements
const uploadModal = getDocEl('upload-modal-overlay');
const openUploadModalBtn = getDocEl('btn-open-upload-modal');
const closeUploadModalBtn = getDocEl('btn-close-upload-modal');

const editModal = getDocEl('edit-modal-overlay');
const closeEditModalBtn = getDocEl('btn-close-edit-modal');
const editForm = getDocEl('edit-cms-form');
let currentlyEditingItem: any = null;

// Utilities Modal elements
const utilitiesModal = getDocEl('utilities-modal-overlay');
const openUtilitiesModalBtn = getDocEl('btn-open-utilities-modal');
const closeUtilitiesModalBtn = getDocEl('btn-close-utilities-modal');
const runDbSortBtn = getDocEl('btn-run-db-sort');
const runDbSortText = getDocEl('btn-run-db-sort-text');
const purgeCdnCacheBtn = getDocEl('btn-purge-cdn-cache');
const purgeCdnCacheText = getDocEl('btn-purge-cdn-cache-text');
const utilityTerminal = getDocEl('utility-terminal');

// Search and Filter Elements
const searchInput = getDocEl('dashboard-search');

// Replacement photo states
let processedEditPhotoBlob: Blob | null = null;
let processedEditThumbBlob: Blob | null = null;
let processedEditRawBlob: Blob | null = null;
let computedEditAspectRatio: number | null = null;

// Restore cached search and filter parameters on load
if (searchInput) {
  searchInput.value = searchQuery;
}
const filterTypeEl = getDocEl('filter-type');
if (filterTypeEl) {
  filterTypeEl.value = activeFilter;
}
const filterSortEl = getDocEl('filter-sort');
if (filterSortEl) {
  filterSortEl.value = localStorage.getItem('vanpics_cms_filter_sort') || 'date-desc';
}
const filterGroupEl = getDocEl('filter-group');
if (filterGroupEl) {
  filterGroupEl.value = localStorage.getItem('vanpics_cms_filter_group') || 'none';
}

// Tab buttons
const tabPhotoBtn = getDocEl('tab-photo');
const tabVideoBtn = getDocEl('tab-video');

// UI elements mapping - Photo Mode
const dropZonePhoto = getDocEl('drop-zone-photo');
const fileInputPhoto = getDocEl('file-input-photo');
const previewContainerPhoto = getDocEl('preview-container-photo');
const imgPreviewPhoto = getDocEl('image-preview-photo');
const removeBtnPhoto = getDocEl('remove-btn-photo');

// UI elements mapping - Video Mode
const dropZoneVideoGrid = getDocEl('drop-zone-video-grid');
const dropZoneVideo = getDocEl('drop-zone-video');
const fileInputVideo = getDocEl('file-input-video');
const previewContainerVideo = getDocEl('preview-container-video');
const videoPreview = getDocEl('video-preview');
const removeBtnVideo = getDocEl('remove-btn-video');

const dropZonePoster = getDocEl('drop-zone-poster');
const fileInputPoster = getDocEl('file-input-poster');
const previewContainerPoster = getDocEl('preview-container-poster');
const imgPreviewPoster = getDocEl('image-preview-poster');
const removeBtnPoster = getDocEl('remove-btn-poster');

// Photo-only & Video-only field wrappers
const photoOnlyElements = document.querySelectorAll('.photo-only');
const videoOnlyElements = document.querySelectorAll('.video-only');

// Global handles to ensure no Playwright test gets broken
const dropZone = dropZonePhoto;
const fileInput = fileInputPhoto;
const previewContainer = previewContainerPhoto;
const imgPreview = imgPreviewPhoto;
const removeBtn = removeBtnPhoto;

// Expose elements on window for E2E tests
window.dropZone = dropZone;
window.fileInput = fileInput;
window.previewContainer = previewContainer;
window.imgPreview = imgPreview;
window.removeBtn = removeBtn;

const form = getDocEl('cms-form');
const submitBtn = getDocEl('submit-btn');
const submitBtnText = getDocEl('submit-btn-text');
const pipelineStatus = getDocEl('pipeline-status');
const itemsContainer = getDocEl('items-container');
const toast = getDocEl('toast');

// Auth verification elements
const secretInput = getDocEl('secret-token');
const rememberCheckbox = getDocEl('remember-token');
const authStatus = getDocEl('auth-status');
const lockSecured = getDocEl('lock-secured');
const lockUnverified = getDocEl('lock-unverified');
const authSpinner = getDocEl('auth-spinner');
const togglePasswordBtn = getDocEl('toggle-password-btn');
const eyeShow = getDocEl('eye-show');
const eyeHide = getDocEl('eye-hide');

// File reference state
let selectedFile: File | null = null; // Photo mode
let selectedVideoFile: File | null = null; // Video mode
let selectedPosterFile: File | null = null; // Video mode

let computedAspectRatio = 1.0;

// Processed blobs state
let processedPhotoBlob: Blob | null = null;
let processedThumbBlob: Blob | null = null;
let processedRawBlob: Blob | null = null;


let processedVideoBlob: Blob | null = null;
let processedPosterBlob: Blob | null = null;

function showToast(text: string, type: 'success' | 'error' | string = 'success') {
  if (!toast) return;
  toast.innerText = text;
  toast.className = `toast show toast-${type}`;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

function clearEditPreview() {
  const imgPreview = getDocEl('edit-media-preview-img');
  if (imgPreview) {
    imgPreview.src = '';
    imgPreview.classList.remove('loaded');
    imgPreview.style.display = 'none';
    const container = imgPreview.closest('.edit-preview-container');
    if (container) {
      container.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    }
  }
  const placeholder = getDocEl('edit-media-preview-placeholder');
  if (placeholder) {
    placeholder.style.display = 'none';
  }
}

// Set up edit preview listeners for fade-in and dominant color extraction
const editPreviewImg = getDocEl('edit-media-preview-img');
if (editPreviewImg) {
  editPreviewImg.crossOrigin = 'anonymous';
  editPreviewImg.addEventListener('load', () => {
    // Only process if src is present and not empty
    if (!editPreviewImg.getAttribute('src')) {
      return;
    }
    
    // Add loaded class to trigger CSS opacity fade-in
    editPreviewImg.classList.add('loaded');
    
    // Attempt dynamic dominant color extraction from image pixels
    const container = editPreviewImg.closest('.edit-preview-container');
    if (container) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(editPreviewImg, 0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          container.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.25)`;
        }
      } catch (err) {
        container.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
      }
    }
  });
}

// Modal & Scroll State management
const confirmModal = getDocEl('confirm-modal-overlay');
const cancelDeleteBtn = getDocEl('btn-cancel-delete');
const confirmDeleteBtn = getDocEl('btn-confirm-delete');
const editDeleteBtn = getDocEl('edit-delete-btn');
const confirmDeleteText = getDocEl('confirm-delete-text');

function preventDefaultScroll(e: any) {
  if (e.target && typeof e.target.closest === 'function') {
    const textarea = e.target.closest('textarea');
    if (textarea) {
      const scrollTop = textarea.scrollTop;
      const scrollHeight = textarea.scrollHeight;
      const clientHeight = textarea.clientHeight;
      const delta = e.deltaY || -e.detail || e.wheelDelta;
      
      if (delta < 0 && scrollTop <= 0) {
        e.preventDefault();
      } else if (delta > 0 && scrollTop + clientHeight >= scrollHeight) {
        e.preventDefault();
      }
      return;
    }

    const modalBody = e.target.closest('.modal-body');
    if (modalBody) {
      const isScrollable = modalBody.scrollHeight > modalBody.clientHeight;
      if (isScrollable) {
        const scrollTop = modalBody.scrollTop;
        const scrollHeight = modalBody.scrollHeight;
        const clientHeight = modalBody.clientHeight;
        const delta = e.deltaY || -e.detail || e.wheelDelta;
        
        if (delta < 0 && scrollTop <= 0) {
          e.preventDefault();
        } else if (delta > 0 && scrollTop + clientHeight >= scrollHeight) {
          e.preventDefault();
        }
        return;
      }
    }
  }
  e.preventDefault();
}

function preventDefaultKeys(e: any) {
  const keys = ['Space', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'End', 'Home'];
  if (keys.includes(e.code)) {
    if (e.target && typeof e.target.closest === 'function') {
      const modalBody = e.target.closest('.modal-body');
      if (modalBody) return;
    }
    e.preventDefault();
  }
}

function updateBodyScrollState() {
  const openModals = document.querySelectorAll('.modal-overlay.open');
  if (openModals.length > 0) {
    document.body.classList.add('modal-open');
    document.documentElement.classList.add('modal-open');
    
    window.addEventListener('wheel', preventDefaultScroll, { passive: false });
    window.addEventListener('touchmove', preventDefaultScroll, { passive: false });
    window.addEventListener('keydown', preventDefaultKeys, { passive: false });
  } else {
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
    
    window.removeEventListener('wheel', preventDefaultScroll);
    window.removeEventListener('touchmove', preventDefaultScroll);
    window.removeEventListener('keydown', preventDefaultKeys);
  }
}

// Modal Triggers
if (openUploadModalBtn) {
  openUploadModalBtn.addEventListener('click', () => {
    uploadModal.classList.add('open');
    updateBodyScrollState();
  });
}

if (closeUploadModalBtn) {
  closeUploadModalBtn.addEventListener('click', () => {
    uploadModal.classList.remove('open');
    resetFileSelection();
    form.reset();
    updateBodyScrollState();
  });
}

if (closeEditModalBtn) {
  closeEditModalBtn.addEventListener('click', () => {
    editModal.classList.remove('open');
    currentlyEditingItem = null;
    editForm.reset();
    clearEditPreview();
    updateBodyScrollState();
  });
}

// Utilities Modal Triggers
if (openUtilitiesModalBtn) {
  openUtilitiesModalBtn.addEventListener('click', () => {
    utilitiesModal.classList.add('open');
    updateBodyScrollState();
    if (utilityTerminal) {
      utilityTerminal.style.display = 'none';
      utilityTerminal.innerText = '';
    }
  });
}

if (closeUtilitiesModalBtn) {
  closeUtilitiesModalBtn.addEventListener('click', () => {
    utilitiesModal.classList.remove('open');
    updateBodyScrollState();
  });
}

if (runDbSortBtn) {
  runDbSortBtn.addEventListener('click', async () => {
    const token = currentAdminToken;
    if (!token) {
      showToast('please verify your admin token first', 'error');
      return;
    }

    runDbSortBtn.disabled = true;
    runDbSortText.innerText = 'sorting collections...';
    
    if (utilityTerminal) {
      utilityTerminal.style.display = 'block';
      utilityTerminal.innerText = '> connecting to worker...\n';
    }

    try {
      if (utilityTerminal) utilityTerminal.innerText += '> POST /api/admin/sort-db\n';
      const res = await fetch(`${API_BASE_URL}/api/admin/sort-db`, {
        method: 'POST',
        headers: {
          'X-Admin-Token': token
        }
      });

      if (handleUnauthorized(res)) return;

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('database sorted successfully', 'success');
        if (utilityTerminal) {
          utilityTerminal.innerText += `> success! parsed and sorted:\n  - ${data.sortedPhotos} photos\n  - ${data.sortedVideos} videos\n> flushed api cache successfully!\n`;
        }
        loadArchives();
      } else {
        showToast(data.error || 'sorting failed', 'error');
        if (utilityTerminal) {
          utilityTerminal.innerText += `> error: ${data.error || 'failed to execute database sort.'}\n`;
        }
      }
    } catch (err) {
      showToast('server connection failed', 'error');
      if (utilityTerminal) {
        utilityTerminal.innerText += `> error: connection to backend failed.\n`;
      }
    } finally {
      runDbSortBtn.disabled = false;
      runDbSortText.innerText = 'run database sorter';
    }
  });
}

if (purgeCdnCacheBtn) {
  purgeCdnCacheBtn.addEventListener('click', async () => {
    const token = currentAdminToken;
    if (!token) {
      showToast('please verify your admin token first', 'error');
      return;
    }

    purgeCdnCacheBtn.disabled = true;
    purgeCdnCacheText.innerText = 'purging cache...';

    if (utilityTerminal) {
      utilityTerminal.style.display = 'block';
      utilityTerminal.innerText = '> invalidating edge cache keys...\n';
    }

    try {
      if (utilityTerminal) utilityTerminal.innerText += '> POST /api/admin/purge-cache\n';
      const res = await fetch(`${API_BASE_URL}/api/admin/purge-cache`, {
        method: 'POST',
        headers: {
          'X-Admin-Token': token
        }
      });

      if (handleUnauthorized(res)) return;

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('edge cdn cache purged successfully', 'success');
        if (utilityTerminal) {
          utilityTerminal.innerText += `> success! successfully invalidated ${data.purgedCount} endpoint cache objects.\n> changes should propagate to all clients instantly!\n`;
        }
      } else {
        showToast(data.error || 'purge failed', 'error');
        if (utilityTerminal) {
          utilityTerminal.innerText += `> error: ${data.error || 'failed to purge cache.'}\n`;
        }
      }
    } catch (err) {
      showToast('server connection failed', 'error');
      if (utilityTerminal) {
        utilityTerminal.innerText += `> error: connection to cdn gateway failed.\n`;
      }
    } finally {
      purgeCdnCacheBtn.disabled = false;
      purgeCdnCacheText.innerText = 'purge edge cache';
    }
  });
}

// Close on overlay click
window.addEventListener('click', (e) => {
  if (e.target === uploadModal) {
    uploadModal.classList.remove('open');
    resetFileSelection();
    form.reset();
    updateBodyScrollState();
  }
  if (e.target === editModal) {
    editModal.classList.remove('open');
    currentlyEditingItem = null;
    editForm.reset();
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

// Delete actions within Edit Modal with Confirmation Dialog
if (editDeleteBtn) {
  editDeleteBtn.addEventListener('click', () => {
    if (!currentlyEditingItem) return;
    confirmDeleteText.innerText = `are you sure you want to permanently delete the ${currentlyEditingItem.type} "${currentlyEditingItem.title || 'untitled'}"? this action cannot be undone.`;
    confirmModal.classList.add('open');
    updateBodyScrollState();
  });
}

if (cancelDeleteBtn) {
  cancelDeleteBtn.addEventListener('click', () => {
    confirmModal.classList.remove('open');
    updateBodyScrollState();
  });
}

if (confirmDeleteBtn) {
  confirmDeleteBtn.addEventListener('click', async () => {
    if (!currentlyEditingItem) return;
    confirmModal.classList.remove('open');
    const id = currentlyEditingItem.id;
    const type = currentlyEditingItem.type;
    const title = currentlyEditingItem.title;
    await deleteItem(type, id, title);
    editModal.classList.remove('open');
    currentlyEditingItem = null;
    updateBodyScrollState();
  });
}

// Toggle Password Visibility
if (togglePasswordBtn) {
  togglePasswordBtn.addEventListener('click', () => {
    if (secretInput.type === 'password') {
      secretInput.type = 'text';
      eyeShow.style.display = 'none';
      eyeHide.style.display = 'block';
    } else {
      secretInput.type = 'password';
      eyeShow.style.display = 'block';
      eyeHide.style.display = 'none';
    }
  });
}

function handleUnauthorized(res: Response) {
  if (res.status === 401) {
    showToast('session expired, please re-authenticate', 'error');
    localStorage.removeItem('vanpics_admin_token');
    sessionStorage.removeItem('vanpics_admin_token');
    setTimeout(() => {
      window.location.replace('login.html');
    }, 1500);
    return true;
  }
  return false;
}

// Check saved credentials and automatically verify
const savedToken = localStorage.getItem('vanpics_admin_token') || sessionStorage.getItem('vanpics_admin_token') || '';
if (savedToken) {
  const isRemembered = !!localStorage.getItem('vanpics_admin_token');
  if (rememberCheckbox) {
    rememberCheckbox.checked = isRemembered;
  }
  verifyToken(savedToken);
} else {
  window.location.replace('login.html');
}

// Logout Action
const logoutBtn = getDocEl('btn-logout');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('vanpics_admin_token');
    sessionStorage.removeItem('vanpics_admin_token');
    window.location.replace('login.html');
  });
}

let verifyTimeout: any = null;
if (secretInput) {
  secretInput.addEventListener('input', () => {
    const token = secretInput.value.trim();
    currentAdminToken = token;
    
    clearTimeout(verifyTimeout);
    if (!token) {
      localStorage.removeItem('vanpics_admin_token');
      sessionStorage.removeItem('vanpics_admin_token');
      setAuthStatus('unverified');
      return;
    }
    
    setAuthStatus('verifying');
    verifyTimeout = setTimeout(() => {
      verifyToken(token);
    }, 600);
  });
}

if (rememberCheckbox) {
  rememberCheckbox.addEventListener('change', () => {
    const token = currentAdminToken;
    if (!token) return;

    // Only update storage if verified/secured
    const isSecured = lockSecured && lockSecured.style.display === 'block';
    if (!isSecured) return;

    if (rememberCheckbox.checked) {
      localStorage.setItem('vanpics_admin_token', token);
      sessionStorage.removeItem('vanpics_admin_token');
    } else {
      localStorage.removeItem('vanpics_admin_token');
      sessionStorage.setItem('vanpics_admin_token', token);
    }
  });
}

function setAuthStatus(status: 'verifying' | 'secured' | 'failed' | 'unverified' | string) {
  if (!authSpinner) return;
  authSpinner.style.display = 'none';
  lockSecured.style.display = 'none';
  lockUnverified.style.display = 'none';
  
  if (status === 'verifying') {
    authSpinner.style.display = 'block';
    authStatus.title = "Verifying admin token...";
  } else if (status === 'secured') {
    lockSecured.style.display = 'block';
    lockSecured.classList.remove('text-danger', 'text-warning');
    lockSecured.classList.add('text-success');
    lockSecured.setAttribute('stroke', 'var(--success)');
    authStatus.title = "Admin Token Verified";
  } else if (status === 'failed') {
    lockSecured.style.display = 'block';
    lockSecured.classList.remove('text-success', 'text-warning');
    lockSecured.classList.add('text-danger');
    lockSecured.setAttribute('stroke', 'var(--danger)');
    authStatus.title = "Unauthorized: Invalid admin token";
  } else {
    lockUnverified.style.display = 'block';
    authStatus.title = "Token status: Unverified";
  }
}

async function verifyToken(token: string) {
  if (!token) return;
  
  setAuthStatus('verifying');
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/verify`, {
      method: 'GET',
      headers: {
        'X-Admin-Token': token
      }
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data && data.token) {
        currentAdminToken = data.token;
        if (rememberCheckbox && rememberCheckbox.checked) {
          localStorage.setItem('vanpics_admin_token', data.token);
        } else {
          sessionStorage.setItem('vanpics_admin_token', data.token);
        }
      }
      setAuthStatus('secured');
    } else {
      setAuthStatus('failed');
      localStorage.removeItem('vanpics_admin_token');
      sessionStorage.removeItem('vanpics_admin_token');
      setTimeout(() => {
        window.location.replace('login.html');
      }, 1000);
    }
  } catch (err) {
    setAuthStatus('unverified');
  }
}

// Tab Switcher handlers
if (tabPhotoBtn) {
  tabPhotoBtn.addEventListener('click', () => {
    switchMode('photo');
  });
}

if (tabVideoBtn) {
  tabVideoBtn.addEventListener('click', () => {
    switchMode('video');
  });
}

function switchMode(mode: 'photo' | 'video' | string) {
  if (currentMode === mode) return;
  currentMode = mode;
  
  if (mode === 'photo') {
    tabPhotoBtn.classList.add('active');
    tabVideoBtn.classList.remove('active');
    
    dropZonePhoto.style.display = 'flex';
    dropZoneVideoGrid.style.display = 'none';
    
    photoOnlyElements.forEach(el => (el as HTMLElement).style.display = '');
    videoOnlyElements.forEach(el => (el as HTMLElement).style.display = 'none');
    
    getDocEl('title').placeholder = 'untitled';
    getDocEl('title').previousElementSibling.innerText = 'title';
  } else {
    tabVideoBtn.classList.add('active');
    tabPhotoBtn.classList.remove('active');
    
    dropZonePhoto.style.display = 'none';
    dropZoneVideoGrid.style.display = 'grid';
    
    photoOnlyElements.forEach(el => (el as HTMLElement).style.display = 'none');
    videoOnlyElements.forEach(el => (el as HTMLElement).style.display = '');
    
    getDocEl('title').placeholder = 'untitled';
    getDocEl('title').previousElementSibling.innerText = 'title';
  }

  resetFileSelection();
}

// Dynamic Dropzone Setup
function setupDropzone(
  zone: HTMLElement | null,
  input: HTMLInputElement | null,
  type: string,
  previewContainer: HTMLElement | null,
  previewEl: HTMLElement | HTMLImageElement | HTMLVideoElement | null,
  removeBtn: HTMLElement | null
) {
  if (!zone) return;
  if (input) zone.addEventListener('click', () => input.click());
  
  zone.addEventListener('dragover', (e: DragEvent) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });

  zone.addEventListener('drop', (e: DragEvent) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0], type, previewContainer, previewEl);
    }
  });

  if (input) {
    input.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target && target.files && target.files[0]) {
        handleFileSelect(target.files[0], type, previewContainer, previewEl);
      }
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      resetSpecificFile(type, input, previewContainer, previewEl);
    });
  }
}

setupDropzone(dropZonePhoto, fileInputPhoto, 'photo', previewContainerPhoto, imgPreviewPhoto, removeBtnPhoto);
setupDropzone(dropZoneVideo, fileInputVideo, 'video', previewContainerVideo, videoPreview, removeBtnVideo);
setupDropzone(dropZonePoster, fileInputPoster, 'poster', previewContainerPoster, imgPreviewPoster, removeBtnPoster);

function checkFormState() {
  if (currentMode === 'photo') {
    const ok = selectedFile && processedPhotoBlob && processedThumbBlob;
    submitBtn.disabled = !ok;
  } else {
    const ok = selectedVideoFile && selectedPosterFile && processedVideoBlob && processedPosterBlob;
    submitBtn.disabled = !ok;
  }
}

function resetFileSelection() {
  selectedFile = null;
  selectedVideoFile = null;
  selectedPosterFile = null;

  processedPhotoBlob = null;
  processedThumbBlob = null;
  processedRawBlob = null;
  processedVideoBlob = null;
  processedPosterBlob = null;

  if (imgPreviewPhoto) imgPreviewPhoto.src = '';
  if (videoPreview) videoPreview.src = '';
  if (imgPreviewPoster) imgPreviewPoster.src = '';

  if (previewContainerPhoto) previewContainerPhoto.style.display = 'none';
  if (previewContainerVideo) previewContainerVideo.style.display = 'none';
  if (previewContainerPoster) previewContainerPoster.style.display = 'none';

  if (submitBtn) submitBtn.disabled = true;
  if (pipelineStatus) {
    pipelineStatus.innerHTML = '<div style="color: var(--text-muted); font-family: \'DM Mono\', monospace; font-size: 0.62rem; text-align: center; padding-top: 1.5rem;">awaiting file upload...</div>';
  }

  if (fileInputPhoto) fileInputPhoto.value = '';
  if (fileInputVideo) fileInputVideo.value = '';
  if (fileInputPoster) fileInputPoster.value = '';
}

function resetSpecificFile(
  type: string,
  input: HTMLInputElement | null,
  previewContainer: HTMLElement | null,
  previewEl: HTMLElement | HTMLImageElement | HTMLVideoElement | null
) {
  if (input) input.value = '';
  if (previewContainer) previewContainer.style.display = 'none';
  if (type === 'video') {
    if (previewEl) (previewEl as any).src = '';
    selectedVideoFile = null;
    processedVideoBlob = null;
  } else if (type === 'poster') {
    if (previewEl) (previewEl as any).src = '';
    selectedPosterFile = null;
    processedPosterBlob = null;
  } else {
    if (previewEl) (previewEl as any).src = '';
    selectedFile = null;
    processedPhotoBlob = null;
    processedThumbBlob = null;
    processedRawBlob = null;
  }
  checkFormState();
  if (pipelineStatus) {
    pipelineStatus.innerHTML = '<div style="color: var(--text-muted); font-family: \'DM Mono\', monospace; font-size: 0.62rem; text-align: center; padding-top: 1.5rem;">awaiting file upload...</div>';
  }
}

function handleFileSelect(
  file: File,
  type: string,
  previewContainer: HTMLElement | null,
  previewEl: HTMLElement | HTMLImageElement | HTMLVideoElement | null
) {
  if (type === 'video') {
    if (!file.type.startsWith('video/')) {
      showToast('file is not a video', 'error');
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      showToast(`video exceeds ${MAX_VIDEO_BYTES / 1024 / 1024}mb limit`, 'error');
      return;
    }
    selectedVideoFile = file;
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (e.target && e.target.result) {
        if (previewEl) (previewEl as any).src = e.target.result as string;
        if (previewContainer) previewContainer.style.display = 'block';
        processVideoPipeline(file);
      }
    };
    reader.readAsDataURL(file);
  } else if (type === 'poster') {
    if (!file.type.startsWith('image/')) {
      showToast('file is not an image', 'error');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showToast(`image exceeds ${MAX_IMAGE_BYTES / 1024 / 1024}mb limit`, 'error');
      return;
    }
    selectedPosterFile = file;
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (e.target && e.target.result) {
        if (previewEl) (previewEl as any).src = e.target.result as string;
        if (previewContainer) previewContainer.style.display = 'block';
        processPosterPipeline(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  } else {
    if (!file.type.startsWith('image/')) {
      showToast('file is not an image', 'error');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showToast(`image exceeds ${MAX_IMAGE_BYTES / 1024 / 1024}mb limit`, 'error');
      return;
    }
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (e.target && e.target.result) {
        if (previewEl) (previewEl as any).src = e.target.result as string;
        if (previewContainer) previewContainer.style.display = 'block';
        processImagePipeline(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  }
}

async function processVideoPipeline(videoFile: File) {
  if (!pipelineStatus) return;
  pipelineStatus.innerHTML = `
    <div class="pipeline-step" id="step-dimensions">checking dimensions & aspect ratio</div>
    <div class="pipeline-step" id="step-video-check">verifying video format</div>
  `;

  setStepState('dimensions', 'active');
  
  const videoEl = document.createElement('video');
  videoEl.src = URL.createObjectURL(videoFile);
  videoEl.muted = true;
  videoEl.playsInline = true;
  
  await new Promise(resolve => {
    videoEl.addEventListener('loadedmetadata', resolve);
  });

  computedAspectRatio = parseFloat((videoEl.videoWidth / videoEl.videoHeight).toFixed(4));
  getDocEl('step-dimensions').innerText = `aspect ratio: ${computedAspectRatio} (${videoEl.videoWidth}x${videoEl.videoHeight})`;
  setStepState('dimensions', 'success');

  setStepState('video-check', 'active');
  processedVideoBlob = videoFile;
  setStepState('video-check', 'success');

  checkFormState();
  if (processedPosterBlob) {
    showToast('video ready for upload', 'success');
  }
}

async function processPosterPipeline(imgSrc: string) {
  if (!pipelineStatus) return;
  
  if (!getDocEl('step-poster-compress')) {
    const posterStep = document.createElement('div');
    posterStep.className = 'pipeline-step';
    posterStep.id = 'step-poster-compress';
    posterStep.innerText = 'compressing poster image (1200px, webp)';
    pipelineStatus.appendChild(posterStep);
  }

  setStepState('poster-compress', 'active');
  const img = new Image();
  img.src = imgSrc;
  await new Promise(resolve => img.onload = resolve);
  
  processedPosterBlob = await resizeImage(img, 1200, 0.75);
  setStepState('poster-compress', 'success');

  checkFormState();
  if (processedVideoBlob) {
    showToast('video assets processed successfully', 'success');
  }
}

async function processImagePipeline(imgSrc: string) {
  if (!pipelineStatus) return;
  pipelineStatus.innerHTML = `
    <div class="pipeline-step" id="step-dimensions">checking dimensions & aspect ratio</div>
    <div class="pipeline-step" id="step-compress">compressing standard photo (2500px, webp)</div>
    <div class="pipeline-step" id="step-raw">compressing high-res raw photo (4000px, webp)</div>
    <div class="pipeline-step" id="step-thumbnail">compiling 600px thumbnail</div>
  `;
  
  const img = new Image();
  img.src = imgSrc;
  
  await new Promise(resolve => img.onload = resolve);
  
  setStepState('dimensions', 'active');
  computedAspectRatio = parseFloat((img.width / img.height).toFixed(4));
  getDocEl('step-dimensions').innerText = `aspect ratio: ${computedAspectRatio} (${img.width}x${img.height})`;
  setStepState('dimensions', 'success');

  setStepState('compress', 'active');
  processedPhotoBlob = await resizeImage(img, 2500, 0.75);
  setStepState('compress', 'success');

  setStepState('raw', 'active');
  processedRawBlob = await resizeImage(img, 4000, 0.95);
  setStepState('raw', 'success');

  setStepState('thumbnail', 'active');
  processedThumbBlob = await resizeImage(img, 600, 0.75);
  setStepState('thumbnail', 'success');
  
  checkFormState();
  showToast('photo processed successfully', 'success');
}

function setStepState(step: string, state: 'active' | 'success' | 'failed' | string) {
  const el = getDocEl(`step-${step}`);
  if (el) {
    el.className = `pipeline-step ${state}`;
  }
}

function updateClearButtonVisibility() {
  const btn = getDocEl('btn-clear-filters');
  const btnMobile = getDocEl('btn-clear-filters-mobile');

  const isDefaultSearch = searchQuery === '';
  const isDefaultType = activeFilter === 'all';
  
  const sortEl = getDocEl('filter-sort');
  const isDefaultSort = !sortEl || sortEl.value === 'date-desc';
  
  const groupEl = getDocEl('filter-group');
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

// Trigger render helper
function renderArchives() {
  const sortVal = getDocEl('filter-sort')?.value || 'date-desc';
  const groupVal = getDocEl('filter-group')?.value || 'none';
  renderArchivesList(itemsContainer, globalArchivesList, activeFilter, searchQuery, sortVal, groupVal);
  updateClearButtonVisibility();
}

// Unified load archives fetching both D1 and R2 listings in parallel
async function loadArchives() {
  try {
    const data = await fetchArchives();

    // Cache globally for filters
    globalArchivesList = [
      ...data.photos.map((p: any) => ({ ...p, type: 'photo' })),
      ...data.videos.map((v: any) => ({ ...v, type: 'video' }))
    ];

    // Sort items by creation date
    globalArchivesList.sort((a, b) => new Date((b as any).created_at || 0).getTime() - new Date((a as any).created_at || 0).getTime());

    renderArchives();
  } catch (err) {
    if (itemsContainer) {
      itemsContainer.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: var(--text-muted); font-family: 'DM Mono', monospace; font-size: 0.72rem; text-transform: lowercase;">failed to connect to local database.</p>`;
    }
  }
}

// Handles Search and Filter events instantly
if (searchInput) {
  searchInput.addEventListener('input', (e: Event) => {
    searchQuery = (e.target as any).value.trim();
    localStorage.setItem('vanpics_cms_search', searchQuery);
    renderArchives();
  });
}

const filterTypeDrop = getDocEl('filter-type');
if (filterTypeDrop) {
  filterTypeDrop.addEventListener('change', (e: Event) => {
    activeFilter = (e.target as any).value;
    localStorage.setItem('vanpics_cms_filter_type', activeFilter);
    renderArchives();
    (e.target as any).blur();
  });
}

const filterSortDrop = getDocEl('filter-sort');
if (filterSortDrop) {
  filterSortDrop.addEventListener('change', (e: Event) => {
    localStorage.setItem('vanpics_cms_filter_sort', (e.target as any).value);
    renderArchives();
    (e.target as any).blur();
  });
}

const filterGroupDrop = getDocEl('filter-group');
if (filterGroupDrop) {
  filterGroupDrop.addEventListener('change', (e: Event) => {
    localStorage.setItem('vanpics_cms_filter_group', (e.target as any).value);
    renderArchives();
    (e.target as any).blur();
  });
}

function handleClearFilters() {
  searchQuery = '';
  if (searchInput) searchInput.value = '';
  localStorage.setItem('vanpics_cms_search', '');

  activeFilter = 'all';
  const filterTypeEl = getDocEl('filter-type');
  if (filterTypeEl) filterTypeEl.value = 'all';
  localStorage.setItem('vanpics_cms_filter_type', 'all');

  const filterSortEl = getDocEl('filter-sort');
  if (filterSortEl) filterSortEl.value = 'date-desc';
  localStorage.setItem('vanpics_cms_filter_sort', 'date-desc');

  const filterGroupEl = getDocEl('filter-group');
  if (filterGroupEl) filterGroupEl.value = 'none';
  localStorage.setItem('vanpics_cms_filter_group', 'none');

  renderArchives();
}

const btnClearFilters = getDocEl('btn-clear-filters');
if (btnClearFilters) {
  btnClearFilters.addEventListener('click', handleClearFilters);
}

const btnClearFiltersMobile = getDocEl('btn-clear-filters-mobile');
if (btnClearFiltersMobile) {
  btnClearFiltersMobile.addEventListener('click', handleClearFilters);
}

// Delegate grid clicks for opening the edit modal
if (itemsContainer) {
  itemsContainer.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement;
    if (!target) return;
    const card = target.closest('.asset-card') as HTMLElement | null;
    if (card) {
      const id = card.dataset.id;
      const type = card.dataset.type;
      if (id && type) {
        openEditModal(type, id);
      }
    }
  });
}

// Populate and open edit details modal (Read & Update setup)
function openEditModal(type: string, id: string | number) {
  const item = globalArchivesList.find(i => i.id == id && i.type === type);
  if (!item) return;

  currentlyEditingItem = item;
  
  // Clear old preview first to prevent visual flashing of the previous asset
  clearEditPreview();

  // Reset replacement photo states
  processedEditPhotoBlob = null;
  processedEditThumbBlob = null;
  processedEditRawBlob = null;
  computedEditAspectRatio = null;
  
  const editFileStatus = getDocEl('edit-photo-file-status');
  if (editFileStatus) editFileStatus.innerText = 'replace';
  
  const editPipeline = getDocEl('edit-pipeline-status');
  if (editPipeline) {
    editPipeline.style.display = 'none';
    editPipeline.innerHTML = '';
  }
  
  const editFileInput = getDocEl('edit-photo-file-input');
  if (editFileInput) editFileInput.value = '';

  // Populate fields
  getDocEl('edit-title').value = unescapeHtml(item.title || '');
  getDocEl('edit-date').value = unescapeHtml(item.date || '');
  getDocEl('edit-location').value = unescapeHtml(item.location || '');
  getDocEl('edit-desc').value = htmlToPlaintext(item.desc || '');
  getDocEl('edit-aspect-ratio').value = item.aspect_ratio || 1.0;

  const editPhotoOnly = document.querySelectorAll('.edit-photo-only');
  const editVideoOnly = document.querySelectorAll('.edit-video-only');

  if (type === 'photo') {
    editPhotoOnly.forEach(el => (el as HTMLElement).style.display = '');
    editVideoOnly.forEach(el => (el as HTMLElement).style.display = 'none');
    
    getDocEl('edit-category').value = item.category || '';
    getDocEl('edit-hero-slide').checked = item.hero_slide === 1 || item.hero_slide === 'true';
  } else {
    editPhotoOnly.forEach(el => (el as HTMLElement).style.display = 'none');
    editVideoOnly.forEach(el => (el as HTMLElement).style.display = '');
    
    getDocEl('edit-music').value = unescapeHtml(item.music || '');
  }

  const imgPreview = getDocEl('edit-media-preview-img');
  const placeholderPreview = getDocEl('edit-media-preview-placeholder');

  if (type === 'photo') {
    const photoSrc = item.thumb || item.src;
    if (imgPreview) {
      if (photoSrc) {
        imgPreview.src = photoSrc;
        imgPreview.style.display = '';
      } else {
        imgPreview.style.display = 'none';
      }
    }
    if (placeholderPreview) {
      placeholderPreview.style.display = photoSrc ? 'none' : '';
      if (!photoSrc) placeholderPreview.textContent = 'photo preview';
    }
  } else {
    if (imgPreview) {
      if (item.poster) {
        imgPreview.src = item.poster;
        imgPreview.style.display = '';
      } else {
        imgPreview.style.display = 'none';
      }
    }
    if (placeholderPreview) {
      placeholderPreview.style.display = item.poster ? 'none' : '';
      if (!item.poster) placeholderPreview.textContent = 'video asset';
    }
  }

  editModal.classList.add('open');
  updateBodyScrollState();
  updateEditNavArrows();
}

async function processEditImagePipeline(imgSrc: string) {
  const pipeline = getDocEl('edit-pipeline-status');
  if (!pipeline) return;
  pipeline.style.display = 'block';
  pipeline.innerHTML = `
    <div class="pipeline-step" id="step-edit-dimensions">checking dimensions & aspect ratio</div>
    <div class="pipeline-step" id="step-edit-compress">compressing standard photo (2500px, webp)</div>
    <div class="pipeline-step" id="step-edit-raw">compressing high-res raw photo (4000px, webp)</div>
    <div class="pipeline-step" id="step-edit-thumbnail">compiling 600px thumbnail</div>
  `;
  
  const img = new Image();
  img.src = imgSrc;
  
  await new Promise(resolve => img.onload = resolve);
  
  setStepState('edit-dimensions', 'active');
  computedEditAspectRatio = parseFloat((img.width / img.height).toFixed(4));
  getDocEl('step-edit-dimensions').innerText = `aspect ratio: ${computedEditAspectRatio} (${img.width}x${img.height})`;
  
  getDocEl('edit-aspect-ratio').value = computedEditAspectRatio;
  setStepState('edit-dimensions', 'success');

  setStepState('edit-compress', 'active');
  processedEditPhotoBlob = await resizeImage(img, 2500, 0.75);
  setStepState('edit-compress', 'success');

  setStepState('edit-raw', 'active');
  processedEditRawBlob = await resizeImage(img, 4000, 0.95);
  setStepState('edit-raw', 'success');

  setStepState('edit-thumbnail', 'active');
  processedEditThumbBlob = await resizeImage(img, 600, 0.75);
  setStepState('edit-thumbnail', 'success');
  
  showToast('replacement photo processed successfully', 'success');
}

const editFileInput = getDocEl('edit-photo-file-input');
const editFileStatus = getDocEl('edit-photo-file-status');
if (editFileInput) {
  editFileInput.addEventListener('change', async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (editFileStatus) editFileStatus.innerText = `selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`;
    
    const reader = new FileReader();
    reader.onload = async (event: ProgressEvent<FileReader>) => {
      if (event.target && event.target.result) {
        const imgPreview = getDocEl('edit-media-preview-img');
        if (imgPreview) imgPreview.src = event.target.result as string;
        await processEditImagePipeline(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  });
}

const editCancelBtn = getDocEl('edit-cancel-btn');
if (editCancelBtn) {
  editCancelBtn.addEventListener('click', () => {
    editModal.classList.remove('open');
    clearEditPreview();
    updateBodyScrollState();
  });
}

// Submit metadata update to backend (Update CRUD action)
if (editForm) {
  editForm.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    if (!currentlyEditingItem) return;

    const editSubmitBtn = getDocEl('edit-submit-btn');
    const submitText = editSubmitBtn ? editSubmitBtn.querySelector('span') : null;
    if (!editSubmitBtn || !submitText) return;
    
    editSubmitBtn.disabled = true;
    submitText.innerText = 'saving changes...';

    const id = currentlyEditingItem.id;
    const type = currentlyEditingItem.type;
    const token = currentAdminToken;

    const payload: any = {
      title: getDocEl('edit-title').value,
      date: getDocEl('edit-date').value,
      location: getDocEl('edit-location').value,
      desc: plaintextToHtml(getDocEl('edit-desc').value),
      aspectRatio: parseFloat(getDocEl('edit-aspect-ratio').value),
    };

    if (type === 'photo') {
      payload.category = getDocEl('edit-category').value;
      payload.heroSlide = getDocEl('edit-hero-slide').checked;
    } else {
      payload.music = getDocEl('edit-music').value;
    }

    try {
      const editPhotoBlob = processedEditPhotoBlob;
      const editThumbBlob = processedEditThumbBlob;
      const editRawBlob = processedEditRawBlob;
      const editAspectRatio = computedEditAspectRatio;

      // If we have a replacement photo, run the R2 replace action first!
      if (type === 'photo' && editPhotoBlob && editThumbBlob && editRawBlob) {
        submitText.innerText = 'replacing R2 asset file...';
        const fileFormData = new FormData();
        fileFormData.append('photo', editPhotoBlob, 'photo.webp');
        fileFormData.append('thumb', editThumbBlob, 'thumb.webp');
        fileFormData.append('aspectRatio', String(editAspectRatio));
        if (editRawBlob) {
          fileFormData.append('raw', editRawBlob, 'raw.webp');
        }

        const fileRes = await replacePhotoItem(id, fileFormData, token);
        if (handleUnauthorized(fileRes)) return;

        const fileData = await fileRes.json();
        if (!fileRes.ok || !fileData.success) {
          showToast(fileData.error || 'file replacement failed', 'error');
          editSubmitBtn.disabled = false;
          submitText.innerText = 'save changes';
          return;
        }
        showToast('photo files replaced successfully in R2', 'success');
      }

      submitText.innerText = 'saving changes...';
      const res = await updateArchiveItem(type, id, payload, token);

      if (handleUnauthorized(res)) return;

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('asset updated successfully', 'success');
        editModal.classList.remove('open');
        currentlyEditingItem = null;
        clearEditPreview();
        updateBodyScrollState();
        loadArchives();
      } else {
        showToast(data.error || 'update failed', 'error');
      }
    } catch (err) {
      showToast('server connection failed', 'error');
    } finally {
      editSubmitBtn.disabled = false;
      submitText.innerText = 'save changes';
    }
  });
}

// Delete CRUD Action
async function deleteItem(type: string, id: string | number, title: string) {
  const token = currentAdminToken;
  try {
    const res = await deleteArchiveItem(type, id, token);
    
    if (handleUnauthorized(res)) return;

    const data = await res.json();
    if (data.success) {
      showToast(`${type} deleted successfully`, 'success');
      loadArchives();
    } else {
      showToast(data.error || 'delete failed', 'error');
    }
  } catch (err) {
    showToast('database connection failed', 'error');
  }
}

// Playwright test compatibility
function deletePhoto(id: string | number, title: string) {
  return deleteItem('photo', id, title);
}

(window as any).deletePhoto = deletePhoto;

// Submit photo/video catalog creation (Create CRUD Action)
if (form) {
  form.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    
    const photoBlob = processedPhotoBlob;
    const thumbBlob = processedThumbBlob;
    const rawBlob = processedRawBlob;
    const videoBlob = processedVideoBlob;
    const posterBlob = processedPosterBlob;

    if (currentMode === 'photo') {
      if (!photoBlob || !thumbBlob) {
        showToast('processing file...', 'error');
        return;
      }
    } else {
      if (!videoBlob || !posterBlob) {
        showToast('processing files...', 'error');
        return;
      }
    }
    
    submitBtn.disabled = true;
    submitBtnText.innerText = 'cataloging...';
    
    const token = currentAdminToken;
    const formData = new FormData();

    formData.append('title', getDocEl('title').value);
    formData.append('date', getDocEl('date').value);
    formData.append('location', getDocEl('location').value);
    formData.append('desc', plaintextToHtml(getDocEl('desc').value));
    formData.append('aspectRatio', String(computedAspectRatio));

    if (currentMode === 'photo') {
      if (photoBlob) formData.append('photo', photoBlob);
      if (thumbBlob) formData.append('thumb', thumbBlob);
      if (rawBlob) {
        formData.append('raw', rawBlob, 'raw.webp');
      }
      formData.append('category', getDocEl('category').value);
      formData.append('heroSlide', String(getDocEl('hero-slide').checked));
    } else {
      if (videoBlob) formData.append('video', videoBlob);
      if (posterBlob) formData.append('poster', posterBlob);
      formData.append('music', getDocEl('music').value);
    }

    try {
      const res = await uploadArchiveItem(currentMode, formData, token);
      
      if (handleUnauthorized(res)) return;

      const data = await res.json();
      if (res.ok && data.success) {
        const titleVal = getDocEl('title').value.trim();
        if (!titleVal) {
          showToast('saved as draft', 'success');
        } else {
          showToast('archived successfully', 'success');
        }
        form.reset();
        resetFileSelection();
        uploadModal.classList.remove('open');
        updateBodyScrollState();
        loadArchives();
      } else {
        showToast(data.error || 'upload failed', 'error');
      }
    } catch (err) {
      showToast('server connection failed', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtnText.innerText = 'upload';
    }
  });
}

// Navigation for Edit Modal
function updateEditNavArrows() {
  const cards = Array.from(document.querySelectorAll('#items-container .asset-card')) as HTMLElement[];
  const prevBtn = getDocEl('btn-edit-prev');
  const nextBtn = getDocEl('btn-edit-next');
  if (!currentlyEditingItem || cards.length <= 1) {
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    return;
  }
  
  if (prevBtn) prevBtn.style.display = 'flex';
  if (nextBtn) nextBtn.style.display = 'flex';

  const currentIndex = cards.findIndex(card => card.dataset.id == currentlyEditingItem.id && card.dataset.type === currentlyEditingItem.type);

  if (prevBtn) {
    if (currentIndex <= 0) {
      prevBtn.disabled = true;
      prevBtn.style.opacity = '0.2';
      prevBtn.style.cursor = 'not-allowed';
    } else {
      prevBtn.disabled = false;
      prevBtn.style.opacity = '1';
      prevBtn.style.cursor = 'pointer';
    }
  }

  if (nextBtn) {
    if (currentIndex >= cards.length - 1 || currentIndex === -1) {
      nextBtn.disabled = true;
      nextBtn.style.opacity = '0.2';
      nextBtn.style.cursor = 'not-allowed';
    } else {
      nextBtn.disabled = false;
      nextBtn.style.opacity = '1';
      nextBtn.style.cursor = 'pointer';
    }
  }
}

const prevEditBtn = getDocEl('btn-edit-prev');
const nextEditBtn = getDocEl('btn-edit-next');

if (prevEditBtn) {
  prevEditBtn.addEventListener('click', () => {
    const cards = Array.from(document.querySelectorAll('#items-container .asset-card')) as HTMLElement[];
    if (!currentlyEditingItem) return;
    const currentIndex = cards.findIndex(card => card.dataset.id == currentlyEditingItem.id && card.dataset.type === currentlyEditingItem.type);
    if (currentIndex > 0) {
      const prevCard = cards[currentIndex - 1];
      const type = prevCard.dataset.type;
      const id = prevCard.dataset.id;
      if (type && id) {
        openEditModal(type, id);
      }
    }
  });
}

if (nextEditBtn) {
  nextEditBtn.addEventListener('click', () => {
    const cards = Array.from(document.querySelectorAll('#items-container .asset-card')) as HTMLElement[];
    if (!currentlyEditingItem) return;
    const currentIndex = cards.findIndex(card => card.dataset.id == currentlyEditingItem.id && card.dataset.type === currentlyEditingItem.type);
    if (currentIndex < cards.length - 1 && currentIndex !== -1) {
      const nextCard = cards[currentIndex + 1];
      const type = nextCard.dataset.type;
      const id = nextCard.dataset.id;
      if (type && id) {
        openEditModal(type, id);
      }
    }
  });
}

// Global window event listener for arrow keys navigation
window.addEventListener('keydown', (e) => {
  if (!editModal || !editModal.classList.contains('open')) return;
  const target = e.target as HTMLElement;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return;
  }
  
  if (e.key === 'ArrowLeft') {
    const prevBtn = getDocEl('btn-edit-prev');
    if (prevBtn && !prevBtn.disabled) {
      prevBtn.click();
    }
  } else if (e.key === 'ArrowRight') {
    const nextBtn = getDocEl('btn-edit-next');
    if (nextBtn && !nextBtn.disabled) {
      nextBtn.click();
    }
  }
});

loadArchives();

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
const addMediaBtn = getDocEl('btn-open-upload-modal');
if (addMediaBtn) {
  let lastScrollY = window.scrollY;
  let accumulatedScroll = 0;
  
  window.addEventListener('scroll', () => {
    if (window.innerWidth <= 768) {
      const currentScrollY = window.scrollY;
      const diff = currentScrollY - lastScrollY;
      
      // Reset accumulator if scrolling direction changes
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
