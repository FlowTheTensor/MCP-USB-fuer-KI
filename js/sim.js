/* =========================================================
   Simulierter MCP-Server „SQLite Schul-Datenbank“
   Nachbau von github.com/FlowTheTensor/SQLite-per-MCP mit Beispieldaten.
   handle(text) -> { response: Objekt | null, notes: [Hinweistexte] }
   ========================================================= */
(function () {
  const PROTOCOL = "2025-06-18";

  const DB = {
    schueler: {
      cols: [["id", "INTEGER"], ["vorname", "TEXT"], ["nachname", "TEXT"], ["klasse", "TEXT"], ["geburtsdatum", "DATE"], ["email", "TEXT"]],
      rows: [
        [1, "Anna", "Müller", "5a", "2014-03-12", "anna.müller@schule.de"],
        [2, "Leon", "Schmidt", "5a", "2014-07-02", "leon.schmidt@schule.de"],
        [3, "Mia", "Weber", "6b", "2013-11-23", "mia.weber@schule.de"],
        [4, "Felix", "Koch", "7a", "2012-01-30", "felix.koch@schule.de"],
        [5, "Lena", "Bauer", "8b", "2011-05-17", "lena.bauer@schule.de"],
        [6, "Jonas", "Richter", "9a", "2010-09-08", "jonas.richter@schule.de"],
        [7, "Sophie", "Klein", "10a", "2009-12-01", "sophie.klein@schule.de"],
        [8, "Noah", "Wolf", "10a", "2009-02-14", "noah.wolf@schule.de"]
      ]
    },
    lehrer: {
      cols: [["id", "INTEGER"], ["vorname", "TEXT"], ["nachname", "TEXT"], ["fach1", "TEXT"], ["fach2", "TEXT"], ["raum", "TEXT"]],
      rows: [
        [1, "Petra", "Müller", "Mathematik", "Informatik", "B204"],
        [2, "Thomas", "Klein", "Mathematik", "Sport", "A112"],
        [3, "Sandra", "Wolf", "Deutsch", "Englisch", "C301"],
        [4, "Michael", "Schneider", "Englisch", "Sport", "A207"],
        [5, "Julia", "Zimmermann", "Deutsch", "Informatik", "B118"],
        [10, "Martin", "Schulz", "Informatik", "Deutsch", "B220"]
      ]
    },
    kurse: {
      cols: [["id", "INTEGER"], ["fach", "TEXT"], ["klasse", "TEXT"], ["lehrer_id", "INTEGER"]],
      rows: [[1, "Mathematik", "5a", 1], [2, "Informatik", "10a", 5], [3, "Deutsch", "5a", 3], [4, "Sport", "7a", 2], [5, "Englisch", "8b", 4]]
    },
    noten: {
      cols: [["id", "INTEGER"], ["schueler_id", "INTEGER"], ["kurs_id", "INTEGER"], ["note", "REAL"], ["datum", "DATE"], ["art", "TEXT"]],
      rows: [
        [1, 1, 1, 2.0, "2026-10-08", "Schulaufgabe"], [2, 1, 3, 1.7, "2026-10-15", "mündlich"],
        [3, 2, 1, 3.3, "2026-10-08", "Schulaufgabe"], [4, 7, 2, 1.0, "2026-10-20", "Schulaufgabe"],
        [5, 8, 2, 2.3, "2026-10-20", "Schulaufgabe"], [6, 4, 4, 1.3, "2026-10-22", "mündlich"]
      ]
    }
  };

  const TOOLS = [
    {
      name: "query_database",
      description: "Führt eine SQL SELECT-Abfrage auf der Schul-Datenbank aus.",
      inputSchema: { type: "object", properties: { query: { type: "string", description: "Die SQL SELECT-Abfrage, z. B. 'SELECT * FROM schueler'" } }, required: ["query"] }
    },
    {
      name: "list_tables",
      description: "Listet alle Tabellen in der Datenbank auf.",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "describe_table",
      description: "Zeigt die Struktur einer Tabelle (Spalten und Datentypen).",
      inputSchema: { type: "object", properties: { table_name: { type: "string", description: "Name der Tabelle" } }, required: ["table_name"] }
    }
  ];

  let state = "new"; // new -> initializing -> ready

  const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
  const err = (id, code, message, data) => ({ jsonrpc: "2.0", id, error: data ? { code, message, data } : { code, message } });
  const text = (t, isError = false) => ({ content: [{ type: "text", text: t }], isError });
  const asJson = x => JSON.stringify(x, null, 2);

  function rowsToObjects(table, cols) {
    const t = DB[table];
    const idx = cols.map(c => t.cols.findIndex(x => x[0] === c));
    return t.rows.map(r => Object.fromEntries(cols.map((c, i) => [c, r[idx[i]]])));
  }

  // Sehr kleiner SQL-Interpreter: SELECT spalten FROM tabelle [WHERE spalte = wert] [LIMIT n]
  function runSelect(q) {
    const s = q.trim().replace(/;\s*$/, "");
    if (!/^select\b/i.test(s)) return { error: "Fehler: Nur SELECT-Abfragen sind erlaubt!" };
    const m = s.match(/^select\s+(.+?)\s+from\s+(\w+)(?:\s+where\s+(\w+)\s*(=|<|>|<=|>=|!=|like)\s*('([^']*)'|-?[\d.]+))?(?:\s+limit\s+(\d+))?$/i);
    if (!m) return { error: "Fehler: Diese Abfrage versteht die Simulation nicht. Möglich ist: SELECT spalten FROM tabelle [WHERE spalte = wert] [LIMIT n]" };
    const table = m[2].toLowerCase();
    if (!DB[table]) return { error: `Fehler: no such table: ${m[2]}` };
    const all = DB[table].cols.map(c => c[0]);
    const cols = m[1].trim() === "*" ? all : m[1].split(",").map(c => c.trim().toLowerCase());
    const bad = cols.find(c => !all.includes(c));
    if (bad) return { error: `Fehler: no such column: ${bad}` };
    let rows = rowsToObjects(table, all);
    if (m[3]) {
      const col = m[3].toLowerCase();
      if (!all.includes(col)) return { error: `Fehler: no such column: ${m[3]}` };
      const op = m[4].toLowerCase();
      const val = m[6] !== undefined ? m[6] : Number(m[5]);
      const cmp = {
        "=": (a, b) => a == b, "!=": (a, b) => a != b, "<": (a, b) => a < b, ">": (a, b) => a > b,
        "<=": (a, b) => a <= b, ">=": (a, b) => a >= b,
        like: (a, b) => new RegExp("^" + String(b).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$", "i").test(String(a))
      }[op];
      rows = rows.filter(r => cmp(r[col], val));
    }
    if (m[7]) rows = rows.slice(0, Number(m[7]));
    return { rows: rows.map(r => Object.fromEntries(cols.map(c => [c, r[c]]))) };
  }

  function callTool(id, params) {
    if (!params || typeof params.name !== "string") return err(id, -32602, "Invalid params: 'name' fehlt");
    const tool = TOOLS.find(t => t.name === params.name);
    if (!tool) return err(id, -32602, `Unknown tool: ${params.name}`);
    const args = params.arguments || {};
    for (const r of tool.inputSchema.required || []) {
      if (typeof args[r] !== "string") return err(id, -32602, `Invalid params: Argument '${r}' (string) fehlt`);
    }
    if (tool.name === "list_tables") return ok(id, text(asJson(Object.keys(DB).map(name => ({ name })))));
    if (tool.name === "describe_table") {
      const t = DB[args.table_name.toLowerCase()];
      if (!t) return ok(id, text(`Fehler: Tabelle '${args.table_name}' nicht gefunden`, true));
      return ok(id, text(asJson(t.cols.map(([name, type], cid) => ({ cid, name, type, pk: name === "id" ? 1 : 0 })))));
    }
    const r = runSelect(args.query);
    if (r.error) return ok(id, text(r.error, true));
    return ok(id, text(asJson(r.rows)));
  }

  function handle(input) {
    const notes = [];
    let msg;
    try { msg = JSON.parse(input); } catch (e) {
      return { response: err(null, -32700, "Parse error"), notes: ["Kein gültiges JSON. Prüfe Anführungszeichen, Kommas und Klammern."] };
    }
    if (Array.isArray(msg)) {
      return { response: err(null, -32600, "Invalid Request", "Batching (mehrere Nachrichten in einem Array) unterstützt MCP nicht."), notes: [] };
    }
    if (typeof msg !== "object" || msg === null) return { response: err(null, -32600, "Invalid Request"), notes: ["Eine Nachricht muss ein JSON-Objekt sein."] };

    const hasId = Object.prototype.hasOwnProperty.call(msg, "id");
    const id = hasId && (typeof msg.id === "string" || typeof msg.id === "number") ? msg.id : null;

    if (msg.jsonrpc !== "2.0") {
      return { response: err(id, -32600, "Invalid Request"), notes: ['Das Feld "jsonrpc" muss genau den String "2.0" enthalten.'] };
    }
    if (typeof msg.method !== "string") {
      if ("result" in msg || "error" in msg) return { response: null, notes: ["Das ist eine Response. Der Server hat keine offene Anfrage an dich gestellt und ignoriert sie."] };
      return { response: err(id, -32600, "Invalid Request"), notes: ['Es fehlt das Feld "method".'] };
    }

    // Notifications: keine id -> niemals eine Antwort
    if (!hasId) {
      if (msg.method === "notifications/initialized") {
        if (state === "initializing") { state = "ready"; notes.push("Handshake abgeschlossen. Der Server ist jetzt betriebsbereit."); }
        else if (state === "new") notes.push("Erst initialize senden, dann diese Bestätigung.");
        else notes.push("Die Verbindung war schon initialisiert.");
      } else {
        notes.push(`Notification „${msg.method}“ empfangen.`);
      }
      notes.push("Auf Notifications antwortet der Server nicht, sie haben keine id.");
      return { response: null, notes };
    }
    if (id === null) return { response: err(null, -32600, "Invalid Request"), notes: ["In MCP muss die id ein String oder eine Zahl sein, nicht null."] };

    const p = msg.params;
    switch (msg.method) {
      case "ping":
        return { response: ok(id, {}), notes: ["ping funktioniert jederzeit, auch vor dem Handshake."] };

      case "initialize":
        if (!p || typeof p.protocolVersion !== "string") return { response: err(id, -32602, "Invalid params: 'protocolVersion' fehlt"), notes: [] };
        if (state !== "new") notes.push("Hinweis: Die Verbindung war schon initialisiert. Ein echter Client schickt initialize nur einmal.");
        state = "initializing";
        notes.push("Jetzt noch die Notification notifications/initialized schicken.");
        if (p.protocolVersion !== PROTOCOL) notes.push(`Der Server kennt Version ${p.protocolVersion} nicht und schlägt ${PROTOCOL} vor.`);
        return {
          response: ok(id, {
            protocolVersion: PROTOCOL,
            capabilities: { tools: { listChanged: false }, resources: {}, prompts: {} },
            serverInfo: { name: "SQLite Schul-Datenbank (Simulation)", version: "1.0.0" },
            instructions: "Nur Lesezugriff. Tabellen: schueler, lehrer, kurse, noten."
          }), notes
        };
    }

    if (state === "new") {
      return { response: err(id, -32600, "Server not initialized"), notes: ["Vor dem Handshake sind nur initialize und ping erlaubt."] };
    }
    if (state === "initializing") notes.push("Hinweis: notifications/initialized wurde noch nicht gesendet. Der Server antwortet trotzdem, aber sauber ist das nicht.");

    switch (msg.method) {
      case "tools/list":
        return { response: ok(id, { tools: TOOLS }), notes };
      case "tools/call":
        return { response: callTool(id, p), notes };
      case "resources/list":
        notes.push("Resources gibt es nur in der Simulation. Der echte Projektserver bietet nur Tools an.");
        return { response: ok(id, { resources: [{ uri: "schule://schema", name: "schema", title: "Datenbankschema", mimeType: "text/plain" }] }), notes };
      case "resources/read":
        if (!p || p.uri !== "schule://schema") return { response: err(id, -32002, "Resource not found", { uri: p && p.uri }), notes };
        return {
          response: ok(id, {
            contents: [{
              uri: "schule://schema", mimeType: "text/plain",
              text: Object.entries(DB).map(([n, t]) => `${n}(${t.cols.map(c => c.join(" ")).join(", ")})`).join("\n")
            }]
          }), notes
        };
      case "prompts/list":
        notes.push("Prompts gibt es nur in der Simulation.");
        return {
          response: ok(id, {
            prompts: [{ name: "notenbericht", title: "Notenbericht", description: "Erstellt einen Notenbericht für eine Klasse",
              arguments: [{ name: "klasse", description: "z. B. 5a", required: true }] }]
          }), notes
        };
      case "prompts/get":
        if (!p || p.name !== "notenbericht") return { response: err(id, -32602, "Invalid params: unbekannter Prompt"), notes };
        if (!p.arguments || !p.arguments.klasse) return { response: err(id, -32602, "Invalid params: Argument 'klasse' fehlt"), notes };
        return {
          response: ok(id, {
            description: "Notenbericht",
            messages: [{ role: "user", content: { type: "text", text: `Erstelle einen übersichtlichen Notenbericht für die Klasse ${p.arguments.klasse}. Nutze dazu die Datenbank-Tools.` } }]
          }), notes
        };
      default:
        return { response: err(id, -32601, "Method not found"), notes: notes.concat([`Die Methode „${msg.method}“ kennt dieser Server nicht.`]) };
    }
  }

  const PRESETS = [
    ["initialize", { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: "Schul-Terminal", version: "1.0.0" } } }],
    ["notifications/initialized", { jsonrpc: "2.0", method: "notifications/initialized" }],
    ["ping", { jsonrpc: "2.0", id: 2, method: "ping" }],
    ["tools/list", { jsonrpc: "2.0", id: 3, method: "tools/list" }],
    ["tools/call → list_tables", { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "list_tables", arguments: {} } }],
    ["tools/call → describe_table", { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "describe_table", arguments: { table_name: "lehrer" } } }],
    ["tools/call → query_database", { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "query_database", arguments: { query: "SELECT vorname, nachname, klasse FROM schueler WHERE klasse = '10a'" } } }],
    ["resources/list", { jsonrpc: "2.0", id: 7, method: "resources/list" }],
    ["resources/read", { jsonrpc: "2.0", id: 8, method: "resources/read", params: { uri: "schule://schema" } }],
    ["prompts/get", { jsonrpc: "2.0", id: 9, method: "prompts/get", params: { name: "notenbericht", arguments: { klasse: "5a" } } }]
  ];

  window.MCPSim = {
    handle,
    reset() { state = "new"; },
    get state() { return state; },
    presets: PRESETS.map(([label, obj]) => [label, JSON.stringify(obj, null, 2)])
  };
})();
