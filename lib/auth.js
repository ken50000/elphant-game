const crypto = require("crypto");
exports.isAdmin = function (req) {
  const want = process.env.FACILITATOR_PASSCODE || "";
  const got = String(req.headers["x-pass"] || "");
  if (!want || !got) return false;
  const a = Buffer.from(want), b = Buffer.from(got);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
