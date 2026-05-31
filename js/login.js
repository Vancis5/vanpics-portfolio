(function () {
  const API_BASE_URL = 'https://vanpics-cms-api.lorzanofrancisevan.workers.dev';

  // 1. Direct Head-Guard: If already authenticated, redirect to dashboard instantly!
  const savedToken = localStorage.getItem('vanpics_admin_token') || sessionStorage.getItem('vanpics_admin_token') || '';
  if (savedToken) {
    // Attempt verification in the background, but redirect immediately to feel instant
    window.location.replace('admin.html');
    return;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginSecretInput = document.getElementById('login-secret-token');
    const loginRememberCheckbox = document.getElementById('login-remember-token');
    const loginErrorMsg = document.getElementById('login-error-msg');
    const loginBtnSubmit = document.getElementById('btn-login-submit');
    const loginBtnText = document.getElementById('login-btn-text');
    const loginBtnSpinner = document.getElementById('login-btn-spinner');
    const loginTogglePasswordBtn = document.getElementById('login-toggle-password-btn');
    const loginEyeShow = document.getElementById('login-eye-show');
    const loginEyeHide = document.getElementById('login-eye-hide');
    const toast = document.getElementById('toast');

    function showToast(text, type = 'success') {
      if (!toast) return;
      toast.innerText = text;
      toast.className = `toast show toast-${type}`;
      setTimeout(() => {
        toast.classList.remove('show');
      }, 4000);
    }

    // Toggle password visibility
    if (loginTogglePasswordBtn) {
      loginTogglePasswordBtn.addEventListener('click', () => {
        if (loginSecretInput.type === 'password') {
          loginSecretInput.type = 'text';
          loginEyeShow.style.display = 'none';
          loginEyeHide.style.display = 'block';
        } else {
          loginSecretInput.type = 'password';
          loginEyeShow.style.display = 'block';
          loginEyeHide.style.display = 'none';
        }
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = loginSecretInput.value.trim();
        if (!token) return;

        // Loading state
        loginBtnSubmit.disabled = true;
        loginBtnText.style.display = 'none';
        loginBtnSpinner.style.display = 'block';
        loginErrorMsg.innerText = '';

        try {
          const res = await fetch(`${API_BASE_URL}/api/admin/verify`, {
            method: 'GET',
            headers: {
              'X-Admin-Token': token
            }
          });

          if (res.ok) {
            const data = await res.json();
            const tokenToStore = data.token || token;

            if (loginRememberCheckbox.checked) {
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
            loginErrorMsg.innerText = 'invalid archive token';
            localStorage.removeItem('vanpics_admin_token');
            sessionStorage.removeItem('vanpics_admin_token');
          }
        } catch (err) {
          loginErrorMsg.innerText = 'server connection failed';
        } finally {
          loginBtnSubmit.disabled = false;
          loginBtnText.style.display = 'block';
          loginBtnSpinner.style.display = 'none';
        }
      });
    }
  });
})();
