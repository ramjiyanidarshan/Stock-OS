export const morphText = (text, numberOfCharacters = 3, separator = '*') => {
    if (!text) return '';
    const visiblePart = text.slice(0, numberOfCharacters);
    const lastVisiblePart = text.length > numberOfCharacters + 1 ? text.slice(numberOfCharacters * -1) : '';
    const morphPartLength = text.length - visiblePart.length - lastVisiblePart.length;
    const morphPart = separator.repeat(morphPartLength > 0 ? morphPartLength : 0);
    return `${visiblePart}${morphPart}${lastVisiblePart}`;
}

import bcrypt from 'bcryptjs';

export const hashPassword = async (password, rounds = 12) => {
    if (!password) throw new Error('Password is required for hashing');
    return await bcrypt.hash(password, rounds);
};

export const comparePassword = async (plain, hash) => {
    if (!plain || !hash) return false;
    return await bcrypt.compare(plain, hash);
};