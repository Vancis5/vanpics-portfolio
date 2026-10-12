import { API_BASE_URL } from './utils.js';
import { showToast } from './ui.js';

let currentAdminToken = localStorage.getItem('vanpics_admin_token') || sessionStorage.getItem('vanpics_admin_token') || '';

export function getAdminToken(): string {
  return currentAdminToken;
}

export function setAdminToken(token: string) {
  currentAdminToken = token;
}

export function handleUnauthorized(res: Response): boolean {
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

export function setAuthStatus(status: 'verifying' | 'secured' | 'failed' | 'unverified' | string) {
  const authSpinner = document.getElementById('auth-spinner');
  const lockSecured = document.getElementById('lock-secured');
  const lockUnverified = document.getElementById('lock-unverified');
  const authStatus = document.getElementById('auth-status');

  if (!authSpinner || !lockSecured || !lockUnverified || !authStatus) return;

  authSpinner.style.display = 'none';
  lockSecured.style.display = 'none';
  lockUnverified.style.display = 'none';
  
  if (status === 'verifying') {
    authSpinner.style.display = 'block';
    authStatus.title = 'Verifying admin token...';
  } else if (status === 'secured') {
    lockSecured.style.display = 'block';
    lockSecured.classList.remove('text-danger', 'text-warning');
    lockSecured.classList.add('text-success');
    lockSecured.setAttribute('stroke', 'var(--success)');
    authStatus.title = 'Admin Token Verified';
  } else if (status === 'failed') {
    lockSecured.style.display = 'block';
    lockSecured.classList.remove('text-success', 'text-warning');
    lockSecured.classList.add('text-danger');
    lockSecured.setAttribute('stroke', 'var(--danger)');
    authStatus.title = 'Unauthorized: Invalid admin token';
  } else {
    lockUnverified.style.display = 'block';
    authStatus.title = 'Token status: Unverified';
  }
}

export async function verifyToken(token: string) {
  if (!token) return;
  const rememberCheckbox = document.getElementById('remember-token') as HTMLInputElement | null;
  
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

export function initAuth() {
  const secretInput = document.getElementById('secret-token') as HTMLInputElement | null;
  const rememberCheckbox = document.getElementById('remember-token') as HTMLInputElement | null;
  const togglePasswordBtn = document.getElementById('toggle-password-btn');
  const eyeShow = document.getElementById('eye-show');
  const eyeHide = document.getElementById('eye-hide');
  const logoutBtn = document.getElementById('btn-logout');

  // Toggle Password Visibility
  if (togglePasswordBtn && secretInput && eyeShow && eyeHide) {
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

  // Logout Action
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

      const lockSecured = document.getElementById('lock-secured');
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
}
