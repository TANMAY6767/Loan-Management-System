import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sendResponse } from '../utils/sendResponse.js';
import { statusType } from '../utils/statusType.js';

export const login = asyncHandler(async(req,res) => {
    const { username, password } = req.body || {};
    const user = await prisma.user.findUnique({
        where: { 
            username: String(username || '').trim().toLowerCase() 
        },
        include: { office: true },
    });

    if (!user || !(await bcrypt.compare(String(password || ''), user.password))) {
        throw new ApiError(statusType.UNAUTHORIZED, 'Username or password is incorrect.');
    }
    const safeUser = {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        officeId: user.officeId,
        office: user.office.name,
        managerId: user.managerId,
    };

    const token = jwt.sign(safeUser, process.env.JWT_SECRET, { expiresIn: '12h' });
    return sendResponse(
        res, 
        true, 
        { token, user: safeUser }, 
        'Login successful.'
    );
})

export const getCurrentUser = asyncHandler(async (req, res) => {
  return sendResponse(res, true, { user: req.user }, 'Current user loaded.');
});