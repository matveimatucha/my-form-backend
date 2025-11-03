require('dotenv').config(); // Загружаем .env в начале

const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3001; // Env для Render/Heroku

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Настройки Google Sheets
const SHEET_ID = process.env.SHEET_ID; // Из .env
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

// Функция записи в Sheets
async function appendToSheet(auth, data) {
  if (!SHEET_ID) {
    throw new Error('SHEET_ID not set in env');
  }
  const sheets = google.sheets({ version: 'v4', auth });
  const values = [
    [new Date().toISOString(), data.name, data.email, data.message] // Timestamp + поля
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Лист1!A:D', // Твой лист
    valueInputOption: 'RAW',
    resource: { values },
  });
}

// Эндпоинт для формы
app.post('/submit', async (req, res) => {
  try {
    const auth = await authorize();
    const body = req.body || {}; // Защита от undefined
    const { name, email, message } = body;
    
    // Простая валидация
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    await appendToSheet(auth, { name, email, message });
    res.json({ success: true, message: 'Данные отправлены!' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});