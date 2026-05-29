import mysql from 'mysql2/promise';

export const getUsers = async (connection, filters) => {
    const query = "SELECT users.id, users.name, users.email, users.is_active, roles.name as role_name FROM users JOIN roles ON users.role_id = roles.id";
    return (await connection.execute(query))['rows'];
};

export const createUser = async (connection, userData) => {};

export const updateUser = async (connection, identity, userData) => {};

export const deleteUser = async (connection, identity, mode = 'soft') => {};