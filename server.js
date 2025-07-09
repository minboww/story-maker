import express from 'express';
import cors from 'cors';
import path from 'path'; // pathモジュールをインポート
import { fileURLToPath } from 'url'; // urlモジュールをインポート
import { VertexAI } from '@google-cloud/vertexai';

// --- ES Modulesで __dirname を再現するための設定 ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ▼▼▼▼▼ この部分が重要 ▼▼▼▼▼
// 静的ファイル（HTML, CSS, フロントエンドJS）を配信するための設定
// 'public'というフォルダを作成してそこに入れるのが一般的ですが、
// 今回はルートディレクトリをそのまま配信します。
app.use(express.static(path.join(__dirname, '/')));
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

// --- Google Cloud Vertex AI の設定 ---
// (この部分は変更なし)
const PROJECT_ID = process.env.GCP_PROJECT_ID; 
const LOCATION = 'us-central1';
const vertex_ai = new VertexAI({ project: PROJECT_ID, location: LOCATION });
const generativeModel = vertex_ai.getGenerativeModel({ model: 'gemini-1.5-flash-001' });
const generativeVisionModel = vertex_ai.getGenerativeModel({ model: 'imagegeneration@0.0.2' });

// --- APIエンドポイント ---

// テキスト生成用のエンドポイント (パスの先頭に '/api' を付けると管理しやすい)
app.post('/api/generate-text', async (req, res) => {
    // (内部のロジックは変更なし)
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

// 画像生成用のエンドポイント (同様に '/api' を付ける)
app.post('/api/generate-image', async (req, res) => {
    // (内部のロジックは変更なし)
    const { storyHistory, theme } = req.body;
    if (!storyHistory || !theme) return res.status(400).json({ error: 'storyHistory と theme は必須です。' });
    try {
        // (プロンプト生成と画像生成のロジック)
        const geminiResponse = await generativeModel.generateContent(/* ... */);
        const imagePrompt = geminiResponse.response.candidates[0].content.parts[0].text.trim();
        const imageResponse = await generativeVisionModel.generateContent({/* ... */});
        const imageBase64 = imageResponse.response.candidates[0].content.parts[0].fileData.data;
        res.status(200).json({ imageBase64: imageBase64 });
    } catch (error) {
        console.error('画像生成エラー:', error);
        res.status(500).json({ error: 'サーバー側で画像の生成に失敗しました。', details: error.message });
    }
});

// ★★★ どのルートにも一致しない場合、index.htmlを返す (SPA対応) ★★★
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました。`);
});
