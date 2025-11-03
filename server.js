require('dotenv').config(); // Для локального .env (удали, если на Render/Heroku)

const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: '*' })); // Для фронта (Vercel)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Настройки Google Sheets
const SHEET_ID = process.env.SHEET_ID; // Из env
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Аутентификация
async function authorize() {
  const credentialsBase64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!credentialsBase64) {
    throw new Error('GOOGLE_CREDENTIALS_BASE64 not set in env');
  }
  const credentials = JSON.parse(Buffer.from(credentialsBase64, 'base64').toString());
  const auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: SCOPES,
  });
  return auth.getClient();
}

// Функция записи в Sheets (8 столбцов: Дата + 7 полей)
async function appendToSheet(auth, data) {
  if (!SHEET_ID) {
    throw new Error('SHEET_ID not set in env');
  }
  const sheets = google.sheets({ version: 'v4', auth });
  const values = [
    [
      new Date().toISOString(), // A: Дата
      data.surname || '', // B: Фамилия
      data.name || '', // C: Имя
      data.patronymic || '', // D: Отчество
      data.vkLink || '', // E: Ссылка на ВК
      data.phone || '', // F: Телефон
      data.email || '', // G: Email
      data.faculty || '' // H: Факультет
    ]
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Лист1!A:H', // 8 столбцов
    valueInputOption: 'RAW',
    resource: { values },
  });
}

// Эндпоинт для формы (валидация на все 7 полей)
app.post('/submit', async (req, res) => {
  try {
    const auth = await authorize();
    const body = req.body || {};
    const { surname, name, patronymic, vkLink, phone, email, faculty } = body;
    
    // Валидация (все поля обязательны)
    if (!surname || !name || !patronymic || !vkLink || !phone || !email || !faculty) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    await appendToSheet(auth, { surname, name, patronymic, vkLink, phone, email, faculty });
    res.json({ success: true, message: 'Данные отправлены!' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});