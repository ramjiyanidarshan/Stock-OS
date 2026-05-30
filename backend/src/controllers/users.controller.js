import { getUsers, addUser, editUser, removeUsers } from '../models/user.model.js';
import Joi from 'joi';
import { validateRequestPayload } from '../helpers/validation.helper.js';
import { hashPassword } from '../helpers/text.helper.js';
import { addTransactionLog } from '../models/transaction-log.model.js';
const VALIDATION_RULES = {
    list: {},
    create: Joi.object({
        name: Joi.string().min(2).max(100).required(),
        email: Joi.string().min(2).max(254).email().required(),
        password: Joi.string().min(6).required(),
        role_id: Joi.allow("", null).optional(),
        department: Joi.string().max(100).allow('', null)
    }),
    edit: Joi.object({
        name: Joi.string().min(2).max(100).optional(),
        role_id: Joi.allow("", null).optional(),
        department: Joi.string().max(100).allow('', null).optional()
    }),
    delete: Joi.object({
        id: Joi.string().uuid().required()
    }),
};

export const listUsers = async (req, res, next) => {
    try {
        const [users] = await getUsers(req['x-db-connection']);
        res.status(200).json({ error: false, message: "Request processed successfully.", data: users });
    } catch (err) {
        console.error(err);
        next(err);
    } finally {
        return res.end();
    }
};

export const createUser = async (req, res, next) => {
    try {
        let payload = await validateRequestPayload(VALIDATION_RULES.create, req.body);
        payload = { ...payload, role_id: payload.role_id || 1 }; // Default values for testing
        payload.password = await hashPassword(payload.password);
        await addUser(req['x-db-connection'], payload);
        addTransactionLog(req['x-db-connection'], req['x-user']['id'] ?? null, "USER:CREATE", null, JSON.stringify(payload), req['x-request-id'], req['x-session-id'] ?? null);
        res.status(201).json({ error: false, message: "User created successfully." });
    } catch (err) {
        console.error(err);
        next(err);
    } finally {
        return res.end();
    }
};

export const updateUser = async (req, res, next) => {
    try {
        const payload = await validateRequestPayload(VALIDATION_RULES.edit, req.body);
        const userId = req.params.id;
        const [userDetails] = await getUsers(req['x-db-connection'], { id: userId });
        if (!userDetails) throw new Error('User not found.');
        // Only update allowed fields (name, role_id, department). Password and email are not editable here.
        await editUser(req['x-db-connection'], userId, payload);
        addTransactionLog(req['x-db-connection'], req['x-user']['id'] ?? null, "USER:UPDATE", JSON.stringify(userDetails), JSON.stringify(payload), req['x-request-id'], req['x-session-id'] ?? null);
        res.status(200).json({ error: false, message: "User updated successfully." });
    } catch (err) {
        console.error(err);
        next(err);
    } finally {
        return res.end();
    }
};

export const deleteUser = async (req, res, next) => {
    try {
        const payload = await validateRequestPayload(VALIDATION_RULES.delete, req.params);
        if (payload.id === req['x-user'].id) throw new Error('Cannot delete yourself.');
        const [userDetails] = await getUsers(req['x-db-connection'], { id: payload.id });
        if (!userDetails) throw new Error('User not found.');
        await removeUsers(req['x-db-connection'], payload.id);
        addTransactionLog(req['x-db-connection'], req['x-user']['id'] ?? null, "USER:DELETE", JSON.stringify(userDetails), JSON.stringify({ status: 'terminated' }), req['x-request-id'], req['x-session-id'] ?? null);
        res.status(200).json({ error: false, message: "User deleted successfully." });
    } catch (err) {
        console.error(err);
        next(err);
    } finally {
        return res.end();
    }
};