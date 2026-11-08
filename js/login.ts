import { API_BASE_URL } from './admin/utils.js';

// 1. Direct Head-Guard: If already authenticated, redirect to dashboard instantly!
const savedToken = localStorage.getItem('vanpics_admin_token') || sessionStorage.getItem('vanpics_admin_token') || '';
if (savedToken) {
  // Attempt verification in the background, but redirect immediately to feel instant
  window.location.replace('admin.html');
} else {
  document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form') as HTMLFormElement;
    const loginSecretInput = document.getElementById('login-secret-token') as HTMLInputElement;
    const loginRememberCheckbox = document.getElementById('login-remember-token') as HTMLInputElement;
    const loginErrorMsg = document.getElementById('login-error-msg') as HTMLElement;
    const loginBtnSubmit = document.getElementById('btn-login-submit') as HTMLButtonElement;
    const loginBtnText = document.getElementById('login-btn-text') as HTMLElement;
    const loginBtnSpinner = document.getElementById('login-btn-spinner') as HTMLElement;
    const loginTogglePasswordBtn = document.getElementById('login-toggle-password-btn');
    const loginEyeShow = document.getElementById('login-eye-show');
    const loginEyeHide = document.getElementById('login-eye-hide');
    const toast = document.getElementById('toast');
    const rememberWrapper = document.querySelector('.remember-checkbox-wrapper');

    const loginInputWrapper = loginSecretInput ? (loginSecretInput.closest('.login-input-wrapper') as HTMLElement | null) : null;
    let lockoutTimer: any = null;

    function startLockoutCountdown(seconds: number) {
      if (lockoutTimer) clearInterval(lockoutTimer);
      let remaining = Math.max(1, Math.round(seconds));
      loginBtnSubmit.disabled = true;
      loginInputWrapper?.classList.add('has-error');
      loginSecretInput.setAttribute('aria-invalid', 'true');

      const updateText = () => {
        loginErrorMsg.innerText = `security lockout active: retry in ${remaining}s`;
      };
      updateText();

      lockoutTimer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(lockoutTimer);
          lockoutTimer = null;
          loginBtnSubmit.disabled = false;
          loginErrorMsg.innerText = '';
          loginInputWrapper?.classList.remove('has-error');
          loginSecretInput.setAttribute('aria-invalid', 'false');
        } else {
          updateText();
        }
      }, 1000);
    }

    // Clear error states on typing (unless active lockout timer is ticking)
    if (loginSecretInput) {
      loginSecretInput.addEventListener('input', () => {
        if (!lockoutTimer) {
          loginErrorMsg.innerText = '';
          loginInputWrapper?.classList.remove('has-error');
          loginSecretInput.setAttribute('aria-invalid', 'false');
        }
      });
    }

    // Handle delayed layout transition on initial autofocus, and instant transition on subsequent focus/blur
    if (loginSecretInput) {
      let isInitialLoad = true;

      const raiseKeyboard = () => {
        if (isInitialLoad) {
          setTimeout(() => {
            document.body.classList.add('keyboard-raised');
            isInitialLoad = false;
          }, 800); // delay to let the page load centered first
        } else {
          document.body.classList.add('keyboard-raised');
        }
      };

      const lowerKeyboard = () => {
        setTimeout(() => {
          if (document.activeElement && document.activeElement.closest('.login-card')) {
            return;
          }
          document.body.classList.remove('keyboard-raised');
          isInitialLoad = false;
        }, 100);
      };

      loginSecretInput.addEventListener('focus', raiseKeyboard);
      loginSecretInput.addEventListener('blur', lowerKeyboard);

      // Trigger immediately on load if autofocus has already focused it
      if (document.activeElement === loginSecretInput) {
        raiseKeyboard();
      }
    }

    function showToast(text: string, type: string = 'success') {
      if (!toast) return;
      toast.innerText = text;
      toast.className = `toast show toast-${type}`;
      setTimeout(() => {
        toast.classList.remove('show');
      }, 4000);
    }

    // Toggle password visibility (restores focus to keep keyboard open)
    if (loginTogglePasswordBtn && loginSecretInput && loginEyeShow && loginEyeHide) {
      loginTogglePasswordBtn.addEventListener('click', () => {
        const isPassword = loginSecretInput.type === 'password';
        loginSecretInput.type = isPassword ? 'text' : 'password';
        loginEyeShow.style.display = isPassword ? 'none' : 'block';
        loginEyeHide.style.display = isPassword ? 'block' : 'none';
        loginTogglePasswordBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        loginTogglePasswordBtn.title = isPassword ? 'Hide password' : 'Show password';
        loginSecretInput.focus();
      });
    }

    // Keep password input focused when clicking the remember checkbox
    if (rememberWrapper) {
      rememberWrapper.addEventListener('click', () => {
        loginSecretInput.focus();
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (lockoutTimer) return;

        const token = loginSecretInput.value.trim();
        if (!token) return;

        // Loading state
        loginBtnSubmit.disabled = true;
        loginBtnSubmit.setAttribute('aria-busy', 'true');
        if (loginBtnText) loginBtnText.style.display = 'none';
        if (loginBtnSpinner) loginBtnSpinner.style.display = 'inline-block';
        loginErrorMsg.innerText = '';
        loginInputWrapper?.classList.remove('has-error');
        loginSecretInput.setAttribute('aria-invalid', 'false');

        const isRemember = loginRememberCheckbox.checked;

        try {
          const res = await fetch(`${API_BASE_URL}/api/admin/verify?remember=${isRemember}`, {
            method: 'GET',
            headers: {
              'X-Admin-Token': token,
              'X-Remember': isRemember ? 'true' : 'false'
            }
          });

          if (res.ok) {
            const data = await res.json();
            const tokenToStore = data.token || token;

            if (isRemember) {
              localStorage.setItem('vanpics_admin_token', tokenToStore);
              sessionStorage.removeItem('vanpics_admin_token');
            } else {
              localStorage.removeItem('vanpics_admin_token');
              sessionStorage.setItem('vanpics_admin_token', tokenToStore);
            }

            showToast('authentication successful', 'success');
            setTimeout(() => {
              window.location.replace('admin.html');
            }, 500);
          } else {
            const errJson = await res.json().catch(() => null);
            loginInputWrapper?.classList.add('has-error');
            loginSecretInput.setAttribute('aria-invalid', 'true');

            if (res.status === 429) {
              const errorStr = (errJson && errJson.error) || '';
              const match = errorStr.match(/(\d+)\s*(?:seconds|second|s)\b/i);
              const remainingSec = match ? parseInt(match[1], 10) : 900;
              startLockoutCountdown(remainingSec);
            } else {
              loginErrorMsg.innerText = (errJson && errJson.error) || 'invalid archive token';
            }

            try { localStorage.removeItem('vanpics_admin_token'); } catch {}
            try { sessionStorage.removeItem('vanpics_admin_token'); } catch {}
          }
        } catch (err) {
          loginInputWrapper?.classList.add('has-error');
          loginSecretInput.setAttribute('aria-invalid', 'true');
          loginErrorMsg.innerText = 'server connection failed';
        } finally {
          loginBtnSubmit.removeAttribute('aria-busy');
          if (loginBtnText) loginBtnText.style.display = 'inline';
          if (loginBtnSpinner) loginBtnSpinner.style.display = 'none';
          if (!lockoutTimer) {
            loginBtnSubmit.disabled = false;
          }
        }
      });
    }
  });
}

// Dynamic interactive background spotlight (runs immediately)
document.addEventListener('mousemove', (e) => {
  document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
  document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
});
