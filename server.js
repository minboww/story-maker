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
app.use(express.static(path.join(__dirname, 'public')));

// --- Google Cloud Vertex AI の設定 ---
const PROJECT_ID = process.env.GCP_PROJECT_ID; 
const LOCATION = 'us-central1';
const vertex_ai = new VertexAI({ project: PROJECT_ID, location: LOCATION });
// テキスト生成モデルのみを使用します
const generativeModel = vertex_ai.getGenerativeModel({ model: 'gemini-1.5-flash-001' });

// --- APIエンドポイント ---

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

// ▼▼▼ 新しいAPIエンドポイントを追加 ▼▼▼
app.post('/api/generate-colors', async (req, res) => {
    const { storyHistory, theme } = req.body;
    if (!storyHistory || !theme) {
        return res.status(400).json({ error: 'storyHistory と theme は必須です。' });
    }

    const prompt = `
# Role: あなたは物語の雰囲気を色で表現する、経験豊富なアートディレクターです。
# Instruction: 以下の物語のテーマと本文を読み、現在の展開のムードや雰囲気に最も合うカラーパレットを生成してください。読者の没入感を高めるような配色をお願いします。
# Constraints: 
- 回答は必ず、キーを英語にした1つのJSONオブジェクトのみで返してください。
- JSONオブジェクトは次のキーを必ず含んでください: "bg", "container", "text", "accent", "btn", "btnHover", "boldText"。
- 全ての色は16進数カラーコード（例: "#1a2b3c"）で指定してください。
- 説明やマークダウン、JSONオブジェクト以外のテキストは一切含めないでください。

# Input:
## Theme:
${theme}
## Story So Far:
${storyHistory.join('\n')}

# Output:
`;
    try {
        const geminiResponse = await generativeModel.generateContent(prompt);
        const textResponse = geminiResponse.response.candidates[0].content.parts[0].text;
        const jsonMatch = textResponse.match(/{[\s\S]*}/);
        if (jsonMatch && jsonMatch[0]) {
            res.status(200).json(JSON.parse(jsonMatch[0]));
        } else {
            throw new Error('AIの応答から有効なカラーJSONを見つけられませんでした。');
        }
    } catch (error) {
        console.error('カラー生成エラー:', error);
        res.status(500).json({ error: 'サーバー側でカラーの生成に失敗しました。', details: error.message });
    }
});
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

// どのAPIルートにも一致しない場合、index.htmlを返す
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました。`);
});
