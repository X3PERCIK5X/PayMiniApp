/**
 * Telegram-бот для мини-аппа оплаты подписки.
 *
 * Конфиг (файл config.env рядом с этим файлом):
 * BOT_TOKEN="..."
 * WEBAPP_URL="https://..."
 * TINKOFF_PAYMENT_URL="https://..."
 * ADMIN_CHAT_ID="123456789"
 */

const fs = require("fs");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");

const BASE_DIR = __dirname;
const ENV_PATH = path.join(BASE_DIR, "config.env");
const CONTACTS_PATH = path.join(BASE_DIR, "contacts.json");

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

function readContacts() {
  try {
    if (!fs.existsSync(CONTACTS_PATH)) return {};
    return JSON.parse(fs.readFileSync(CONTACTS_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeContacts(data) {
  fs.writeFileSync(CONTACTS_PATH, JSON.stringify(data, null, 2), "utf8");
}

function sanitizeText(value) {
  return String(value || "").replace(/[<>]/g, "").trim();
}

function formatUserLabel(user) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  const username = user.username ? `@${user.username}` : "без username";
  return `${fullName || "Пользователь"} (${username}, id: ${user.id})`;
}

loadEnvFile(ENV_PATH);

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const TINKOFF_PAYMENT_URL = process.env.TINKOFF_PAYMENT_URL;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (!BOT_TOKEN || !WEBAPP_URL || !TINKOFF_PAYMENT_URL || !ADMIN_CHAT_ID) {
  console.error(
    "Не найдены BOT_TOKEN, WEBAPP_URL, TINKOFF_PAYMENT_URL или ADMIN_CHAT_ID. " +
      "Заполните config.env рядом с файлом оплата бот.js"
  );
  process.exit(1);
}

const contactsByUserId = readContacts();
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  await bot.sendMessage(
    chatId,
    "Откройте мини-апп, укажите название вашего бота и подтвердите оплату подписки.",
    {
      reply_markup: {
        keyboard: [[{ text: "Открыть мини-апп", web_app: { url: WEBAPP_URL } }]],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    }
  );

  await bot.sendMessage(chatId, `Прямая ссылка оплаты: ${TINKOFF_PAYMENT_URL}`);
});

bot.on("message", async (msg) => {
  const from = msg.from;
  if (!from) return;

  if (msg.contact && msg.contact.phone_number) {
    const phone = sanitizeText(msg.contact.phone_number);
    contactsByUserId[String(from.id)] = {
      phone,
      updatedAt: new Date().toISOString()
    };
    writeContacts(contactsByUserId);

    await bot.sendMessage(
      msg.chat.id,
      `Номер ${phone} получен. Теперь вернитесь в mini app и нажмите "Я оплатил подписку".`
    );
    return;
  }

  if (!msg.web_app_data || !msg.web_app_data.data) return;

  let payload;
  try {
    payload = JSON.parse(msg.web_app_data.data);
  } catch {
    await bot.sendMessage(msg.chat.id, "Не удалось обработать данные из mini app.");
    return;
  }

  if (payload.action !== "subscription_paid") return;

  const botName = sanitizeText(payload.botName);
  const manualPhone = sanitizeText(payload.phone);
  const savedPhone = sanitizeText((contactsByUserId[String(from.id)] || {}).phone);
  const phone = manualPhone || savedPhone || "не указан";

  if (!botName) {
    await bot.sendMessage(msg.chat.id, "Укажите название бота перед отправкой оплаты.");
    return;
  }

  const paidAt = sanitizeText(payload.paidAt) || new Date().toISOString();
  const userLabel = formatUserLabel(from);

  const adminText = [
    "Новая заявка на продление подписки:",
    `Пользователь: ${userLabel}`,
    `Телефон: ${phone}`,
    `Бот клиента: ${botName}`,
    `Время отметки об оплате: ${paidAt}`,
    `Источник: Mini App`
  ].join("\n");

  try {
    await bot.sendMessage(ADMIN_CHAT_ID, adminText);
    await bot.sendMessage(
      msg.chat.id,
      "Спасибо. Уведомление отправлено администратору, подписка будет продлена вручную."
    );
  } catch (err) {
    await bot.sendMessage(msg.chat.id, "Не удалось отправить уведомление администратору. Попробуйте позже.");
    console.error("Admin notify error:", err.message);
  }
});

bot.on("polling_error", (err) => {
  console.error("Polling error:", err.message);
});

console.log("Бот запущен. Ожидаю команды /start");
