# PayMiniApp

Полноценный Telegram mini app для оплаты подписки (фиксированно 3000 ₽) + бот для запуска.

## Структура

- `index.html` — основной mini app для GitHub Pages
- `Оплата мини апп.html` — копия интерфейса
- `бот/оплата бот.js` — код Telegram-бота
- `бот/config.env.example` — пример конфига

## Настройка бота

1. В папке `бот` создайте файл `config.env` по примеру `config.env.example`.
2. Заполните переменные:

```env
BOT_TOKEN="ваш_токен_бота"
WEBAPP_URL="https://x3percik5x.github.io/PayMiniApp/"
TINKOFF_PAYMENT_URL="https://ваша-ссылка-на-запрос-денег"
```

3. Установите зависимости:

```bash
npm i node-telegram-bot-api
```

4. Запустите бота:

```bash
node "бот/оплата бот.js"
```
