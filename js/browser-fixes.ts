// Footer brightness and visibility scroll tracking
let footerObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
    } else {
      entry.target.classList.remove('is-visible');
    }
  });
}, { threshold: 0.1 });

let siteFooter = document.getElementById('site-footer');
if (siteFooter) footerObserver.observe(siteFooter);

// Enable header blur backdrop-filter for iOS/iPhones and Desktop devices
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
              (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1);
const isDesktop = !window.matchMedia('(hover: none)').matches;

if (isIOS || isDesktop) {
  document.documentElement.classList.add('enable-header-blur');
}

// Tag iOS so CSS can keep the lightbox close button but shift it to the left
if (isIOS) {
  document.documentElement.classList.add('ios-device');
}
