import pool from "./db.js";

/**
 * ✅ Creates performance indexes on startup (idempotent)
 * Improves query performance without changing architecture
 */
export const createIndexes = async () => {
  try {
    console.log("🔍 Creating database indexes...");

    const indexes = [
      {
        name: "idx_messages_conversation_created",
        query: `CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
                ON messages(conversation_id, created_at DESC)`,
        purpose: "Optimizes message fetching by conversation"
      },
      {
        name: "idx_messages_sender_created",
        query: `CREATE INDEX IF NOT EXISTS idx_messages_sender_created 
                ON messages(sender_id, created_at DESC)`,
        purpose: "Optimizes sender activity queries"
      },
      {
        name: "idx_conversation_participants_user",
        query: `CREATE INDEX IF NOT EXISTS idx_conversation_participants_user 
                ON conversation_participants(user_id, conversation_id)`,
        purpose: "Optimizes conversation lookups by user"
      },
      {
        name: "idx_conversation_participants_conv",
        query: `CREATE INDEX IF NOT EXISTS idx_conversation_participants_conv 
                ON conversation_participants(conversation_id)`,
        purpose: "Optimizes participant lookups"
      },
      {
        name: "idx_messages_id_unique",
        query: `CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_id_unique ON messages(id)`,
        purpose: "Ensures unique constraint on message ID (prevents duplicates)"
      }
    ];

    for (const index of indexes) {
      await pool.query(index.query);
      console.log(`✅ ${index.name} created (${index.purpose})`);
    }

    console.log("✅ All indexes ready");
  } catch (error) {
    console.warn("⚠️ Index creation warning (may already exist):", error.message);
  }
};
