const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
	role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
	content: { type: String, required: true }
}, { timestamps: true });

chatMessageSchema.index({ createdAt: -1 });

const ChatMessage = mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);

module.exports = ChatMessage;




