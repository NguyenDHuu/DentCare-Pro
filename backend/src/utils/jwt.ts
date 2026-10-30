import jwt, { SignOptions } from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET as string
const EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn']

export const signToken = (payload: object) =>
  jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN })

export const verifyToken = (token: string) =>
  jwt.verify(token, SECRET)