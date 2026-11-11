// הגדרות האתר. שדה ריק = הקישור לא מוצג.
window.SITE = {
  linkedinUrl: "https://www.linkedin.com/in/shahar-ezer-1466a0232/",
  email: "Shaharezer1212@gmail.com",
  phone: "052-6641422",
  intro: true // false מבטל את פתיח הלומדה
};

// הפרויקטים. title: שם הלקוח ושם הפרויקט, בלי תגיות ובלי שנים.
// images: התמונה הראשונה גדולה, השאר בשורה קטנה מתחתיה. רשימה ריקה = ממלא מקום.
// award: שורת פרס (לא חובה). stats: מספרים בולטים (לא חובה).
window.PROJECTS = [
  {
    title: "ZIM - DARE TO AI",
    award: "זוכה שלושה פרסי Gold של Brandon\u00a0Hall\u00a0Group",
    text: "במשך 14 חודשים השימוש ב־Copilot בצים עמד במקום. Dare\u00a0to\u00a0AI נועדה לשנות את זה אצל 5,000 עובדים ב־35 מדינות: סרטון השקה, מרכז AI פנימי, ושלוש לומדות שפיתחתי על כתיבת פרומפטים, שימוש אחראי ב־AI וסוכני AI. בסוף התוכנית שיעור האימוץ של Copilot הגיע ל־88%, לפי נתוני מיקרוסופט.",
    stats: [
      { num: "5,000", label: "עובדים" },
      { num: "10,400", label: "הרשמות ללומדות" },
      { num: "88%", label: "אימוץ של Copilot" }
    ],
    images: ["assets/img/projects/zim-1.webp", "assets/img/projects/zim-2.webp", "assets/img/projects/zim-3.webp", "assets/img/projects/zim-4.webp"],
    url: ""
  },
  {
    title: "WINT - מערך אונבורדינג לקוחות",
    text: "שדרגתי את מסע הלקוח החדש של החברה. עד אז כל לקוח עבר הדרכות עם נציג שירות. מיפיתי את הנושאים והשאלות שחוזרים על עצמם, את התקלות הנפוצות ואת מה שבאמת חשוב לדעת, ובניתי פלטפורמת אונבורדינג: רכיבי הוט־ספוט, טקסטים קצרים במקום חוברת ההדרכה, סרטוני סמן ומדריכי שימוש לאתר ולאפליקציה. באמצעות הפורטל צמצמתי את כמות הפניות של לקוחות חדשים למוקד השירות.",
    images: ["assets/img/projects/wint-1.webp", "assets/img/projects/wint-2.webp", "assets/img/projects/wint-3.webp", "assets/img/projects/wint-5.webp"],
    url: ""
  },
  {
    title: "מכבי - אונבורדינג למנהלים חדשים",
    text: "כניסה לתפקיד ניהולי במכבי היא תהליך טובעני. במקום להוסיף עוד עומס, הפקתי סדרה של 12 סרטונים קצרים עם אנשי מפתח בארגון, על אסטרטגיה, כלכלת בריאות, משאבי אנוש, מדידה, חוויית המטופל ועוד. סרטונים שאפשר גם רק להאזין להם, בדרכים ובין לבין, ובכך לצלוח את התהליך המקדים לכניסה לתפקיד.",
    images: ["assets/img/projects/maccabi-1.webp", "assets/img/projects/maccabi-2.webp", "assets/img/projects/maccabi-3.webp", "assets/img/projects/maccabi-4.webp"],
    url: ""
  },
  {
    title: "AppsFlyer - סרטון AI",
    text: "סרטון שנועד לרתום את העובדים לשינוי במודל העבודה עם AI, מהלך שהיה יכול לעורר הרבה התנגדות. בחרתי לא להכריז רק על השינוי הדרמטי, אלא להמליץ על דרך עבודה נכונה ויעילה בטוקנים, והוספתי הרבה הומור, כדי להקליל את התהליך וגם להסביר מה עומד מאחורי הבחירה.",
    images: ["assets/img/projects/appsflyer-1.webp", "assets/img/projects/appsflyer-2.webp", "assets/img/projects/appsflyer-3.webp", "assets/img/projects/appsflyer-4.webp", "assets/img/projects/appsflyer-5.webp", "assets/img/projects/appsflyer-6.webp", "assets/img/projects/appsflyer-7.webp"],
    url: ""
  },
  {
    title: "monday - משחק קלפים דיגיטלי",
    text: "כלי למנהלים שמשתלב בתהליך המשובים. לחברה היה משחק קלפים מודפס, והמרתי אותו לגרסה דיגיטלית: הוספתי קלפים, חשבתי מחדש על הממשק, ושמרתי על גרסה פשוטה ואינטואיטיבית שכל מטרתה לפתוח שיחה.",
    images: ["assets/img/projects/monday-1.webp", "assets/img/projects/monday-2.webp", "assets/img/projects/monday-3.webp", "assets/img/projects/monday-4.webp"],
    url: ""
  }
];
