// Runs before first paint (loaded from index.html, not inline, so a strict
// Content Security Policy needs no 'unsafe-inline'). Dark by default for mission control,
// light only if the visitor explicitly chose it; Arabic and right-to-left unless they chose English.
// Serve this file with `Cache-Control: no-cache`: it is not fingerprinted.
(function () {
  var root = document.documentElement;
  var theme = 'dark';
  var lang = 'ar';
  try {
    if (localStorage.getItem('zimam-theme') === 'light') theme = 'light';
    if (localStorage.getItem('zimam-lang') === 'en') lang = 'en';
  } catch {
    /* storage unavailable: keep the defaults */
  }
  root.dataset.theme = theme;
  root.lang = lang;
  root.dir = lang === 'en' ? 'ltr' : 'rtl';
})();
