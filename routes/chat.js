const express = require('express');
const router = express.Router();
const axios = require('axios');
const Journal = require('../models/Journal');
const ChatMessage = require('../models/ChatMessage');
const jwt = require('jsonwebtoken');

const AI_BASE_URL = process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1/chat/completions';
const AI_MODEL = process.env.AI_MODEL || 'groq/compound';
const modelToUse = /llama3-70b-8192/i.test(AI_MODEL) ? 'groq/compound' : AI_MODEL;

// Helper to build context from journals (simple RAG)
// IMPORTANT: Only use PUBLIC journals (no private/user-specific data)
async function buildContext(query, _userId) {
    try {
        const criteria = {}; // public-only context
        const safeTerms = String(query || '').split(/\s+/).slice(0, 6).filter(Boolean);
        if (!safeTerms.length) return '';
        const regex = new RegExp(safeTerms.join('|'), 'i');
        const journals = await Journal.find({
            ...criteria,
            $or: [
                { title: regex },
                { description: regex },
                { location: regex }
            ]
        })
        .limit(5)
        .select('title description location date');

        if (!journals.length) return '';
        const blocks = journals.map(j => {
            return `Title: ${j.title}\nLocation: ${j.location}\nDate: ${new Date(j.date).toDateString()}\nNotes: ${j.description}`;
        });
        return `Relevant user journals (use only if helpful):\n\n${blocks.join('\n\n---\n\n')}`;
    } catch (_) {
        return '';
    }
}

// Public endpoint; if Authorization provided, we include user's journals in context
router.post('/', async (req, res) => {
	try {
		const { message, history } = req.body || {};
		if (!message || typeof message !== 'string') {
			return res.status(400).json({ message: 'message is required' });
		}

    // Optional user extraction without invoking middleware (avoid double responses)
    let userId = null;
    try {
        const authHeader = req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.replace('Bearer ', '');
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            userId = decoded.userId || decoded._id || null;
        }
    } catch (_) {
        // ignore invalid tokens
    }

		const context = await buildContext(message, userId);

        const systemPrompt = `You are Explore Mate, the AI assistant for a travel journal web application. Your role is to guide users on how to use the app effectively.

APP OVERVIEW:
Explore Mate is a full-stack MERN (MongoDB, Express, React, Node.js) travel journal application where users can document their travel experiences with photos, locations, and descriptions.

AUTHENTICATION & USER MANAGEMENT:
- Registration: Users can register with username, email, and password (minimum 6 characters). Endpoint: POST /api/users/register
- Login: Users log in with email and password. Endpoint: POST /api/users/login
- Profile: Authenticated users can view their profile. Endpoint: GET /api/users/profile (requires JWT token)
- Logout: Users can log out, which clears their session token

JOURNAL MANAGEMENT:
- Create Journal: Authenticated users can create travel journals with:
  * Title (required)
  * Description (required)
  * Location (required) - format: "City, Country"
  * Date (required)
  * Image upload (optional) - supports image files
  Endpoint: POST /api/journals (requires authentication, multipart/form-data)
  
- View All Journals: Authenticated users see only their own journals. Endpoint: GET /api/journals (requires authentication)
- View Public Journals: Anyone can view all public journals on the home page. Endpoint: GET /api/journals/public
- View Single Journal: Get details of a specific journal by ID. Endpoint: GET /api/journals/:id
- Update Journal: Edit an existing journal (only the owner can update). Endpoint: PATCH /api/journals/:id (requires authentication)
- Delete Journal: Remove a journal (only the owner can delete). Endpoint: DELETE /api/journals/:id (requires authentication)

APP FEATURES:
1. Interactive Maps: Journals are displayed on an interactive map using Leaflet/OpenStreetMap. Each journal location is geocoded and shown as a marker.
2. Image Uploads: Users can upload images when creating or editing journals. Images are stored in /uploads directory and served at /uploads/:filename
3. Search Functionality: Home page has a search bar to filter journals by title, location, or description
4. Responsive Design: The app works on desktop and mobile devices
5. Chat History: User conversations with you are saved and can be retrieved on next visit

NAVIGATION & ROUTES:
- / (Home) - Public page showing all journals on a map with search
- /login - Login page
- /register - Registration page
- /journals - User's private journal list (requires login)
- /journals/new - Create new journal form (requires login)
- /journals/:id - View journal details
- /journals/:id/edit - Edit journal form (requires login, owner only)

CHATBOT CAPABILITIES:
- You must NOT access or use any private journals or personal data
- You may only use PUBLIC journal content provided in system context
- You can provide generalized suggestions and app guidance without private data
- You can help with app navigation and feature explanations
- You can suggest travel ideas, summarize journals, and help plan trips
- Your conversation history is saved per user

GUIDANCE STYLE:
- Be friendly, concise, and actionable
- Use bullet points for step-by-step instructions
- Reference specific features and routes when helping with navigation
- When users ask about their journals, use the provided context from their actual journals
- If asked about features not in this app, politely redirect to supported features
- Always encourage users to explore the app's features

IMPORTANT:
- Only provide information about this app's actual features
- Do not invent features that don't exist
- When users ask "how do I...", provide clear step-by-step guidance
- Reference the user's actual journals when relevant (from context provided)
- Keep responses helpful and encouraging`;

		const messages = [
			{ role: 'system', content: systemPrompt },
			context ? { role: 'system', content: context } : null,
			...(Array.isArray(history) ? history : []).slice(-10),
			{ role: 'user', content: message }
		].filter(Boolean);

    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
        // Graceful fallback without external call
        const fallback = [
            'I cannot reach the AI service right now, but here are some ideas:',
            '-',
            '- Beach escapes: Bali, Costa Rica, Maldives',
            '- City breaks: Tokyo, Barcelona, New York',
            '- Nature trips: Iceland, New Zealand, Banff',
            '',
            'Tip: Ask me to plan a 3-day itinerary or summarize one of your journals.'
        ].join('\n');
        return res.json({ reply: fallback });
    }

        const response = await axios.post(
			AI_BASE_URL,
            {
                model: modelToUse,
				messages,
				temperature: 0.3,
				max_tokens: 800,
				stream: false
			},
			{
				headers: {
					'Authorization': `Bearer ${apiKey}`,
					'Content-Type': 'application/json'
				}
			}
		);

        const text = response.data?.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';

        // Persist user and assistant messages if we have a userId
        if (userId) {
            try {
                if (history && Array.isArray(history)) {
                    // Optionally persist last 1-2 history items if they belong to the user
                }
                await ChatMessage.create({ userId, role: 'user', content: message });
                await ChatMessage.create({ userId, role: 'assistant', content: text });
            } catch (_) {}
        }

        return res.json({ reply: text });
    } catch (error) {
        try {
            console.error('Chat error:', error.response?.data || error.message);
        } catch (_) {}
        // Fallback response if API call fails
        const generic = 'I had trouble contacting the AI service. Here are some quick ideas to get you started:\n\n- Weekend escape nearby based on your recent journals\n- Top 3 locations similar to your last trip\n- Packing checklist for your next destination\n\nYou can also try again in a moment.';
        // Save fallback as assistant message if user is known
        try { if (userId) { await ChatMessage.create({ userId, role: 'user', content: (req.body && req.body.message) || '' }); await ChatMessage.create({ userId, role: 'assistant', content: generic }); } } catch (_) {}
        return res.json({ reply: generic });
    }
});

// Return last N messages for the authenticated user
router.get('/history', async (req, res) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Please authenticate' });
        }
        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const userId = decoded.userId || decoded._id;
        if (!userId) return res.status(401).json({ message: 'Please authenticate' });

        const limit = Math.min(parseInt(req.query.limit || '30', 10), 100);
        const items = await ChatMessage.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
        const messages = items.reverse().map(m => ({ role: m.role, content: m.content }));
        return res.json({ messages });
    } catch (e) {
        return res.status(500).json({ message: 'Unable to load history' });
    }
});

module.exports = router;

