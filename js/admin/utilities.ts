import { API_BASE_URL } from './utils.js';
import { getDocEl, showToast, updateBodyScrollState } from './ui.js';
import { getAdminToken, handleUnauthorized } from './auth.js';

export function initUtilities(options: { onDbSorted: () => void }) {
  const utilitiesModal = getDocEl('utilities-modal-overlay');
  const openUtilitiesModalBtn = document.getElementById('btn-open-utilities-modal');
  const closeUtilitiesModalBtn = document.getElementById('btn-close-utilities-modal');
  const runDbSortBtn = document.getElementById('btn-run-db-sort') as HTMLButtonElement | null;
  const runDbSortText = document.getElementById('btn-run-db-sort-text');
  const purgeCdnCacheBtn = document.getElementById('btn-purge-cdn-cache') as HTMLButtonElement | null;
  const purgeCdnCacheText = document.getElementById('btn-purge-cdn-cache-text');
  const utilityTerminal = document.getElementById('utility-terminal');

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

  if (runDbSortBtn && runDbSortText) {
    runDbSortBtn.addEventListener('click', async () => {
      const token = getAdminToken();
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
          options.onDbSorted();
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

  if (purgeCdnCacheBtn && purgeCdnCacheText) {
    purgeCdnCacheBtn.addEventListener('click', async () => {
      const token = getAdminToken();
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
}
