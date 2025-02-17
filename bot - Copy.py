import asyncio
import logging
from pymongo import MongoClient
from telegram import Bot, Update
from telegram.ext import Application, CommandHandler, CallbackContext
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# =======================
# ✅ Configuration
# =======================
TOKEN = "7347827559:AAEBSZFDABcpEnO_RiwZiN1sKV5gFbPGZQ0"
CHAT_ID = "-1002252985220"
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "reclaim"

# =======================
# ✅ Initialize Logging
# =======================
logging.basicConfig(
    format="%(asctime)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# =======================
# ✅ Initialize Telegram Bot
# =======================
bot = Bot(token=TOKEN)

# =======================
# ✅ Connect to MongoDB
# =======================
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db["pending_announcements"]

# =======================
# ✅ Function: Announce New Referrals
# =======================
async def announce_new_referrals():
    """ Fetch new referrals from MongoDB and announce them in Telegram """
    logger.info("🔄 Checking for new referrals...")

    try:
        pending_referrals = list(collection.find({"announced": False}))

        if not pending_referrals:
            logger.info("❌ No new referrals to announce.")
            return

        for referral in pending_referrals:
            referrer = referral.get("referrer", "Unknown")
            referred = referral.get("referredUser", "Unknown")

            message = f"🎉 *New Referral!*\n🔹 Referrer: `{referrer}`\n🔹 Referred: `{referred}`"

            try:
                await bot.send_message(chat_id=CHAT_ID, text=message, parse_mode="Markdown")
                collection.update_one({"_id": referral["_id"]}, {"$set": {"announced": True}})
                logger.info(f"✅ Announced referral: {referrer} -> {referred}")

            except Exception as e:
                logger.error(f"⚠️ Error sending message: {e}")

    except Exception as e:
        logger.error(f"⚠ MongoDB Query Error: {e}")

# =======================
# ✅ Function: Show Leaderboard
# =======================
async def leaderboard_command(update: Update, context: CallbackContext):
    """ Fetch the top referrers from MongoDB and display the leaderboard """
    logger.info("📊 Fetching leaderboard...")

    try:
        top_referrers = list(db["leaderboard"].find().sort("total_referrals", -1).limit(10))

        if not top_referrers:
            await update.message.reply_text("📊 No referrals yet!")
            return

        leaderboard_text = "🏆 *Leaderboard - Top Referrers:*\n"
        for i, referrer in enumerate(top_referrers, start=1):
            leaderboard_text += f"{i}. `{referrer['referrer']}` - {referrer['total_referrals']} referrals\n"

        await update.message.reply_text(leaderboard_text, parse_mode="Markdown")

    except Exception as e:
        logger.error(f"⚠️ Leaderboard Error: {e}")
        await update.message.reply_text("⚠️ Error fetching leaderboard!")

# =======================
# ✅ Function: Help Command
# =======================
async def help_command(update: Update, context: CallbackContext):
    help_text = (
        "📜 *Available Commands:*\n"
        "🔹 `/refer <Your Name> <Your Wallet> <Their Name> <Their Wallet>` - Submit a referral\n"
        "🔹 `/track <Wallet>` - Check verified referrals for a wallet\n"
        "🔹 `/leaderboard` - View the top referrers\n"
        "🔹 `/adminlog` - Admin-only: View all verified referrals\n"
        "🔹 *Referred users must hold at least $10 USD worth of $CLAIM to be verified!*"
    )
    await update.message.reply_text(help_text, parse_mode="Markdown")

# =======================
# ✅ Function: Track Referrals
# =======================
async def track_referrals(update: Update, context: CallbackContext):
    args = context.args
    if len(args) != 1:
        await update.message.reply_text("❌ Usage: `/track <Wallet>`")
        return

    wallet = args[0]
    try:
        count = db["referrals"].count_documents({"referrer_wallet": wallet, "verified": True})
        if count == 0:
            await update.message.reply_text(f"🔍 No verified referrals found for `{wallet}`")
        else:
            await update.message.reply_text(f"💰 `{wallet}` has `{count}` verified referrals!", parse_mode="Markdown")
    except Exception as e:
        logger.error(f"⚠️ Error checking referrals: {e}")
        await update.message.reply_text("⚠️ Error checking referrals!")

# =======================
# ✅ Function: Start Bot
# =======================
async def start_bot():
    logger.info("🚀 Bot is starting...")

    # Setup APScheduler to check MongoDB every 5 minutes
    scheduler = AsyncIOScheduler()
    scheduler.add_job(announce_new_referrals, "interval", minutes=5)
    scheduler.start()

    # Start the Telegram bot
    application = Application.builder().token(TOKEN).build()
    
    # Add command handlers
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("leaderboard", leaderboard_command))
    application.add_handler(CommandHandler("track", track_referrals))

    # ✅ FIX: Properly handle event loops
    logger.info("✅ Bot is now running!")
    await application.run_polling()

# =======================
# ✅ Run the Bot Properly
# =======================
if __name__ == "__main__":
    import nest_asyncio
    nest_asyncio.apply()  # ✅ FIX: Prevent event loop conflicts

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        loop.run_until_complete(start_bot())
    except KeyboardInterrupt:
        logger.info("🛑 Bot Stopped by User")

