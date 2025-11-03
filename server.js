require('dotenv').config();

const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 мин
  max: 60, // 60 req/мин
  message: { ok: false, error: 'Rate limit exceeded' }
});
app.use(limiter);
app.use(express.json({ limit: '1mb' }));

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'https://my-form-frontend.vercel.app'];
app.use(cors({ origin: ALLOWED_ORIGINS }));

const SHEET_ID = process.env.SHEET_ID;
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Google клиент (ленивый)
let sheetsClient = null;
async function getSheetsClient() {
  if (!sheetsClient) {
    const credentialsBase64 = process.env.GOOGLE_CREDENTIALS_BASE64;
    if (!credentialsBase64) throw new Error('GOOGLE_CREDENTIALS_BASE64 not set');
    const credentials = JSON.parse(Buffer.from(credentialsBase64, 'base64').toString());
    const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
    sheetsClient = google.sheets({ version: 'v4', auth });
  }
  return sheetsClient;
}

// Запись в Sheets
async function appendToSheet(data) {
  if (!SHEET_ID) throw new Error('SHEET_ID not set');
  const sheets = await getSheetsClient();
  const values = [[
    new Date().toISOString(), // A: Дата
    data.surname, data.name, data.patronymic, data.vkLink, data.phone, data.email, data.faculty
  ]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Лист1!A:H',
    valueInputOption: 'RAW',
    resource: { values },
  });
}

// Валидация
const schema = z.object({
  surname: z.string().min(1),
  name: z.string().min(1),
  patronymic: z.string().min(1),
  vkLink: z.string().url().startsWith('https://vk.com/'),
  phone: z.string().min(1),
  email: z.string().email(),
  faculty: z.string().min(1)
});

// API
app.get('/healthz', (req, res) => res.status(200).json({ ok: true, status: 'healthy' }));

app.post('/submit', async (req, res) => {
  try {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: result.error.errors });
    }
    await appendToSheet(result.data);
    res.json({ ok: true, success: true, message: 'Данные отправлены!' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});