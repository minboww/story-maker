import express from 'express';
import cors from 'cors';
import { VertexAI } from '@google-cloud/vertexai';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Google Cloud Vertex AI の設定 ---
const PROJECT_ID = process.env.GCP_PROJECT_ID; 
const LOCATION = 'us-central1'; // 必要に応じて変更

const vertex_ai = new VertexAI({ project: PROJECT_ID, location: LOCATION });

const generativeModel = vertex_ai.getGenerativeModel({
    model: 'gemini-1.5-flash-001',
});

const generativeVisionModel = vertex_ai.getGenerativeModel({
    model: 'imagegeneration@0.0.2',
});

// --- ルート定義 ---

/**
 * ルートURL ('/') へのGETリクエスト（ヘルスチェック用）
 */
app.get('/', (req, res) => {
    res.status(200).send('<h1>物語メーカーAPIサーバー</h1><p>正常に動作しています。</p>');
});

/**
 * テキスト生成用のエンドポイント
 */
app.post('/generate-text', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'prompt は必須です。' });
    }

    try {
        const geminiResponse = await generativeModel.generateContent(prompt);
        const textResponse = geminiResponse.response.candidates[0].content.parts[0].text;
        
        // AIの応答からJSON部分だけを抜き出す
        const jsonMatch = textResponse.match(/{[\s\S]*}/);
        
        if (jsonMatch && jsonMatch[0]) {
            res.status(200).json(JSON.parse(jsonMatch[0]));
        } else {
            console.error('無効なJSON応答:', textResponse);
            throw new Error('AIの応答から有効なJSONを見つけられませんでした。');
        }
    } catch (error) {
        console.error('テキスト生成中にエラーが発生しました:', error);
        res.status(500).json({ error: 'サーバー側でテキストの生成に失敗しました。', details: error.message });
    }
});

/**
 * 画像生成用のエンドポイント
 */
app.post('/generate-image', async (req, res) => {
    const { storyHistory, theme } = req.body;
    if (!storyHistory || !theme) {
        return res.status(400).json({ error: 'storyHistory と theme は必須です。' });
    }

    try {
        console.log('1. 画像生成用のプロンプトを作成開始...');

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
        
        console.log(`2. 生成されたプロンプト: "${imagePrompt}"`);
        console.log('3. Imagenに画像生成をリクエスト中...');

        const imageResponse = await generativeVisionModel.generateContent({
            contents: [{
                role: 'user',
                parts: [{ text: imagePrompt }]
            }],
            generationConfig: {
                "number_of_images": 1
            }
        });

        const imageBase64 = imageResponse.response.candidates[0].content.parts[0].fileData.data;

        console.log('4. 画像生成成功。フロントエンドにデータを送信します。');
        
        res.status(200).json({ imageBase64: imageBase64 });

    } catch (error) {
        console.error('画像生成中にエラーが発生しました:', error);
        res.status(500).json({ error: 'サーバー側で画像の生成に失敗しました。', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました。`);
});
