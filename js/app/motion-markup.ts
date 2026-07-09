import { escapeHtml } from './utils.js';

function createMotionPosterElement(item) {
  const poster = document.createElement('media-poster');
  const img = document.createElement('img');
  img.src = item.thumb;
  img.alt = (item.title || '') + ' thumbnail';
  poster.appendChild(img);
  return poster;
}

export function getMotionThumbnailMarkup(item) {
  if (item.thumb) return '<img src="' + escapeHtml(item.thumb) + '" alt="' + escapeHtml(item.title) + '" loading="lazy">';
  return '<div class="motion-card-fallback" aria-hidden="true"></div>';
}

export function getVideoPlayerMarkup(item) {
  const template = document.getElementById('motion-player-template') as HTMLTemplateElement;
  if (!template) return '';

  const playerId = 'motion-player-instance';
  const fragment = template.content.cloneNode(true) as DocumentFragment;
  const shell = fragment.querySelector('.motion-player-prime');
  const video = fragment.querySelector('video');
  const posterSlot = fragment.querySelector('[data-motion-poster-slot]');
  const startButton = fragment.querySelector('.motion-start-button') as HTMLElement | null;

  if (shell) shell.id = playerId;
  if (video) video.src = item.src || '';
  if (startButton) startButton.dataset.playerId = playerId;

  if (posterSlot) {
    if (item.thumb) {
      posterSlot.replaceWith(createMotionPosterElement(item));
    } else {
      posterSlot.remove();
    }
  }

  const wrap = document.createElement('div');
  wrap.appendChild(fragment);
  return wrap.innerHTML;
}
