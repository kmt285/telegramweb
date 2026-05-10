const mongoose = require('mongoose');

const webSessionSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true, unique: true },
    indexedDbData: { type: String, required: true }, // IndexedDB က Data အကုန်လုံးကို String အနေနဲ့ သိမ်းမည်
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WebSession', webSessionSchema);
