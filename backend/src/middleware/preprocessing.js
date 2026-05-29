import {getConnectionFromPool, startTransaction, commitTransaction, rollbackTransaction, releaseConnection} from '../services/database.js';
import {v4} from 'uuid';

export const preProcessingTheRequest = async (req, res, next) => {
    const startTime = Date.now();
    console.log(`[${new Date(startTime).toISOString()}] ${req.method} ${req.originalUrl}`);
    req['x-request-id'] = v4();
    res.setHeader('X-Request-ID', req['x-request-id']);
    
    // 1. get the database connection
    req['x-db-connection'] = await getConnectionFromPool();
    
    // 2. if request type is not "GET" start a database transaction.
    if (req.method !== 'GET') req['x-db-transaction'] = await startTransaction(req['x-db-connection']);
    
    // 3. set the finish listener to commit or rollback the transaction based on the response status code.
    res.on('finish', async () => {
        if (req.method !== 'GET') {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                await commitTransaction(req['x-db-transaction']);
            } else {
                await rollbackTransaction(req['x-db-transaction']);
            }
        }
        await releaseConnection(req['x-db-connection']);
    });
    next();
};

export const errorHandler = (err, req, res, next) => {
    if(process.env.NODE_ENV !== 'production') console.error(err);
    return res.status(500).json({error: true, message: process.env.NODE_ENV !== 'production'? 'Internal server error': err.message});
};

export const notFoundHandler = (req, res, next) => {
    return res.status(404).json({error: true, message: 'Opps! The requested resource was not found :(\n'});
};