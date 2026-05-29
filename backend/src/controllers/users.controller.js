import { getUsers } from '../models/user.model.js';

export const listUsers = async (req, res, next) => {
    try{
        const [users] = await getUsers(req['x-db-connection']);
        res.status(200).json({error: false, message: "Request processed successfully.", data:users});
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