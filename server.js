const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Ensure `MONGO_URI` is pulled from Railway variables correctly
const MONGO_URI = process.env.MONGO_URI;

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
        process.exit(1); // Exit if MongoDB fails to connect
    });

// Middleware
app.use(cors());
app.use(bodyParser.json());

// 🟢 **Health Check API**
app.get("/", (req, res) => {
    res.send("✅ Server is running.");
});

// 🟢 **Test API Endpoint to Check MongoDB Connection**
app.get("/api/ping", async (req, res) => {
    try {
        const test = await db.collection("referrals").findOne({});
        res.json({ success: true, message: "✅ MongoDB is connected!", data: test || {} });
    } catch (error) {
        console.error("❌ Error fetching test data:", error);
        res.status(500).json({ success: false, message: "MongoDB connection error" });
    }
});

// 📌 **1. Track a Referral**
app.post("/api/track-referral", async (req, res) => {
    try {
        const { referrer, referredUser } = req.body;

        if (!referrer || !referredUser) {
            return res.status(400).json({ success: false, message: "Missing referrer or referredUser" });
        }

        await db.collection("referrals").insertOne({
            referrer,
            referredUser,
            timestamp: Date.now(),
            verified: 0, // Default: Unverified
            announced: 0 // Default: Not announced
        });

        console.log(`🔄 Referral logged: ${referrer} → ${referredUser}`);
        res.json({ success: true, message: "Referral tracked successfully." });

    } catch (error) {
        console.error("❌ Error tracking referral:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// 📌 **2. Get Referrals for a Referrer**
app.get("/api/referrals/:referrer", async (req, res) => {
    try {
        const referrer = req.params.referrer;
        const referrals = await db.collection("referrals").find({ referrer }).toArray();
        
        res.json({ success: true, referrals });
    } catch (error) {
        console.error("❌ Error fetching referrals:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// 📌 **3. Get a Wallet's Balance**
app.get("/api/balance/:wallet", async (req, res) => {
    try {
        const wallet = req.params.wallet;
        const user = await db.collection("users").findOne({ wallet });

        res.json({ success: true, balance: user ? user.balance : 0 });
    } catch (error) {
        console.error("❌ Error fetching balance:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// 📌 **4. Mark Referral as Verified**
app.post("/api/verify-referral", async (req, res) => {
    try {
        const { referredUser } = req.body;

        const result = await db.collection("referrals").updateOne(
            { referredUser },
            { $set: { verified: 1 } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: "Referral not found" });
        }

        console.log(`✅ Referral verified: ${referredUser}`);
        res.json({ success: true, message: "Referral verified successfully." });

    } catch (error) {
        console.error("❌ Error verifying referral:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// 📌 **5. Get Pending Announcements**
app.get("/api/pending-announcements", async (req, res) => {
    try {
        const pendingReferrals = await db.collection("referrals").find({ verified: 1, announced: 0 }).toArray();
        res.json({ success: true, pendingReferrals });
    } catch (error) {
        console.error("❌ Error fetching pending announcements:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// 📌 **6. Mark Referral as Announced**
app.post("/api/mark-announced", async (req, res) => {
    try {
        const { referredUser } = req.body;

        const result = await db.collection("referrals").updateOne(
            { referredUser },
            { $set: { announced: 1 } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: "Referral not found" });
        }

        console.log(`📢 Referral announced: ${referredUser}`);
        res.json({ success: true, message: "Referral marked as announced." });

    } catch (error) {
        console.error("❌ Error marking referral as announced:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// 📌 **7. Leaderboard: Top Referrers**
app.get("/api/leaderboard", async (req, res) => {
    try {
        const leaderboard = await db.collection("referrals").aggregate([
            { $match: { verified: 1 } }, 
            { $group: { _id: "$referrer", totalReferrals: { $sum: 1 } } }, 
            { $sort: { totalReferrals: -1 } },
            { $limit: 10 }
        ]).toArray();

        res.json({ success: true, leaderboard });
    } catch (error) {
        console.error("❌ Error fetching leaderboard:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
