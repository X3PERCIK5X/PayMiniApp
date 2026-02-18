const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");

const BASE_DIR = __dirname;
const ENV_PATH = path.join(BASE_DIR, "config.env");
const CONTACTS_DEFAULT = "/opt/payminiapp-bot/contacts.json";
const PROCESSED_DEFAULT = path.join(BASE_DIR, "processed-payments.json");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['\"]|['\"]$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function sanitize(value) {
  return String(value || "").replace(/[<>]/g, "").trim();
}

loadEnvFile(ENV_PATH);

const PORT = Number(process.env.PORT || 8090);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://x3percik5x.github.io";
const SHOP_ID = process.env.YOOKASSA_SHOP_ID;
const SECRET_KEY = process.env.YOOKASSA_SECRET_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const CONTACTS_FILE = process.env.CONTACTS_FILE || CONTACTS_DEFAULT;
const PROCESSED_FILE = process.env.PROCESSED_FILE || PROCESSED_DEFAULT;

if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) {
  console.error("Missing YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY, TELEGRAM_BOT_TOKEN or ADMIN_CHAT_ID in config.env");
  process.exit(1);
}

function yookassaConfigured() {
  if (!SHOP_ID || !SECRET_KEY) return false;
  const value = `${SHOP_ID} ${SECRET_KEY}`.toLowerCase();
  return !value.includes("replace_me") && !value.includes("your_shop_id") && !value.includes("your_secret_key");
}

const app = express();
app.use(express.json({ limit: "300kb" }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Idempotence-Key");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "payminiapp-api" });
});

app.get("/api/contact-status", (req, res) => {
  const tgUserId = String(req.query.tgUserId || "").trim();
  if (!tgUserId) {
    return res.status(400).json({ ok: false, error: "tgUserId is required" });
  }
  const contacts = readJson(CONTACTS_FILE, {});
  const phone = sanitize((contacts[tgUserId] || {}).phone);
  return res.json({ ok: true, hasPhone: Boolean(phone) });
});

app.post("/api/yookassa/create-payment", async (req, res) => {
  try {
    if (!yookassaConfigured()) {
      return res.status(503).json({ ok: false, error: "yookassa_not_configured" });
    }
    const botLink = sanitize(req.body.botLink);
    const tgUserId = String(req.body.tgUserId || "").trim();
    const tgUsername = sanitize(req.body.tgUsername);
    const tgFirstName = sanitize(req.body.tgFirstName);
    const tgLastName = sanitize(req.body.tgLastName);
    const returnUrl = sanitize(req.body.returnUrl) || "https://x3percik5x.github.io/PayMiniApp/";

    if (!botLink || !tgUserId) {
      return res.status(400).json({ ok: false, error: "botLink and tgUserId are required" });
    }

    const idempotenceKey = crypto.randomUUID();
    const auth = Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString("base64");

    const payload = {
      amount: { value: "3000.00", currency: "RUB" },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: returnUrl
      },
      description: "Подписка на обслуживание",
      metadata: {
        tgUserId,
        tgUsername,
        tgFirstName,
        tgLastName,
        botLink,
        status: "Подписка оплачена"
      }
    };

    const response = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`,
        "Idempotence-Key": idempotenceKey
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(502).json({ ok: false, error: "yookassa_error", details: data });
    }

    return res.json({
      ok: true,
      paymentId: data.id,
      confirmationUrl: data.confirmation && data.confirmation.confirmation_url ? data.confirmation.confirmation_url : null
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/yookassa/webhook", async (req, res) => {
  try {
    const event = sanitize(req.body.event);
    const object = req.body.object || {};
    const paymentId = sanitize(object.id);
    const status = sanitize(object.status);

    if (!paymentId) return res.status(400).json({ ok: false, error: "missing_payment_id" });

    if (event !== "payment.succeeded" || status !== "succeeded") {
      return res.json({ ok: true, skipped: true });
    }

    const processed = readJson(PROCESSED_FILE, {});
    if (processed[paymentId]) {
      return res.json({ ok: true, duplicate: true });
    }

    const metadata = object.metadata || {};
    const tgUserId = String(metadata.tgUserId || "").trim();
    const botLink = sanitize(metadata.botLink);
    const paidStatus = sanitize(metadata.status) || "Подписка оплачена";
    const paidAt = sanitize(object.paid_at || new Date().toISOString());

    const contacts = readJson(CONTACTS_FILE, {});
    const phone = sanitize((contacts[tgUserId] || {}).phone) || "не указан";

    const userLabel = [
      sanitize(metadata.tgFirstName),
      sanitize(metadata.tgLastName)
    ].filter(Boolean).join(" ") || "Пользователь";
    const username = sanitize(metadata.tgUsername);

    const text = [
      "Автоподтверждение ЮKassa:",
      `Статус: ${paidStatus}`,
      `Телефон: ${phone}`,
      `Ссылка на бота: ${botLink || "не указана"}`,
      `Пользователь: ${userLabel}${username ? ` (@${username})` : ""}`,
      `TG user id: ${tgUserId || "не указан"}`,
      `Payment ID: ${paymentId}`,
      `Время оплаты: ${paidAt}`
    ].join("\n");

    const tgResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text
      })
    });

    const tgData = await tgResp.json();
    if (!tgResp.ok || !tgData.ok) {
      return res.status(502).json({ ok: false, error: "telegram_send_failed", details: tgData });
    }

    processed[paymentId] = {
      at: new Date().toISOString(),
      chatId: ADMIN_CHAT_ID
    };
    writeJson(PROCESSED_FILE, processed);

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`PayMiniApp API started on 127.0.0.1:${PORT}`);
});
