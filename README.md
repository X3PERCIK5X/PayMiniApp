# PayMiniApp

Автоподтверждение подписки через ЮKassa webhook.

## Как работает

1. Mini app при входе запрашивает номер телефона из Telegram.
2. После подтверждения показывает только экран оплаты:
   - Подпись: "Подписка на обслуживание"
   - Сумма: 3000 ₽
   - Поле: ссылка на бота клиента
   - Кнопка: оплата через ЮKassa
3. Mini app создаёт платёж через backend API.
4. После события `payment.succeeded` webhook отправляет в группу:
   - Телефон
   - Ссылка на бота
   - Статус: `Подписка оплачена`

## Структура

- `index.html` — mini app
- `Оплата мини апп.html` — копия mini app
- `бот/оплата бот.js` — Telegram-бот (запуск mini app + сохранение контактов)
- `бот/config.env.example` — конфиг бота
- `api/server.js` — backend для ЮKassa (create-payment + webhook)
- `api/config.env.example` — конфиг backend

## Конфиг бота (`бот/config.env`)

```env
BOT_TOKEN="ваш_токен_бота"
WEBAPP_URL="https://x3percik5x.github.io/PayMiniApp/"
ADMIN_CHAT_ID="chat_id_группы"
```

## Конфиг API (`api/config.env`)

```env
PORT="8090"
ALLOWED_ORIGIN="https://x3percik5x.github.io"
YOOKASSA_SHOP_ID="shop_id"
YOOKASSA_SECRET_KEY="secret_key"
TELEGRAM_BOT_TOKEN="тот_же_токен_бота"
ADMIN_CHAT_ID="chat_id_группы"
CONTACTS_FILE="/opt/payminiapp-bot/contacts.json"
```

## Важно

Для реального автоподтверждения в ЮKassa нужно настроить HTTP-уведомления на endpoint:
`https://lambrizsel.duckdns.org/payminiapi/api/yookassa/webhook`
