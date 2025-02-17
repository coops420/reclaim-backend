const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const PORT = 5000;

// 🔧 MongoDB Connection
const MONGO_URI = "mongodb://127.0.0.1:27017"; 
const DB_NAME = "reclaim";
let db;

MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(client => {
        db = client.db(DB_NAME);
        console.log("✅ Connected to MongoDB");
    })
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// 🔧 Middleware
app.use(cors());
app.use(bodyParser.json());

// 🟢 Test API
app.get("/", (req, res) => {
    res.send("✅ Server is running.");
});

// 📌 **1. Track a Referral (FORCE INTO LEADERBOARD & PENDING ANNOUNCEMENTS)**
app.post("/api/track-referral", async (req, res) => {
    try {
        const { referrer, referredUser } = req.body;

        if (!referrer || !referredUser) {
            return res.status(400).json({ success: false, message: "Missing referrer or referredUser" });
        }

        // ✅ **Insert Referral**
        await db.collection("referrals").insertOne({
            referrer,
            referredUser,
            timestamp: Date.now(),
            verified: 0, // Default: Unverified
            announced: 0 // Default: Not announced
        });

        // ✅ **Insert into Pending Announcements**
        await db.collection("pending_announcements").insertOne({
            referrer,
            referredUser,
            timestamp: Date.now(),
            announced: false
        });

        // ✅ **Update Leaderboard (Force Add/Increment)**
        await db.collection("leaderboard").updateOne(
            { referrer }, 
            { $inc: { totalReferrals: 1 } }, 
            { upsert: true }
        );

        console.log(`🔄 Referral logged: ${referrer} → ${referredUser}`);
        res.json({ success: true, message: "Referral tracked successfully and added to leaderboard." });

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
        const leaderboard = await db.collection("leaderboard").find().sort({ totalReferrals: -1 }).limit(10).toArray();

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

