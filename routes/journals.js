const express = require('express');
const router = express.Router();
const Journal = require('../models/journal');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const fs = require('fs');
const path = require('path');

// Test route for image upload
router.post('/test-upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        res.json({ 
            message: 'File uploaded successfully',
            filePath: `/uploads/${req.file.filename}`
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Public route - Get all journals
router.get('/public', async (req, res) => {
    try {
        const journals = await Journal.find();
        res.json(journals);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create a new journal entry
router.post('/', auth, upload.single('image'), async (req, res) => {
    try {
        const journal = new Journal({
            ...req.body,
            image: req.file ? `/uploads/${req.file.filename}` : null,
            owner: req.user._id
        });

        const newJournal = await journal.save();
        res.status(201).json(newJournal);
    } catch (error) {
        // If there's an error, remove the uploaded file if it exists
        if (req.file) {
            fs.unlink(path.join(__dirname, '..', 'uploads', req.file.filename), (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }
        res.status(400).json({ message: error.message });
    }
});

// Get all journal entries for the authenticated user
router.get('/', auth, async (req, res) => {
    try {
        const journals = await Journal.find({ owner: req.user._id });
        res.json(journals);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get a specific journal entry
router.get('/:id', async (req, res) => {
    try {
        const journal = await Journal.findById(req.params.id);
        if (!journal) {
            return res.status(404).json({ message: 'Journal not found' });
        }
        res.json(journal);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update a journal entry
router.patch('/:id', auth, upload.single('image'), async (req, res) => {
    try {
        const journal = await Journal.findOne({ _id: req.params.id, owner: req.user._id });
        if (!journal) {
            return res.status(404).json({ message: 'Journal not found' });
        }

        const updates = { ...req.body };
        if (req.file) {
            // Delete old image if it exists
            if (journal.image) {
                const oldImagePath = path.join(__dirname, '..', journal.image);
                fs.unlink(oldImagePath, (err) => {
                    if (err && err.code !== 'ENOENT') console.error('Error deleting old image:', err);
                });
            }
            updates.image = `/uploads/${req.file.filename}`;
        }

        Object.assign(journal, updates);
        const updatedJournal = await journal.save();
        res.json(updatedJournal);
    } catch (error) {
        if (req.file) {
            fs.unlink(path.join(__dirname, '..', 'uploads', req.file.filename), (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }
        res.status(400).json({ message: error.message });
    }
});

// Delete a journal entry
router.delete('/:id', auth, async (req, res) => {
    try {
        const journal = await Journal.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
        if (!journal) {
            return res.status(404).json({ message: 'Journal not found' });
        }
        res.json({ message: 'Journal deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 