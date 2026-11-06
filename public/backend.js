/* Connects the game to its shared storage on this site (/api/db).
   It speaks the same small "db / user / room / downloads" language the game
   already uses, so the game itself barely changed. */
(function () {
  const PASS_KEY = "eitr-pass";
  let pass = null; try { pass = localStorage.getItem(PASS_KEY); } catch (e) {}
  let docs = {}, ver = 0, pending = [], listeners = [], ready = false, timer = null;
  let peerCbs = [], myRole = null, hb = null;
  const rid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  const clean = o => JSON.parse(JSON.stringify(o));

  function http(url, opts) {
    return fetch(url, opts).then(async r => {
      let body = null; try { body = await r.json(); } catch (e) {}
      if (!r.ok) { const e = new Error("http " + r.status); e.status = r.status;
        e.code = r.status === 403 ? "not_granted" : r.status === 429 ? "rate_limited" : "unavailable"; throw e; }
      return body;
    });
  }
  function view() {
    const d = Object.assign({}, docs);
    pending.forEach(p => { if (p.op === "set") d[p.path] = p.data; else delete d[p.path]; });
    return d;
  }
  function collDocs(name, d) {
    const pre = name + "/", out = [];
    for (const k in d) if (k.startsWith(pre) && k.indexOf("/", pre.length) < 0)
      out.push({ id: k.slice(pre.length), data: () => d[k] });
    return out;
  }
  function notify() {
    const d = view();
    listeners.forEach(l => {
      let snap, sig;
      if (l.kind === "doc") { const x = d[l.path]; sig = x ? JSON.stringify(x) : "-"; snap = { id: l.path.split("/")[1], exists: !!x, data: () => x }; }
      else { const ds = collDocs(l.path, d); sig = ds.map(z => z.id + JSON.stringify(z.data())).join("|"); snap = { docs: ds }; }
      if (sig !== l.sig) { l.sig = sig; try { l.cb(snap); } catch (e) { console.error(e); } }
    });
    if (peerCbs.length) {
      const now = Date.now();
      const peers = collDocs("presence", d).map(z => z.data()).filter(p => p && now - (p.at || 0) < 45000).map(p => ({ presence: { role: p.role } }));
      peerCbs.forEach(cb => { try { cb({ peers }); } catch (e) {} });
    }
  }
  async function fetchNow(fresh) {
    const t = fresh ? "n" + Date.now() : Math.floor(Date.now() / 2000);
    const r = await http("/api/db?t=" + t);
    docs = r.docs || {}; ver = r.v || 0;
    pending = pending.filter(p => p.v > ver);
    ready = true; notify(); return r;
  }
  function loop() {
    clearTimeout(timer);
    timer = setTimeout(async () => { try { if (!document.hidden) await fetchNow(false); } catch (e) {} loop(); }, document.hidden ? 6000 : 2500);
  }
  async function write(ops) {
    const mine = ops.map(o => ({ op: o.op, path: o.path, data: o.data ? clean(o.data) : undefined, v: Infinity }));
    pending.push(...mine); notify();
    try {
      const headers = { "Content-Type": "application/json" }; if (pass) headers["x-pass"] = pass;
      const r = await http("/api/db", { method: "POST", headers, body: JSON.stringify({ ops: mine.map(({ op, path, data }) => ({ op, path, data })) }) });
      mine.forEach(p => p.v = r.v);
      if (r.v <= ver) { pending = pending.filter(p => !mine.includes(p)); }
      notify();
    } catch (e) { pending = pending.filter(p => !mine.includes(p)); notify(); throw e; }
  }
  const db = {
    doc(path) { return {
      set: data => write([{ op: "set", path, data }]),
      delete: () => write([{ op: "delete", path }]),
      get: async () => { await fetchNow(true); const x = view()[path]; return { exists: !!x, data: () => x, id: path.split("/")[1] }; },
      onSnapshot(cb, err) { listeners.push({ kind: "doc", path, cb, err, sig: null }); if (ready) notify(); }
    }; },
    collection(name) { return {
      add: async data => { const id = rid(); await write([{ op: "set", path: name + "/" + id, data }]); return { id }; },
      get: async () => { await fetchNow(true); return { docs: collDocs(name, view()) }; },
      onSnapshot(cb, err) { listeners.push({ kind: "coll", path: name, cb, err, sig: null }); if (ready) notify(); }
    }; }
  };
  function heartbeat() {
    clearInterval(hb);
    if (!myRole) return;
    const key = (localStorage.getItem("eitr-key") || "x").replace(/[^A-Za-z0-9_-]/g, "");
    const beat = () => { if (document.hidden) return; write([{ op: "set", path: "presence/" + key, data: { role: myRole, at: Date.now() } }]).catch(() => {}); };
    beat(); hb = setInterval(beat, 15000);
  }
  async function verify() {
    if (!pass) return false;
    try { const r = await http("/api/auth", { method: "POST", headers: { "x-pass": pass } }); return !!r.ok; } catch (e) { return false; }
  }
  window.EITR = {
    async unlock(p) {
      const old = pass; pass = String(p || "").trim();
      if (await verify()) { try { localStorage.setItem(PASS_KEY, pass); } catch (e) {} return true; }
      pass = old; return false;
    },
    lock() { pass = null; try { localStorage.removeItem(PASS_KEY); } catch (e) {} }
  };
  window.claude = { use: async name => {
    if (name === "db") { try { await fetchNow(false); } catch (e) { return null; } loop(); return db; }
    if (name === "user") return { isOwner: verify };
    if (name === "room") return { presence(o) { myRole = (o && o.role) || null; heartbeat(); }, onPeers(cb) { peerCbs.push(cb); notify(); } };
    if (name === "downloads") return { save: async ({ filename, data }) => {
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: "text/plain" }));
      a.download = filename; document.body.appendChild(a); a.click(); a.remove(); } };
    return null;
  } };
})();
