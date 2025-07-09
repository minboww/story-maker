import express from 'express';
import cors from 'cors';
import { VertexAI } from '@google-cloud/vertexai';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors()); // 異なるオリジンからのリクエストを許可
app.use(express.json({ limit: '10mb' })); // リクエストボディをJSONとして解析

// Google Cloudのプロジェクト設定
const PROJECT_ID = process.env.GCP_PROJECT_ID; // Renderの環境変数で設定
const LOCATION = 'us-central1'; // 例: us-central1

// Vertex AI クライアントの初期化
const vertex_ai = new VertexAI({ project: PROJECT_ID, location: LOCATION });
const generativeModel = vertex_ai.getGenerativeModel({
    model: 'gemini-1.5-flash-001',
});
const generativeVisionModel = vertex_ai.getGenerativeModel({
    model: 'imagegeneration@0.0.2', // Imagen 2 モデル
});


// 画像生成エンドポイント
app.post('/generate-image', async (req, res) => {
    const { storyHistory, theme } = req.body;

    if (!storyHistory || !theme) {
        return res.status(400).json({ error: 'storyHistory and theme are required.' });
    }

    try {
        console.log('1. Generating image prompt from story...');
        // ステップ1: 物語から画像生成用のプロンプトを作成
        const promptForImagePrompt = `
            # Role: You are a professional prompt engineer for an image generation AI.
            # Task: Read the following story and generate a highly detailed, artistic, and evocative prompt in English to create a book cover image.
            # Constraints: The prompt must be in English. It should include the main subject, the atmosphere, the style (e.g., oil painting, photorealistic, anime style), and the color palette. It must fit the story's theme: "${theme}".
            # Story:
            ${storyHistory.join('\n')}
            # Output:
        `;
        
        const resp = await generativeModel.generateContent(promptForImagePrompt);
        const imagePrompt = resp.response.candidates[0].content.parts[0].text.trim();
        
        console.log(`2. Generated Prompt: "${imagePrompt}"`);
        console.log('3. Requesting image generation to Imagen...');

        // ステップ2: Imagenで画像を生成
        const imageResponse = await generativeVisionModel.generateContent({
            contents: [{
                role: 'user',
                parts: [{ text: imagePrompt }]
            }],
            generationConfig: {
                "number_of_images": 1 // 生成する画像の数
            }
        });

        // 生成された画像のBase64データを取得
        const imageBase64 = imageResponse.response.candidates[0].content.parts[0].fileData.data;

        console.log('4. Image generated successfully. Sending to frontend.');
        
        // ステップ3: Base64エンコードされた画像データをフロントエンドに返す
        res.json({ imageBase64: imageBase64 });

    } catch (error) {
        console.error('Error during image generation:', error);
        res.status(500).json({ error: 'Failed to generate image.', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
