import Joi from 'joi';

export const validateRequestPayload = async (schema, payload = {}) => {
    if (!schema || typeof schema.validate !== 'function') {
        throw new TypeError('A Joi schema object is required for validation');
    }

    const { error, value } = schema.validate(payload, {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true,
    });

    if (error) {
        const details = error.details.map(detail => detail.message);
        const validationError = new Error('Validation failed');
        validationError.status = 400;
        validationError.details = details;
        validationError.message = details.join(', ');
        throw validationError;
    }

    return value;
};

export const validateBody = (schema) => (req, res, next) => {
    try {
        req.validatedBody = validateRequestPayload(schema, req.body);
        return next();
    } catch (err) {
        return res.status(err.status || 400).json({ error: true, message: err.message, details: err.details });
    }
};
