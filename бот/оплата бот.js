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
const LOCAL_ENV_PATH = path.join(BASE_DIR, "config.env");
const REPO_SHARED_ENV_PATH = path.join(BASE_DIR, "..", "miniapp.config.env");
const SERVER_SHARED_ENV_PATH = "/opt/payminiapp-miniapp/config.env";
const CONTACTS_PATH = path.join(BASE_DIR, "contacts.json");
const WELCOME_IMAGE_PATH = path.join(BASE_DIR, "welcome-card.png");

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

[
  process.env.SHARED_CONFIG_PATH,
  REPO_SHARED_ENV_PATH,
  SERVER_SHARED_ENV_PATH,
  LOCAL_ENV_PATH
].forEach((envPath) => {
  if (envPath) loadEnvFile(envPath);
});

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (!BOT_TOKEN || !WEBAPP_URL || !ADMIN_CHAT_ID) {
  console.error(
    "Не найдены BOT_TOKEN, WEBAPP_URL или ADMIN_CHAT_ID. " +
      "Заполните общий config.env в папке mini app или локальный config.env рядом с ботом."
  );
  process.exit(1);
}

const contactsByUserId = readContacts();
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.onText(/\/start/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const welcomeText = "Подписка на обслуживание ботов и mini app каталогов.\nНажмите «Оплата», чтобы открыть mini app.";
    if (msg.chat.type !== "private") {
      await bot.sendMessage(chatId, "Команда доступна в личном чате с ботом. Для ID чата используйте /chatid здесь.");
      return;
    }
    const webAppUrl = `${WEBAPP_URL}${WEBAPP_URL.includes("?") ? "&" : "?"}ts=${Date.now()}`;
    const inlineMarkup = {
      inline_keyboard: [
        [{ text: "Оплата", web_app: { url: webAppUrl } }]
      ]
    };

    if (fs.existsSync(WELCOME_IMAGE_PATH)) {
      await bot.sendPhoto(chatId, fs.createReadStream(WELCOME_IMAGE_PATH), {
        caption: welcomeText,
        reply_markup: inlineMarkup
      });
    } else {
      await bot.sendMessage(chatId, welcomeText, { reply_markup: inlineMarkup });
    }
  } catch (err) {
    console.error("Start handler error:", err.message);
  }
});

bot.onText(/\/chatid/, async (msg) => {
  const chat = msg.chat || {};
  const from = msg.from || {};
  const text = [
    "ID чата:",
    `chat_id: ${chat.id}`,
    `тип: ${chat.type || "unknown"}`,
    `твой user_id: ${from.id || "unknown"}`
  ].join("\n");
  await bot.sendMessage(chat.id, text);
});

bot.onText(/\/myid/, async (msg) => {
  const from = msg.from || {};
  await bot.sendMessage(msg.chat.id, `Твой user_id: ${from.id || "unknown"}`);
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

  const botLink = sanitizeText(payload.botLink);
  const paymentStatus = sanitizeText(payload.status) || "Подписка оплачена";
  const manualPhone = sanitizeText(payload.phone);
  const savedPhone = sanitizeText((contactsByUserId[String(from.id)] || {}).phone);
  const phone = manualPhone || savedPhone || "не указан";

  if (!botLink) {
    await bot.sendMessage(msg.chat.id, "Укажите ссылку на бота перед отправкой оплаты.");
    return;
  }

  const paidAt = sanitizeText(payload.paidAt) || new Date().toISOString();
  const userLabel = formatUserLabel(from);

  const adminText = [
    "Новая заявка на подписку:",
    `Пользователь: ${userLabel}`,
    `Телефон: ${phone}`,
    `Ссылка на бота: ${botLink}`,
    `Статус: ${paymentStatus}`,
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
