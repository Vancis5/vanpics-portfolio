import {
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  plaintextToHtml
} from './utils.js';
import { uploadArchiveItem } from './api.js';
import { resizeImage } from './pipeline.js';
import { getDocEl, showToast, updateBodyScrollState } from './ui.js';
import { getAdminToken, handleUnauthorized } from './auth.js';

let currentMode: 'photo' | 'video' = 'photo';

let selectedFile: File | null = null;
let selectedVideoFile: File | null = null;
let selectedPosterFile: File | null = null;

let computedAspectRatio = 1.0;

let processedPhotoBlob: Blob | null = null;
let processedThumbBlob: Blob | null = null;
let processedRawBlob: Blob | null = null;
let processedLbBlob: Blob | null = null;
let processedVideoBlob: Blob | null = null;
let processedPosterBlob: Blob | null = null;

function setStepState(step: string, state: 'active' | 'success' | 'failed' | string) {
  const el = document.getElementById(`step-${step}`);
  if (el) {
    el.className = `pipeline-step ${state}`;
  }
}

export function resetFileSelection() {
  selectedFile = null;
  selectedVideoFile = null;
  selectedPosterFile = null;

  processedPhotoBlob = null;
  processedThumbBlob = null;
  processedRawBlob = null;
  processedLbBlob = null;
  processedVideoBlob = null;
  processedPosterBlob = null;

  const imgPreviewPhoto = document.getElementById('image-preview-photo') as HTMLImageElement | null;
  const videoPreview = document.getElementById('video-preview') as HTMLVideoElement | null;
  const imgPreviewPoster = document.getElementById('image-preview-poster') as HTMLImageElement | null;

  const previewContainerPhoto = document.getElementById('preview-container-photo');
  const previewContainerVideo = document.getElementById('preview-container-video');
  const previewContainerPoster = document.getElementById('preview-container-poster');

  const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement | null;
  const pipelineStatus = document.getElementById('pipeline-status');

  const fileInputPhoto = document.getElementById('file-input-photo') as HTMLInputElement | null;
  const fileInputVideo = document.getElementById('file-input-video') as HTMLInputElement | null;
  const fileInputPoster = document.getElementById('file-input-poster') as HTMLInputElement | null;

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

function checkFormState() {
  const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement | null;
  if (!submitBtn) return;

  if (currentMode === 'photo') {
    const ok = !!(selectedFile && processedPhotoBlob && processedThumbBlob);
    submitBtn.disabled = !ok;
  } else {
    const ok = !!(selectedVideoFile && selectedPosterFile && processedVideoBlob && processedPosterBlob);
    submitBtn.disabled = !ok;
  }
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
    processedLbBlob = null;
  }
  checkFormState();
  const pipelineStatus = document.getElementById('pipeline-status');
  if (pipelineStatus) {
    pipelineStatus.innerHTML = '<div style="color: var(--text-muted); font-family: \'DM Mono\', monospace; font-size: 0.62rem; text-align: center; padding-top: 1.5rem;">awaiting file upload...</div>';
  }
}

async function processVideoPipeline(videoFile: File) {
  const pipelineStatus = document.getElementById('pipeline-status');
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
  const stepDimensions = document.getElementById('step-dimensions');
  if (stepDimensions) {
    stepDimensions.innerText = `aspect ratio: ${computedAspectRatio} (${videoEl.videoWidth}x${videoEl.videoHeight})`;
  }
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
  const pipelineStatus = document.getElementById('pipeline-status');
  if (!pipelineStatus) return;
  
  if (!document.getElementById('step-poster-compress')) {
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
  const pipelineStatus = document.getElementById('pipeline-status');
  if (!pipelineStatus) return;
  pipelineStatus.innerHTML = `
    <div class="pipeline-step" id="step-dimensions">checking dimensions & aspect ratio</div>
    <div class="pipeline-step" id="step-compress">compressing standard photo (2500px, webp)</div>
    <div class="pipeline-step" id="step-raw">compressing high-res raw photo (4000px, webp)</div>
    <div class="pipeline-step" id="step-lb">compressing lightbox photo (1600px, webp)</div>
    <div class="pipeline-step" id="step-thumbnail">compiling 600px thumbnail</div>
  `;
  
  const img = new Image();
  img.src = imgSrc;
  
  await new Promise(resolve => img.onload = resolve);
  
  setStepState('dimensions', 'active');
  computedAspectRatio = parseFloat((img.width / img.height).toFixed(4));
  const stepDimensions = document.getElementById('step-dimensions');
  if (stepDimensions) {
    stepDimensions.innerText = `aspect ratio: ${computedAspectRatio} (${img.width}x${img.height})`;
  }
  setStepState('dimensions', 'success');

  setStepState('compress', 'active');
  processedPhotoBlob = await resizeImage(img, 2500, 0.75);
  setStepState('compress', 'success');

  setStepState('raw', 'active');
  processedRawBlob = await resizeImage(img, 4000, 0.95);
  setStepState('raw', 'success');

  // Lightbox tier is cut from the original (not from the 2500px q75 blob) to avoid double compression.
  setStepState('lb', 'active');
  processedLbBlob = await resizeImage(img, 1600, 0.8);
  setStepState('lb', 'success');

  setStepState('thumbnail', 'active');
  processedThumbBlob = await resizeImage(img, 600, 0.75);
  setStepState('thumbnail', 'success');
  
  checkFormState();
  showToast('photo processed successfully', 'success');
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

export function switchMode(mode: 'photo' | 'video' | string) {
  if (currentMode === mode) return;
  currentMode = mode as 'photo' | 'video';

  const tabPhotoBtn = document.getElementById('tab-photo');
  const tabVideoBtn = document.getElementById('tab-video');
  const dropZonePhoto = document.getElementById('drop-zone-photo');
  const dropZoneVideoGrid = document.getElementById('drop-zone-video-grid');
  const photoOnlyElements = document.querySelectorAll('.photo-only');
  const videoOnlyElements = document.querySelectorAll('.video-only');
  const titleInput = document.getElementById('title') as HTMLInputElement | null;
  
  if (mode === 'photo') {
    tabPhotoBtn?.classList.add('active');
    tabVideoBtn?.classList.remove('active');
    
    if (dropZonePhoto) dropZonePhoto.style.display = 'flex';
    if (dropZoneVideoGrid) dropZoneVideoGrid.style.display = 'none';
    
    photoOnlyElements.forEach(el => (el as HTMLElement).style.display = '');
    videoOnlyElements.forEach(el => (el as HTMLElement).style.display = 'none');
    
    if (titleInput) {
      titleInput.placeholder = 'untitled';
      if (titleInput.previousElementSibling) {
        (titleInput.previousElementSibling as HTMLElement).innerText = 'title';
      }
    }
  } else {
    tabVideoBtn?.classList.add('active');
    tabPhotoBtn?.classList.remove('active');
    
    if (dropZonePhoto) dropZonePhoto.style.display = 'none';
    if (dropZoneVideoGrid) dropZoneVideoGrid.style.display = 'grid';
    
    photoOnlyElements.forEach(el => (el as HTMLElement).style.display = 'none');
    videoOnlyElements.forEach(el => (el as HTMLElement).style.display = '');
    
    if (titleInput) {
      titleInput.placeholder = 'untitled';
      if (titleInput.previousElementSibling) {
        (titleInput.previousElementSibling as HTMLElement).innerText = 'title';
      }
    }
  }

  resetFileSelection();
}

export function initUploader(options: { onUploadSuccess: () => void }) {
  const uploadModal = getDocEl('upload-modal-overlay');
  const openUploadModalBtn = document.getElementById('btn-open-upload-modal');
  const closeUploadModalBtn = document.getElementById('btn-close-upload-modal');
  const form = document.getElementById('cms-form') as HTMLFormElement | null;
  const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement | null;
  const submitBtnText = document.getElementById('submit-btn-text');

  const tabPhotoBtn = document.getElementById('tab-photo');
  const tabVideoBtn = document.getElementById('tab-video');

  const dropZonePhoto = document.getElementById('drop-zone-photo');
  const fileInputPhoto = document.getElementById('file-input-photo') as HTMLInputElement | null;
  const previewContainerPhoto = document.getElementById('preview-container-photo');
  const imgPreviewPhoto = document.getElementById('image-preview-photo') as HTMLImageElement | null;
  const removeBtnPhoto = document.getElementById('remove-btn-photo');

  const dropZoneVideo = document.getElementById('drop-zone-video');
  const fileInputVideo = document.getElementById('file-input-video') as HTMLInputElement | null;
  const previewContainerVideo = document.getElementById('preview-container-video');
  const videoPreview = document.getElementById('video-preview') as HTMLVideoElement | null;
  const removeBtnVideo = document.getElementById('remove-btn-video');

  const dropZonePoster = document.getElementById('drop-zone-poster');
  const fileInputPoster = document.getElementById('file-input-poster') as HTMLInputElement | null;
  const previewContainerPoster = document.getElementById('preview-container-poster');
  const imgPreviewPoster = document.getElementById('image-preview-poster') as HTMLImageElement | null;
  const removeBtnPoster = document.getElementById('remove-btn-poster');

  // Expose handles on window for Playwright test compatibility
  (window as any).dropZone = dropZonePhoto;
  (window as any).fileInput = fileInputPhoto;
  (window as any).previewContainer = previewContainerPhoto;
  (window as any).imgPreview = imgPreviewPhoto;
  (window as any).removeBtn = removeBtnPhoto;

  // Dropzones setup
  setupDropzone(dropZonePhoto, fileInputPhoto, 'photo', previewContainerPhoto, imgPreviewPhoto, removeBtnPhoto);
  setupDropzone(dropZoneVideo, fileInputVideo, 'video', previewContainerVideo, videoPreview, removeBtnVideo);
  setupDropzone(dropZonePoster, fileInputPoster, 'poster', previewContainerPoster, imgPreviewPoster, removeBtnPoster);

  // Tab mode switches
  if (tabPhotoBtn) tabPhotoBtn.addEventListener('click', () => switchMode('photo'));
  if (tabVideoBtn) tabVideoBtn.addEventListener('click', () => switchMode('video'));

  // Upload modal open/close
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
      form?.reset();
      updateBodyScrollState();
    });
  }

  // Submit creation action
  if (form && submitBtn && submitBtnText) {
    form.addEventListener('submit', async (e: Event) => {
      e.preventDefault();
      
      const photoBlob = processedPhotoBlob;
      const thumbBlob = processedThumbBlob;
      const rawBlob = processedRawBlob;
      const lbBlob = processedLbBlob;
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
      
      const token = getAdminToken();
      const formData = new FormData();

      const titleEl = document.getElementById('title') as HTMLInputElement | null;
      const dateEl = document.getElementById('date') as HTMLInputElement | null;
      const locEl = document.getElementById('location') as HTMLInputElement | null;
      const descEl = document.getElementById('desc') as HTMLTextAreaElement | null;
      const catEl = document.getElementById('category') as HTMLSelectElement | null;
      const heroEl = document.getElementById('hero-slide') as HTMLInputElement | null;
      const musicEl = document.getElementById('music') as HTMLInputElement | null;

      formData.append('title', titleEl?.value || '');
      formData.append('date', dateEl?.value || '');
      formData.append('location', locEl?.value || '');
      formData.append('desc', plaintextToHtml(descEl?.value || ''));
      formData.append('aspectRatio', String(computedAspectRatio));

      if (currentMode === 'photo') {
        if (photoBlob) formData.append('photo', photoBlob);
        if (thumbBlob) formData.append('thumb', thumbBlob);
        if (rawBlob) {
          formData.append('raw', rawBlob, 'raw.webp');
        }
        if (lbBlob) {
          formData.append('lb', lbBlob, 'lb.webp');
        }
        formData.append('category', catEl?.value || '');
        formData.append('heroSlide', String(!!heroEl?.checked));
      } else {
        if (videoBlob) formData.append('video', videoBlob);
        if (posterBlob) formData.append('poster', posterBlob);
        formData.append('music', musicEl?.value || '');
      }

      try {
        const res = await uploadArchiveItem(currentMode, formData, token);
        
        if (handleUnauthorized(res)) return;

        const data = await res.json();
        if (res.ok && data.success) {
          const titleVal = (titleEl?.value || '').trim();
          if (!titleVal) {
            showToast('saved as draft', 'success');
          } else {
            showToast('archived successfully', 'success');
          }
          form.reset();
          resetFileSelection();
          uploadModal.classList.remove('open');
          updateBodyScrollState();
          options.onUploadSuccess();
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
}
