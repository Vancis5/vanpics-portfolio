import {
  unescapeHtml,
  plaintextToHtml,
  htmlToPlaintext
} from './utils.js';
import { updateArchiveItem, replacePhotoItem, deleteArchiveItem } from './api.js';
import { resizeImage } from './pipeline.js';
import { getDocEl, showToast, updateBodyScrollState } from './ui.js';
import { getAdminToken, handleUnauthorized } from './auth.js';

let currentlyEditingItem: any = null;

let processedEditPhotoBlob: Blob | null = null;
let processedEditThumbBlob: Blob | null = null;
let processedEditRawBlob: Blob | null = null;
let processedEditLbBlob: Blob | null = null;
let computedEditAspectRatio: number | null = null;

function setStepState(step: string, state: 'active' | 'success' | 'failed' | string) {
  const el = document.getElementById(`step-${step}`);
  if (el) {
    el.className = `pipeline-step ${state}`;
  }
}

export function clearEditPreview() {
  const imgPreview = document.getElementById('edit-media-preview-img') as HTMLImageElement | null;
  if (imgPreview) {
    imgPreview.src = '';
    imgPreview.classList.remove('loaded');
    imgPreview.style.display = 'none';
    const container = imgPreview.closest('.edit-preview-container') as HTMLElement | null;
    if (container) {
      container.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    }
  }
  const placeholder = document.getElementById('edit-media-preview-placeholder');
  if (placeholder) {
    placeholder.style.display = 'none';
  }
}

async function processEditImagePipeline(imgSrc: string) {
  const pipeline = document.getElementById('edit-pipeline-status');
  if (!pipeline) return;
  pipeline.style.display = 'block';
  pipeline.innerHTML = `
    <div class="pipeline-step" id="step-edit-dimensions">checking dimensions & aspect ratio</div>
    <div class="pipeline-step" id="step-edit-compress">compressing standard photo (2500px, webp)</div>
    <div class="pipeline-step" id="step-edit-raw">compressing high-res raw photo (4000px, webp)</div>
    <div class="pipeline-step" id="step-edit-lb">compressing lightbox photo (1600px, webp)</div>
    <div class="pipeline-step" id="step-edit-thumbnail">compiling 600px thumbnail</div>
  `;
  
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image decode failed'));
      img.src = imgSrc;
    });
  } catch {
    setStepState('edit-dimensions', 'failed');
    showToast('failed to decode replacement image', 'error');
    return;
  }
  
  setStepState('edit-dimensions', 'active');
  computedEditAspectRatio = parseFloat((img.width / img.height).toFixed(4));
  const dimensionsEl = document.getElementById('step-edit-dimensions');
  if (dimensionsEl) {
    dimensionsEl.innerText = `aspect ratio: ${computedEditAspectRatio} (${img.width}x${img.height})`;
  }
  
  const aspectRatioInput = document.getElementById('edit-aspect-ratio') as HTMLInputElement | null;
  if (aspectRatioInput) {
    aspectRatioInput.value = String(computedEditAspectRatio);
  }
  setStepState('edit-dimensions', 'success');

  setStepState('edit-compress', 'active');
  processedEditPhotoBlob = await resizeImage(img, 2500, 0.75);
  if (!processedEditPhotoBlob) {
    setStepState('edit-compress', 'failed');
    showToast('photo compression failed (memory limit)', 'error');
    return;
  }
  setStepState('edit-compress', 'success');

  setStepState('edit-raw', 'active');
  processedEditRawBlob = await resizeImage(img, 4000, 0.95);
  if (!processedEditRawBlob) {
    setStepState('edit-raw', 'failed');
    showToast('raw compression failed (memory limit)', 'error');
    return;
  }
  setStepState('edit-raw', 'success');

  // Lightbox tier is cut from the original (not from the 2500px q75 blob) to avoid double compression.
  setStepState('edit-lb', 'active');
  processedEditLbBlob = await resizeImage(img, 1600, 0.8);
  if (!processedEditLbBlob) {
    setStepState('edit-lb', 'failed');
    showToast('lightbox compression failed (memory limit)', 'error');
    return;
  }
  setStepState('edit-lb', 'success');

  setStepState('edit-thumbnail', 'active');
  processedEditThumbBlob = await resizeImage(img, 600, 0.75);
  if (!processedEditThumbBlob) {
    setStepState('edit-thumbnail', 'failed');
    showToast('thumbnail compression failed', 'error');
    return;
  }
  setStepState('edit-thumbnail', 'success');
  
  showToast('replacement photo processed successfully', 'success');
}

export function updateEditNavArrows() {
  const cards = Array.from(document.querySelectorAll('#items-container .asset-card')) as HTMLElement[];
  const prevBtn = document.getElementById('btn-edit-prev') as HTMLButtonElement | null;
  const nextBtn = document.getElementById('btn-edit-next') as HTMLButtonElement | null;
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

export function openEditModal(type: string, id: string | number, itemsList: any[]) {
  const item = itemsList.find(i => i.id == id && i.type === type);
  if (!item) return;

  currentlyEditingItem = item;
  
  clearEditPreview();

  processedEditPhotoBlob = null;
  processedEditThumbBlob = null;
  processedEditRawBlob = null;
  processedEditLbBlob = null;
  computedEditAspectRatio = null;
  
  const editFileStatus = document.getElementById('edit-photo-file-status');
  if (editFileStatus) editFileStatus.innerText = 'replace';
  
  const editPipeline = document.getElementById('edit-pipeline-status');
  if (editPipeline) {
    editPipeline.style.display = 'none';
    editPipeline.innerHTML = '';
  }
  
  const editFileInput = document.getElementById('edit-photo-file-input') as HTMLInputElement | null;
  if (editFileInput) editFileInput.value = '';

  const editTitle = document.getElementById('edit-title') as HTMLInputElement | null;
  const editDate = document.getElementById('edit-date') as HTMLInputElement | null;
  const editLocation = document.getElementById('edit-location') as HTMLInputElement | null;
  const editDesc = document.getElementById('edit-desc') as HTMLTextAreaElement | null;
  const editAspectRatio = document.getElementById('edit-aspect-ratio') as HTMLInputElement | null;
  const editCategory = document.getElementById('edit-category') as HTMLSelectElement | null;
  const editHeroSlide = document.getElementById('edit-hero-slide') as HTMLInputElement | null;
  const editMusic = document.getElementById('edit-music') as HTMLInputElement | null;

  if (editTitle) editTitle.value = unescapeHtml(item.title || '');
  if (editDate) editDate.value = unescapeHtml(item.date || '');
  if (editLocation) editLocation.value = unescapeHtml(item.location || '');
  if (editDesc) editDesc.value = htmlToPlaintext(item.desc || '');
  if (editAspectRatio) editAspectRatio.value = item.aspect_ratio || 1.0;

  const editPhotoOnly = document.querySelectorAll('.edit-photo-only');
  const editVideoOnly = document.querySelectorAll('.edit-video-only');

  if (type === 'photo') {
    editPhotoOnly.forEach(el => (el as HTMLElement).style.display = '');
    editVideoOnly.forEach(el => (el as HTMLElement).style.display = 'none');
    
    if (editCategory) editCategory.value = item.category || '';
    if (editHeroSlide) editHeroSlide.checked = item.hero_slide === 1 || item.hero_slide === 'true' || item.hero_slide === true;
  } else {
    editPhotoOnly.forEach(el => (el as HTMLElement).style.display = 'none');
    editVideoOnly.forEach(el => (el as HTMLElement).style.display = '');
    
    if (editMusic) editMusic.value = unescapeHtml(item.music || '');
  }

  const imgPreview = document.getElementById('edit-media-preview-img') as HTMLImageElement | null;
  const placeholderPreview = document.getElementById('edit-media-preview-placeholder');

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

  const editModal = document.getElementById('edit-modal-overlay');
  if (editModal) {
    editModal.classList.add('open');
    updateBodyScrollState();
    updateEditNavArrows();
  }
}

export function initEditor(options: {
  getArchivesList: () => any[];
  onArchiveUpdated: () => void;
}) {
  const editModal = getDocEl('edit-modal-overlay');
  const closeEditModalBtn = document.getElementById('btn-close-edit-modal');
  const editCancelBtn = document.getElementById('edit-cancel-btn');
  const editForm = document.getElementById('edit-cms-form') as HTMLFormElement | null;

  const confirmModal = getDocEl('confirm-modal-overlay');
  const cancelDeleteBtn = document.getElementById('btn-cancel-delete');
  const confirmDeleteBtn = document.getElementById('btn-confirm-delete');
  const editDeleteBtn = document.getElementById('edit-delete-btn');
  const confirmDeleteText = document.getElementById('confirm-delete-text');

  const editFileInput = document.getElementById('edit-photo-file-input') as HTMLInputElement | null;
  const editFileStatus = document.getElementById('edit-photo-file-status');
  const editPreviewImg = document.getElementById('edit-media-preview-img') as HTMLImageElement | null;

  const prevEditBtn = document.getElementById('btn-edit-prev');
  const nextEditBtn = document.getElementById('btn-edit-next');

  // Dominant color extraction listener
  if (editPreviewImg) {
    editPreviewImg.crossOrigin = 'anonymous';
    editPreviewImg.addEventListener('load', () => {
      if (!editPreviewImg.getAttribute('src')) return;
      editPreviewImg.classList.add('loaded');
      
      const container = editPreviewImg.closest('.edit-preview-container') as HTMLElement | null;
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

  // Close edit modal
  const handleCloseEdit = () => {
    editModal.classList.remove('open');
    currentlyEditingItem = null;
    editForm?.reset();
    clearEditPreview();
    updateBodyScrollState();
  };

  if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', handleCloseEdit);
  if (editCancelBtn) editCancelBtn.addEventListener('click', handleCloseEdit);

  // Replacement photo selection
  if (editFileInput) {
    editFileInput.addEventListener('change', async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (editFileStatus) editFileStatus.innerText = `selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`;
      
      const reader = new FileReader();
      reader.onload = async (event: ProgressEvent<FileReader>) => {
        if (event.target && event.target.result) {
          if (editPreviewImg) editPreviewImg.src = event.target.result as string;
          await processEditImagePipeline(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // Delete actions
  async function deleteItem(type: string, id: string | number, _title: string) {
    const token = getAdminToken();
    try {
      const res = await deleteArchiveItem(type, id, token);
      if (handleUnauthorized(res)) return;

      const data = await res.json();
      if (data.success) {
        showToast(`${type} deleted successfully`, 'success');
        options.onArchiveUpdated();
      } else {
        showToast(data.error || 'delete failed', 'error');
      }
    } catch (err) {
      showToast('database connection failed', 'error');
    }
  }

  function deletePhoto(id: string | number, title: string) {
    return deleteItem('photo', id, title);
  }

  (window as any).deletePhoto = deletePhoto;

  if (editDeleteBtn && confirmDeleteText) {
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

  // Edit form submit
  if (editForm) {
    editForm.addEventListener('submit', async (e: Event) => {
      e.preventDefault();
      if (!currentlyEditingItem) return;

      const editSubmitBtn = document.getElementById('edit-submit-btn') as HTMLButtonElement | null;
      const submitText = editSubmitBtn ? editSubmitBtn.querySelector('span') : null;
      if (!editSubmitBtn || !submitText) return;
      
      editSubmitBtn.disabled = true;
      submitText.innerText = 'saving changes...';

      const id = currentlyEditingItem.id;
      const type = currentlyEditingItem.type;
      const token = getAdminToken();

      const titleInput = document.getElementById('edit-title') as HTMLInputElement | null;
      const dateInput = document.getElementById('edit-date') as HTMLInputElement | null;
      const locInput = document.getElementById('edit-location') as HTMLInputElement | null;
      const descInput = document.getElementById('edit-desc') as HTMLTextAreaElement | null;
      const arInput = document.getElementById('edit-aspect-ratio') as HTMLInputElement | null;
      const catInput = document.getElementById('edit-category') as HTMLSelectElement | null;
      const heroInput = document.getElementById('edit-hero-slide') as HTMLInputElement | null;
      const musicInput = document.getElementById('edit-music') as HTMLInputElement | null;

      const payload: any = {
        title: titleInput?.value || '',
        date: dateInput?.value || '',
        location: locInput?.value || '',
        desc: plaintextToHtml(descInput?.value || ''),
        aspectRatio: parseFloat(arInput?.value || '1.0'),
      };

      if (type === 'photo') {
        payload.category = catInput?.value || '';
        payload.heroSlide = !!heroInput?.checked;
      } else {
        payload.music = musicInput?.value || '';
      }

      try {
        const editPhotoBlob = processedEditPhotoBlob;
        const editThumbBlob = processedEditThumbBlob;
        const editRawBlob = processedEditRawBlob;
        const editLbBlob = processedEditLbBlob;
        const editAspectRatio = computedEditAspectRatio;

        if (type === 'photo' && editPhotoBlob && editThumbBlob && editRawBlob) {
          submitText.innerText = 'replacing R2 asset file...';
          const fileFormData = new FormData();
          fileFormData.append('photo', editPhotoBlob, 'photo.webp');
          fileFormData.append('thumb', editThumbBlob, 'thumb.webp');
          fileFormData.append('aspectRatio', String(editAspectRatio));
          if (editRawBlob) {
            fileFormData.append('raw', editRawBlob, 'raw.webp');
          }
          if (editLbBlob) {
            fileFormData.append('lb', editLbBlob, 'lb.webp');
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
          options.onArchiveUpdated();
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

  // Prev / Next card navigation
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
          openEditModal(type, id, options.getArchivesList());
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
          openEditModal(type, id, options.getArchivesList());
        }
      }
    });
  }

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (!editModal || !editModal.classList.contains('open')) return;
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    
    if (e.key === 'ArrowLeft') {
      const prevBtn = document.getElementById('btn-edit-prev') as HTMLButtonElement | null;
      if (prevBtn && !prevBtn.disabled) {
        prevBtn.click();
      }
    } else if (e.key === 'ArrowRight') {
      const nextBtn = document.getElementById('btn-edit-next') as HTMLButtonElement | null;
      if (nextBtn && !nextBtn.disabled) {
        nextBtn.click();
      }
    }
  });
}
