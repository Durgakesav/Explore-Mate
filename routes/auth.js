const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Register a new user
router.post('/register', async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();
        const token = jwt.sign({ _id: user._id.toString() }, process.env.JWT_SECRET || 'your-secret-key',{expiresIn:'1h'});
        res.status(201).json({ user, token });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            throw new Error('Unable to login');
        }

        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) {
            throw new Error('Unable to login');
        }

        const token = jwt.sign({ _id: user._id.toString() }, process.env.JWT_SECRET || 'your-secret-key',{expiresIn:'1h'});
        res.json({ user, token });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router; 