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
const generativeModel = vertex_ai.getGenerativeModel({ model: 'gemini-2.0-flash-001' });
const generativeVisionModel = vertex_ai.getGenerativeModel({ model: 'imagen-3.0-generate-002' });

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
    // ログを追加して、呼び出し回数を確認
    console.log(`[${new Date().toISOString()}] /api/generate-image endpoint hit.`);

    const { storyHistory, theme } = req.body;
    if (!storyHistory || !Array.isArray(storyHistory) || storyHistory.length === 0) {
        return res.status(400).json({ error: 'storyHistory is invalid.' });
    }

    try {
        // --- 処理を1段階に簡略化 ---
        // AIにプロンプトを作らせる工程を削除。
        // 物語の全文とテーマを基に、簡単な英語プロンプトを直接組み立てる。
        const simplePrompt = `${storyHistory.join('. ')}, theme of ${theme}, cinematic lighting, detailed, photorealistic`;

        console.log(`Simplified Prompt: ${simplePrompt}`); // 生成されるプロンプトをログで確認

        // 組み立てたプロンプトで、直接画像生成をリクエスト
        const imageResponse = await generativeVisionModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: simplePrompt }] }],
            generationConfig: {
                "number_of_images": 1,
                "aspectRatio": "9:16" // 例：縦長の画像を指定
            }
        });

        const imageBase64 = imageResponse.response.candidates?.[0]?.content?.parts?.[0]?.fileData?.data;

        if (!imageBase64) {
            throw new Error('AI from image data could not be retrieved.');
        }

        res.status(200).json({ imageBase64: imageBase64 });

    } catch (error) {
        console.error('画像生成エラー:', error);
        res.status(500).json({ error: 'Failed to generate image on the server.', details: error.message });
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
