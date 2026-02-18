/**
 * Telegram-бот для мини-аппа оплаты подписки.
 *
 * Конфиг как в "Ламбриз бот":
 * - создайте файл config.env рядом с этим файлом
 * - добавьте BOT_TOKEN, WEBAPP_URL, TINKOFF_PAYMENT_URL
 *
 * Запуск:
 * 1) npm i node-telegram-bot-api
 * 2) node "оплата бот.js"
 */

const fs = require("fs");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");

const BASE_DIR = __dirname;
const ENV_PATH = path.join(BASE_DIR, "config.env");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;

    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['\"]|['\"]$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(ENV_PATH);

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const TINKOFF_PAYMENT_URL = process.env.TINKOFF_PAYMENT_URL;

if (!BOT_TOKEN || !WEBAPP_URL || !TINKOFF_PAYMENT_URL) {
  console.error(
    "Не найдены BOT_TOKEN, WEBAPP_URL или TINKOFF_PAYMENT_URL. " +
      "Создайте config.env рядом с файлом оплата бот.js"
  );
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  await bot.sendMessage(
    chatId,
    "Подписка на продукт: 3000 ₽. Выберите удобный способ оплаты:",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Открыть мини-апп", web_app: { url: WEBAPP_URL } }],
          [{ text: "Оплатить сразу (Tinkoff)", url: TINKOFF_PAYMENT_URL }]
        ]
      }
    }
  );
});

bot.on("polling_error", (err) => {
  console.error("Polling error:", err.message);
});

console.log("Бот запущен. Ожидаю команды /start");
