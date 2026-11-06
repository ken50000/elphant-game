const { isAdmin } = require("../lib/auth");
module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!process.env.FACILITATOR_PASSCODE) return res.status(500).json({ ok: false, error: "no_passcode_set" });
  return res.status(200).json({ ok: isAdmin(req) });
};
