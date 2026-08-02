export function initEasterEggs(): void {
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;

    const target = e.target as HTMLElement | null;
    const isTyping = target && target.matches && target.matches('input, textarea, select, [contenteditable="true"]');
    if (isTyping) return;

    const key = e.key.toLowerCase();
    if (key === 'b') {
      document.documentElement.classList.toggle('easter-egg-bw');
    } else if (key === 'i') {
      document.documentElement.classList.toggle('easter-egg-invert');
    }
  });
}

initEasterEggs();
