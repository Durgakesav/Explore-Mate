const mongoose = require('mongoose');

const journalSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    images: [{
        type: String
    }],
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    image: {
        type: String, // This will store the path to the uploaded image
        required: true
    }
}, {
    timestamps: true
});


journalSchema.index({image:1})
journalSchema.index({images:1})
journalSchema.index({owner:1})
const Journal = mongoose.model('Journal', journalSchema);

module.exports = Journal; 