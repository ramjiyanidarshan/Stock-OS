import { readLogs } from "../models/transaction-log.model.js";

export const getTransactionLogs = async (req, res, next) => {
    try {
        const [logs] = await readLogs(req['x-db-connection']);
        res.status(200).json({ error: false, message: "Request processed successfully.", data: logs });
    } catch (err) {
        console.error(err);
        next(err);
    } finally {
        return res.end();
    }
};