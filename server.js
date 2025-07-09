import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { VertexAI } from '@google-cloud/vertexai';
import { randomUUID } from 'crypto'; // 受付番号を生成するために追加

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
const generativeModel = vertex_ai.getGenerativeModel({ model: 'gemini-2.0-flash-001' });
const generativeVisionModel = vertex_ai.getGenerativeModel({ model: 'imagen-4.0-fast-generate-preview-06-06' });

// --- ▼▼▼ 新しい部分：処理状況を保存する場所 ▼▼▼ ---
// サーバーのメモリ上に一時的に保存します。（サーバーが再起動すると消えます）
const imageGenerationJobs = {};

// --- APIエンドポイント ---

app.post('/api/generate-text', async (req, res) => {
    // この部分は変更なし
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

// --- ▼▼▼ 新しいAPI：画像生成の "受付" をする ▼▼▼ ---
app.post('/api/request-image-generation', (req, res) => {
    console.log(`[${new Date().toISOString()}] /api/request-image-generation endpoint hit.`);
    const { storyHistory, theme } = req.body;

    // 受付番号（Job ID）を生成
    const jobId = randomUUID();

    // 処理状況を「処理中」として保存
    imageGenerationJobs[jobId] = { status: 'pending', data: null };
    
    // すぐに「受付ました」とJob IDをフロントエンドに返す
    res.status(202).json({ jobId });

    // --- バックグラウンドで重い処理を開始 ---
    // ここでは await せずに、処理を開始させるだけ（Fire and Forget）
    (async () => {
        try {
            const simplePrompt = `${storyHistory.join('. ')}, theme of ${theme}, cinematic lighting, detailed, photorealistic`;
            console.log(`[Job ID: ${jobId}] Starting image generation with prompt: ${simplePrompt}`);
            
            const imageResponse = await generativeVisionModel.generateContent({
                contents: [{ role: 'user', parts: [{ text: simplePrompt }] }],
                generationConfig: { "number_of_images": 1, "aspectRatio": "9:16" }
            });

            const imageBase64 = imageResponse.response.candidates?.[0]?.content?.parts?.[0]?.fileData?.data;
            if (!imageBase64) {
                throw new Error('AIから画像データを取得できませんでした。');
            }

            // 処理が成功したら、結果を保存
            imageGenerationJobs[jobId] = { status: 'completed', data: imageBase64 };
            console.log(`[Job ID: ${jobId}] Image generation completed.`);

        } catch (error) {
            console.error(`[Job ID: ${jobId}] Image generation failed:`, error);
            // 処理が失敗したら、ステータスを「失敗」に更新
            imageGenerationJobs[jobId] = { status: 'failed', data: error.message };
        }
    })();
});


// --- ▼▼▼ 新しいAPI：画像生成の "状況確認" をする ▼▼▼ ---
app.get('/api/check-image-status/:jobId', (req, res) => {
    const { jobId } = req.params;
    const job = imageGenerationJobs[jobId];

    if (!job) {
        return res.status(404).json({ status: 'not_found' });
    }

    // 現在の処理状況をフロントエンドに返す
    res.status(200).json(job);
});


// どのAPIルートにも一致しない場合、index.htmlを返す
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました。`);
});
