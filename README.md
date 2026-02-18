# PayMiniApp

Telegram mini app для подписки на обслуживание (3000 ₽) + бот для уведомления в группу.

## Mini app flow

1. При входе запрашивает номер телефона из Telegram.
2. После подтверждения открывается только экран оплаты.
3. Пользователь указывает ссылку на своего бота.
4. Нажимает кнопку оплаты (ЮKassa).
5. После возврата mini app отправляет в бота: телефон, ссылку на бота, статус `Подписка оплачена`.

## Файлы

- `index.html` — основной mini app
- `Оплата мини апп.html` — копия mini app
- `бот/оплата бот.js` — Telegram-бот
- `бот/config.env.example` — пример конфига

## Настройка бота

Создайте `бот/config.env`:

```env
BOT_TOKEN="ваш_токен_бота"
WEBAPP_URL="https://x3percik5x.github.io/PayMiniApp/"
YOOKASSA_PAYMENT_URL="https://ваша-ссылка-оплаты-юкасса"
ADMIN_CHAT_ID="chat_id_группы_или_чата"
```

Запуск:

```bash
npm i node-telegram-bot-api
node "бот/оплата бот.js"
```
