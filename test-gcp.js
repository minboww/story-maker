import { VertexAI } from '@google-cloud/vertexai';

async function main() {
    console.log('--- GCP Connection Test Start ---');
    
    const PROJECT_ID = process.env.GCP_PROJECT_ID;
    const LOCATION = 'us-central1';

    if (!PROJECT_ID) {
        console.error('Error: GCP_PROJECT_ID environment variable is not set.');
        return;
    }
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.error('Error: GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.');
        return;
    }

    console.log(`Project ID: ${PROJECT_ID}`);
    console.log('Initializing Vertex AI client...');

    try {
        const vertex_ai = new VertexAI({ project: PROJECT_ID, location: LOCATION });
        
        console.log('Client initialized. Getting generative model (gemini-1.0-pro)...');
        
        const generativeModel = vertex_ai.getGenerativeModel({
            model: 'gemini-1.0-pro', // 最も安定しているモデルでテスト
        });

        console.log('Model object created. Sending a simple test prompt...');
        
        const result = await generativeModel.generateContent("Hello.");
        const response = await result.response;
        const text = response.text();

        console.log('SUCCESS! AI Response:', text);
        console.log('--- GCP Connection Test End: OK ---');

    } catch (error) {
        console.error('--- GCP Connection Test End: FAILED ---');
        console.error('Error details:', error);
    }
}

main();
