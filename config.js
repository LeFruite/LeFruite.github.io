// Адреса вашого Apps Script (Deploy → Manage deployments → Web app URL, закінчується на /exec).
// Вносити її сюди НЕ ОБОВ'ЯЗКОВО: відкрийте setup.html на своєму сайті — він перевірить адресу й запам'ятає її.
// Посилання для учнів, які створює кабінет вчителя, самі містять потрібну адресу.
(function () {
  var own = "https://script.google.com/macros/s/AKfycbx3Ov1bucIYd-kuNLa0gs-VxU3x9m6NEYn27RSizdQnZSmWBk_w_cgoqA1JSXCZlNE/exec";
  var url = "", fromStorage = false;
  try { if (/(^|\.)lefruite\.github\.io$/i.test(location.hostname)) url = own; } catch (e) {}   // сайт автора; на чужих сайтах цей рядок не діє
  if (!url) {
    try {
      var q = new URLSearchParams(location.search).get("api");
      if (q) localStorage.setItem("script_api", q);
      var v = localStorage.getItem("script_api") || "";
      if (v) { url = /^https?:\/\//.test(v) ? v : "https://script.google.com/macros/s/" + v + "/exec"; fromStorage = true; window.SCRIPT_API_ID = v; }
    } catch (e) {}
  }
  window.SCRIPT_URL = url; window.SCRIPT_FROM_STORAGE = fromStorage;
})();
