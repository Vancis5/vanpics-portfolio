if (navigator.userAgent.toLowerCase().indexOf('firefox') > -1) {
  document.write('<script src="scripts/firefox.js"><\/script>');
}

// Footer brightness on mobile scroll
var footerObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (window.matchMedia('(hover: none)').matches) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      } else {
        entry.target.classList.remove('is-visible');
      }
    }
  });
}, { threshold: 0.85 });

var siteFooter = document.getElementById('site-footer');
if (siteFooter) footerObserver.observe(siteFooter);
