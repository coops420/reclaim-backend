const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8080; // ✅ Railway-assigned PORT or fallback

// ✅ Use the correct MongoDB URI
const MONGO_URI = process.env.MONGO_URI || "mongodb://mongo:mwEIolzroqgXTxcYPIvBVbdHDtwikDBH@ballast.proxy.rlwy.net:19809";

console.log(`🔹 Using MongoDB URI: ${MONGO_URI}`);

if (!MONGO_URI) {
    console.error("❌ ERROR: Missing MongoDB connection string in environment variables!");
    process.exit(1);
}

let db;

// 🛠 Connect to MongoDB
MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(client => {
        db = client.db();
        console.log("✅ Connected to MongoDB");
    })
    .catch(err => {
        console.error("❌ MongoDB Connection Error:", err);
        process.exit(1); // ❌ Exit if MongoDB fails to connect
    });

// ✅ Middleware
app.use(cors());
app.use(bodyParser.json());

// 🟢 **Health Check API**
app.get("/", (req, res) => {
    res.send("✅ Server is running.");
});

// 🟢 **Test MongoDB Connection**
app.get("/api/ping", async (req, res) => {
    try {
        const test = await db.collection("referrals").findOne({});
        res.json({ success: true, message: "✅ MongoDB is connected!", data: test || {} });
    } catch (error) {
        console.error("❌ Error fetching test data:", error);
        res.status(500).json({ success: false, message: "MongoDB connection error" });
    }
});

// ✅ **Start Server & Listen on 0.0.0.0**
app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
});
