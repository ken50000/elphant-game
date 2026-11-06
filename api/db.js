const store = require("../lib/store");
const { isAdmin } = require("../lib/auth");

// Players may add/replace these. Everything else needs the facilitator passcode.
const PLAYER_COLLS = new Set(["responses", "joins", "solutions", "votes", "cvotes", "presence"]);
const MAX_DOC = 6000, MAX_OPS = 400;

function validate(o, admin) {
  if (!o || (o.op !== "set" && o.op !== "delete")) return false;
  if (typeof o.path !== "string" || !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(o.path) || o.path.length > 160) return false;
  if (admin) return o.op === "set" ? JSON.stringify(o.data || {}).length <= MAX_DOC : true;
  const coll = o.path.split("/")[0];
  if (o.op !== "set" || !PLAYER_COLLS.has(coll)) return false;
  return o.data && typeof o.data === "object" && JSON.stringify(o.data).length <= MAX_DOC;
}

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      // Everyone polls the same URL (?t=window) so Vercel's edge can share one answer.
      res.setHeader("Cache-Control", "public, s-maxage=2, stale-while-revalidate=3");
      const { v, docs } = await store.readAll();
      return res.status(200).json({ v, docs, redis: store.hasRedis() });
    }
    if (req.method === "POST") {
      res.setHeader("Cache-Control", "no-store");
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const ops = Array.isArray(body.ops) ? body.ops : [];
      if (!ops.length || ops.length > MAX_OPS) return res.status(400).json({ error: "bad_request" });
      const admin = isAdmin(req);
      if (!ops.every(o => validate(o, admin))) return res.status(403).json({ error: "not_granted" });
      const v = await store.apply(ops);
      return res.status(200).json({ v });
    }
    return res.status(405).json({ error: "method" });
  } catch (e) {
    return res.status(500).json({ error: "server", message: String(e && e.message || e) });
  }
};
