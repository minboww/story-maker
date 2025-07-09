import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config'; 

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY is not defined. Please set it in Heroku Config Vars.");
  // アプリケーションをクラッシュさせずにエラーを示す
  // サーバーは起動し続けるが、API呼び出しは失敗する
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(express.static('public'));
app.use(express.json());

app.post('/api/generate', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: API_KEY is missing.' });
  }
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    res.json(JSON.parse(text));
  } catch (error) {
    console.error('Error calling Google AI API:', error);
    res.status(500).json({ error: 'An error occurred while generating content.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
