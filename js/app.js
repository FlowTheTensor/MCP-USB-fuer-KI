/* =========================================================
   MCP – USB für KI · Seitenlogik
   ========================================================= */
(function () {
  const LEVELS = ["OFFLINE", "SIGNAL", "HANDSHAKE", "LINKED", "OPERATOR", "ARCHITECT"];
  const STREAK_GOAL = 5;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; };
  const svgEl = (tag, attrs = {}, parent) => {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };

  /* ---------------- Fortschritt (nur im Browser) ---------------- */
  const KEY = "mcp-usb-fuer-ki:v1";
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { cleared: [] }; } catch (e) { return { cleared: [] }; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* privat/blockiert */ } }
  const progress = load();
  const isCleared = n => progress.cleared.includes(n);

  /* ---------------- Syntax-Hervorhebung ---------------- */
  function hlJson(src) {
    return esc(src).replace(/("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g, (m, str, colon, lit) => {
      if (str) return colon ? `<span class="j-key">${str}</span>${colon}` : `<span class="j-str">${str}</span>`;
      if (lit) return `<span class="j-lit">${lit}</span>`;
      return `<span class="j-num">${m}</span>`;
    });
  }
  function hlPy(src) {
    return esc(src).replace(/(#.*$)|("""[\s\S]*?"""|"(?:\\.|[^"\\])*")|(@[\w.]+)|\b(from|import|def|return|if|not|None|True|False|and|or)\b/gm, (m, com, str, dec, kw) => {
      if (com) return `<span class="p-com">${com}</span>`;
      if (str) return `<span class="p-str">${str}</span>`;
      if (dec) return `<span class="p-dec">${dec}</span>`;
      return `<span class="p-kw">${kw}</span>`;
    });
  }
  const setJson = (el, text) => { el.innerHTML = hlJson(text); };
  $$("pre.json").forEach(p => { if (p.textContent.trim()) setJson(p, p.textContent); });
  $$("pre.py").forEach(p => { if (p.textContent.trim()) p.innerHTML = hlPy(p.textContent); });

  /* ---------------- Toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
  }

  /* ---------------- Navigation ---------------- */
  const nav = $("#lvl-nav");
  const page = $(".level") ? +$(".level").dataset.level : null; // null = Startseite
  LEVELS.forEach((name, i) => {
    const a = document.createElement("a");
    a.href = `lvl${i}.html`; a.textContent = `LVL ${i}`; a.title = name; a.dataset.level = i;
    if (i === page) { a.classList.add("current"); a.setAttribute("aria-current", "page"); }
    nav.appendChild(a);
  });
  $$(".level").forEach(sec => {
    const links = $$(".station", sec).map(st => `<a href="#${st.id}">${esc($("h3", st).textContent)}</a>`);
    links.push(`<a href="#${sec.id}-test">Clearance-Test</a>`);
    const div = document.createElement("div");
    div.className = "station-nav"; div.innerHTML = links.join("<span class='dim'>·</span>");
    $(".lvl-head .lvl-sub", sec).after(div);
  });

  /* ---------------- Kern-Schaltbild ---------------- */
  const core = $("#core-svg");
  function drawCore() {
    if (!core) return;
    core.innerHTML = "";
    const g = svgEl("g", { class: "core" + (progress.cleared.length === LEVELS.length ? " online" : "") }, core);
    LEVELS.forEach((name, i) => {
      const a = (-90 + i * 60) * Math.PI / 180;
      const cx = 200 + Math.cos(a) * 158, cy = 200 + Math.sin(a) * 150;
      const pg = svgEl("g", { class: "port" + (isCleared(i) ? " on" : "") }, g);
      svgEl("line", { x1: 200 + Math.cos(a) * 66, y1: 200 + Math.sin(a) * 66, x2: 200 + Math.cos(a) * 128, y2: 200 + Math.sin(a) * 124, class: "port-wire" }, pg);
      const link = svgEl("a", { href: `lvl${i}.html` }, pg);
      svgEl("rect", { x: cx - 40, y: cy - 18, width: 80, height: 36, rx: 6, class: "port-box" }, link);
      const t1 = svgEl("text", { x: cx, y: cy - 2, "text-anchor": "middle", class: "port-lbl" }, link); t1.textContent = `LVL ${i}`;
      const t2 = svgEl("text", { x: cx, y: cy + 11, "text-anchor": "middle", class: "port-sub" }, link); t2.textContent = name;
    });
    svgEl("circle", { cx: 200, cy: 200, r: 78, class: "core-ring" }, g);
    svgEl("circle", { cx: 200, cy: 200, r: 60, class: "core-body" }, g);
    svgEl("circle", { cx: 200, cy: 192, r: 15, class: "core-eye" }, g);
    const t = svgEl("text", { x: 200, y: 230, "text-anchor": "middle", class: "port-lbl" }, g);
    t.textContent = "KERN";
  }

  function refreshProgressUI() {
    const n = progress.cleared.length;
    $$("a", nav).forEach(a => a.classList.toggle("done", isCleared(+a.dataset.level)));
    $$(".level, .lvl-card").forEach(el => el.classList.toggle("done", isCleared(+el.dataset.level)));
    const st = $("#status-line");
    if (st) {
      st.parentElement.classList.toggle("ok", n === LEVELS.length);
      st.textContent = n === LEVELS.length ? "SYSTEM ONLINE – 6/6 PORTS VERBUNDEN" : `KERN ISOLIERT – ${n}/6 PORTS VERBUNDEN`;
    }
    const start = $("#start-btn");
    if (start) {
      const open = LEVELS.findIndex((_, i) => !isCleared(i));
      start.href = open < 0 ? "#online" : `lvl${open}.html`;
      start.textContent = n === 0 ? "System starten ▸" : open < 0 ? "Zum Abschluss ▸" : `Weiter mit LVL ${open} ▸`;
    }
    if ($("#online")) $("#online").hidden = n !== LEVELS.length;
    drawCore();
  }

  /* ---------------- Boot-Sequenz ---------------- */
  (function boot() {
    const el = $("#boot");
    if (!el) return;
    let seen = false;
    try { seen = sessionStorage.getItem("mcp-boot") === "1"; } catch (e) { /* egal */ }
    if (seen || matchMedia("(prefers-reduced-motion: reduce)").matches) { el.remove(); return; }
    const n = progress.cleared.length;
    const lines = [
      "> BOOT SEQUENCE …",
      "> KERN ................ <span class='cy'>ONLINE</span>",
      "> SPRACHMODELL ........ <span class='cy'>GELADEN</span>",
      `> PORTS ............... ${n}/6 VERBUNDEN`,
      n < 6 ? "> <span class='err'>WARNUNG: Kern isoliert. Kein Zugriff auf Werkzeuge oder Daten.</span>" : "> <span class='cy'>Alle Module verbunden.</span>",
      "> Lade Protokoll: <span class='cy'>MCP – USB für KI</span>",
      "> _"
    ];
    const pre = $("#boot-text");
    let i = 0, timer;
    const step = () => { pre.innerHTML += (i ? "\n" : "") + lines[i++]; if (i < lines.length) timer = setTimeout(step, 380); };
    step();
    const close = () => {
      clearTimeout(timer);
      try { sessionStorage.setItem("mcp-boot", "1"); } catch (e) { /* egal */ }
      el.classList.add("hide"); setTimeout(() => el.remove(), 700);
      document.removeEventListener("keydown", onKey);
      $("h1.glitch").classList.add("go");
    };
    const onKey = e => { if (e.key === "Enter" || e.key === "Escape" || e.key === " ") { e.preventDefault(); close(); } };
    document.addEventListener("keydown", onKey);
    $("#boot-skip").addEventListener("click", close);
    el.addEventListener("click", close);
  })();

  /* ---------------- LVL 0: Adapter-Rechner ---------------- */
  (function adapterCalc() {
    const APPS = ["Chat-App", "Code-Editor", "Lern-App", "Sprachassistent", "Büro-Suite", "Eigene App"];
    const TOOLS = ["Datenbank", "Kalender", "Dateien", "Wetter", "E-Mail", "Code-Repo", "Stundenplan", "Websuche"];
    const svg = $("#ac-svg"), nIn = $("#ac-n-in"), mIn = $("#ac-m-in");
    if (!svg) return;
    let mode = "chaos";
    const node = (x, y, label, cls = "") => {
      const g = svgEl("g", { class: "ac-node " + cls }, svg);
      svgEl("rect", { x, y: y - 13, width: 120, height: 26, rx: 5 }, g);
      const t = svgEl("text", { x: x + 60, y: y + 4, "text-anchor": "middle" }, g); t.textContent = label;
    };
    function draw() {
      const n = +nIn.value, m = +mIn.value;
      $("#ac-n").textContent = n; $("#ac-m").textContent = m;
      svg.innerHTML = "";
      const ys = k => Array.from({ length: k }, (_, i) => 160 + (i - (k - 1) / 2) * Math.min(38, 290 / k));
      const ay = ys(n), ty = ys(m);
      if (mode === "chaos") {
        ay.forEach(y1 => ty.forEach(y2 => {
          svgEl("line", { x1: 140, y1, x2: 460, y2, class: "ac-line" }, svg);
          svgEl("rect", { x: 296, y: (y1 + y2) / 2 - 4, width: 8, height: 8, class: "ac-adapter" }, svg);
        }));
      } else {
        ay.forEach(y => svgEl("line", { x1: 140, y1: y, x2: 250, y2: 160, class: "ac-line mcp" }, svg));
        ty.forEach(y => svgEl("line", { x1: 350, y1: 160, x2: 460, y2: y, class: "ac-line mcp" }, svg));
        const g = svgEl("g", { class: "ac-node hub" }, svg);
        svgEl("rect", { x: 250, y: 135, width: 100, height: 50, rx: 8 }, g);
        const t = svgEl("text", { x: 300, y: 165, "text-anchor": "middle" }, g); t.textContent = "MCP";
      }
      ay.forEach((y, i) => node(20, y, APPS[i]));
      ty.forEach((y, i) => node(460, y, TOOLS[i]));
      $("#ac-readout").innerHTML = mode === "chaos"
        ? `Ohne Standard: ${n} × ${m} = <strong>${n * m}</strong> Einzel-Adapter (rote Kästchen)`
        : `Mit MCP: ${n} Clients + ${m} Server = <strong>${n + m}</strong> Implementierungen`;
    }
    nIn.addEventListener("input", draw); mIn.addEventListener("input", draw);
    $$("#adapter-calc .toggle-row .btn").forEach(b => b.addEventListener("click", () => {
      mode = b.dataset.mode;
      $$("#adapter-calc .toggle-row .btn").forEach(x => x.classList.toggle("sel", x === b));
      draw();
    }));
    draw();
  })();

  /* ---------------- LVL 1: JSON-Scanner ---------------- */
  (function jsonScanner() {
    const inp = $("#js-in"), out = $("#js-out");
    if (!inp) return;
    const typeOf = v => v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
    const NAMES = { string: "String", number: "Zahl", boolean: "Boolean", null: "null", array: "Array", object: "Objekt" };
    function tree(v, key) {
      const t = typeOf(v);
      const label = key !== undefined ? `<span class="j-key">${esc(key)}</span>` : "<em>Wurzel</em>";
      let html = `<li>${label}<span class="t t-${t}">${NAMES[t]}</span>`;
      if (t === "object" || t === "array") {
        const entries = t === "array" ? v.map((x, i) => [`[${i}]`, x]) : Object.entries(v);
        html += `<ul class="tree">${entries.map(([k, x]) => tree(x, k)).join("")}</ul>`;
      } else {
        html += ` <span class="dim">${esc(JSON.stringify(v))}</span>`;
      }
      return html + "</li>";
    }
    function scan() {
      try {
        const v = JSON.parse(inp.value);
        out.innerHTML = `<p class="ok">✓ SIGNAL GÜLTIG</p><ul class="tree">${tree(v)}</ul>`;
      } catch (e) {
        out.innerHTML = `<p class="err">✗ SIGNAL BESCHÄDIGT</p><p>${esc(e.message)}</p>`;
        out.classList.remove("glitch-flash"); void out.offsetWidth; out.classList.add("glitch-flash");
      }
    }
    const breakers = [
      s => s.replace(/"(\w+)":/, "$1:"),
      s => s.replace(/(\S)(\s*)\]/, "$1,$2]"),
      s => s.replace("true", "True"),
      s => s.replace(/"/g, "'"),
      s => s.replace(/,(\s*\n)/, "$1")
    ];
    $("#js-scan").addEventListener("click", scan);
    $("#js-break").addEventListener("click", () => {
      const fns = shuffle(breakers.slice());
      for (const f of fns) { const r = f(inp.value); if (r !== inp.value) { inp.value = r; break; } }
      scan();
    });
    scan();
  })();

  /* ---------------- LVL 1: Signal-Baukasten ---------------- */
  (function rpcBuilder() {
    const kind = $("#rb-kind"), method = $("#rb-method"), idIn = $("#rb-id"), out = $("#rb-out"), hint = $("#rb-hint");
    if (!kind) return;
    const PARAMS = {
      initialize: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "Schul-Host", version: "1.0.0" } },
      "tools/call": { name: "list_tables", arguments: {} }
    };
    const RESULTS = {
      ping: {},
      initialize: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "Demo", version: "1.0.0" } },
      "tools/list": { tools: [{ name: "list_tables", description: "Listet alle Tabellen auf.", inputSchema: { type: "object", properties: {} } }] },
      "tools/call": { content: [{ type: "text", text: "[\"schueler\", \"lehrer\"]" }], isError: false },
      "notifications/initialized": null
    };
    function render() {
      const k = kind.value, m = method.value, id = Number(idIn.value) || 0;
      idIn.disabled = k === "notification";
      const msg = { jsonrpc: "2.0" };
      const hints = [];
      if (k === "request" || k === "notification") {
        if (k === "request") msg.id = id;
        msg.method = m;
        if (PARAMS[m]) msg.params = PARAMS[m];
        if (k === "request" && m.startsWith("notifications/")) hints.push("⚠ Methoden mit <strong>notifications/</strong> werden in MCP als Notification verschickt, also ohne id.");
        else if (k === "notification" && !m.startsWith("notifications/")) hints.push(`⚠ <strong>${m}</strong> ohne id würde nie beantwortet. Diese Methode braucht einen Request.`);
        else hints.push(k === "request" ? `Die Antwort wird später an <strong>"id": ${id}</strong> erkannt.` : "Keine id, also keine Antwort. Ein Funkspruch ohne Rückkanal.");
      } else {
        msg.id = id;
        if (k === "result") {
          if (RESULTS[m] === null) { msg.result = {}; hints.push("⚠ Auf eine Notification gibt es keine Response."); }
          else msg.result = RESULTS[m];
        } else {
          msg.error = { code: -32601, message: "Method not found" };
        }
        hints.push("Eine Response enthält <strong>keine method</strong>. Sie wird nur über die id ihrer Anfrage zugeordnet.");
      }
      setJson(out, JSON.stringify(msg, null, 2));
      hint.innerHTML = hints.join("<br>");
    }
    [kind, method, idIn].forEach(e => e.addEventListener("input", render));
    render();
  })();

  /* ---------------- LVL 2: Handshake-Sortierer ---------------- */
  (function sorter() {
    const root = $("#sorter");
    if (!root) return;
    const STEPS = [
      "Host startet den Server als Prozess (stdio)",
      "Client → Server: initialize (Request, id 1)",
      "Server → Client: Antwort mit protocolVersion und capabilities (id 1)",
      "Client → Server: notifications/initialized",
      "Client → Server: tools/list (id 2)",
      "Server → Client: Liste der Tools (id 2)",
      "Client → Server: tools/call (id 3)"
    ];
    function start() {
      let pos = 0, errors = 0;
      root.innerHTML = `<div class="sort-slots">${STEPS.map(() => `<div class="sort-slot">…</div>`).join("")}</div><div class="sort-pool"></div><p class="readout"></p>`;
      const slots = $$(".sort-slot", root), pool = $(".sort-pool", root), info = $(".readout", root);
      shuffle(STEPS.map((s, i) => i)).forEach(i => {
        const b = document.createElement("button");
        b.className = "sort-card"; b.textContent = STEPS[i];
        b.addEventListener("click", () => {
          if (i === pos) {
            slots[pos].textContent = STEPS[i]; slots[pos].className = "sort-slot filled right";
            b.remove(); pos++;
            if (pos === STEPS.length) {
              info.innerHTML = `<strong>✓ Verbindung steht!</strong> Fehlversuche: ${errors}. <button class="btn small ghost">Nochmal</button>`;
              $("button", info).addEventListener("click", start);
            }
          } else {
            errors++;
            slots[pos].classList.remove("wrong"); void slots[pos].offsetWidth; slots[pos].classList.add("wrong");
            info.textContent = `✗ Passt nicht an Position ${pos + 1}. Fehlversuche: ${errors}`;
          }
        });
        pool.appendChild(b);
      });
    }
    start();
  })();

  /* ---------------- LVL 3: Terminal ---------------- */
  (function terminal() {
    const log = $("#term-log"), inp = $("#term-in"), led = $("#term-led"), stateEl = $("#term-state"), preset = $("#term-preset");
    if (!log) return;
    MCPSim.presets.forEach(([label, text], i) => {
      const o = document.createElement("option"); o.value = i; o.textContent = label; preset.appendChild(o);
    });
    preset.addEventListener("change", () => {
      if (preset.value !== "") inp.value = MCPSim.presets[preset.value][1];
      preset.value = ""; inp.focus();
    });
    function entry(dirCls, dirText, body) {
      const d = document.createElement("div"); d.className = "entry";
      d.innerHTML = `<div class="dir ${dirCls}">${dirText}</div>${body}`;
      log.appendChild(d); log.scrollTop = log.scrollHeight;
    }
    function updateState() {
      const s = MCPSim.state;
      led.className = "led" + (s === "ready" ? " on" : s === "initializing" ? " half" : "");
      stateEl.textContent = s === "ready" ? "VERBUNDEN · BEREIT" : s === "initializing" ? "HANDSHAKE LÄUFT" : "NICHT INITIALISIERT";
    }
    function reset() {
      MCPSim.reset(); log.innerHTML = "";
      entry("sys", "SYSTEM", `<div class="hint">Server „SQLite Schul-Datenbank“ wurde per stdio gestartet. Er wartet auf initialize …</div>`);
      updateState();
    }
    function send() {
      const raw = inp.value.trim();
      if (!raw) return;
      let shown;
      try { shown = JSON.stringify(JSON.parse(raw), null, 2); } catch (e) { shown = raw; }
      entry("out", "CLIENT → SERVER", `<pre>${hlJson(shown)}</pre>`);
      const { response, notes } = MCPSim.handle(raw);
      if (response) {
        const isErr = !!response.error || (response.result && response.result.isError);
        entry(isErr ? "errd" : "in", isErr ? (response.error ? "SERVER → CLIENT · PROTOKOLLFEHLER" : "SERVER → CLIENT · TOOL-FEHLER") : "SERVER → CLIENT",
          `<pre>${hlJson(JSON.stringify(response, null, 2))}</pre>`);
      } else {
        entry("sys", "KEINE ANTWORT", "");
      }
      if (notes.length) entry("sys", "HINWEIS", notes.map(n => `<div class="hint">${esc(n)}</div>`).join(""));
      updateState();
    }
    $("#term-send").addEventListener("click", send);
    inp.addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
    $("#term-reset").addEventListener("click", reset);
    reset();
  })();

  /* ---------------- LVL 4: Signalverfolgung ---------------- */
  (function tracer() {
    const LANES = [["👤", "Mensch"], ["🖥", "Host + Client"], ["🧠", "LLM"], ["🔌", "MCP-Server"], ["🗄", "Datenbank"]];
    const q = "SELECT vorname, nachname FROM lehrer WHERE fach1 = 'Informatik' OR fach2 = 'Informatik'";
    const rows = '[{"vorname": "Petra", "nachname": "Müller"}, {"vorname": "Julia", "nachname": "Zimmermann"}, {"vorname": "Martin", "nachname": "Schulz"}]';
    const S = (from, to, text, payload) => ({ from, to, text, payload });
    const STEPS = [
      S(1, 3, "<strong>Beim Start</strong> hat der Host den Server gestartet und den Handshake erledigt. Jetzt fragt er: Welche Tools gibt es?",
        { jsonrpc: "2.0", id: 2, method: "tools/list" }),
      S(3, 1, "Der Server antwortet mit seiner Werkzeugliste (hier gekürzt).",
        { jsonrpc: "2.0", id: 2, result: { tools: [{ name: "query_database", description: "Führt eine SQL SELECT-Abfrage …" }, { name: "list_tables" }, { name: "describe_table" }] } }),
      S(0, 1, "Ein Mensch tippt: <em>„Welche Lehrkräfte unterrichten Informatik?“</em>"),
      S(1, 2, "Der Host gibt dem LLM die Frage <strong>zusammen mit der Werkzeugliste</strong>. Das ist kein MCP, sondern die normale Schnittstelle zum Modell.",
        { frage: "Welche Lehrkräfte unterrichten Informatik?", verfuegbare_tools: ["query_database", "list_tables", "describe_table"] }),
      S(2, 2, "Das LLM überlegt: Dafür brauche ich Daten aus der Datenbank. Es wählt ein Tool und formuliert die SQL-Abfrage."),
      S(2, 1, "Das LLM antwortet dem Host mit einem <strong>Tool-Wunsch</strong>. Es führt nichts selbst aus!",
        { tool: "query_database", arguments: { query: q } }),
      S(1, 0, "Der Host fragt den Menschen: <em>„Darf query_database ausgeführt werden?“</em> Der Mensch bestätigt."),
      S(1, 3, "Jetzt schickt der Client die MCP-Nachricht <code>tools/call</code>.",
        { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "query_database", arguments: { query: q } } }),
      S(3, 4, "Der Server prüft (nur SELECT?) und führt die Abfrage auf der Datenbank aus. Das ist SQL, kein MCP."),
      S(4, 3, "Die Datenbank liefert die passenden Zeilen."),
      S(3, 1, "Der Server verpackt das Ergebnis als MCP-Antwort mit derselben id 3.",
        { jsonrpc: "2.0", id: 3, result: { content: [{ type: "text", text: rows }], isError: false } }),
      S(1, 2, "Der Host gibt das Tool-Ergebnis an das LLM weiter."),
      S(2, 1, "Das LLM formuliert eine verständliche Antwort."),
      S(1, 0, "Der Mensch liest: <em>„Informatik unterrichten Petra Müller, Julia Zimmermann und Martin Schulz.“</em> ✓")
    ];
    const lanesEl = $("#tr-lanes");
    if (!lanesEl) return;
    lanesEl.innerHTML = LANES.map(([i, n]) => `<div class="lane"><span class="ico">${i}</span>${n}</div>`).join("") + `<div class="tr-arrow"></div>`;
    const lanes = $$(".lane", lanesEl), arrow = $(".tr-arrow", lanesEl);
    let cur = 0;
    function show() {
      const s = STEPS[cur];
      lanes.forEach((l, i) => l.classList.toggle("act", i === s.from || i === s.to));
      const box = lanesEl.getBoundingClientRect();
      const cx = i => { const r = lanes[i].getBoundingClientRect(); return r.left - box.left + r.width / 2; };
      if (s.from === s.to) {
        const r = lanes[s.from].getBoundingClientRect();
        arrow.className = "tr-arrow self";
        arrow.style.left = (r.left - box.left + r.width * .25) + "px"; arrow.style.width = (r.width * .5) + "px";
      } else {
        const a = cx(s.from), b = cx(s.to);
        arrow.className = "tr-arrow " + (b > a ? "r" : "l");
        arrow.style.left = Math.min(a, b) + "px"; arrow.style.width = Math.abs(b - a) + "px";
      }
      $("#tr-num").textContent = `SCHRITT ${cur + 1}/${STEPS.length} · ${LANES[s.from][1]} → ${LANES[s.to][1]}`;
      $("#tr-text").innerHTML = s.text;
      const p = $("#tr-payload");
      if (s.payload) setJson(p, JSON.stringify(s.payload, null, 2)); else p.innerHTML = "";
      $("#tr-prev").disabled = cur === 0;
      $("#tr-next").textContent = cur === STEPS.length - 1 ? "Von vorn ↺" : "Weiter ▸";
    }
    $("#tr-next").addEventListener("click", () => { cur = (cur + 1) % STEPS.length; show(); });
    $("#tr-prev").addEventListener("click", () => { if (cur > 0) { cur--; show(); } });
    window.addEventListener("resize", show);
    show();
  })();

  /* ---------------- LVL 5: Tool-Designer ---------------- */
  (function designer() {
    const nameIn = $("#td-name"), descIn = $("#td-desc"), paramsEl = $("#td-params"), check = $("#td-check");
    if (!nameIn) return;
    const outJson = $("#td-json"), outPy = $("#td-py");
    const PYTYPE = { string: "str", integer: "int", number: "float", boolean: "bool" };
    let params = [
      { name: "schueler_id", type: "integer", required: true, desc: "ID der Schülerin oder des Schülers" },
      { name: "fach", type: "string", required: true, desc: "Fach, z. B. Mathematik" }
    ];
    function renderParams() {
      paramsEl.innerHTML = `<div class="param-row param-head"><span>Parameter</span><span>Typ</span><span>Pflicht</span><span>Beschreibung</span><span></span></div>` +
        params.map((p, i) => `<div class="param-row" data-i="${i}">
          <input data-k="name" value="${esc(p.name)}" spellcheck="false" aria-label="Parametername">
          <select data-k="type" aria-label="Typ">${Object.keys(PYTYPE).map(t => `<option ${t === p.type ? "selected" : ""}>${t}</option>`).join("")}</select>
          <label><input type="checkbox" data-k="required" ${p.required ? "checked" : ""}> ja</label>
          <input data-k="desc" value="${esc(p.desc)}" aria-label="Beschreibung">
          <button class="btn ghost small" data-del aria-label="Parameter entfernen">✕</button></div>`).join("");
    }
    paramsEl.addEventListener("input", e => {
      const row = e.target.closest(".param-row"); if (!row || row.dataset.i === undefined) return;
      const p = params[row.dataset.i], k = e.target.dataset.k;
      p[k] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      update();
    });
    paramsEl.addEventListener("click", e => {
      if (!e.target.matches("[data-del]")) return;
      params.splice(e.target.closest(".param-row").dataset.i, 1); renderParams(); update();
    });
    $("#td-add").addEventListener("click", () => {
      params.push({ name: `parameter${params.length + 1}`, type: "string", required: false, desc: "" }); renderParams(); update();
    });
    $$("#designer .tabs .btn").forEach(b => b.addEventListener("click", () => {
      $$("#designer .tabs .btn").forEach(x => x.classList.toggle("sel", x === b));
      outJson.hidden = b.dataset.tab !== "json"; outPy.hidden = b.dataset.tab !== "py";
    }));
    function update() {
      const name = nameIn.value.trim(), desc = descIn.value.trim();
      const msgs = [];
      const ident = /^[A-Za-z_][A-Za-z0-9_]*$/;
      if (!/^[A-Za-z0-9_.-]{1,128}$/.test(name)) msgs.push(["bad", "Tool-Name: nur Buchstaben, Ziffern, _ - . und keine Leerzeichen"]);
      else if (!ident.test(name)) msgs.push(["bad", "Für Python (FastMCP) muss der Name ein gültiger Funktionsname sein: keine Bindestriche oder Punkte, keine Ziffer am Anfang"]);
      if (desc.length < 20) msgs.push(["bad", "Beschreibung zu kurz: Das LLM entscheidet anhand der Beschreibung, wann es das Tool benutzt"]);
      const names = params.map(p => p.name.trim());
      params.forEach(p => { if (!ident.test(p.name.trim())) msgs.push(["bad", `Parametername „${p.name}“ ist ungültig`]); });
      if (new Set(names).size !== names.length) msgs.push(["bad", "Parameternamen müssen eindeutig sein"]);
      params.forEach(p => { if (!p.desc.trim()) msgs.push(["bad", `Parameter „${p.name}“ hat keine Beschreibung`]); });
      if (!msgs.length) msgs.push(["good", "✓ Sauber definiert. Das LLM weiß, was das Tool tut und welche Argumente es braucht."]);
      check.innerHTML = msgs.map(([c, t]) => `<div class="${c}">${c === "bad" ? "⚠ " : ""}${esc(t)}</div>`).join("");

      const props = {};
      params.forEach(p => { props[p.name.trim()] = { type: p.type, ...(p.desc.trim() ? { description: p.desc.trim() } : {}) }; });
      const req = params.filter(p => p.required).map(p => p.name.trim());
      const tool = { name, description: desc, inputSchema: { type: "object", properties: props, ...(req.length ? { required: req } : {}) } };
      setJson(outJson, JSON.stringify(tool, null, 2));

      const sorted = [...params.filter(p => p.required), ...params.filter(p => !p.required)];
      const sig = sorted.map(p => p.required ? `${p.name.trim()}: ${PYTYPE[p.type]}` : `${p.name.trim()}: ${PYTYPE[p.type]} | None = None`).join(", ");
      const args = params.length ? `\n\n    Args:\n${params.map(p => `        ${p.name.trim()}: ${p.desc.trim()}`).join("\n")}` : "";
      const py = `from fastmcp import FastMCP

mcp = FastMCP("Mein Schul-Server")

@mcp.tool()
def ${name || "mein_tool"}(${sig}) -> str:
    """${desc}${args}
    """
    # TODO: Hier passiert die eigentliche Arbeit, z. B. eine Datenbankabfrage
    return "Ergebnis"

if __name__ == "__main__":
    mcp.run(transport="stdio")`;
      outPy.innerHTML = hlPy(py);
    }
    nameIn.addEventListener("input", update); descIn.addEventListener("input", update);
    renderParams(); update();
  })();

  /* ---------------- Clearance-Tests ---------------- */
  const norm = s => String(s).toLowerCase().replace(/\s+/g, "");
  $$(".test").forEach(box => {
    const lvl = +box.dataset.level;
    box.id = `lvl${lvl}-test`;
    const pool = window.TESTS[lvl];
    let queue = [], streak = 0;

    const next = () => {
      if (!queue.length) queue = shuffle(pool.map((_, i) => i));
      const item = pool[queue.pop()];
      return typeof item === "function" ? item() : item;
    };
    const leds = () => `<div class="streak" aria-label="${streak} von ${STREAK_GOAL}">${Array.from({ length: STREAK_GOAL }, (_, i) => `<i class="${i < streak ? "on" : ""}"></i>`).join("")}</div>`;
    const head = sub => `<div class="test-head"><h3>Clearance-Test · LVL ${lvl}</h3>${leds()}</div>${sub || ""}`;

    function intro() {
      streak = 0;
      if (isCleared(lvl)) {
        box.innerHTML = head() + `<div class="test-done"><p class="big">PORT ${lvl} VERBUNDEN ✓</p>
          <p>Clearance <strong>${LEVELS[lvl]}</strong> erreicht.</p>
          <div class="row" style="justify-content:center"><button class="btn ghost" data-start>Nochmal üben</button>${nextLink()}</div></div>`;
      } else {
        box.innerHTML = head(`<p>Beantworte <strong>${STREAK_GOAL} Fragen in Folge</strong> richtig, um Port ${lvl} zu verbinden.
          Ein Fehler setzt den Zähler zurück, aber du bekommst eine Erklärung.</p>
          <button class="btn" data-start>Test starten ▸</button>`);
      }
      $("[data-start]", box).addEventListener("click", ask);
    }
    function nextLink() {
      return lvl < LEVELS.length - 1 ? `<a class="btn next-link" href="lvl${lvl + 1}.html">Weiter zu LVL ${lvl + 1} ▸</a>` : `<a class="btn next-link" href="index.html#online">Zum Abschluss ▸</a>`;
    }

    function ask() {
      const q = next();
      box.innerHTML = head(`<p class="q-text">${q.q}</p>${q.code ? `<pre class="json">${hlJson(q.code)}</pre>` : ""}<div class="answer"></div><div class="fb-wrap"></div>`);
      const ans = $(".answer", box);
      if (q.input) {
        ans.innerHTML = `<div class="q-input"><input type="text" spellcheck="false" autocomplete="off" aria-label="Antwort"><button class="btn">Prüfen</button></div>`;
        const inp = $("input", ans), btn = $("button", ans);
        const go = () => {
          if (!inp.value.trim()) return;
          inp.disabled = btn.disabled = true;
          resolve(q.accept.some(a => norm(a) === norm(inp.value)), q, `Richtig wäre: <code>${esc(q.accept[0])}</code>. `);
        };
        btn.addEventListener("click", go);
        inp.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
        inp.focus({ preventScroll: true });
      } else {
        const order = shuffle(q.opts.map((_, i) => i));
        ans.innerHTML = `<div class="opts">${order.map(i => `<button class="opt" data-i="${i}">${q.opts[i]}</button>`).join("")}</div>`;
        $$(".opt", ans).forEach(b => b.addEventListener("click", () => {
          const right = b.dataset.i === "0";
          $$(".opt", ans).forEach(x => { x.disabled = true; if (x.dataset.i === "0") x.classList.add("right"); });
          if (!right) b.classList.add("wrong");
          resolve(right, q, "");
        }));
      }
    }

    function resolve(right, q, solution) {
      streak = right ? streak + 1 : 0;
      $(".streak", box).outerHTML = leds();
      const fb = $(".fb-wrap", box);
      if (right && streak >= STREAK_GOAL) {
        const first = !isCleared(lvl);
        if (first) { progress.cleared.push(lvl); save(); }
        fb.innerHTML = `<div class="fb ok"><div class="fb-title">✓ KORREKT</div>${q.explain}</div>`;
        setTimeout(() => {
          toast(`PORT ${lvl} VERBUNDEN · ${LEVELS[lvl]}`);
          refreshProgressUI(); intro();
          if (first && progress.cleared.length === LEVELS.length) setTimeout(() => { location.href = "index.html#online"; }, 1500);
        }, 900);
        return;
      }
      fb.innerHTML = right
        ? `<div class="fb ok"><div class="fb-title">✓ KORREKT · ${streak}/${STREAK_GOAL}</div>${q.explain}</div>`
        : `<div class="fb no"><div class="fb-title">✗ SIGNALFEHLER · Zähler zurückgesetzt</div>${solution}${q.explain}</div>`;
      fb.insertAdjacentHTML("beforeend", `<div class="row"><button class="btn">Nächste Frage ▸</button></div>`);
      const btn = $(".row .btn", fb);
      btn.addEventListener("click", ask);
      btn.focus({ preventScroll: true });
      if (!right) { box.classList.remove("glitch-flash"); void box.offsetWidth; box.classList.add("glitch-flash"); }
    }
    intro();
  });

  /* ---------------- Reset ---------------- */
  $("#reset-progress").addEventListener("click", () => {
    if (!confirm("Gesamten Fortschritt (alle verbundenen Ports) löschen?")) return;
    progress.cleared = []; save(); location.reload();
  });

  refreshProgressUI();
  // Abschluss ist erst nach refreshProgressUI sichtbar, daher Sprungziel nachholen
  if (location.hash === "#online" && $("#online") && !$("#online").hidden) $("#online").scrollIntoView();
})();
