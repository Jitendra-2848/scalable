import pool from "../config/db.js";

const getUser = async (req, res) => {
  try {
    // console.log(req.body);
    const { search } = req.body;
    const result = await pool.query("select * from users where email ~* $1 AND id <> $2", ['^' + search, req.user.id]);
    const data = result.rows;
    return res.status(200).json({ message: "search successfull", data: data });
    // const {} = req.body;
  } catch (error) {
    console.log(error);
    return res.status(500).json({ messgae: "internal server error" });
  }
}
const getMyUser = async (req, res) => {
  try {
    const users = await pool.query(`
      SELECT DISTINCT ON (cp.conversation_id)
    u.id AS user_id,
    u.name,
    u.email,
    cp.conversation_id,
    m.message AS last_message,
    m.created_at AS last_message_time
FROM conversation_participants cp
JOIN users u ON u.id = cp.user_id
LEFT JOIN LATERAL (
    SELECT message, created_at
    FROM messages
    WHERE conversation_id = cp.conversation_id
    ORDER BY created_at DESC
    LIMIT 1
) m ON true
WHERE cp.conversation_id IN (
    SELECT conversation_id 
    FROM conversation_participants 
    WHERE user_id = $1
)
AND cp.user_id <> $1
ORDER BY cp.conversation_id, last_message_time DESC;
    `, [req.user.id]);
      console.log(users.rows);
    return res.status(200).json({
      message: "Users you chatted with",
      data: users.rows
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "internal server error" });
  }
};

export {
  getUser,
  getMyUser
}