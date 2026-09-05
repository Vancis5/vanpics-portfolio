export function getDocEl<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Required element with id "${id}" was not found in the DOM.`);
  }
  return el as T;
}

export function showToast(text: string, type: 'success' | 'error' | string = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.innerText = text;
  toast.className = `toast show toast-${type}`;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

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

export function updateBodyScrollState() {
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
