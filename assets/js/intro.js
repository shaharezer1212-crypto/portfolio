// פתיח: לומדת נגישות "קלאסית" בשלושה מסכים. מסך פתיחה עם מטרות למידה,
// שאלה אחת ומשוב, ואז המסך משתבש ושחר פורץ החוצה אל האתר.
(function () {
  "use strict";
  var intro = document.getElementById("intro");
  if (!intro) return;

  var SITE = window.SITE || {};
  var seen = false;
  try { seen = sessionStorage.getItem("introSeen") === "1"; } catch (e) {}
  var force = /[?&]intro=1/.test(location.search);
  if ((SITE.intro === false || seen) && !force) { intro.remove(); return; }

  var FEEDBACK = {
    right: ["✔ תשובה נכונה!", "כל הכבוד! ועכשיו, כדי לוודא שהבנתם, נעבור על אותו הדבר שוב, ב־21 השקפים הבאים."],
    wrong: ["✘ תשובה שגויה", "התשובה הנכונה היא א'. אבל אל דאגה, יש עוד 21 שקפים שיסבירו את זה שוב, לאט."]
  };

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var player = intro.querySelector(".player");
  var slides = intro.querySelectorAll(".slide");
  var menu = intro.querySelectorAll(".player__menu li");
  var counter = intro.querySelector("[data-counter]");
  var track = intro.querySelector(".player__track i");
  var next = intro.querySelector("[data-next]");
  var quiz = intro.querySelectorAll("[data-quiz] li");
  var timer = null;
  var done = false;
  var step = 0;

  intro.hidden = false;
  document.body.classList.add("is-locked");

  function fit() {
    var s = Math.min((innerWidth - 24) / 960, (innerHeight - 70) / 600, 1.25);
    player.style.setProperty("--fit", s.toFixed(3));
  }
  fit();
  addEventListener("resize", fit);

  function wait(fn, ms) { clearTimeout(timer); timer = setTimeout(fn, ms); }

  function show(i) {
    step = i;
    slides.forEach(function (s, n) { s.classList.toggle("is-on", n === i); });
    menu.forEach(function (m, n) {
      m.classList.toggle("is-on", n === i);
      m.classList.toggle("is-done", n < i);
    });
    counter.textContent = "שקף " + (i + 1) + " מתוך 24";
    track.style.width = ((i + 1) / 24 * 100) + "%";
    next.disabled = i !== 0;
  }

  // מסך 1: מטרות הלמידה. "הבא" עובר לשאלה; מי שלא לוחץ עובר אחרי כמה שניות.
  function toQuestion() {
    if (step !== 0) return;
    show(1);
    // מי שלא עונה מקבל תשובה אקראית, כדי שהפתיח לא ייתקע
    wait(function () {
      var n = Math.floor(Math.random() * quiz.length);
      answer(quiz[n]);
    }, 9000);
  }

  // מסך 2: שאלה אחת. מסך 3: המשוב, ואז השיבוש.
  function answer(li) {
    if (step !== 1) return;
    step = 1.5;
    li.classList.add("is-picked");
    var f = li.hasAttribute("data-right") ? FEEDBACK.right : FEEDBACK.wrong;
    var verdict = intro.querySelector("[data-verdict]");
    verdict.textContent = f[0];
    verdict.className = "verdict " + (f === FEEDBACK.right ? "is-right" : "is-wrong");
    intro.querySelector("[data-feedback]").textContent = f[1];
    wait(function () {
      show(2);
      wait(glitch, 3400);
    }, 500);
  }

  quiz.forEach(function (li) {
    li.addEventListener("click", function () { answer(li); });
    li.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); answer(li); }
    });
  });
  next.addEventListener("click", toQuestion);

  function scramble() {
    var marks = "█▓▒░#/\\<>*?!";
    var nodes = [];
    var walker = document.createTreeWalker(player, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
    return setInterval(function () {
      nodes.forEach(function (node) {
        if (Math.random() > 0.35) return;
        node.nodeValue = node.nodeValue.replace(/\S/g, function (c) {
          return Math.random() < 0.3 ? marks[Math.floor(Math.random() * marks.length)] : c;
        });
      });
    }, 70);
  }

  function finish() {
    if (done) return;
    done = true;
    clearTimeout(timer);
    try { sessionStorage.setItem("introSeen", "1"); } catch (e) {}
    document.body.classList.remove("is-locked");
    removeEventListener("resize", fit);
    removeEventListener("keydown", onKey);
    intro.remove();
    document.dispatchEvent(new Event("intro:done"));
  }

  function glitch() {
    if (done || intro.classList.contains("is-glitch")) return;
    clearTimeout(timer);
    if (reduce) { finish(); return; }
    intro.classList.add("is-glitch");
    var noise = scramble();
    setTimeout(function () {
      clearInterval(noise);
      intro.classList.remove("is-glitch");
      intro.classList.add("is-break");
      setTimeout(finish, 2100);
    }, 1400);
  }

  function onKey(e) { if (e.key === "Escape") finish(); }

  intro.querySelector("[data-skip]").addEventListener("click", finish);
  addEventListener("keydown", onKey);

  show(0);
  wait(toQuestion, 7000);
})();
