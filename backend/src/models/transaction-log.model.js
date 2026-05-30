export const addTransactionLog = async (conn, actioner, action, before, after, requestId, sessionId) => {
    const query = `INSERT INTO log_transaction (user_id, event, data_before, data_after, request_id, session_id) VALUES (?, ?, ?, ?, ?, ?)`;
    const values = [actioner, action, JSON.stringify(before), JSON.stringify(after), requestId, sessionId];
    await conn.execute(query, values);
};

export const readLogs = async (conn, filters = {}) => {
    const values = [];
    let query = `SELECT tl.created_at, tl.event, tl.data_before, tl.data_after, tl.request_id, tl.session_id, u.name AS user_name FROM log_transaction tl JOIN users u ON tl.user_id = u.id`;

    if (filters && Object.keys(filters).length > 0) {
        const conditions = Object.entries(filters).map(([key, value]) => {
            values.push(value);
            return `tl.${key} = ?`;
        });
        query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ` ORDER BY tl.created_at DESC`;
    return await conn.execute(query, values);;
};