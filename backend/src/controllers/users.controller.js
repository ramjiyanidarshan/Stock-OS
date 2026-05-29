import { getUsers } from '../models/user.model.js';

export const listUsers = async (req, res, next) => {
    try{
        log.info(`User ${req.user.email} requested user list`);
        const users = await getUsers(req.db);
        res.status(200).json(users);
    } catch(err){
        console.error(err);
        next(err);
    } finally {
        return res.end();
    }
};

export const createUser = async (req, res, next) => {
    try{
        // const newUser = await createUser(req.db, req.body);
    } catch(err){
        console.error(err);
        next(err);
    } finally {
        return res.end();
    }
};

export const updateUser = async (req, res, next) => {
    try{

    } catch(err){
        console.error(err);
        next(err);
    } finally {
        return res.end();
    }
};

export const deleteUser = async (req, res, next) => {
    try{

    } catch(err){
        console.error(err);
        next(err);
    } finally {
        return res.end();
    }
};