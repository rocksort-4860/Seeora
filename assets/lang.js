/* Shared language toggle: English (default) / 中文. Preference is remembered across pages. */
(function () {
  var saved = null;
  try { saved = localStorage.getItem('seeora_lang'); } catch (e) {}
  var lang = saved === 'zh' ? 'zh' : 'en';
  var root = document.documentElement;

  function apply(l) {
    root.setAttribute('data-lang', l);
    root.setAttribute('lang', l);
    var btns = document.querySelectorAll('.lang-switch button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-lang') === l);
    }
  }

  apply(lang);

  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('.lang-switch button') : null;
    if (!b) return;
    var l = b.getAttribute('data-lang');
    apply(l);
    try { localStorage.setItem('seeora_lang', l); } catch (err) {}
  });
})();
