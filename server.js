import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { VertexAI } from '@google-cloud/vertexai';

// --- ES Modulesで __dirname を再現するための設定 ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ▼▼▼▼▼ この部分を修正 ▼▼▼▼▼
// 静的ファイル（HTMLなど）が 'public' フォルダにあることをExpressに教える
app.use(express.static(path.join(__dirname, 'public')));
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

// --- Google Cloud Vertex AI の設定 ---
// (この部分は変更なし)
const PROJECT_ID = process.env.GCP_PROJECT_ID; 
const LOCATION = 'us-central1';
const vertex_ai = new VertexAI({ project: PROJECT_ID, location: LOCATION });
const generativeModel = vertex_ai.getGenerativeModel({ model: 'gemini-1.5-flash-001' });
const generativeVisionModel = vertex_ai.getGenerativeModel({ model: 'imagegeneration@0.0.2' });

// --- APIエンドポイント ---
// (APIエンドポイントのロジックは変更なし)

app.post('/api/generate-text', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt は必須です。' });
    try {
        const geminiResponse = await generativeModel.generateContent(prompt);
        const textResponse = geminiResponse.response.candidates[0].content.parts[0].text;
        const jsonMatch = textResponse.match(/{[\s\S]*}/);
        if (jsonMatch && jsonMatch[0]) {
            res.status(200).json(JSON.parse(jsonMatch[0]));
        } else {
            throw new Error('AIの応答から有効なJSONを見つけられませんでした。');
        }
    } catch (error) {
        console.error('テキスト生成エラー:', error);
        res.status(500).json({ error: 'サーバー側でテキストの生成に失敗しました。', details: error.message });
    }
});

app.post('/api/generate-image', async (req, res) => {
    const { storyHistory, theme } = req.body;
    if (!storyHistory || !theme) return res.status(400).json({ error: 'storyHistory と theme は必須です。' });
    try {
        const promptForImagePrompt = `
            # Role: あなたは画像生成AIを操るプロの「プロンプトエンジニア」です。
            # Task: 以下の物語を読み、その情景や感情を最もよく表現する「表紙画像」を生成するための、非常に詳細で芸術的な指示文（プロンプト）を英語で生成してください。
            # Constraints: 
            - プロンプトは必ず英語にしてください。
            - 物語の主要な被写体、雰囲気、画風（例: oil painting, photorealistic, anime style）、色彩、光の当たり方などを具体的に含めてください。
            - 物語のテーマである「${theme}」の雰囲気を強く反映させてください。
            # Story:
            ${storyHistory.join('\n')}
            # Output (英語のプロンプトのみ):
        `;
        const geminiResponse = await generativeModel.generateContent(promptForImagePrompt);
        const imagePrompt = geminiResponse.response.candidates[0].content.parts[0].text.trim();
        const imageResponse = await generativeVisionModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: imagePrompt }] }],
            generationConfig: { "number_of_images": 1 }
        });
        const imageBase64 = imageResponse.response.candidates[0].content.parts[0].fileData.data;
        res.status(200).json({ imageBase64: imageBase64 });
    } catch (error) {
        console.error('画像生成エラー:', error);
        res.status(500).json({ error: 'サーバー側で画像の生成に失敗しました。', details: error.message });
    }
});

// ▼▼▼ この部分も修正 ▼▼▼
// どのAPIルートにも一致しない場合、'public'フォルダ内のindex.htmlを返す
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

app.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました。`);
});
