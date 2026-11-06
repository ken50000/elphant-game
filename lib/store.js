// Tiny storage layer. Uses Upstash Redis (free, added from the Vercel dashboard).
// If no Redis is connected it falls back to memory, which is fine for trying it
// on your own computer but NOT reliable on Vercel (the game would forget things).
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const HASH = "eitr:docs", VER = "eitr:v";

const mem = (globalThis.__eitrMem = globalThis.__eitrMem || { docs: {}, v: 0 });

async function pipeline(cmds) {
  const r = await fetch(URL_ + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error("redis " + r.status);
  const out = await r.json();
  return out.map(x => { if (x.error) throw new Error(x.error); return x.result; });
}

exports.hasRedis = () => !!(URL_ && TOKEN);

exports.readAll = async function () {
  if (!exports.hasRedis()) return { v: mem.v, docs: { ...mem.docs } };
  const [flat, v] = await pipeline([["HGETALL", HASH], ["GET", VER]]);
  const docs = {};
  for (let i = 0; i < (flat || []).length; i += 2) {
    try { docs[flat[i]] = JSON.parse(flat[i + 1]); } catch (e) {}
  }
  return { v: Number(v || 0), docs };
};

// ops: [{op:"set",path,data} | {op:"delete",path}]
exports.apply = async function (ops) {
  if (!exports.hasRedis()) {
    for (const o of ops) {
      if (o.op === "set") mem.docs[o.path] = o.data; else delete mem.docs[o.path];
    }
    mem.v += 1; return mem.v;
  }
  const cmds = ops.map(o => o.op === "set"
    ? ["HSET", HASH, o.path, JSON.stringify(o.data)]
    : ["HDEL", HASH, o.path]);
  cmds.push(["INCR", VER]);
  const res = await pipeline(cmds);
  return Number(res[res.length - 1]);
};
