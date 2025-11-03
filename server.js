const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Настройки Google Sheets
const SHEET_ID = '1jR3M4rEH6jmJoaRgW6rwuoxPPgpHbRGpBdhTEIFmsFI'; 
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const credentialsPath = './credentials.json';; // Путь к JSON-ключу сервис-аккаунта

// Аутентификация
async function authorize() {
    const auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: SCOPES,
    });
    return auth.getClient();
}

// Функция записи в Sheets
async function appendToSheet(auth, data) {
    const sheets = google.sheets({ version: 'v4', auth });
    const values = [
        [new Date().toISOString(), data.name, data.email, data.message] // Добавь timestamp
    ];
    await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: 'Лист1!A:D', // Столбцы A-D: Timestamp, Name, Email, Message
        valueInputOption: 'RAW',
        resource: { values },
    });
}

// Эндпоинт для формы
app.post('/submit', async (req, res) => {
    try {
        const auth = await authorize();
        const { name, email, message } = req.body;

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