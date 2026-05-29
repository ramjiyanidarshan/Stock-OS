import mysql from 'mysql2/promise';

let DATABASE_CONNECTION_POOL;

const getConnectionPool = async () => {
    DATABASE_CONNECTION_POOL = await mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
};

export const getConnectionFromPool = async () => {
    if (!DATABASE_CONNECTION_POOL) {
        await getConnectionPool();
    }
    return await DATABASE_CONNECTION_POOL.getConnection();
};

export const startTransaction = async (conn) => {
    await conn.beginTransaction();
    return conn;
};

export const commitTransaction = async (conn) => {
    return await conn.commit();
};

export const rollbackTransaction = async (conn) => {
    return await conn.rollback();
};

export const releaseConnection = async (conn) => {
    return await conn.release();
};