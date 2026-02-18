/**
 * Telegram-бот для мини-аппа оплаты подписки.
 *
 * Запуск:
 * 1) npm i node-telegram-bot-api dotenv
 * 2) Создайте .env рядом с файлом:
 *    BOT_TOKEN=ваш_токен_бота
 *    WEBAPP_URL=https://ваш-домен/Оплата%20мини%20апп.html
 *    TINKOFF_PAYMENT_URL=https://ваша-ссылка-на-запрос-денег
 * 3) node "оплата бот.js"
 */

require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const TINKOFF_PAYMENT_URL = process.env.TINKOFF_PAYMENT_URL;

if (!BOT_TOKEN || !WEBAPP_URL || !TINKOFF_PAYMENT_URL) {
  console.error("Нужны переменные BOT_TOKEN, WEBAPP_URL и TINKOFF_PAYMENT_URL в .env");
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
