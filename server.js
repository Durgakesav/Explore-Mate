const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const userRouter = require('./routes/users');
const journalRouter = require('./routes/journals');
const authRouter = require('./routes/auth');
const chatRouter = require('./routes/chat');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware
const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// Serve static files from the uploads directory
app.use('/uploads', express.static('uploads'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI , {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully'))
.catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/journals', journalRouter);
app.use('/api/chat', chatRouter);

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
    // Serve static files from the React app
    app.use(express.static(path.join(__dirname, 'client/build')));

    // Handle React routing, return all requests to React app
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack || err);
    const status = err.status || 500;
    const message = err.message || 'Something went wrong!';
    res.status(status).json({ message });
});

// Start server with simple port fallback (tries next ports if in use)
async function startServer() {
    const basePort = parseInt(process.env.PORT, 10) || 5000;
    let port = basePort;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
        try {
            const server = app.listen(port, () => {
                console.log(`Server is running on port ${port}`);
            });
            // If we got here, listening succeeded; break loop
            return server;
        } catch (err) {
            if (err && err.code === 'EADDRINUSE') {
                attempts += 1;
                port += 1;
                console.warn(`Port in use. Trying port ${port}...`);
            } else {
                throw err;
            }
        }
    }
    throw new Error(`Unable to bind to any port from ${basePort} to ${basePort + maxAttempts - 1}`);
}

startServer().catch((e) => {
    console.error(e);
    process.exit(1);
}); 