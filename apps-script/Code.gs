// Apps Script для Google Таблиці: приймає дані від тесту, створює аркуш для кожної роботи
// та автоматично оцінює відкриті питання за ключовими поняттями.
// Після вставки: Deploy → Manage deployments → Edit → New version.

var BASE_HEADERS = ["Час", "Клас", "Учень", "Автобал", "Статус", "Виходів зі сторінки",
                    "Бал відкритих (авто)", "Підсумок (авто)", "Перевірка відкритих"];

var OPEN_MAX = 2;    // макс. балів за ОДНЕ відкрите питання
var MIN_WORDS = 3;   // відповідь коротша за це число слів отримує 0

/* ===== КРИТЕРІЇ ВІДКРИТИХ ПИТАНЬ =====
   Ключ — код питання з пулу (o01…o10 — нервова система, k01…k10 — типи клітин, g01…g09 — політична карта світу, h01…h04 — клітина/тканини/органи/системи). Кожне «поняття» — це назва (для вашого звіту)
   і регулярний вираз (p), що шукається в тексті відповіді (малі літери, без апострофів).
   Бал = OPEN_MAX × (знайдені / усі поняття) ÷ FULL_AT, але не більше OPEN_MAX:
   максимум дається вже за FULL_AT = 75% понять. */
var RUBRIC = {
  o01: [
    { n: "центральна нервова система", p: "центральн|цнс" },
    { n: "периферична нервова система", p: "периферичн" },
    { n: "головний мозок", p: "головн" },
    { n: "спинний мозок", p: "спинн" },
    { n: "нерви / нервові вузли", p: "вузл|гангл" }
  ],
  o02: [
    { n: "нейрони", p: "нейрон" },
    { n: "нейроглія", p: "нейрогл|гліальн|глія|гліоцит" },
    { n: "сприймання подразнень", p: "подразн|сприйм|сприйн" },
    { n: "проведення збудження", p: "збудж|імпульс|проводит|проведенн|передач|передає" },
    { n: "обробка інформації", p: "обробк|обробл|інформац|аналіз" }
  ],
  o03: [
    { n: "тіло нейрона", p: "тіло|тілом|тіла|сома" },
    { n: "дендрити", p: "дендрит" },
    { n: "аксон", p: "аксон|нейрит" },
    { n: "властивість: збудливість", p: "збудлив" },
    { n: "властивість: провідність", p: "провідн" }
  ],
  o04: [
    { n: "місце контакту", p: "контакт|звязок|звязк|між нейрон" },
    { n: "пресинаптична мембрана", p: "пресинап" },
    { n: "синаптична щілина", p: "щілин" },
    { n: "постсинаптична мембрана", p: "постсинап" },
    { n: "нейромедіатор / хімічна передача", p: "медіатор|хімічн|речовин" }
  ],
  o05: [
    { n: "чутливі (доцентрові)", p: "чутлив|доцентров|аферент" },
    { n: "рухові (відцентрові)", p: "рухов|відцентров|еферент" },
    { n: "змішані", p: "змішан" },
    { n: "чутливі: від рецепторів до ЦНС", p: "рецептор|до мозк|до цнс|до центральн" },
    { n: "рухові: до м'язів і залоз", p: "мязів|мязи|мяз|залоз|від цнс|від мозк|від центральн" }
  ],
  o06: [
    { n: "у хребтовому каналі", p: "хребт|хребет" },
    { n: "сіра речовина всередині (метелик)", p: "всередин|метелик|літер" },
    { n: "біла речовина зовні", p: "зовні|навколо|ззовні" },
    { n: "сіра — тіла нейронів", p: "тіл[а-яіїєґ]* нейрон|тілами|тіла" },
    { n: "біла — відростки / провідні шляхи", p: "відростк|провідн|шлях|аксон" },
    { n: "роги або центральний канал", p: "рог|рожк|канал" }
  ],
  o07: [
    { n: "згадано сіру речовину", p: "сір" },
    { n: "згадано білу речовину", p: "біл" },
    { n: "сіра: рефлекторна функція / нервові центри / тіла нейронів", p: "рефлекс|центр|тіл|нейрон" },
    { n: "біла: провідникова функція / шляхи / відростки", p: "провід|шлях|відростк|передає|передач" },
    { n: "зв'язок із головним мозком / висхідні й низхідні шляхи", p: "головн|висхідн|низхідн" }
  ],
  o08: [
    { n: "усього 31 пара", p: "31|тридцять одн" },
    { n: "шийних 8", p: "шийн\\D{0,25}(8|вісім)(\\D|$)|(^|\\D)(8|вісім)\\D{0,25}шийн" },
    { n: "грудних 12", p: "грудн\\D{0,25}(12|дванадцять)|(12|дванадцять)\\D{0,25}грудн" },
    { n: "поперекових 5", p: "попереков\\D{0,25}(5|пять)(\\D|$)|(^|\\D)(5|пять)\\D{0,25}попереков" },
    { n: "крижових 5", p: "крижов\\D{0,25}(5|пять)(\\D|$)|(^|\\D)(5|пять)\\D{0,25}крижов" },
    { n: "куприкових 1", p: "куприк\\D{0,25}(1|одн)|куприков\\D{0,25}(1|одн)|(^|\\D)(1|одн[а-яіїєґ]*)\\D{0,25}куприк" }
  ],
  o09: [
    { n: "рефлекторна функція", p: "рефлектор" },
    { n: "провідникова функція", p: "провідник" },
    { n: "рефлекторна: відповідь на подразнення / нервовий центр", p: "подразн|відповід|центр" },
    { n: "провідникова: зв'язок із головним мозком / шляхи / імпульси", p: "головн|шлях|імпульс|збудж" }
  ],
  o10: [
    { n: "рефлекс — відповідь / реакція", p: "відповід|реакц" },
    { n: "на подразнення", p: "подразн" },
    { n: "за участі нервової системи", p: "нервов[а-яіїєґ]* систем|цнс|мозк" },
    { n: "порядок: рецептор → чутливий нейрон", p: "рецептор[\\s\\S]*чутлив" },
    { n: "порядок: чутливий → нервовий центр → руховий нейрон", p: "чутлив[\\s\\S]*центр[\\s\\S]*рухов" }
  ],
  // ----- Самостійна «Типи організації клітин» -----
  k01: [
    { n: "структурна одиниця", p: "структурн" },
    { n: "функціональна одиниця", p: "функціональн" },
    { n: "живе / організм", p: "жив|організм" },
    { n: "процеси життєдіяльності (обмін, ріст, поділ)", p: "обмін|життєдіяльн|процес|ріст|поділ|розмнож" }
  ],
  k02: [
    { n: "плазматична мембрана", p: "мембран" },
    { n: "цитоплазма", p: "цитоплазм" },
    { n: "роль мембрани (відокремлює, регулює обмін)", p: "відокремл|межа|регулю|обмін|транспорт|захист|надходж|пропуска" },
    { n: "роль цитоплазми (середовище, органели, включення)", p: "середовищ|органел|включен|розташован" }
  ],
  k03: [
    { n: "органели — постійні", p: "постійн" },
    { n: "включення — тимчасові / непостійні", p: "тимчасов|непостійн" },
    { n: "органели виконують функції", p: "функці" },
    { n: "приклад органели", p: "мітохондр|хлоропласт|рибосом|лізосом|гольджі|ендоплазм|вакуол" },
    { n: "приклад включення", p: "крохмал|жир|глікоген|кристал|крапл|гранул|запасн" }
  ],
  k04: [
    { n: "прокаріоти — немає оформленого ядра", p: "(немає|відсутн|без|позбавлен|не мають|не має)[\\s\\S]{0,30}ядр|нуклеоїд" },
    { n: "еукаріоти — є ядро", p: "(є|мають|має|наявн|оформлен)[\\s\\S]{0,30}ядр" },
    { n: "приклад прокаріота (бактерія)", p: "бактері|кишков|паличк" },
    { n: "приклад еукаріота (рослини, тварини, гриби)", p: "рослин|тварин|гриб|людин|дріжд|берез|амеб" },
    { n: "ДНК у нуклеоїді / мембранні органели", p: "нуклеоїд|мембранн|органел" }
  ],
  k05: [
    { n: "рослини мають стінку", p: "рослин" },
    { n: "гриби мають стінку", p: "гриб" },
    { n: "бактерії мають стінку", p: "бактері" },
    { n: "тварини стінки не мають", p: "(без|немає|не мають|не має|позбавлен|відсутн)[\\s\\S]{0,60}тварин|тварин[\\s\\S]{0,60}(без|немає|не мають|не має|позбавлен|відсутн)" }
  ],
  k06: [
    { n: "у рослин є клітинна стінка", p: "стінк|оболонк" },
    { n: "у рослин є хлоропласти", p: "хлоропласт|пластид|зелен" },
    { n: "вакуоль", p: "вакуол" },
    { n: "згадано тваринну клітину", p: "тварин" }
  ],
  k07: [
    { n: "бактерії — немає ядра / нуклеоїд", p: "нуклеоїд|(немає|відсутн|без|не мають)[\\s\\S]{0,30}ядр" },
    { n: "гриби — є ядро / еукаріоти", p: "(є|мають|наявн)[\\s\\S]{0,30}ядр|еукаріот" },
    { n: "клітинна стінка", p: "стінк" },
    { n: "органели у грибів / відсутні у бактерій", p: "органел|мітохондр" }
  ],
  k08: [
    { n: "ядерна оболонка", p: "оболонк" },
    { n: "хроматин / хромосоми / ДНК", p: "хроматин|хромосом|днк" },
    { n: "ядерце", p: "ядерц" },
    { n: "каріоплазма (ядерний сік)", p: "каріоплазм|ядерний сік|ядерн[а-яіїєґ]* сік" },
    { n: "функція: зберігання спадкової інформації", p: "спадков|зберіга|генетичн|днк" },
    { n: "функція: керування клітиною", p: "керу|контрол|регул|центр" }
  ],
  k09: [
    { n: "є оформлене ядро", p: "ядр" },
    { n: "є органели", p: "органел" },
    { n: "мембранні структури / відокремлені відділи", p: "мембран|відокремл|розділ|компартмент|окремі" },
    { n: "різні процеси одночасно / складність", p: "процес|функці|одночасно|складн" }
  ],
  k10: [
    { n: "внутрішнє середовище клітини", p: "середовищ|вміст" },
    { n: "містить органели та включення", p: "органел|включен" },
    { n: "обмін речовин / реакції / транспорт", p: "обмін|реакці|процес|транспорт|рух" },
    { n: "розташована під мембраною", p: "мембран" }
  ],
  // ----- Самостійна «Політична карта світу» (ч.1) — за презентацією -----
  g01: [
    { n: "Європа", p: "європ" },
    { n: "Азія", p: "азі" },
    { n: "Африка", p: "африк|африц" },
    { n: "Америка", p: "америк|америц" },
    { n: "Океанія", p: "океані" },
    { n: "для статистичного аналізу", p: "статистичн|аналіз|облік" }
  ],
  g02: [
    { n: "194 незалежні держави", p: "194" },
    { n: "близько 230 країн і територій", p: "230" },
    { n: "Африка — лідер", p: "африк|африц" },
    { n: "54 держави в Африці", p: "54|пятдесят чотир" }
  ],
  g03: [
    { n: "територія — частина поверхні з просторовими межами", p: "поверхн|простор|меж" },
    { n: "територія включає суходоли, акваторії, Антарктиду", p: "суходол|акватор|антарктид" },
    { n: "країна — заселена територія з кордонами", p: "заселен|кордон кордон|кордон" },
    { n: "країна може бути залежною (колонія)", p: "залежн|колоні" },
    { n: "держава — повністю суверенна / незалежна", p: "суверен|незалежн" },
    { n: "незалежна у внутрішній і зовнішній політиці", p: "внутрішн[а-яіїєґ]*[\\s\\S]{0,40}зовнішн|зовнішн[а-яіїєґ]*[\\s\\S]{0,40}внутрішн" }
  ],
  g04: [
    { n: "відсутність суверенітету", p: "(не|без|відсутн)[\\s\\S]{0,30}суверен|залежн" },
    { n: "заморські території / автономні регіони / протекторати", p: "заморськ|автоном|протектор" },
    { n: "близько 10 держав", p: "10|десят" },
    { n: "військово-стратегічне значення", p: "військов|стратегіч|баз" }
  ],
  g05: [
    { n: "Велика Британія — за кількістю", p: "великобритан|велик[а-яіїєґ]* британі|британі" },
    { n: "Франція — за кількістю", p: "франц" },
    { n: "Данія — за площею", p: "дані" },
    { n: "приклад: Гібралтар", p: "гібралтар" },
    { n: "приклад: Гренландія / Фарерські острови", p: "гренланд|фарер" }
  ],
  g06: [
    { n: "статус не визначено або оскаржується", p: "невизначен|оскаржу|спірн|не визнан|невизнан" },
    { n: "території з невизначеним статусом (Палестина, Західна Сахара)", p: "палестин|сахар" },
    { n: "спірні території (Гібралтар)", p: "гібралтар|претенду" },
    { n: "самопроголошені республіки", p: "самопроголошен" },
    { n: "не визнані більшістю країн", p: "не визнан|невизнан|більшіст" },
    { n: "політична напруга", p: "напруг|конфлікт" }
  ],
  g07: [
    { n: "Палестина", p: "палестин" },
    { n: "Західна Сахара", p: "сахар" },
    { n: "Гібралтар", p: "гібралтар" },
    { n: "спірні — претендують кілька держав", p: "претенду|кілька держав|декілька держав|спір" },
    { n: "невизначений статус / статус не визначено", p: "невизначен|не визначен" }
  ],
  g08: [
    { n: "самопроголошені утворення", p: "самопроголошен|проголосил" },
    { n: "не визнані більшістю країн", p: "не визнан|невизнан|більшіст" },
    { n: "Азія", p: "азі" },
    { n: "Європа", p: "європ" },
    { n: "Африка", p: "африк|африц" },
    { n: "тимчасово окуповані території України", p: "україн|окупован" }
  ],
  g09: [
    { n: "Договір 1959 року", p: "1959|договор" },
    { n: "демілітаризована / нейтральна зона", p: "демілітар|нейтрал" },
    { n: "заборонена військова та господарська діяльність", p: "військов|господарськ" },
    { n: "дозволена лише науково-пошукова робота", p: "науков|дослідж|пошук" },
    { n: "станція «Академік Вернадський»", p: "вернадськ" },
    { n: "унікальний континент / особливий режим", p: "особлив|унікальн|міжнародно" }
  ],
  // ----- Самостійна «Клітина, тканини, органи, системи» (один варіант) -----
  h01: [
    { n: "клітина — структурна одиниця", p: "структурн" },
    { n: "клітина — функціональна одиниця живого", p: "функціональн" },
    { n: "тканина: клітини і міжклітинна речовина", p: "міжклітин" },
    { n: "тканина: подібні за будовою/походженням/функціями", p: "подібн|схожі|однотипн|однаков" },
    { n: "орган — частина тіла з певною формою/розташуванням", p: "частин[а-яіїєґ]* тіла|форм[а-яіїєґ]*|розташуван" },
    { n: "орган складається з кількох тканин", p: "кількох тканин|декількох тканин|різних тканин|кілька тканин|декілька тканин|багатьох тканин" },
    { n: "орган виконує певну функцію", p: "виконує[\\s\\S]{0,25}функці|певн[а-яіїєґ]* функці" }
  ],
  h02: [
    { n: "плазматична мембрана", p: "мембран" },
    { n: "цитоплазма", p: "цитоплазм" },
    { n: "ядро", p: "ядр" },
    { n: "мітохондрії", p: "мітохондр" },
    { n: "рибосоми", p: "рибосом" },
    { n: "ще одна органела (ЕПС, апарат Гольджі, лізосоми, центріолі)", p: "ендоплазматичн|епс|гольджі|лізосом|центріол|клітинн[а-яіїєґ]* центр" }
  ],
  h03: [
    { n: "фізіологічна система — група органів", p: "груп[а-яіїєґ]* орган|сукупн[а-яіїєґ]* орган|орган[а-яіїєґ]*[\\s\\S]{0,30}обєдн|обєдн[а-яіїєґ]*[\\s\\S]{0,30}орган" },
    { n: "фізіологічна: спільна функція", p: "спільн[а-яіїєґ]* функці|виконують[\\s\\S]{0,25}функці|однакову функці" },
    { n: "фізіологічна: постійна / анатомічно пов'язана", p: "постійн|стал[а-яіїєґ]* |анатомічн" },
    { n: "функціональна: тимчасова / динамічна", p: "тимчасов|динамічн|гнучк" },
    { n: "функціональна: органи з різних систем", p: "різних[\\s\\S]{0,30}систем|різн[а-яіїєґ]* фізіологічн|кількох[\\s\\S]{0,20}систем|декількох[\\s\\S]{0,20}систем" },
    { n: "функціональна: корисний / пристосувальний результат", p: "результат|пристосувальн|корисн" },
    { n: "приклад фізіологічної системи", p: "травн|дихальн|кровоносн|кровообіг|нервов|видільн|ендокринн|опорно|імунн|статев|покривн" }
  ],
  h04: [
    { n: "гомеостаз — сталість / рівновага", p: "стал[а-яіїєґ]*|постійн|стабільн|рівноваг" },
    { n: "гомеостаз — внутрішнє середовище організму", p: "внутрішн[а-яіїєґ]* середовищ" },
    { n: "названо щонайменше 3 фізіологічні системи", ps: ["травн", "дихальн", "кровоносн|кровообіг|серцево", "видільн|сечов", "нервов", "ендокринн|гормональн", "опорно|кістков|рухов", "імунн", "статев|репродукт", "покривн"], min: 3 },
    { n: "названо щонайменше 5 фізіологічних систем", ps: ["травн", "дихальн", "кровоносн|кровообіг|серцево", "видільн|сечов", "нервов", "ендокринн|гормональн", "опорно|кістков|рухов", "імунн", "статев|репродукт", "покривн"], min: 5 }
  ]
};

/* ===== Оцінювання відкритих питань ===== */
var FULL_AT = 0.75; // частка знайдених «понять», за якої відкрите питання отримує максимум (2 бали)
function norm_(s) {
  return String(s || "").toLowerCase().replace(/[’ʼ`']/g, "").replace(/\s+/g, " ").trim();
}

// rmap — критерії з тесту нової системи ({pid: {max, rub}}); якщо немає — беремо RUBRIC зі старих тестів
function gradeOpenAnswer_(pid, answer, rmap) {
  var rub = RUBRIC[pid], max = OPEN_MAX;
  if (rmap && rmap[pid]) { rub = rmap[pid].rub; max = rmap[pid].max || OPEN_MAX; }
  if (!rub || !rub.length) return { score: 0, note: pid + ": немає критеріїв — перевірте вручну" };
  var t = norm_(answer);
  var words = t.split(" ").filter(function (w) { return w.length > 1; }).length;
  if (words < MIN_WORDS) return { score: 0, note: pid + ": 0/" + max + " (відповідь порожня або занадто коротка)" };
  var hit = 0, miss = [];
  rub.forEach(function (c) {
    var ok;
    try { ok = c.ps ? c.ps.filter(function (q) { return new RegExp(q).test(t); }).length >= (c.min || 1) : new RegExp(c.p).test(t); }
    catch (e) { ok = false; }
    if (ok) hit++; else miss.push(c.n);
  });
  var score = Math.round(Math.min(max, max * (hit / rub.length) / FULL_AT) * 4) / 4;   // максимум — за FULL_AT (75%) понять
  return { score: score, note: pid + ": " + score + "/" + max + (miss.length ? " — не знайдено: " + miss.join("; ") : " — знайдено все") };
}

// answers: {q1: "...", q10: "[o06] Питання: ... — Відповідь: ...", ...}
function gradeOpenAll_(answers, rmap) {
  var sum = 0, notes = [];
  Object.keys(answers).sort(function (a, b) { return parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10); })
    .forEach(function (key) {
      var m = String(answers[key]).match(/^\[([a-z]\d+)\]\s*Питання:[\s\S]*?—\s*Відповідь:\s*([\s\S]*)$/);
      if (!m) return;
      var g = gradeOpenAnswer_(m[1], m[2], rmap);
      sum += g.score;
      notes.push(key + " " + g.note);
    });
  return { sum: Math.round(sum * 100) / 100, notes: notes.join("\n") };
}

/* ===== Допоміжні функції ===== */
function getSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(BASE_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, BASE_HEADERS.length).setFontWeight("bold");
  }
  return sheet;
}

function safe_(v) {
  v = (v === undefined || v === null) ? "" : String(v);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

// Повертає номер колонки за назвою; якщо немає — створює в кінці
function col_(sheet, headers, name) {
  var c = headers.indexOf(name) + 1;
  if (c === 0) {
    c = headers.length + 1;
    sheet.getRange(1, c).setValue(name).setFontWeight("bold");
    headers.push(name);
  }
  return c;
}

function writeGrade_(sheet, row, headers, autoValue, g) {
  var autoNum = parseFloat(String(autoValue).replace(",", ".")) || 0; // працює і зі старим «6.25 / 7.5»
  var total = Math.round((autoNum + g.sum) * 100) / 100;
  sheet.getRange(row, col_(sheet, headers, "Бал відкритих (авто)")).setValue(g.sum);
  sheet.getRange(row, col_(sheet, headers, "Підсумок (авто)")).setValue(total);
  sheet.getRange(row, col_(sheet, headers, "Перевірка відкритих")).setValue(g.notes);
}

/* ===== Клас «8-2» Google Sheets може сам перетворити на дату — порівнюємо з урахуванням цього ===== */
function clsMatch_(v, cn) {
  cn = String(cn).trim().toLowerCase();
  if (v instanceof Date) {
    var tz = Session.getScriptTimeZone();
    return Utilities.formatDate(v, tz, "d-M") === cn || Utilities.formatDate(v, tz, "M-d") === cn;
  }
  return String(v).trim().toLowerCase() === cn;
}
// додає рядок, а колонку «Клас» записує саме як текст
function addRow_(sheet, arr) {
  var r = sheet.getLastRow() + 1;
  sheet.getRange(r, 2).setNumberFormat("@");
  sheet.getRange(r, 1, 1, arr.length).setValues([arr]);
  return r;
}

/* ===== Прийом даних від тесту ===== */
function doPost(e) {
  if (e && e.parameter && /^t_/.test(e.parameter.action || "")) return teacherApi_(e.parameter);   // редактор вчителя
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return ContentService.createTextOutput("SERVER_BUSY");
  }

  try {
    var p = e.parameter;
    var sheetName = (p.sheetName || "Без назви").toString().substring(0, 100);
    var testId = (p.testId || "").trim(), test = null;
    if (testId) {   // тест нової системи: аркуш і керування — за ID тесту
      test = loadTest_(testId);
      if (!test) return ContentService.createTextOutput("NO_TEST");
      sheetName = test.sheetName;
    }
    var sheet = getSheet_(sheetName);
    var className = (p.className || "").trim();
    var studentName = (p.studentName || "").trim();
    var action = p.action;
    var now = new Date().toLocaleString('uk-UA');

    var ctrl = getCtrl_(testId);
    var round = (action === "submit" && parseInt(p.round, 10)) ? parseInt(p.round, 10) : ctrl.round;

    var data = sheet.getDataRange().getValues();
    var headers0 = data[0].slice();
    var rc = headers0.indexOf("Раунд");
    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      var rr = rc >= 0 ? (parseInt(data[i][rc], 10) || 1) : 1;
      if (rr !== round) continue;
      if (clsMatch_(data[i][1], className) &&
          data[i][2].toString().trim().toLowerCase() === studentName.toLowerCase()) {
        rowIndex = i + 1;
        break;
      }
    }

    if (action === "start") {
      if (ctrl.state !== "open") return ContentService.createTextOutput("NOT_OPEN");
      if (test && (test.groups || []).indexOf(className) < 0) return ContentService.createTextOutput("NOT_ASSIGNED");
      if (rowIndex !== -1) return ContentService.createTextOutput("ALREADY_STARTED");
      addRow_(sheet, [now, className, studentName, "", "В процесі складання...", 0]);
      sheet.getRange(sheet.getLastRow(), col_(sheet, headers0, "Раунд")).setValue(round);
      return ContentService.createTextOutput("OK_STARTED|" + round + "|" + ctrl.stopSeq);
    }

    if (action === "submit") {
      var answers = {};
      try { answers = JSON.parse(p.answers || "{}"); } catch (err) {}
      var partial = p.partial === "true";
      var status = partial ? "Вийшов зі сторінки (не завершив)"
        : (p.byTeacher === "true" ? "Перервано вчителем" : (p.isInterrupted === "true" ? "Перервано!" : "Завершено"));
      // запізніле часткове збереження не має перезаписувати вже завершену роботу
      if (partial && rowIndex !== -1) {
        var cur = String(data[rowIndex - 1][4]);
        if (cur.indexOf("Завершено") === 0 || cur.indexOf("Перервано") === 0) return ContentService.createTextOutput("OK_IGNORED");
      }

      if (rowIndex === -1) {
        rowIndex = addRow_(sheet, [now, className, studentName, "", "", 0]);
        sheet.getRange(rowIndex, col_(sheet, headers0, "Раунд")).setValue(round);
      }
      sheet.getRange(rowIndex, 1).setValue(now);
      sheet.getRange(rowIndex, 4).setValue(parseFloat(p.testScore) || 0);
      sheet.getRange(rowIndex, 5).setValue(status);
      sheet.getRange(rowIndex, 6).setValue(parseInt(p.leaves || "0", 10) || 0);

      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      sheet.getRange(rowIndex, col_(sheet, headers, "Тип виходів")).setValue(safe_(p.leaveInfo || ""));
      sheet.getRange(rowIndex, col_(sheet, headers, "Секунд поза сторінкою")).setValue(parseInt(p.awaySec || "0", 10) || 0);
      sheet.getRange(rowIndex, col_(sheet, headers, "Спроб вставки")).setValue(parseInt(p.pastes || "0", 10) || 0);
      sheet.getRange(rowIndex, col_(sheet, headers, "Журнал виходів")).setValue(safe_(String(p.leaveLog || "").substring(0, 2000)));
      sheet.getRange(rowIndex, col_(sheet, headers, "Час на питання")).setValue(safe_(String(p.qTime || "").substring(0, 2000)));
      Object.keys(answers).forEach(function (key) {
        sheet.getRange(rowIndex, col_(sheet, headers, key)).setValue(safe_(answers[key]));
      });

      writeGrade_(sheet, rowIndex, headers, p.testScore, gradeOpenAll_(answers, rubricMap_(test)));
      // в журнал оцінки потрапляють лише коли ви самі їх заносите (кнопка в редакторі або пункт меню)
      return ContentService.createTextOutput("OK_SUBMITTED");
    }

    return ContentService.createTextOutput("INVALID_ACTION");
  } finally {
    lock.releaseLock();
  }
}

/* ===== Керування вчителя: почати / перервати / дозволити всім ще раз ===== */
// ЗМІНІТЬ ПІН на свій! Він потрібен для кнопок на сторінці вчителя.
var TEACHER_PIN = "1234";

// id — ID тесту нової системи; порожній id — старі окремі HTML-файли (спільне керування)
function ck_(id, k) { return id ? k + "|" + id : k; }
function getCtrl_(id) {
  var pr = PropertiesService.getScriptProperties();
  return {
    state: pr.getProperty(ck_(id, "CTRL_STATE")) || "closed",           // open | paused | closed
    round: parseInt(pr.getProperty(ck_(id, "CTRL_ROUND")), 10) || 1,    // номер «спроби»
    stopSeq: parseInt(pr.getProperty(ck_(id, "CTRL_STOPSEQ")), 10) || 0 // збільшується при кожному «Перервати»
  };
}

function setCtrl_(kind, id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var pr = PropertiesService.getScriptProperties();
    var c = getCtrl_(id);
    if (kind === "open") {
      pr.setProperty(ck_(id, "CTRL_STATE"), "open");
    } else if (kind === "pause") {      // пауза: тести заморожуються, правила виходу не діють
      pr.setProperty(ck_(id, "CTRL_STATE"), "paused");
    } else if (kind === "close") {
      pr.setProperty(ck_(id, "CTRL_STATE"), "closed");
      pr.setProperty(ck_(id, "CTRL_STOPSEQ"), String(c.stopSeq + 1));
    } else if (kind === "reset") {      // нова спроба; робота закрита, поки не натиснете «Почати»
      pr.setProperty(ck_(id, "CTRL_STATE"), "closed");
      pr.setProperty(ck_(id, "CTRL_STOPSEQ"), String(c.stopSeq + 1));
      pr.setProperty(ck_(id, "CTRL_ROUND"), String(c.round + 1));
    }
  } finally {
    lock.releaseLock();
  }
  return getCtrl_(id);
}

// Викликається зі сторінки вчителя
function teacherAction(pin, kind) {
  if (!kind) return getCtrl_();   // лише показати поточний статус
  if (String(pin) !== TEACHER_PIN) return { error: "Невірний пін" };
  if (kind === "open" || kind === "pause" || kind === "close" || kind === "reset") setCtrl_(kind);
  return getCtrl_();
}

// Статус для учнів (JSON) або сторінка вчителя (?panel=1)
function doGet(e) {
  var q = (e && e.parameter) || {};
  if (q.info) return jsonOut_(infoJson_(q.info));        // нова система: дані для сторінки учня
  if (q.body) return jsonOut_(bodyJson_(q.body));        // питання тесту (лише коли робота відкрита)
  if (q.ctrl) return jsonOut_(getCtrl_(q.ctrl));         // стан тесту (опитування кожні кілька секунд)
  if (e && e.parameter && e.parameter.marks) return marksJson_(e.parameter);
  if (e && e.parameter && e.parameter.panel) {
    return HtmlService.createHtmlOutput(PANEL_HTML_).setTitle("Керування самостійними")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }
  return ContentService.createTextOutput(JSON.stringify(getCtrl_())).setMimeType(ContentService.MimeType.JSON);
}

var PANEL_HTML_ =
  '<!doctype html><html><head><meta charset="utf-8"><style>' +
  'body{font-family:Arial,sans-serif;max-width:420px;margin:20px auto;padding:0 16px;text-align:center}' +
  'button{display:block;width:100%;padding:16px;margin:12px 0;font-size:18px;border:0;border-radius:8px;color:#fff;cursor:pointer}' +
  '#o{background:#27ae60}#p{background:#e67e22}#c{background:#c0392b}#r{background:#2980b9}input{padding:10px;font-size:16px;width:100%;box-sizing:border-box}' +
  '#st{font-size:20px;font-weight:bold;margin:16px 0}</style></head><body>' +
  '<h2>Керування самостійними</h2><input id="pin" type="password" placeholder="Пін вчителя">' +
  '<div id="st">…</div>' +
  '<button id="o" onclick="go(\'open\')">▶ Почати / продовжити написання</button>' +
  '<button id="p" onclick="go(\'pause\')">⏸ Пауза для всіх (тривога)</button>' +
  '<button id="c" onclick="go(\'close\')">⏹ Перервати всі роботи</button>' +
  '<button id="r" onclick="go(\'reset\')">🔄 Дозволити всім пройти ще раз</button>' +
  '<script>' +
  'function show(s){document.getElementById("st").innerText=s.error?s.error:({open:"Статус: ВІДКРИТО",paused:"Статус: ПАУЗА",closed:"Статус: ЗАКРИТО"}[s.state])+" · спроба №"+s.round;}' +
  'function go(k){var m={close:"Перервати ВСІ роботи просто зараз?",reset:"Дозволити всім пройти ще раз? Усі поточні роботи буде перервано, потім натисніть «Почати»."};' +
  'if(m[k]&&!confirm(m[k]))return;google.script.run.withSuccessHandler(show).teacherAction(document.getElementById("pin").value,k);}' +
  'google.script.run.withSuccessHandler(show).teacherAction("","");' +
  '</script></body></html>';

/* ===== Меню в таблиці ===== */
function onOpen() {
  SpreadsheetApp.getUi().createMenu("Самостійні")
    .addItem("▶ Почати / продовжити написання", "menuOpen_")
    .addItem("⏸ Пауза для всіх (тривога)", "menuPause_")
    .addItem("⏹ Перервати всі роботи", "menuClose_")
    .addItem("🔄 Дозволити всім пройти ще раз", "menuReset_")
    .addSeparator()
    .addItem("Перерахувати відкриті питання (поточний аркуш)", "regradeActiveSheet")
    .addItem("🧹 Прибрати зайві рядки (поточний аркуш)", "cleanupDuplicates")
    .addSeparator()
    .addItem("📒 Оцінки в журнал: лише порожні клітинки (поточний аркуш роботи)", "menuJournalFill_")
    .addItem("📒 Оцінки в журнал: перерахувати й перезаписати", "menuJournalOverwrite_")
    .addItem("📒 Створити аркуші журналу зі списків класів", "createJournals_")
    .addToUi();
}
// Якщо відкрито аркуш з результатами роботи з редактора — кнопки діють лише на цю роботу; інакше — на старі окремі файли.
function activeTestId_() {
  var t = findBySheet_(SpreadsheetApp.getActiveSheet().getName());
  return t ? t.id : "";
}
function menuOpen_()  { setCtrl_("open", activeTestId_());  toast_("Роботу відкрито — учні можуть починати"); }
function menuPause_() { setCtrl_("pause", activeTestId_()); toast_("Роботу поставлено на паузу"); }
function menuClose_() { setCtrl_("close", activeTestId_()); toast_("Роботу перервано"); }
function menuReset_() { var c = setCtrl_("reset", activeTestId_()); toast_("Нова спроба №" + c.round + ". Натисніть «Почати написання»"); }
function toast_(m) { SpreadsheetApp.getActiveSpreadsheet().toast(m, "Самостійні", 6); }

function regradeActiveSheet() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var tid = activeTestId_();
  var rmap = tid ? rubricMap_(loadTest_(tid)) : null;
  var data = sheet.getDataRange().getValues();
  var headers = data[0].slice();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][4]).indexOf("В процесі") === 0) continue;
    var answers = {};
    headers.forEach(function (h, c) {
      if (/^q\d+$/.test(h) && data[r][c]) answers[h] = String(data[r][c]);
    });
    writeGrade_(sheet, r + 1, headers, data[r][3], gradeOpenAll_(answers, rmap));
  }
  SpreadsheetApp.getActiveSpreadsheet().toast("Відкриті питання перераховано", "Готово", 5);
}


/* ===== Прибирання дублів: по одному рядку на учня за спробу (найповніший статус; за рівних — останній) ===== */
function cleanupDuplicates() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length < 3) { ui.alert("Тут нема що прибирати."); return; }
  var rc = data[0].indexOf("Раунд");
  var tz = Session.getScriptTimeZone();

  var known = {};  // тексти класів, що вже є в таблиці
  for (var i = 1; i < data.length; i++) if (!(data[i][1] instanceof Date)) known[String(data[i][1]).trim().toLowerCase()] = true;
  function clsKey(v) {
    if (!(v instanceof Date)) return String(v).trim().toLowerCase();
    var a = Utilities.formatDate(v, tz, "d-M"), b = Utilities.formatDate(v, tz, "M-d");
    return known[a] ? a : (known[b] ? b : a);
  }
  function rank(st) {
    st = String(st);
    if (st.indexOf("Завершено") === 0) return 4;
    if (st.indexOf("Перервано") === 0) return 3;
    if (st.indexOf("Вийшов") === 0) return 2;
    return 1;
  }
  var best = {};
  for (var r = 1; r < data.length; r++) {
    var key = clsKey(data[r][1]) + "|" + String(data[r][2]).trim().toLowerCase() + "|" + (rc >= 0 ? (parseInt(data[r][rc], 10) || 1) : 1);
    var rk = rank(data[r][4]);
    if (!best[key] || rk >= best[key].rk) best[key] = { row: r, rk: rk };
  }
  var del = [];
  for (var r2 = 1; r2 < data.length; r2++) {
    var k2 = clsKey(data[r2][1]) + "|" + String(data[r2][2]).trim().toLowerCase() + "|" + (rc >= 0 ? (parseInt(data[r2][rc], 10) || 1) : 1);
    if (best[k2].row !== r2) del.push(r2 + 1);
  }
  if (!del.length) { ui.alert("Зайвих рядків не знайдено."); return; }
  var ans = ui.alert("Буде видалено " + del.length + " зайвих рядків (лишається по одному на учня за спробу).\n" +
    "Перед цим автоматично створиться копія аркуша. Продовжити?", ui.ButtonSet.YES_NO);
  if (ans !== ui.Button.YES) return;
  sheet.copyTo(ss).setName((sheet.getName().substring(0, 70) + " (копія до очищення)").substring(0, 99));
  for (var d = del.length - 1; d >= 0; d--) sheet.deleteRow(del[d]);
  ss.toast("Видалено рядків: " + del.length, "Готово", 6);
}


/* ============================================================
   ЖУРНАЛ ОЦІНОК: по одному аркушу на клас («Журнал 6 клас», … «Журнал 9 клас»).
   У кожному — усі учні класу, біля прізвища підписана ваша група. Після самостійної
   з'являється нова колонка з оцінкою (12-бальна шкала) — окрема для кожної групи.
   ============================================================ */

// Початкові списки учнів для аркушів «Журнал N клас» (необов'язково): [["Прізвище Ім'я По батькові", "8-2"], ...].
// У ПУБЛІЧНИЙ РЕПОЗИТОРІЙ СПИСКИ УЧНІВ НЕ ЗАЛИШАЙТЕ. Простіше лишити порожніми й вписати учнів прямо в аркуші
// «Журнал 6 клас» … «Журнал 9 клас» у вашій Таблиці (колонки «Учень» і «Група»). Ключі — номери класів, які вам потрібні.
var ROSTER = {
  "6": [],
  "7": [],
  "8": [],
  "9": []
};

// Групи, що можуть бути в назві класу в тесті (для розпізнавання «8-2», яке Таблиці перетворили на дату)
var KNOWN_GROUPS = ["6-1", "6-2", "6-3", "6-4", "7-1", "7-2", "8-2", "8-4", "9-5", "9-6", "9-7"];

// Роботи: ключ — точна назва аркуша з результатами (SHEET_NAME у тесті).
// title — підпис колонки в журналі, max — максимум балів (автобал + 2 за кожне відкрите питання).
// Для нової роботи додайте рядок сюди.
var WORKS = {
  "Самостійна 8 клас Нервова система":               { title: "Нервова система", max: 11.5 },
  "Самостійна Типи організації клітин":              { title: "Типи організації клітин", max: 11.5 },
  "Самостійна Політична карта світу (ч.1)":          { title: "Політична карта світу", max: 11.5 },
  "Самостійна Клітина, тканини, органи, системи":    { title: "Клітина, тканини, органи, системи", max: 16.5 }
};

var GRADE_MAX = 12;  // шкала оцінювання
// Оцінка = частка набраних балів × 12, округлена; мінімум 1. Інша шкала — змініть цю функцію.
function gradeFromScore_(total, max) {
  if (!(max > 0) || isNaN(total)) return "";
  var g = Math.round(GRADE_MAX * total / max);
  return Math.max(1, Math.min(GRADE_MAX, g));
}

// Справжня назва групи (в аркуші «8-2» могло стати датою)
function canonClass_(v) {
  for (var i = 0; i < KNOWN_GROUPS.length; i++) if (clsMatch_(v, KNOWN_GROUPS[i])) return KNOWN_GROUPS[i];
  return v instanceof Date ? "" : String(v).trim();
}
function gradeOf_(cls) { var m = String(cls).match(/^\d+/); return m ? m[0] : ""; }

/* ----- порівняння прізвищ: «Іваненко Марія Петрівна» ~ «Іваненко Марія» ~ «Іваненко М. П.» ----- */
function normName_(s) { return norm_(s).replace(/\s+/g, ""); }

function parseName_(s) {
  var t = norm_(s).split(" ");
  var f = t[1] || "";
  var isIni = f.indexOf(".") >= 0 || f.length <= 1;
  return { sur: t[0] || "", full: isIni ? "" : f, ini: f.charAt(0) };
}
function lev_(a, b) {
  var m = a.length, n = b.length, d = [], i, j;
  for (i = 0; i <= m; i++) { d[i] = [i]; }
  for (j = 1; j <= n; j++) d[0][j] = j;
  for (i = 1; i <= m; i++) for (j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
  return d[m][n];
}
// 0 — однаково; більше — гірше; 99 — не підходить. Допускає дрібні розбіжності в написанні (Олена ~ Єлена, Олександр ~ Александр)
function nameScore_(a, b) {
  if (!a.sur || !b.sur) return 99;
  var s = lev_(a.sur, b.sur);
  if (s > 3) return 99;
  var bothFull = a.full && b.full;
  var f = bothFull ? lev_(a.full, b.full) : 0;
  if (a.ini !== b.ini && !(bothFull && f <= 2)) return 99;   // різні початкові літери — лише коли імена майже збігаються
  if (f > 3 || s + f > 4) return 99;
  return s + f;
}

function journalSheet_(grade) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = "Журнал " + grade + " клас";
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, 2).setValues([["Учень", "Група"]]).setFontWeight("bold");
    sh.getRange(1, 2, sh.getMaxRows(), 1).setNumberFormat("@");   // «8-2» не має ставати датою
    var list = ROSTER[grade] || [];
    if (list.length) sh.getRange(2, 1, list.length, 2).setValues(list);
    sh.setFrozenRows(1);
    sh.setFrozenColumns(2);
    sh.setColumnWidth(1, 270);
    sh.setColumnWidth(2, 70);
  }
  return sh;
}

// колонка (робота + спроба + група): шукаємо за прихованим ключем у примітці; якщо немає — додаємо праворуч
function journalCol_(sh, work, round, cls, isoDate) {
  var key = work.title + "|" + round + "|" + cls;
  var lastCol = sh.getLastColumn();
  var notes = sh.getRange(1, 1, 1, lastCol).getNotes()[0];
  var earlier = 0;   // скільки колонок цієї роботи для цієї групи вже є (повторне складання)
  for (var c = 2; c < notes.length; c++) {
    var k = String(notes[c]).split("\n")[0];
    if (k === key) return c + 1;
    var p = k.split("|");
    if (p[0] === work.title && p[2] === cls) earlier++;
  }
  var col = lastCol + 1;
  var iso = isoDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var hdr = iso.slice(8, 10) + "." + iso.slice(5, 7) + " " + work.title + (earlier > 0 ? " (спроба " + (earlier + 1) + ")" : "") + " · " + cls;
  // у примітці: ключ і дата написання (за нею оцінки переносяться на сайт)
  sh.getRange(1, col).setValue(hdr).setNote(key + "\n" + iso).setFontWeight("bold").setWrap(true);
  sh.setColumnWidth(col, 120);
  return col;
}

// рядок учня: найкращий збіг; при рівності — той, чия група збігається; якщо учня немає — додаємо в кінець
function journalRow_(sh, studentName, cls) {
  var last = sh.getLastRow();
  var vals = last >= 2 ? sh.getRange(2, 1, last - 1, 2).getValues() : [];
  var ep = parseName_(studentName), best = 99, cand = [];
  vals.forEach(function (r, i) {
    var sc = nameScore_(ep, parseName_(r[0]));
    if (sc < best) { best = sc; cand = [i + 2]; } else if (sc === best && sc < 99) cand.push(i + 2);
  });
  if (best === 99) {
    sh.getRange(last + 1, 1, 1, 2).setValues([[studentName, cls]]);
    return last + 1;
  }
  if (cand.length > 1) {
    var byG = cand.filter(function (row) { return String(vals[row - 2][1]).trim() === cls; });
    if (byG.length === 1) return byG[0];
    return -1;
  }
  return cand[0];
}

// 1 — записано, 0 — клітинка вже заповнена, -1 — неоднозначний учень, -2 — не вдалося визначити клас/оцінку
function putGrade_(work, cls, studentName, round, total, overwrite, isoDate, gradeOverride) {
  var g = gradeOverride ? gradeOverride : gradeFromScore_(total, work.max), grade = gradeOf_(cls);
  if (g === "" || !grade || !ROSTER[grade]) return -2;
  var sh = journalSheet_(grade);
  var row = journalRow_(sh, studentName, cls);
  if (row < 0) return -1;
  var col = journalCol_(sh, work, round, cls, isoDate);
  var cell = sh.getRange(row, col);
  if (!overwrite && String(cell.getValue()).trim() !== "") return 0;
  cell.setValue(g).setHorizontalAlignment("center");
  return 1;
}

function isFinal_(status) { return /^(Завершено|Перервано)/.test(String(status)); }
function num_(v) { return parseFloat(String(v).replace(",", ".")); }

// оцінка одного рядка (викликається одразу після здачі роботи)
function journalFromRow_(sheet, rowIndex, overwrite) {
  var work = workFor_(sheet.getName());
  if (!work) return false;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var v = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  if (!isFinal_(v[4])) return false;
  var rc = headers.indexOf("Раунд"), tc = headers.indexOf("Підсумок (авто)");
  if (tc < 0) return false;
  return putGrade_(work, canonClass_(v[1]), String(v[2]).trim(), rc >= 0 ? (parseInt(v[rc], 10) || 1) : 1, num_(v[tc]), overwrite) === 1;
}

// Дата написання роботи з клітинки «Час» (рядок «16.10.2026, 11:12:56» або справжня дата)
function isoFromTime_(v) {
  var tz = Session.getScriptTimeZone();
  if (v instanceof Date) return Utilities.formatDate(v, tz, "yyyy-MM-dd");
  var m = String(v).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
  m = String(v).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
}

var TEACHER_GRADE_COL = "Оцінка (вчитель)";

// Заносить у журнал оцінки з аркуша роботи. only — необов'язковий набір ключів «група|прізвище|спроба».
// Якщо ви виставили оцінку вручну — береться вона, інакше обчислена автоматично.
function journalPush_(sheet, work, overwrite, only) {
  var data = sheet.getDataRange().getValues();
  var h = data[0];
  var rc = h.indexOf("Раунд"), tc = h.indexOf("Підсумок (авто)"), oc = h.indexOf(TEACHER_GRADE_COL);
  if (tc < 0) return { error: "no_total" };
  var best = {};
  for (var r = 1; r < data.length; r++) {
    if (!isFinal_(data[r][4])) continue;
    var ov = oc >= 0 ? num_(data[r][oc]) : NaN;
    if (data[r][tc] === "" && !(ov > 0)) continue;
    var cls = canonClass_(data[r][1]);
    var rnd = rc >= 0 ? (parseInt(data[r][rc], 10) || 1) : 1;
    var key = cls + "|" + normName_(data[r][2]) + "|" + rnd;
    var rk = String(data[r][4]).indexOf("Завершено") === 0 ? 2 : 1;
    if (!best[key] || rk >= best[key].rk) best[key] = { r: r, rk: rk, cls: cls, rnd: rnd, key: key };
  }
  var out = { done: 0, kept: 0, bad: [], total: 0 };
  Object.keys(best).forEach(function (k) {
    var b = best[k];
    if (only && !only[k]) return;
    out.total++;
    var ov2 = oc >= 0 ? num_(data[b.r][oc]) : NaN;
    var res = putGrade_(work, b.cls, String(data[b.r][2]).trim(), b.rnd, num_(data[b.r][tc]), overwrite,
                        isoFromTime_(data[b.r][0]), ov2 > 0 ? Math.round(ov2) : 0);
    if (res === 1) out.done++; else if (res === 0) out.kept++; else out.bad.push(String(data[b.r][2]).trim() + " (" + b.cls + ")");
  });
  return out;
}

function syncJournal_(overwrite) {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();
  var work = workFor_(sheet.getName());
  if (!work) { ui.alert("Для аркуша «" + sheet.getName() + "» немає роботи (ні в редакторі, ні в WORKS у Code.gs).\nВідкрийте аркуш з результатами роботи."); return; }
  var r = journalPush_(sheet, work, overwrite, null);
  if (r.error) { ui.alert("На цьому аркуші немає колонки «Підсумок (авто)»."); return; }
  var msg = "Записано оцінок: " + r.done + " з " + r.total + (overwrite ? " (з перезаписом)" : "; уже були в журналі: " + r.kept);
  if (r.bad.length) msg += ". Не вдалося (неоднозначно або невідомий клас): " + r.bad.join(", ");
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, "Журнал", 15);
}
function menuJournalFill_() { syncJournal_(false); }
function menuJournalOverwrite_() { syncJournal_(true); }

function createJournals_() {
  Object.keys(ROSTER).forEach(function (g) { journalSheet_(g); });
  SpreadsheetApp.getActiveSpreadsheet().toast("Аркуші журналу створено", "Журнал", 5);
}

/* ============================================================
   ВИДАЧА ОЦІНОК ДЛЯ ПЕРЕНЕСЕННЯ НА САЙТ (читає скрипт-помічник у браузері вчителя)
   Захищено ключем. Поки MARKS_KEY порожній — вимкнено.
   ============================================================ */
var MARKS_KEY = "";   // ЗАДАЙТЕ довгий випадковий ключ (20+ символів) і вставте такий самий у скрипт-помічник

function marksJson_(p) {
  function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
  if (!MARKS_KEY || String(p.key) !== MARKS_KEY) return out({ error: "Ключ не заданий або невірний" });
  var ss = SpreadsheetApp.getActiveSpreadsheet(), works = [];
  Object.keys(ROSTER).forEach(function (grade) {
    if (p.grade && String(p.grade) !== grade) return;
    var sh = ss.getSheetByName("Журнал " + grade + " клас");
    if (!sh || sh.getLastColumn() < 3) return;
    var lastCol = sh.getLastColumn(), lastRow = sh.getLastRow();
    var notes = sh.getRange(1, 1, 1, lastCol).getNotes()[0];
    var vals = lastRow >= 2 ? sh.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];
    for (var c = 2; c < lastCol; c++) {
      var parts = String(notes[c]).split("\n");
      if (!parts[0]) continue;
      var iso = parts[1] || "";
      if (p.date && iso !== p.date) continue;
      var k = parts[0].split("|");
      var rows = [];
      vals.forEach(function (r) {
        var n = num_(r[c]);
        if (String(r[c]).trim() !== "" && !isNaN(n)) rows.push([String(r[0]).trim(), n, String(r[1]).trim()]);
      });
      works.push({ grade: grade, group: k[2] || "", title: k[0], date: iso, rows: rows });
    }
  });
  return out({ works: works });
}


/* ============================================================
   НОВА СИСТЕМА: редактор тестів + один універсальний програвач (index.html на GitHub Pages)
   Тести зберігаються в аркуші «_Тести» цієї таблиці, малюнки — у папці Google Drive.
   Усі запити редактора захищені TEACHER_PIN.
   ============================================================ */
var TESTS_SHEET = "_Тести";
var IMG_FOLDER = "Самостійні — малюнки";
var CHUNK = 40000;   // у одну клітинку Таблиці вміщується до 50 000 символів
// Аркуш: A id | B назва | C оновлено | D групи | E аркуш результатів | F макс. балів | G частин | H… дані (JSON частинами)

function jsonOut_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function testsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TESTS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(TESTS_SHEET);
    sh.getRange(1, 1, 1, 7).setValues([["ID", "Назва", "Оновлено", "Групи", "Аркуш результатів", "Макс. балів", "Частин"]]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function testRowOf_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function loadTest_(id) {
  if (!/^[A-Za-z0-9_\-]{3,40}$/.test(String(id))) return null;
  var cache = CacheService.getScriptCache();
  var hit = cache.get("T|" + id);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var sh = testsSheet_();
  var row = testRowOf_(sh, id);
  if (row < 0) return null;
  var n = parseInt(sh.getRange(row, 7).getValue(), 10) || 0;
  if (n < 1) return null;
  var parts = sh.getRange(row, 8, 1, n).getValues()[0];
  var t;
  try { t = JSON.parse(parts.join("")); } catch (e) { return null; }
  try { cache.put("T|" + id, JSON.stringify(t), 120); } catch (e) {}   // кеш не вміщує дуже великі тести — тоді просто читаємо з аркуша
  return t;
}

// максимальний автобал + бали за відкриті (середнє, якщо в розділі різні)
function maxOf_(t) {
  var sum = 0;
  (t.sections || []).forEach(function (s) {
    var qs = s.questions || [];
    if (!qs.length) return;
    var n = s.type === "tf" ? (+s.n || 1) : Math.min(+s.n || qs.length, qs.length);
    if (s.type === "open") {
      var avg = qs.reduce(function (a, q) { return a + (+q.max || OPEN_MAX); }, 0) / qs.length;
      sum += n * avg;
    } else {
      sum += n * (+s.points || 0);
    }
  });
  return Math.round(sum * 100) / 100;
}

function cleanSheetName_(s) {
  return String(s || "Без назви").replace(/[\[\]\*\?:\/\\]/g, " ").replace(/\s+/g, " ").trim().substring(0, 90);
}

function saveTest_(id, t) {
  if (!/^[A-Za-z0-9_\-]{3,40}$/.test(String(id))) throw new Error("bad id");
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = testsSheet_();
    var row = testRowOf_(sh, id);
    t.id = id;
    // аркуш результатів: стабільна назва; унікальна серед тестів
    if (!t.sheetName) {
      var base = cleanSheetName_("Самостійна " + (t.title || id)), name = base, k = 2;
      var used = {};
      var last = sh.getLastRow();
      if (last >= 2) sh.getRange(2, 1, last - 1, 5).getValues().forEach(function (r) { if (String(r[0]) !== String(id)) used[String(r[4])] = true; });
      while (used[name] || (WORKS[name] && true)) name = base.substring(0, 85) + " " + (k++);
      t.sheetName = name;
    }
    var json = JSON.stringify(t), parts = [];
    for (var i = 0; i < json.length; i += CHUNK) parts.push(json.substring(i, i + CHUNK));
    if (!parts.length) parts = ["{}"];
    var meta = [id, t.title || "", new Date().toISOString(), (t.groups || []).join(","), t.sheetName, maxOf_(t), parts.length];
    if (row < 0) row = Math.max(2, sh.getLastRow() + 1);
    sh.getRange(row, 1, 1, 7).setNumberFormat("@").setValues([meta]);
    sh.getRange(row, 8, 1, parts.length).setNumberFormat("@").setValues([parts]);
    CacheService.getScriptCache().remove("T|" + id);
    return t;
  } finally {
    lock.releaseLock();
  }
}

function listTests_() {
  var sh = testsSheet_(), last = sh.getLastRow(), out = [];
  if (last < 2) return out;
  sh.getRange(2, 1, last - 1, 7).getValues().forEach(function (r) {
    if (!r[0]) return;
    out.push({ id: String(r[0]), title: String(r[1]), updated: String(r[2]), groups: String(r[3]).split(",").filter(Boolean),
               sheetName: String(r[4]), max: +r[5] || 0, ctrl: getCtrl_(String(r[0])) });
  });
  return out;
}

function findBySheet_(name) {
  if (!name || name === TESTS_SHEET) return null;
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TESTS_SHEET);
  if (!sh || sh.getLastRow() < 2) return null;
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
  for (var i = 0; i < rows.length; i++) if (String(rows[i][4]) === String(name)) return { id: String(rows[i][0]), title: String(rows[i][1]), max: +rows[i][5] || 0 };
  return null;
}

// для журналу: спершу старі роботи (WORKS), потім роботи з редактора
function workFor_(sheetName) {
  if (WORKS[sheetName]) return WORKS[sheetName];
  var t = findBySheet_(sheetName);
  return t ? { title: t.title, max: t.max } : null;
}

/* ----- критерії відкритих питань з тесту ----- */
function escRe_(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function conceptToRub_(c) {
  var name = c.n || c.k || "";
  if (c.ps && c.ps.length) return { n: name, ps: c.ps, min: c.min || 1 };
  if (c.p) return { n: name, p: c.p };
  var kws = String(c.k || "").split(/[,;\n]/).map(function (w) { return norm_(w); }).filter(Boolean).map(escRe_);
  return { n: name, p: kws.length ? kws.join("|") : "(?!)" };   // «(?!)» — ніколи не збігається
}
function rubricMap_(t) {
  if (!t) return null;
  var map = {};
  (t.sections || []).forEach(function (s) {
    if (s.type !== "open") return;
    (s.questions || []).forEach(function (q) {
      map[q.id] = { max: +q.max || OPEN_MAX, rub: (q.concepts || []).map(conceptToRub_) };
    });
  });
  return map;
}

/* ----- список учнів: береться з аркушів «Журнал N клас» (колонки «Учень» і «Група») ----- */
function rosterMap_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get("ROSTER");
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var out = {};
  Object.keys(ROSTER).forEach(function (grade) {
    var sh = journalSheet_(grade), last = sh.getLastRow();
    if (last < 2) return;
    sh.getRange(2, 1, last - 1, 2).getValues().forEach(function (r) {
      var name = String(r[0]).trim(), g = canonClass_(r[1]);
      if (name && g) (out[g] = out[g] || []).push(name);
    });
  });
  try { cache.put("ROSTER", JSON.stringify(out), 45); } catch (e) {}
  return out;
}

/* ----- для сторінки учня ----- */
function infoJson_(id) {
  var t = loadTest_(id);
  if (!t || !(t.groups || []).length) return { error: "not_found" };
  var ros = rosterMap_(), groups = {};
  t.groups.forEach(function (g) { groups[g] = (ros[g] || []).slice(); });
  return { ok: true, id: id, title: t.title, subject: t.subject || "", topic: t.topic || "", groups: groups,
           ctrl: getCtrl_(id), awayOne: +t.awayOne || 5, awayTotal: +t.awayTotal || 15 };
}
function bodyJson_(id) {
  var t = loadTest_(id);
  if (!t || !(t.groups || []).length) return { error: "not_found" };
  if (getCtrl_(id).state === "closed") return { error: "closed" };   // питання не віддаємо, поки вчитель не відкрив роботу
  var pub = JSON.parse(JSON.stringify(t));
  delete pub.groups;
  (pub.sections || []).forEach(function (s) {   // критерії відкритих питань учням не віддаємо
    if (s.type === "open") (s.questions || []).forEach(function (q) { delete q.concepts; });
  });
  return { test: pub };
}

/* ----- запити редактора ----- */
function teacherApi_(p) {
  if (String(p.pin) !== TEACHER_PIN) return jsonOut_({ error: "pin" });
  try {
    switch (p.action) {
      case "t_auth": return jsonOut_({ ok: true });
      case "t_list": return jsonOut_({ tests: listTests_() });
      case "t_roster": return jsonOut_({ groups: rosterMap_() });
      case "t_get": {
        var t = loadTest_(p.id);
        return jsonOut_(t ? { test: t } : { error: "not_found" });
      }
      case "t_save": {
        var obj = JSON.parse(p.json);
        // при повторному збереженні назва аркуша результатів не змінюється
        var row0 = testRowOf_(testsSheet_(), p.id);
        if (row0 > 0) { var old = loadTest_(p.id); if (old && old.sheetName) obj.sheetName = old.sheetName; }
        var saved = saveTest_(p.id, obj);
        return jsonOut_({ ok: true, sheetName: saved.sheetName, max: maxOf_(saved) });
      }
      case "t_delete": {
        var lock = LockService.getScriptLock(); lock.waitLock(20000);
        try {
          var sh = testsSheet_(), r = testRowOf_(sh, p.id);
          if (r > 0) sh.deleteRow(r);
          CacheService.getScriptCache().remove("T|" + p.id);
        } finally { lock.releaseLock(); }
        return jsonOut_({ ok: true });
      }
      case "t_ctrl": {
        if (!loadTest_(p.id)) return jsonOut_({ error: "not_found" });
        if (["open", "pause", "close", "reset"].indexOf(p.kind) < 0) return jsonOut_({ error: "kind" });
        return jsonOut_({ ctrl: setCtrl_(p.kind, p.id) });
      }
      case "t_monitor": return jsonOut_(monitorJson_(p.id));
      case "t_results": return jsonOut_(resultsJson_(p.id));
      case "t_grade": return jsonOut_(setTeacherGrade_(p));
      case "t_journal": return jsonOut_(journalFromEditor_(p));
      case "t_img": return jsonOut_(saveImage_(p));
    }
    return jsonOut_({ error: "unknown_action" });
  } catch (err) {
    return jsonOut_({ error: String(err && err.message || err) });
  }
}

// хто з учнів у якому стані (для екрана «Видача» в редакторі)
function monitorJson_(id) {
  var t = loadTest_(id);
  if (!t) return { error: "not_found" };
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(t.sheetName);
  var ctrl = getCtrl_(id), rows = [];
  if (sh && sh.getLastRow() >= 2) {
    var data = sh.getDataRange().getValues(), h = data[0];
    var ix = function (n) { return h.indexOf(n); };
    for (var r = 1; r < data.length; r++) {
      var rd = ix("Раунд") >= 0 ? (parseInt(data[r][ix("Раунд")], 10) || 1) : 1;
      if (rd !== ctrl.round) continue;
      rows.push({ cls: canonClass_(data[r][1]), name: String(data[r][2]), status: String(data[r][4]),
                  auto: data[r][3], total: ix("Підсумок (авто)") >= 0 ? data[r][ix("Підсумок (авто)")] : "",
                  leaves: data[r][5], away: ix("Секунд поза сторінкою") >= 0 ? data[r][ix("Секунд поза сторінкою")] : "" });
    }
  }
  return { ctrl: ctrl, max: maxOf_(t), rows: rows };
}

function saveImage_(p) {
  var mime = String(p.mime || "image/jpeg");
  if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) return { error: "mime" };
  var bytes = Utilities.base64Decode(String(p.data || ""));
  if (bytes.length > 8 * 1024 * 1024) return { error: "big" };
  var it = DriveApp.getFoldersByName(IMG_FOLDER);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(IMG_FOLDER);
  var ext = mime.split("/")[1].replace("jpeg", "jpg");
  var file = folder.createFile(Utilities.newBlob(bytes, mime, cleanSheetName_(p.name || "img").substring(0, 60) + "." + ext));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var id = file.getId();
  return { ok: true, id: id, url: "https://drive.google.com/thumbnail?id=" + id + "&sz=w1600" };
}


/* ----- перегляд відповідей, ручна оцінка, занесення в журнал (з редактора) ----- */
function resultsJson_(id) {
  var t = loadTest_(id);
  if (!t) return { error: "not_found" };
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(t.sheetName);
  var rows = [];
  if (sh && sh.getLastRow() >= 2) {
    var data = sh.getDataRange().getValues(), h = data[0];
    var ix = function (n) { return h.indexOf(n); };
    for (var r = 1; r < data.length; r++) {
      var ans = {};
      h.forEach(function (name, c) { if (/^q\d+$/.test(name) && data[r][c] !== "") ans[name] = String(data[r][c]); });
      var tm = data[r][0];
      rows.push({
        cls: canonClass_(data[r][1]), name: String(data[r][2]).trim(),
        round: ix("Раунд") >= 0 ? (parseInt(data[r][ix("Раунд")], 10) || 1) : 1,
        time: tm instanceof Date ? Utilities.formatDate(tm, Session.getScriptTimeZone(), "dd.MM.yyyy HH:mm") : String(tm),
        status: String(data[r][4]), auto: data[r][3],
        open: ix("Бал відкритих (авто)") >= 0 ? data[r][ix("Бал відкритих (авто)")] : "",
        total: ix("Підсумок (авто)") >= 0 ? data[r][ix("Підсумок (авто)")] : "",
        final: ix(TEACHER_GRADE_COL) >= 0 ? data[r][ix(TEACHER_GRADE_COL)] : "",
        leaves: data[r][5], away: ix("Секунд поза сторінкою") >= 0 ? data[r][ix("Секунд поза сторінкою")] : "",
        pastes: ix("Спроб вставки") >= 0 ? data[r][ix("Спроб вставки")] : "",
        leaveLog: ix("Журнал виходів") >= 0 ? String(data[r][ix("Журнал виходів")]) : "",
        qTime: ix("Час на питання") >= 0 ? String(data[r][ix("Час на питання")]) : "",
        notes: ix("Перевірка відкритих") >= 0 ? String(data[r][ix("Перевірка відкритих")]) : "",
        answers: ans
      });
    }
  }
  return { max: maxOf_(t), ctrl: getCtrl_(id), rows: rows };
}

// Оцінка вчителя (1–12) записується в колонку «Оцінка (вчитель)»; порожнє значення повертає автоматичну
function setTeacherGrade_(p) {
  var t = loadTest_(p.id);
  if (!t) return { error: "not_found" };
  var g = String(p.grade || "").trim() === "" ? "" : Math.round(num_(p.grade));
  if (g !== "" && !(g >= 1 && g <= GRADE_MAX)) return { error: "grade_range" };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(t.sheetName);
    if (!sh) return { error: "no_sheet" };
    var data = sh.getDataRange().getValues(), headers = data[0].slice();
    var rc = headers.indexOf("Раунд"), want = parseInt(p.round, 10) || 1, row = -1;
    for (var r = 1; r < data.length; r++) {
      var rnd = rc >= 0 ? (parseInt(data[r][rc], 10) || 1) : 1;
      if (rnd === want && clsMatch_(data[r][1], p.cls) && String(data[r][2]).trim().toLowerCase() === String(p.name).trim().toLowerCase()) row = r + 1;
    }
    if (row < 0) return { error: "no_row" };
    sh.getRange(row, col_(sh, headers, TEACHER_GRADE_COL)).setValue(g);
    return { ok: true, grade: g };
  } finally { lock.releaseLock(); }
}

// Заносить у журнал: усі завершені роботи або лише вказані учні (p.only — JSON [{cls,name,round}])
function journalFromEditor_(p) {
  var t = loadTest_(p.id);
  if (!t) return { error: "not_found" };
  var work = workFor_(t.sheetName);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(t.sheetName);
  if (!work || !sh) return { error: "no_sheet" };
  var only = null;
  if (p.only) {
    only = {};
    JSON.parse(p.only).forEach(function (x) { only[canonClass_(x.cls) + "|" + normName_(x.name) + "|" + (parseInt(x.round, 10) || 1)] = true; });
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return journalPush_(sh, work, p.overwrite === "true", only); } finally { lock.releaseLock(); }
}
