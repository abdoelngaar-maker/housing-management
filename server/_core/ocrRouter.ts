import express from 'express';
import { OpenAI } from 'openai';

const router = express.Router();

const openai = new OpenAI({ apiKey: 'YOUR_API_KEY' }); // Add your OpenAI API key here

// Function to process OCR using OpenAI API
const processOCR = async (imageUrl) => {
    try {
        const response = await openai.images.ocr({ url: imageUrl });
        return response
    } catch (error) {
        console.error('Error processing OCR:', error);
        throw new Error('حدث خطأ أثناء معالجة الصورة. الرجاء المحاولة مرة أخرى.'); // Arabic error message
    }
};

// Route to handle OCR requests
router.post('/scan', async (req, res) => {
    const { imageUrl } = req.body;

    if (!imageUrl) {
        return res.status(400).json({ error: 'لا يوجد رابط صورة مقدمة.' }); // Arabic error message
    }

    try {
        const result = await processOCR(imageUrl);
        return res.status(200).json({ data: result });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

export default router;
