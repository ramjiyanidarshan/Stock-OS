import mysql from 'mysql2/promise';

export const getUsers = async (connection, filters) => {
    let query = "SELECT users.id, users.name, users.password_hash, users.email, users.is_active, roles.name as role_name FROM users JOIN roles ON users.role_id = roles.id";
    const values = [];
    if(filters) {
        const conditions = [];
        for(const key in filters) {
            conditions.push(`users.${key} = ?`);
            values.push(filters[key]);
        }
        if(conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }
    }
    return await connection.execute(query, values);
};

export const createUser = async (connection, userData) => {};

export const updateUser = async (connection, identity, userData) => {};

export const deleteUser = async (connection, identity, mode = 'soft') => {};