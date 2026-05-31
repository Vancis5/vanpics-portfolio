    const API_BASE_URL = (
      !window.location.origin || 
      window.location.origin.includes('localhost') || 
      window.location.origin.includes('127.0.0.1') || 
      window.location.origin.includes('192.168.') || 
      window.location.origin.includes('10.') || 
      window.location.origin.includes('172.') || 
      window.location.origin.startsWith('file://')
    )
      ? 'https://vanpics-cms-api.lorzanofrancisevan.workers.dev'
      : '';

    // Client-side file size limits (match worker limits)
    const MAX_IMAGE_BYTES = 10 * 1024 * 1024;  // 10 MB
    const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

    // Local placeholder data URI (no external requests)
    const PLACEHOLDER_SRC = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="%23222"><rect width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23555" font-size="11" font-family="monospace">no img</text></svg>');

    // Form mode state
    let currentMode = 'photo'; // 'photo' or 'video'

    // Dashboard navigation state
    let activeFilter = 'all';
    let searchQuery = '';
    let globalArchivesList = []; // Caches all items for instantaneous filtering

    // Modal elements
    const uploadModal = document.getElementById('upload-modal-overlay');
    const openUploadModalBtn = document.getElementById('btn-open-upload-modal');
    const closeUploadModalBtn = document.getElementById('btn-close-upload-modal');

    const editModal = document.getElementById('edit-modal-overlay');
    const closeEditModalBtn = document.getElementById('btn-close-edit-modal');
    const editForm = document.getElementById('edit-cms-form');
    let currentlyEditingItem = null;

    // Search and Filter Elements
    const searchInput = document.getElementById('dashboard-search');

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
    let processedBlurBlob = null;

    let processedVideoBlob = null;
    let processedPosterBlob = null;

    function showToast(text, type = 'success') {
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
            
            // Allow normal scrolling within bounds, block scroll-chaining at boundaries
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
          if (modalBody) return; // Allow keyboard navigation inside the modal body
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
    openUploadModalBtn.addEventListener('click', () => {
      uploadModal.classList.add('open');
      updateBodyScrollState();
    });

    closeUploadModalBtn.addEventListener('click', () => {
      uploadModal.classList.remove('open');
      resetFileSelection();
      form.reset();
      updateBodyScrollState();
    });

    closeEditModalBtn.addEventListener('click', () => {
      editModal.classList.remove('open');
      currentlyEditingItem = null;
      editForm.reset();
      updateBodyScrollState();
    });

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
      if (e.target === confirmModal) {
        confirmModal.classList.remove('open');
        updateBodyScrollState();
      }
    });

    // Delete actions within Edit Modal with Confirmation Dialog
    editDeleteBtn.addEventListener('click', () => {
      if (!currentlyEditingItem) return;
      confirmDeleteText.innerText = `are you sure you want to permanently delete the ${currentlyEditingItem.type} "${currentlyEditingItem.title || 'untitled'}"? this action cannot be undone.`;
      confirmModal.classList.add('open');
      updateBodyScrollState();
    });

    cancelDeleteBtn.addEventListener('click', () => {
      confirmModal.classList.remove('open');
      updateBodyScrollState();
    });

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

    // Toggle Password Visibility
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

    // Check saved credentials and automatically verify
    const savedToken = localStorage.getItem('vanpics_admin_token') || sessionStorage.getItem('vanpics_admin_token') || '';
    if (savedToken) {
      secretInput.value = savedToken;
      if (localStorage.getItem('vanpics_admin_token')) {
        rememberCheckbox.checked = true;
      }
      verifyToken(savedToken);
    }

    let verifyTimeout = null;
    secretInput.addEventListener('input', () => {
      const token = secretInput.value.trim();
      
      // Update storage immediately
      if (rememberCheckbox.checked) {
        localStorage.setItem('vanpics_admin_token', token);
      } else {
        sessionStorage.setItem('vanpics_admin_token', token);
      }

      // Debounce the token validation API call
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

    function setAuthStatus(status) {
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
      try {
        const res = await fetch(`${API_BASE_URL}/api/admin/verify`, {
          method: 'GET',
          headers: {
            'X-Admin-Token': token
          }
        });
        
        if (res.ok) {
          setAuthStatus('secured');
        } else {
          setAuthStatus('failed');
          localStorage.removeItem('vanpics_admin_token');
          sessionStorage.removeItem('vanpics_admin_token');
        }
      } catch (err) {
        setAuthStatus('unverified');
      }
    }

    // Tab Switcher handlers
    tabPhotoBtn.addEventListener('click', () => {
      switchMode('photo');
    });

    tabVideoBtn.addEventListener('click', () => {
      switchMode('video');
    });

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
        
        document.getElementById('title').placeholder = 'e.g. harbinger';
        document.getElementById('title').previousElementSibling.innerText = 'photo title';
      } else {
        tabVideoBtn.classList.add('active');
        tabPhotoBtn.classList.remove('active');
        
        dropZonePhoto.style.display = 'none';
        dropZoneVideoGrid.style.display = 'grid';
        
        photoOnlyElements.forEach(el => el.style.display = 'none');
        videoOnlyElements.forEach(el => el.style.display = '');
        
        document.getElementById('title').placeholder = 'e.g. cinematic shorelines';
        document.getElementById('title').previousElementSibling.innerText = 'video title';
      }

      resetFileSelection();
    }

    // Dynamic Dropzone Setup
    function setupDropzone(zone, input, type, previewContainer, previewEl, removeBtn) {
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
        const ok = selectedFile && processedPhotoBlob && processedThumbBlob && processedBlurBlob;
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
      processedBlurBlob = null;
      processedVideoBlob = null;
      processedPosterBlob = null;

      imgPreviewPhoto.src = '';
      videoPreview.src = '';
      imgPreviewPoster.src = '';

      previewContainerPhoto.style.display = 'none';
      previewContainerVideo.style.display = 'none';
      previewContainerPoster.style.display = 'none';

      submitBtn.disabled = true;
      pipelineStatus.style.display = 'none';

      fileInputPhoto.value = '';
      fileInputVideo.value = '';
      fileInputPoster.value = '';
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
        processedBlurBlob = null;
      }
      checkFormState();
      pipelineStatus.style.display = 'none';
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
      pipelineStatus.style.display = 'block';
      pipelineStatus.innerHTML = `
        <div class="pipeline-step" id="step-dimensions">checking dimensions & aspect ratio...</div>
        <div class="pipeline-step" id="step-compress">compressing raw photo (2500px, webp)...</div>
        <div class="pipeline-step" id="step-thumbnail">compiling 600px thumbnail...</div>
        <div class="pipeline-step" id="step-blur">rendering 40px pre-blurred background...</div>
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

      setStepState('blur', 'active');
      processedBlurBlob = await resizeImage(img, 40, 0.4, true);
      setStepState('blur', 'success');
      
      checkFormState();
      showToast('photo processed successfully', 'success');
    }

    function setStepState(step, state) {
      const el = document.getElementById(`step-${step}`);
      if (el) {
        el.className = `pipeline-step ${state}`;
      }
    }

    function resizeImage(img, maxDimension, quality, applyBlur = false) {
      return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        if (applyBlur) {
          ctx.filter = 'blur(10px)';
          ctx.drawImage(img, -10, -10, width + 20, height + 20);
        } else {
          ctx.drawImage(img, 0, 0, width, height);
        }
        
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/webp', quality);
      });
    }

    // Unified load archives fetching both D1 and R2 listings in parallel
    async function loadArchives() {
      try {
        const [photosRes, videosRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/photos?limit=100`),
          fetch(`${API_BASE_URL}/api/videos?limit=100`)
        ]);

        if (!photosRes.ok || !videosRes.ok) throw new Error('API server down');

        const photosData = await photosRes.json();
        const videosData = await videosRes.json();

        const photos = Array.isArray(photosData) ? photosData : photosData.items || [];
        const videos = Array.isArray(videosData) ? videosData : videosData.items || [];

        // Cache globally for filters
        globalArchivesList = [
          ...photos.map(p => ({ ...p, type: 'photo' })),
          ...videos.map(v => ({ ...v, type: 'video' }))
        ];

        // Sort items by creation date
        globalArchivesList.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        renderArchives();
      } catch (err) {
        itemsContainer.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: var(--text-muted); font-family: 'DM Mono', monospace; font-size: 0.72rem; text-transform: lowercase;">failed to connect to local database.</p>`;
      }
    }

    function getYearFromDate(dateStr) {
      if (!dateStr) return 'undated';
      const match = dateStr.match(/\b(19|20)\d{2}\b/);
      return match ? match[0] : 'undated';
    }

    function isUntitled(item) {
      const title = (item.title || '').toLowerCase().trim();
      return !title || title === 'untitled';
    }

    function parseDate(item) {
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

    function renderSingleCardHtml(p) {
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
            
            <div class="card-meta-row" style="display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.3rem;">
              <div style="display: flex; align-items: center; gap: 0.45rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-faint); flex-shrink: 0;"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
                <span>${escapeHtml(p.location || 'unknown location')}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.45rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-faint); flex-shrink: 0;"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span>${escapeHtml(p.date || 'undated')}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Renders matching and sorted archive items to our Google Drive directory grid
    function renderArchives() {
      const filtered = globalArchivesList.filter(item => {
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
      const sortVal = document.getElementById('filter-sort').value;
      filtered.sort((a, b) => {
        const draftA = isUntitled(a);
        const draftB = isUntitled(b);
        if (draftA && !draftB) return 1;
        if (!draftA && draftB) return -1;

        if (sortVal === 'date-desc') {
          return parseDate(b) - parseDate(a);
        } else if (sortVal === 'date-asc') {
          return parseDate(a) - parseDate(b);
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

      const groupVal = document.getElementById('filter-group').value;
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

    function escapeHtml(str) {
      return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Handles Search and Filter events instantly
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderArchives();
    });

    document.getElementById('filter-type').addEventListener('change', (e) => {
      activeFilter = e.target.value;
      renderArchives();
    });

    document.getElementById('filter-sort').addEventListener('change', () => {
      renderArchives();
    });

    document.getElementById('filter-group').addEventListener('change', () => {
      renderArchives();
    });

    // Delegate grid clicks for opening the edit modal
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

    // Populate and open edit details modal (Read & Update setup)
    function openEditModal(type, id) {
      const item = globalArchivesList.find(i => i.id == id && i.type === type);
      if (!item) return;

      currentlyEditingItem = item;
      
      // Populate fields
      document.getElementById('edit-title').value = item.title || '';
      document.getElementById('edit-date').value = item.date || '';
      document.getElementById('edit-location').value = item.location || '';
      document.getElementById('edit-desc').value = item.desc || '';
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

      editModal.classList.add('open');
      updateBodyScrollState();
    }

    // Submit metadata update to backend (Update CRUD action)
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentlyEditingItem) return;

      const submitBtn = document.getElementById('edit-submit-btn');
      const submitText = submitBtn.querySelector('span');
      
      submitBtn.disabled = true;
      submitText.innerText = 'saving changes...';

      const id = currentlyEditingItem.id;
      const type = currentlyEditingItem.type;
      const token = secretInput.value.trim();

      const payload = {
        title: document.getElementById('edit-title').value,
        date: document.getElementById('edit-date').value,
        location: document.getElementById('edit-location').value,
        desc: document.getElementById('edit-desc').value,
        aspectRatio: parseFloat(document.getElementById('edit-aspect-ratio').value),
      };

      if (type === 'photo') {
        payload.category = document.getElementById('edit-category').value;
        payload.heroSlide = document.getElementById('edit-hero-slide').checked;
      } else {
        payload.music = document.getElementById('edit-music').value;
      }

      const endpoint = type === 'photo'
        ? `${API_BASE_URL}/api/admin/photo/${id}`
        : `${API_BASE_URL}/api/admin/video/${id}`;

      try {
        const res = await fetch(endpoint, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Token': token
          },
          body: JSON.stringify(payload)
        });

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
        submitBtn.disabled = false;
        submitText.innerText = 'save changes';
      }
    });

    // Delete CRUD Action
    async function deleteItem(type, id, title) {
      const token = secretInput.value.trim();
      const endpoint = type === 'video' 
        ? `${API_BASE_URL}/api/admin/video/${id}`
        : `${API_BASE_URL}/api/admin/photo/${id}`;

      try {
        const res = await fetch(endpoint, {
          method: 'DELETE',
          headers: {
            'X-Admin-Token': token
          }
        });
        
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

    // Submit photo/video catalog creation (Create CRUD Action)
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (currentMode === 'photo') {
        if (!processedPhotoBlob || !processedThumbBlob || !processedBlurBlob) {
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
      const endpoint = currentMode === 'photo'
        ? `${API_BASE_URL}/api/admin/upload-photo`
        : `${API_BASE_URL}/api/admin/upload-video`;

      formData.append('title', document.getElementById('title').value);
      formData.append('date', document.getElementById('date').value);
      formData.append('location', document.getElementById('location').value);
      formData.append('desc', document.getElementById('desc').value);
      formData.append('aspectRatio', computedAspectRatio);

      if (currentMode === 'photo') {
        formData.append('photo', processedPhotoBlob);
        formData.append('thumb', processedThumbBlob);
        formData.append('blur', processedBlurBlob);
        formData.append('category', document.getElementById('category').value);
        formData.append('heroSlide', document.getElementById('hero-slide').checked);
      } else {
        formData.append('video', processedVideoBlob);
        formData.append('poster', processedPosterBlob);
        formData.append('music', document.getElementById('music').value);
      }

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'X-Admin-Token': token
          },
          body: formData
        });
        
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
        submitBtnText.innerText = 'catalog and upload';
      }
    });

    loadArchives();