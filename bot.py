import asyncio
import logging
import nest_asyncio
from pymongo import MongoClient
from telegram import Bot, Update
from telegram.ext import Application, CommandHandler, CallbackContext
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# ✅ Apply nest_asyncio to fix "Event loop already running" errors
nest_asyncio.apply()

# ✅ Telegram Bot API Token & Chat ID
TOKEN = "7347827559:AAEBSZFDABcpEnO_RiwZiN1sKV5gFbPGZQ0"
CHAT_ID = "-1002252985220"

# ✅ MongoDB Connection
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "reclaim"

# ✅ Setup Logging
logging.basicConfig(
    format="%(asctime)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# ✅ Initialize Telegram Bot
bot = Bot(token=TOKEN)

# ✅ Connect to MongoDB
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db["pending_announcements"]

# ✅ Announce New Referrals from MongoDB
async def announce_new_referrals():
    """ Check for new referrals and announce them in Telegram chat """
    logger.info("🔄 Checking for new referrals...")

    pending_referrals = list(collection.find({"announced": False}))

    if not pending_referrals:
        logger.info("❌ No new referrals to announce.")
        return

    for referral in pending_referrals:
        referrer = referral["referrer"]
        referred = referral["referredUser"]

        message = f"🎉 *New Referral!*\n🔹 Referrer: `{referrer}`\n🔹 Referred: `{referred}`"
        
        try:
            await bot.send_message(chat_id=CHAT_ID, text=message, parse_mode="Markdown")
            collection.update_one({"_id": referral["_id"]}, {"$set": {"announced": True}})
            logger.info(f"✅ Announced {referrer} -> {referred}")
        except Exception as e:
            logger.error(f"⚠️ Error sending message: {e}")

# ✅ Command: Help
async def help_command(update: Update, context: CallbackContext):
    help_text = (
        "📌 *Available Commands:*\n"
        "✅ /refer `<Your Name>` `<Your Wallet ID>` `<Their Name>` `<Their Wallet ID>` - Add a referral\n"
        "✅ /leaderboard - View the top referrers\n"
        "✅ /track `<Wallet ID>` - Check your verified referrals\n"
        "📢 *Referrals must hold at least $10 worth of $CLAIM to be verified!*"
    )
    await update.message.reply_text(help_text, parse_mode="Markdown")

# ✅ Command: Leaderboard
async def leaderboard_command(update: Update, context: CallbackContext):
    leaderboard = list(db["referrals"].aggregate([
        {"$group": {"_id": "$referrer", "total_referrals": {"$sum": 1}}},
        {"$sort": {"total_referrals": -1}},
        {"$limit": 10}
    ]))

    if not leaderboard:
        await update.message.reply_text("🏆 No referrals yet!")
        return

    leaderboard_text = "🏆 *Leaderboard - Top Referrers:*\n"
    for i, entry in enumerate(leaderboard, start=1):
        leaderboard_text += f"{i}. {entry['_id']} - {entry['total_referrals']} referrals\n"
    
    await update.message.reply_text(leaderboard_text, parse_mode="Markdown")

# ✅ Command: Track Referrals
async def track_referrals(update: Update, context: CallbackContext):
    args = context.args
    if len(args) != 1:
        await update.message.reply_text("❌ Incorrect format! Use: `/track <Wallet ID>`", parse_mode="Markdown")
        return
    
    wallet = args[0]
    count = db["referrals"].count_documents({"referrer_wallet": wallet, "verified": True})

    if count == 0:
        await update.message.reply_text(f"🔍 No verified referrals found for wallet `{wallet}`!", parse_mode="Markdown")
    else:
        await update.message.reply_text(f"💰 Wallet `{wallet}` has `{count}` verified referrals!", parse_mode="Markdown")

# ✅ Start the Bot
async def main():
    logger.info("🚀 Bot is starting...")

    # ✅ Start Scheduler for auto-announcements
    scheduler = AsyncIOScheduler()
    scheduler.add_job(announce_new_referrals, "interval", minutes=1)
    scheduler.start()

    # ✅ Telegram Command Handlers
    application = Application.builder().token(TOKEN).build()
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("leaderboard", leaderboard_command))
    application.add_handler(CommandHandler("track", track_referrals))

    logger.info("✅ Bot is running...")

    # ✅ Run the Telegram Bot
    await application.run_polling()

# ✅ Run the bot (Fix event loop issue)
if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(main())
    except RuntimeError:
        logger.error("❌ Event loop error: Cannot close a running event loop")

