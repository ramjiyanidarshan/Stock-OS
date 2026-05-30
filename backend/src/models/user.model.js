import { buildFlagQueryParts } from '../services/database.js';
import { v4 } from 'uuid';
const BASE_FIELDS = [
    'users.id',
    'users.name',
    'users.department',
    'users.email',
    'users.status',
    'roles.name AS role_name',
];

const FLAGS = {
    FETCH_PASSWORD_HASH: {
        desc: 'Include password_hash in the returned user objects (excluded by default for security)',
        select: ['users.password_hash'],
        joins: [],
    },
    FETCH_PERMISSIONS: {
        desc: 'Include permissions in the returned user objects (excluded by default for security)',
        select: ['users.permissions'],
        joins: [],
    },
    FETCH_SESSIONS: {
        desc: 'Include active sessions in the returned user objects (excluded by default for security)',
        select: [
            'sessions.id AS session_id',
            'sessions.device',
            'sessions.expires_at',
            'sessions.last_active_at',
        ],

        joins: [
            {
                type: 'LEFT JOIN',
                table: 'users_sessions',
                alias: 'sessions',
                condition: 'sessions.user_id = users.id',
            },
        ],
    },
};


export const getUsers = async (connection, filters = { status: 'active' }, flags = []) => {
    const values = [];
    const { fields, joins } = buildFlagQueryParts(flags, FLAGS, BASE_FIELDS);

    let query = `SELECT ${fields} FROM users JOIN roles ON users.role_id = roles.id`;

    joins.forEach((join) => {
        const aliasClause = join.alias && join.alias !== join.table ? ` AS ${join.alias}` : '';
        query += ` ${join.type} ${join.table}${aliasClause} ON ${join.condition}`;
    });

    if (filters && Object.keys(filters).length > 0) {
        const conditions = Object.entries(filters).map(([key, value]) => {
            values.push(value);
            return `users.${key} = ?`;
        });
        query += ` WHERE ${conditions.join(' AND ')}`;
    }

    return await connection.execute(query, values);
};

export const addUser = async (connection, userData) => {
    return await connection.execute(
        `INSERT INTO users (id, name, email, password_hash, role_id, department) VALUES (?, ?, ?, ?, ?, ?)`,
        [v4(), userData.name, userData.email, userData.password, userData.role_id, userData.department]
    );
};

export const editUser = async (connection, identity, userData) => {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(userData)) {
        if (value !== undefined) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
    }
    if (fields.length === 0) return; // Nothing to update
    values.push(identity); // For WHERE clause
    return await connection.execute(
        `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
        values
    );
};

export const removeUsers = async (connection, identity, mode = 'soft') => {
    if (mode === 'soft')
        return await editUser(connection, identity, { status: 'terminated' });
    else
        return await connection.execute(`DELETE FROM users WHERE id = ?`, [identity]);
};