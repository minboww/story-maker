import express from 'express';
import cors from 'cors';
import { VertexAI } from '@google-cloud/vertexai';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// cors() は異なるドメインからのリクエストを許可するために必要です。
// (例: index.htmlがGitHub Pagesにあり、サーバーがRender.comにある場合など)
app.use(cors());
// リクエストのボディがJSON形式であることをサーバーに伝え、サイズ上限を10MBに設定します。
app.use(express.json({ limit: '10mb' }));

// --- Google Cloud Vertex AI の設定 ---
// Render.comの環境変数からプロジェクトIDとロケーションを取得します。
const PROJECT_ID = process.env.GCP_PROJECT_ID; 
const LOCATION = 'us-central1'; // 必要に応じて変更してください

// Vertex AI クライアントの初期化
// 環境変数 GOOGLE_APPLICATION_CREDENTIALS が設定されていれば、自動で認証情報を読み込みます。
const vertex_ai = new VertexAI({ project: PROJECT_ID, location: LOCATION });

// テキスト生成用のモデル (Gemini)
const generativeModel = vertex_ai.getGenerativeModel({
    model: 'gemini-1.5-flash-001',
});

// 画像生成用のモデル (Imagen)
const generativeVisionModel = vertex_ai.getGenerativeModel({
    model: 'imagegeneration@0.0.2',
});


// --- ルート定義 ---

/**
 * ルートURL ('/') へのGETリクエストを処理します。
 * サーバーが正常に動作しているかを確認するためのヘルスチェック用エンドポイントです。
 * ブラウザでサーバーのURLに直接アクセスすると、このメッセージが表示されます。
 */
app.get('/', (req, res) => {
    res.status(200).send('<h1>物語メーカー画像生成サーバー</h1><p>このサーバーは正常に動作しています。</p>');
});


/**
 * '/generate-image' へのPOSTリクエストを処理します。
 * フロントエンドから物語のテキストを受け取り、画像を生成して返します。
 */
app.post('/generate-image', async (req, res) => {
    // リクエストのボディから物語の履歴とテーマを取得します。
    const { storyHistory, theme } = req.body;

    // 必要なデータが送られてきていない場合は、エラーを返します。
    if (!storyHistory || !theme) {
        return res.status(400).json({ error: 'storyHistory と theme は必須です。' });
    }

    try {
        console.log('1. 画像生成用のプロンプトを作成開始...');

        // ステップ1: 物語から画像生成用の詳細なプロンプトを作成
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

        // ステップ2: 生成されたプロンプトを使ってImagenで画像を生成
        const imageResponse = await generativeVisionModel.generateContent({
            contents: [{
                role: 'user',
                parts: [{ text: imagePrompt }]
            }],
            generationConfig: {
                "number_of_images": 1 // 生成する画像の数
            }
        });

        // 生成された画像のBase64エンコードされたデータを取得します。
        const imageBase64 = imageResponse.response.candidates[0].content.parts[0].fileData.data;

        console.log('4. 画像生成成功。フロントエンドにデータを送信します。');
        
        // ステップ3: Base64形式の画像データをフロントエンドに返します。
        res.status(200).json({ imageBase64: imageBase64 });

    } catch (error) {
        console.error('画像生成中にエラーが発生しました:', error);
        res.status(500).json({ error: 'サーバー側で画像の生成に失敗しました。', details: error.message });
    }
});

// 指定されたポートでサーバーを起動します。
app.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました。`);
});
