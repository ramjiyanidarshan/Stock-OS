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

/**
 * Builds query parts based on the provided flags and their definitions
 * @param {*} flags Array 
 * @param {*} flagDefinitions Object defining the available flags, their select fields and joins
 * @param {*} defaultFields Array of fields to include by default
 * @returns Object containing the combined fields and joins for the query
 */
export const buildFlagQueryParts = (flags = [], flagDefinitions = {}, defaultFields = []) => {
    const normalizedFlags = Array.isArray(flags) ? flags : [flags];
    const selectedFields = new Set(defaultFields);
    const joinMap = new Map();

    normalizedFlags.forEach((flag) => {
        const definition = flagDefinitions[flag];
        if (!definition) return;

        if (Array.isArray(definition.select)) {
            definition.select.forEach((column) => selectedFields.add(column));
        }

        if (Array.isArray(definition.joins)) {
            definition.joins.forEach((join) => {
                const joinKey = join.alias || join.table;
                if (!joinMap.has(joinKey)) {
                    joinMap.set(joinKey, join);
                }
            });
        }
    });

    return {
        fields: [...selectedFields].join(', '),
        joins: [...joinMap.values()],
    };
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