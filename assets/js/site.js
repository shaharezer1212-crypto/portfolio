(function () {
  "use strict";
  var SITE = window.SITE || {};
  document.documentElement.classList.add("js");

  // קישורי יצירת קשר מתוך ההגדרות
  document.querySelectorAll("[data-link]").forEach(function (a) {
    var key = a.getAttribute("data-link");
    var value = SITE[key];
    if (!value) { a.hidden = true; return; }
    if (key === "email") { a.href = "mailto:" + value; a.textContent = value; }
    else if (key === "whatsapp") { a.href = "https://wa.me/" + value + (SITE.whatsappText ? "?text=" + encodeURIComponent(SITE.whatsappText) : ""); }
    else if (key === "phone") { a.href = "tel:" + value.replace(/[^0-9+]/g, ""); a.textContent = value; }
    else { a.href = value; }
  });

  // רשימת הפרויקטים
  var list = document.querySelector("[data-projects]");
  if (list) {
    var shapes = ["", "panel--b", "panel--c"];
    // פאנל במסגרת לא ישרה; בלי תמונה מוצג ממלא מקום
    function makePanel(src, alt, shape) {
      var fig = document.createElement("figure");
      fig.className = "panel" + (shape ? " " + shape : "");
      fig.style.setProperty("--ar", "16 / 9");
      var frame = document.createElement("span");
      frame.className = "panel__frame";
      if (src) {
        var img = document.createElement("img");
        img.src = src; img.alt = alt; img.loading = "lazy";
        frame.appendChild(img);
      } else {
        var todo = document.createElement("span");
        todo.className = "panel__todo";
        var label = document.createElement("span");
        label.textContent = "כאן: צילום מסך של הפרויקט";
        todo.appendChild(label);
        frame.appendChild(todo);
      }
      fig.appendChild(frame);
      return fig;
    }
    (window.PROJECTS || []).forEach(function (p, i) {
      var el = document.createElement(p.url ? "a" : "article");
      el.className = "project";
      if (p.url) el.href = p.url;
      el.setAttribute("data-reveal", "");

      var media = document.createElement("div");
      media.className = "project__media";
      var images = p.images || [];
      media.appendChild(makePanel(images[0], p.title, shapes[i % shapes.length]));
      if (images.length > 1) {
        var strip = document.createElement("div");
        strip.className = "project__strip";
        images.slice(1).forEach(function (src, n) {
          strip.appendChild(makePanel(src, "", shapes[(i + n + 1) % shapes.length]));
        });
        media.appendChild(strip);
      }

      var body = document.createElement("div");
      var num = document.createElement("div");
      num.className = "project__num";
      num.textContent = (i < 9 ? "0" : "") + (i + 1);
      var title = document.createElement("h3");
      title.className = "project__title";
      var titleText = document.createElement("span");
      titleText.textContent = p.title;
      title.appendChild(titleText);
      var text = document.createElement("p");
      text.className = "project__text";
      text.textContent = p.text;
      body.append(num);
      if (p.award) {
        var award = document.createElement("div");
        award.className = "project__award";
        award.textContent = p.award;
        body.append(award);
      }
      body.append(title, text);
      if (p.stats && p.stats.length) {
        var stats = document.createElement("dl");
        stats.className = "project__stats";
        p.stats.forEach(function (st) {
          var d = document.createElement("div");
          var dd = document.createElement("dd"); dd.textContent = st.num;
          var dt = document.createElement("dt"); dt.textContent = st.label;
          d.append(dd, dt);
          stats.appendChild(d);
        });
        body.append(stats);
      }

      el.append(media, body);
      list.appendChild(el);
    });
    // במסכי מגע אין מעבר עכבר: הפרויקט שבמרכז המסך מקבל את הצבע
    if (window.matchMedia("(hover: none)").matches && "IntersectionObserver" in window) {
      var mid = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { e.target.classList.toggle("is-active", e.isIntersecting); });
      }, { rootMargin: "-42% 0px -42% 0px" });
      list.querySelectorAll(".project").forEach(function (el) { mid.observe(el); });
    }
  }

  // חשיפה בגלילה
  function reveal() {
    var targets = document.querySelectorAll("[data-reveal], .display");
    if (!("IntersectionObserver" in window)) {
      targets.forEach(function (t) { t.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    targets.forEach(function (t) { io.observe(t); });
  }
  // כשהפתיח רץ, הכותרות נחשפות רק אחריו
  if (document.getElementById("intro")) document.addEventListener("intro:done", reveal, { once: true });
  else reveal();

  var year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();
})();
