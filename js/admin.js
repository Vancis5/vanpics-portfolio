import {
  API_BASE_URL,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  PLACEHOLDER_SRC,
  escapeHtml,
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

// Form mode state
let currentMode = 'photo'; // 'photo' or 'video'

// Dashboard navigation state
let activeFilter = localStorage.getItem('vanpics_cms_filter_type') || 'all';
let searchQuery = localStorage.getItem('vanpics_cms_search') || '';
let globalArchivesList = []; // Caches all items for instantaneous filtering

// Modal elements
const uploadModal = document.getElementById('upload-modal-overlay');
const openUploadModalBtn = document.getElementById('btn-open-upload-modal');
const closeUploadModalBtn = document.getElementById('btn-close-upload-modal');

const editModal = document.getElementById('edit-modal-overlay');
const closeEditModalBtn = document.getElementById('btn-close-edit-modal');
const editForm = document.getElementById('edit-cms-form');
let currentlyEditingItem = null;

// Utilities Modal elements
const utilitiesModal = document.getElementById('utilities-modal-overlay');
const openUtilitiesModalBtn = document.getElementById('btn-open-utilities-modal');
const closeUtilitiesModalBtn = document.getElementById('btn-close-utilities-modal');
const runDbSortBtn = document.getElementById('btn-run-db-sort');
const runDbSortText = document.getElementById('btn-run-db-sort-text');
const purgeCdnCacheBtn = document.getElementById('btn-purge-cdn-cache');
const purgeCdnCacheText = document.getElementById('btn-purge-cdn-cache-text');
const utilityTerminal = document.getElementById('utility-terminal');

// Search and Filter Elements
const searchInput = document.getElementById('dashboard-search');

// Replacement photo states
let processedEditPhotoBlob = null;
let processedEditThumbBlob = null;
let computedEditAspectRatio = null;

// Restore cached search and filter parameters on load
if (searchInput) {
  searchInput.value = searchQuery;
}
const filterTypeEl = document.getElementById('filter-type');
if (filterTypeEl) {
  filterTypeEl.value = activeFilter;
}
const filterSortEl = document.getElementById('filter-sort');
if (filterSortEl) {
  filterSortEl.value = localStorage.getItem('vanpics_cms_filter_sort') || 'date-desc';
}
const filterGroupEl = document.getElementById('filter-group');
if (filterGroupEl) {
  filterGroupEl.value = localStorage.getItem('vanpics_cms_filter_group') || 'none';
}

// Tab buttons
const tabPhotoBtn = document.getElementById('tab-photo');
const tabVideoBtn = document.getElementById('tab-video');

// UI elements mapping - Photo Mode
const dropZonePhoto = document.getElementById('drop-zone-photo');
const fileInputPhoto = document.getElementById('file-input-photo');
const previewContainerPhoto = document.getElementById('preview-container-photo');
const imgPreviewPhoto = document.getElementById('image-preview-photo');
const removeBtnPhoto = document.getElementById('remove-btn-photo');

// UI elements mapping - Video Mode
const dropZoneVideoGrid = document.getElementById('drop-zone-video-grid');
const dropZoneVideo = document.getElementById('drop-zone-video');
const fileInputVideo = document.getElementById('file-input-video');
const previewContainerVideo = document.getElementById('preview-container-video');
const videoPreview = document.getElementById('video-preview');
const removeBtnVideo = document.getElementById('remove-btn-video');

const dropZonePoster = document.getElementById('drop-zone-poster');
const fileInputPoster = document.getElementById('file-input-poster');
const previewContainerPoster = document.getElementById('preview-container-poster');
const imgPreviewPoster = document.getElementById('image-preview-poster');
const removeBtnPoster = document.getElementById('remove-btn-poster');

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

const form = document.getElementById('cms-form');
const submitBtn = document.getElementById('submit-btn');
const submitBtnText = document.getElementById('submit-btn-text');
const pipelineStatus = document.getElementById('pipeline-status');
const itemsContainer = document.getElementById('items-container');
const toast = document.getElementById('toast');

// Auth verification elements
const secretInput = document.getElementById('secret-token');
const rememberCheckbox = document.getElementById('remember-token');
const authStatus = document.getElementById('auth-status');
const lockSecured = document.getElementById('lock-secured');
const lockUnverified = document.getElementById('lock-unverified');
const authSpinner = document.getElementById('auth-spinner');
const togglePasswordBtn = document.getElementById('toggle-password-btn');
const eyeShow = document.getElementById('eye-show');
const eyeHide = document.getElementById('eye-hide');

// File reference state
let selectedFile = null; // Photo mode
let selectedVideoFile = null; // Video mode
let selectedPosterFile = null; // Video mode

let computedAspectRatio = 1.0;

// Processed blobs state
let processedPhotoBlob = null;
let processedThumbBlob = null;


let processedVideoBlob = null;
let processedPosterBlob = null;

function showToast(text, type = 'success') {
  if (!toast) return;
  toast.innerText = text;
  toast.className = `toast show toast-${type}`;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// Modal & Scroll State management
const confirmModal = document.getElementById('confirm-modal-overlay');
const cancelDeleteBtn = document.getElementById('btn-cancel-delete');
const confirmDeleteBtn = document.getElementById('btn-confirm-delete');
const editDeleteBtn = document.getElementById('edit-delete-btn');
const confirmDeleteText = document.getElementById('confirm-delete-text');

function preventDefaultScroll(e) {
  if (e.target && typeof e.target.closest === 'function') {
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

function preventDefaultKeys(e) {
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
    const token = secretInput.value.trim();
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
    const token = secretInput.value.trim();
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

function handleUnauthorized(res) {
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
const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('vanpics_admin_token');
    sessionStorage.removeItem('vanpics_admin_token');
    window.location.replace('login.html');
  });
}

let verifyTimeout = null;
if (secretInput) {
  secretInput.addEventListener('input', () => {
    const token = secretInput.value.trim();
    
    if (rememberCheckbox.checked) {
      localStorage.setItem('vanpics_admin_token', token);
    } else {
      sessionStorage.setItem('vanpics_admin_token', token);
    }

    clearTimeout(verifyTimeout);
    if (!token) {
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
    const token = secretInput.value.trim();
    if (rememberCheckbox.checked) {
      localStorage.setItem('vanpics_admin_token', token);
      sessionStorage.removeItem('vanpics_admin_token');
    } else {
      localStorage.removeItem('vanpics_admin_token');
      sessionStorage.setItem('vanpics_admin_token', token);
    }
  });
}

function setAuthStatus(status) {
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

async function verifyToken(token) {
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
        if (secretInput) {
          secretInput.value = data.token;
        }
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

function switchMode(mode) {
  if (currentMode === mode) return;
  currentMode = mode;
  
  if (mode === 'photo') {
    tabPhotoBtn.classList.add('active');
    tabVideoBtn.classList.remove('active');
    
    dropZonePhoto.style.display = 'flex';
    dropZoneVideoGrid.style.display = 'none';
    
    photoOnlyElements.forEach(el => el.style.display = '');
    videoOnlyElements.forEach(el => el.style.display = 'none');
    
    document.getElementById('title').placeholder = 'harbinger';
    document.getElementById('title').previousElementSibling.innerText = 'title';
  } else {
    tabVideoBtn.classList.add('active');
    tabPhotoBtn.classList.remove('active');
    
    dropZonePhoto.style.display = 'none';
    dropZoneVideoGrid.style.display = 'grid';
    
    photoOnlyElements.forEach(el => el.style.display = 'none');
    videoOnlyElements.forEach(el => el.style.display = '');
    
    document.getElementById('title').placeholder = 'cinematic shorelines';
    document.getElementById('title').previousElementSibling.innerText = 'title';
  }

  resetFileSelection();
}

// Dynamic Dropzone Setup
function setupDropzone(zone, input, type, previewContainer, previewEl, removeBtn) {
  if (!zone) return;
  zone.addEventListener('click', () => input.click());
  
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0], type, previewContainer, previewEl);
    }
  });

  input.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0], type, previewContainer, previewEl);
    }
  });

  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetSpecificFile(type, input, previewContainer, previewEl);
  });
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
  processedVideoBlob = null;
  processedPosterBlob = null;

  if (imgPreviewPhoto) imgPreviewPhoto.src = '';
  if (videoPreview) videoPreview.src = '';
  if (imgPreviewPoster) imgPreviewPoster.src = '';

  if (previewContainerPhoto) previewContainerPhoto.style.display = 'none';
  if (previewContainerVideo) previewContainerVideo.style.display = 'none';
  if (previewContainerPoster) previewContainerPoster.style.display = 'none';

  if (submitBtn) submitBtn.disabled = true;
  if (pipelineStatus) pipelineStatus.style.display = 'none';

  if (fileInputPhoto) fileInputPhoto.value = '';
  if (fileInputVideo) fileInputVideo.value = '';
  if (fileInputPoster) fileInputPoster.value = '';
}

function resetSpecificFile(type, input, previewContainer, previewEl) {
  input.value = '';
  previewContainer.style.display = 'none';
  if (type === 'video') {
    previewEl.src = '';
    selectedVideoFile = null;
    processedVideoBlob = null;
  } else if (type === 'poster') {
    previewEl.src = '';
    selectedPosterFile = null;
    processedPosterBlob = null;
  } else {
    previewEl.src = '';
    selectedFile = null;
    processedPhotoBlob = null;
    processedThumbBlob = null;
  }
  checkFormState();
  if (pipelineStatus) pipelineStatus.style.display = 'none';
}

function handleFileSelect(file, type, previewContainer, previewEl) {
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
    previewEl.src = URL.createObjectURL(file);
    previewContainer.style.display = 'block';
    processVideoPipeline(file);
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
    reader.onload = (e) => {
      previewEl.src = e.target.result;
      previewContainer.style.display = 'block';
      processPosterPipeline(e.target.result);
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
    reader.onload = (e) => {
      previewEl.src = e.target.result;
      previewContainer.style.display = 'block';
      processImagePipeline(e.target.result);
    };
    reader.readAsDataURL(file);
  }
}

async function processVideoPipeline(videoFile) {
  if (!pipelineStatus) return;
  pipelineStatus.style.display = 'block';
  pipelineStatus.innerHTML = `
    <div class="pipeline-step" id="step-dimensions">checking dimensions & aspect ratio...</div>
    <div class="pipeline-step" id="step-video-check">verifying video format...</div>
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
  document.getElementById('step-dimensions').innerText = `aspect ratio: ${computedAspectRatio} (${videoEl.videoWidth}x${videoEl.videoHeight})`;
  setStepState('dimensions', 'success');

  setStepState('video-check', 'active');
  processedVideoBlob = videoFile;
  setStepState('video-check', 'success');

  checkFormState();
  if (processedPosterBlob) {
    showToast('video ready for upload', 'success');
  }
}

async function processPosterPipeline(imgSrc) {
  if (!pipelineStatus) return;
  pipelineStatus.style.display = 'block';
  
  if (!document.getElementById('step-poster-compress')) {
    const posterStep = document.createElement('div');
    posterStep.className = 'pipeline-step';
    posterStep.id = 'step-poster-compress';
    posterStep.innerText = 'compressing poster image (1200px, webp)...';
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

async function processImagePipeline(imgSrc) {
  if (!pipelineStatus) return;
  pipelineStatus.style.display = 'block';
  pipelineStatus.innerHTML = `
    <div class="pipeline-step" id="step-dimensions">checking dimensions & aspect ratio...</div>
    <div class="pipeline-step" id="step-compress">compressing raw photo (2500px, webp)...</div>
    <div class="pipeline-step" id="step-thumbnail">compiling 600px thumbnail...</div>
  `;
  
  const img = new Image();
  img.src = imgSrc;
  
  await new Promise(resolve => img.onload = resolve);
  
  setStepState('dimensions', 'active');
  computedAspectRatio = parseFloat((img.width / img.height).toFixed(4));
  document.getElementById('step-dimensions').innerText = `aspect ratio: ${computedAspectRatio} (${img.width}x${img.height})`;
  setStepState('dimensions', 'success');

  setStepState('compress', 'active');
  processedPhotoBlob = await resizeImage(img, 2500, 0.75);
  setStepState('compress', 'success');

  setStepState('thumbnail', 'active');
  processedThumbBlob = await resizeImage(img, 600, 0.75);
  setStepState('thumbnail', 'success');
  
  checkFormState();
  showToast('photo processed successfully', 'success');
}

function setStepState(step, state) {
  const el = document.getElementById(`step-${step}`);
  if (el) {
    el.className = `pipeline-step ${state}`;
  }
}

// Trigger render helper
function renderArchives() {
  const sortVal = document.getElementById('filter-sort')?.value || 'date-desc';
  const groupVal = document.getElementById('filter-group')?.value || 'none';
  renderArchivesList(itemsContainer, globalArchivesList, activeFilter, searchQuery, sortVal, groupVal);
}

// Unified load archives fetching both D1 and R2 listings in parallel
async function loadArchives() {
  try {
    const data = await fetchArchives();

    // Cache globally for filters
    globalArchivesList = [
      ...data.photos.map(p => ({ ...p, type: 'photo' })),
      ...data.videos.map(v => ({ ...v, type: 'video' }))
    ];

    // Sort items by creation date
    globalArchivesList.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    renderArchives();
  } catch (err) {
    if (itemsContainer) {
      itemsContainer.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: var(--text-muted); font-family: 'DM Mono', monospace; font-size: 0.72rem; text-transform: lowercase;">failed to connect to local database.</p>`;
    }
  }
}

// Handles Search and Filter events instantly
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    localStorage.setItem('vanpics_cms_search', searchQuery);
    renderArchives();
  });
}

const filterTypeDrop = document.getElementById('filter-type');
if (filterTypeDrop) {
  filterTypeDrop.addEventListener('change', (e) => {
    activeFilter = e.target.value;
    localStorage.setItem('vanpics_cms_filter_type', activeFilter);
    renderArchives();
  });
}

const filterSortDrop = document.getElementById('filter-sort');
if (filterSortDrop) {
  filterSortDrop.addEventListener('change', (e) => {
    localStorage.setItem('vanpics_cms_filter_sort', e.target.value);
    renderArchives();
  });
}

const filterGroupDrop = document.getElementById('filter-group');
if (filterGroupDrop) {
  filterGroupDrop.addEventListener('change', (e) => {
    localStorage.setItem('vanpics_cms_filter_group', e.target.value);
    renderArchives();
  });
}

// Delegate grid clicks for opening the edit modal
if (itemsContainer) {
  itemsContainer.addEventListener('click', (e) => {
    const card = e.target.closest('.asset-card');
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
function openEditModal(type, id) {
  const item = globalArchivesList.find(i => i.id == id && i.type === type);
  if (!item) return;

  currentlyEditingItem = item;
  
  // Reset replacement photo states
  processedEditPhotoBlob = null;
  processedEditThumbBlob = null;
  computedEditAspectRatio = null;
  
  const editFileStatus = document.getElementById('edit-photo-file-status');
  if (editFileStatus) editFileStatus.innerText = 'replace';
  
  const editPipeline = document.getElementById('edit-pipeline-status');
  if (editPipeline) {
    editPipeline.style.display = 'none';
    editPipeline.innerHTML = '';
  }
  
  const editFileInput = document.getElementById('edit-photo-file-input');
  if (editFileInput) editFileInput.value = '';

  // Populate fields
  document.getElementById('edit-title').value = item.title || '';
  document.getElementById('edit-date').value = item.date || '';
  document.getElementById('edit-location').value = item.location || '';
  document.getElementById('edit-desc').value = htmlToPlaintext(item.desc || '');
  document.getElementById('edit-aspect-ratio').value = item.aspect_ratio || 1.0;

  const editPhotoOnly = document.querySelectorAll('.edit-photo-only');
  const editVideoOnly = document.querySelectorAll('.edit-video-only');

  if (type === 'photo') {
    editPhotoOnly.forEach(el => el.style.display = '');
    editVideoOnly.forEach(el => el.style.display = 'none');
    
    document.getElementById('edit-category').value = item.category || '';
    document.getElementById('edit-hero-slide').checked = item.hero_slide === 1 || item.hero_slide === 'true';
  } else {
    editPhotoOnly.forEach(el => el.style.display = 'none');
    editVideoOnly.forEach(el => el.style.display = '');
    
    document.getElementById('edit-music').value = item.music || '';
  }

  const imgPreview = document.getElementById('edit-media-preview-img');
  const placeholderPreview = document.getElementById('edit-media-preview-placeholder');

  if (type === 'photo') {
    if (imgPreview) {
      imgPreview.src = item.src;
      imgPreview.style.display = '';
    }
    if (placeholderPreview) placeholderPreview.style.display = 'none';
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
      placeholderPreview.style.display = '';
      placeholderPreview.textContent = 'video asset';
    }
  }

  editModal.classList.add('open');
  updateBodyScrollState();
}

async function processEditImagePipeline(imgSrc) {
  const pipeline = document.getElementById('edit-pipeline-status');
  if (!pipeline) return;
  pipeline.style.display = 'block';
  pipeline.innerHTML = `
    <div class="pipeline-step" id="step-edit-dimensions">checking dimensions & aspect ratio...</div>
    <div class="pipeline-step" id="step-edit-compress">compressing raw photo (2500px, webp)...</div>
    <div class="pipeline-step" id="step-edit-thumbnail">compiling 600px thumbnail...</div>
  `;
  
  const img = new Image();
  img.src = imgSrc;
  
  await new Promise(resolve => img.onload = resolve);
  
  setStepState('edit-dimensions', 'active');
  computedEditAspectRatio = parseFloat((img.width / img.height).toFixed(4));
  document.getElementById('step-edit-dimensions').innerText = `aspect ratio: ${computedEditAspectRatio} (${img.width}x${img.height})`;
  
  document.getElementById('edit-aspect-ratio').value = computedEditAspectRatio;
  setStepState('edit-dimensions', 'success');

  setStepState('edit-compress', 'active');
  processedEditPhotoBlob = await resizeImage(img, 2500, 0.75);
  setStepState('edit-compress', 'success');

  setStepState('edit-thumbnail', 'active');
  processedEditThumbBlob = await resizeImage(img, 600, 0.75);
  setStepState('edit-thumbnail', 'success');
  
  showToast('replacement photo processed successfully', 'success');
}

const editFileInput = document.getElementById('edit-photo-file-input');
const editFileStatus = document.getElementById('edit-photo-file-status');
if (editFileInput) {
  editFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (editFileStatus) editFileStatus.innerText = `selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const imgPreview = document.getElementById('edit-media-preview-img');
      if (imgPreview) imgPreview.src = event.target.result;
      await processEditImagePipeline(event.target.result);
    };
    reader.readAsDataURL(file);
  });
}

const editCancelBtn = document.getElementById('edit-cancel-btn');
if (editCancelBtn) {
  editCancelBtn.addEventListener('click', () => {
    editModal.classList.remove('open');
    updateBodyScrollState();
  });
}

// Submit metadata update to backend (Update CRUD action)
if (editForm) {
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentlyEditingItem) return;

    const editSubmitBtn = document.getElementById('edit-submit-btn');
    const submitText = editSubmitBtn.querySelector('span');
    
    editSubmitBtn.disabled = true;
    submitText.innerText = 'saving changes...';

    const id = currentlyEditingItem.id;
    const type = currentlyEditingItem.type;
    const token = secretInput.value.trim();

    const payload = {
      title: document.getElementById('edit-title').value,
      date: document.getElementById('edit-date').value,
      location: document.getElementById('edit-location').value,
      desc: plaintextToHtml(document.getElementById('edit-desc').value),
      aspectRatio: parseFloat(document.getElementById('edit-aspect-ratio').value),
    };

    if (type === 'photo') {
      payload.category = document.getElementById('edit-category').value;
      payload.heroSlide = document.getElementById('edit-hero-slide').checked;
    } else {
      payload.music = document.getElementById('edit-music').value;
    }

    try {
      // If we have a replacement photo, run the R2 replace action first!
      if (type === 'photo' && processedEditPhotoBlob && processedEditThumbBlob) {
        submitText.innerText = 'replacing R2 asset file...';
        const fileFormData = new FormData();
        fileFormData.append('photo', processedEditPhotoBlob, 'photo.webp');
        fileFormData.append('thumb', processedEditThumbBlob, 'thumb.webp');
        fileFormData.append('aspectRatio', computedEditAspectRatio);

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
async function deleteItem(type, id, title) {
  const token = secretInput.value.trim();
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
function deletePhoto(id, title) {
  return deleteItem('photo', id, title);
}

window.deletePhoto = deletePhoto;

// Submit photo/video catalog creation (Create CRUD Action)
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (currentMode === 'photo') {
      if (!processedPhotoBlob || !processedThumbBlob) {
        showToast('processing file...', 'error');
        return;
      }
    } else {
      if (!processedVideoBlob || !processedPosterBlob) {
        showToast('processing files...', 'error');
        return;
      }
    }
    
    submitBtn.disabled = true;
    submitBtnText.innerText = 'cataloging...';
    
    const token = secretInput.value.trim();
    const formData = new FormData();

    formData.append('title', document.getElementById('title').value);
    formData.append('date', document.getElementById('date').value);
    formData.append('location', document.getElementById('location').value);
    formData.append('desc', plaintextToHtml(document.getElementById('desc').value));
    formData.append('aspectRatio', computedAspectRatio);

    if (currentMode === 'photo') {
      formData.append('photo', processedPhotoBlob);
      formData.append('thumb', processedThumbBlob);
      formData.append('category', document.getElementById('category').value);
      formData.append('heroSlide', document.getElementById('hero-slide').checked);
    } else {
      formData.append('video', processedVideoBlob);
      formData.append('poster', processedPosterBlob);
      formData.append('music', document.getElementById('music').value);
    }

    try {
      const res = await uploadArchiveItem(currentMode, formData, token);
      
      if (handleUnauthorized(res)) return;

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('archived successfully', 'success');
        form.reset();
        resetFileSelection();
        uploadModal.classList.remove('open');
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

loadArchives();
