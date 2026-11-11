// פתיח: לומדה "קלאסית" בשלושה מסכים. בוחרים נושא, עונים על שאלה אחת,
// מקבלים משוב, ואז המסך משתבש ושחר פורץ החוצה אל האתר.
(function () {
  "use strict";
  var intro = document.getElementById("intro");
  if (!intro) return;

  var SITE = window.SITE || {};
  var seen = false;
  try { seen = sessionStorage.getItem("introSeen") === "1"; } catch (e) {}
  var force = /[?&]intro=1/.test(location.search);
  if ((SITE.intro === false || seen) && !force) { intro.remove(); return; }

  // right: מספר התשובה הנכונה (מאפס), או -1 כשאין תשובה נכונה
  var TOPICS = [
    {
      name: "תהליך ייצור", icon: "⚙", note: "212 עמודי נוהל",
      q: "מה השלב הראשון בתהליך הייצור?",
      answers: ["לקרוא את הנוהל (עמוד 1 מתוך 212)", "לברר מי אחראי", "קפה", "כל התשובות נכונות, בעיקר ג'"],
      right: 3,
      yes: "ד', כמובן. בלומדות זו תמיד ד'.",
      no: "התשובה היא ד'. בלומדות זו תמיד ד'."
    },
    {
      name: "נגישות מול לקוחות", icon: "☺", note: "כולל מבחן",
      q: "לקוח מבקש את הטופס באותיות גדולות יותר. מה עושים?",
      answers: ["מדברים אליו חזק יותר", "שולחים לו את אותו הקובץ, פעמיים", "מגדילים את האותיות", "פותחים קריאת שירות ומחכים 14 ימי עסקים"],
      right: 2,
      yes: "פשוט מגדילים. ובשביל זה היינו צריכים 45 דקות?",
      no: "פשוט מגדילים את האותיות. ובשביל זה היינו צריכים 45 דקות?"
    },
    {
      name: "אבטחת מידע", icon: "🔒", note: "רענון שנתי",
      q: "מהי הסיסמה החזקה ביותר?",
      answers: ["123456", "Password1!", "שם הכלב ושנת הלידה", "הפתק הצהוב שעל המסך"],
      right: -1,
      yes: "",
      no: "אף אחת מהן. אבל תודה ששיתפתם את הסיסמה שלכם."
    }
  ];

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var player = intro.querySelector(".player");
  var slides = intro.querySelectorAll(".slide");
  var menu = intro.querySelectorAll(".player__menu li");
  var counter = intro.querySelector("[data-counter]");
  var track = intro.querySelector(".player__track i");
  var topicsBox = intro.querySelector("[data-topics]");
  var quizBox = intro.querySelector("[data-quiz]");
  var timer = null;
  var done = false;
  var topic = null;
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
  }

  // מסך 1: בחירת נושא
  TOPICS.forEach(function (t, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("data-icon", t.icon);
    b.append(t.name);
    var small = document.createElement("small");
    small.textContent = t.note;
    b.appendChild(small);
    b.addEventListener("click", function () { pickTopic(i, b); });
    topicsBox.appendChild(b);
  });

  function pickTopic(i, button) {
    if (step !== 0 || topic) return;
    topic = TOPICS[i];
    button.classList.add("is-picked");
    intro.querySelector("[data-q-title]").textContent = topic.q;
    topic.answers.forEach(function (a, n) {
      var li = document.createElement("li");
      li.textContent = a;
      li.tabIndex = 0;
      li.setAttribute("role", "button");
      li.addEventListener("click", function () { answer(n, li); });
      li.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") answer(n, li); });
      quizBox.appendChild(li);
    });
    wait(function () {
      show(1);
      // מי שלא עונה מקבל תשובה אקראית, כדי שהפתיח לא ייתקע
      wait(function () {
        var n = Math.floor(Math.random() * topic.answers.length);
        answer(n, quizBox.children[n]);
      }, 9000);
    }, 450);
  }

  // מסך 2: שאלה אחת. מסך 3: המשוב, ואז השיבוש.
  function answer(n, li) {
    if (step !== 1) return;
    step = 1.5;
    li.classList.add("is-picked");
    var right = n === topic.right;
    var verdict = intro.querySelector("[data-verdict]");
    verdict.textContent = right ? "✔ תשובה נכונה!" : "✘ תשובה שגויה";
    verdict.className = "verdict " + (right ? "is-right" : "is-wrong");
    intro.querySelector("[data-feedback]").textContent = right ? topic.yes : topic.no;
    wait(function () {
      show(2);
      wait(glitch, 3200);
    }, 500);
  }

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
  // מי שלא בוחר נושא מקבל אחד אקראי
  wait(function () {
    var i = Math.floor(Math.random() * TOPICS.length);
    pickTopic(i, topicsBox.children[i]);
  }, 9000);
})();
