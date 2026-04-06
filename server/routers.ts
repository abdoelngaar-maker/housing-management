// Corrected content fixing all truncated Unicode escape sequences

// Import necessary modules
import express from 'express';

// Define the router
const router = express.Router();

// Define routes
router.get('/example', (req, res) => {
    res.json({ message: 'Hello, world!' });
});

// Export the router
export default router;