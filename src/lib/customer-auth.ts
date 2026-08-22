import 'server-only'
import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { customerAccessSelect, customerProfileSelect, type CustomerAccess } from '@/lib/customer-access'
import { z } from 'zod'
import { getJwtSecret } from '@/lib/jwt-secret'

export interface CustomerTokenPayload {
    id: string
    phone: string
    role: 'CUSTOMER'
    websiteId?: string
    ownerAdminId?: string
    subdomain?: string
}

export async function hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10)
    return bcrypt.hash(password, salt)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
}

export function createCustomerToken(payload: Omit<CustomerTokenPayload, 'role'>): string {
    const jwtSecret = getJwtSecret()
    if (!jwtSecret) {
        throw new Error('JWT_SECRET is not set in environment')
    }
    const tokenPayload: CustomerTokenPayload = {
        ...payload,
        role: 'CUSTOMER'
    }
    return jwt.sign(tokenPayload, jwtSecret, { expiresIn: '30d' }) // Long expiration for mobile app
}

export function verifyCustomerToken(token: string): CustomerTokenPayload | null {
    try {
        const jwtSecret = getJwtSecret()
        if (!jwtSecret) return null
        const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] })
        const parsed = z
            .object({
                id: z.string().min(1),
                phone: z.string().min(1),
                role: z.literal('CUSTOMER')
            })
            .and(z.object({
                websiteId: z.string().min(1).optional(),
                ownerAdminId: z.string().min(1).optional(),
                subdomain: z.string().min(1).optional()
            }))
            .safeParse(decoded)
        if (!parsed.success) return null
        return parsed.data
    } catch {
        return null
    }
}

function getCustomerTokenFromRequest(request: NextRequest): CustomerTokenPayload | null {
    const authHeader = request.headers.get('authorization')
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null
    const cookieToken = request.cookies.get('customerToken')?.value || null
    const payload = verifyCustomerToken(bearerToken || cookieToken || '')

    return payload?.role === 'CUSTOMER' ? payload : null
}

export async function getCustomerFromRequest(request: NextRequest) {
    const payload = getCustomerTokenFromRequest(request)
    if (!payload) return null

    const customer = await db.customer.findUnique({
        where: { id: payload.id, isActive: true, deletedAt: null },
        select: customerProfileSelect,
    })

    if (!customer || !customer.isActive) {
        return null
    }

    return customer
}

export async function getCustomerAccessFromRequest(request: NextRequest): Promise<CustomerAccess | null> {
    const payload = getCustomerTokenFromRequest(request)
    if (!payload) return null

    const customer = await db.customer.findUnique({
        where: { id: payload.id, isActive: true, deletedAt: null },
        select: customerAccessSelect,
    })

    if (!customer || !customer.isActive) {
        return null
    }

    return customer
}
