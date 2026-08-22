import 'server-only'
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { type AdminRole, isAdminRole, ADMIN_ROLE_LEVEL } from '@/lib/roles'
import { getJwtSecret } from '@/lib/jwt-secret'

export interface AuthUser {
    id: string
    email: string
    role: AdminRole
    name?: string
}

const adminJwtPayloadSchema = z.object({
    id: z.string().min(1),
    email: z.string().min(1),
    role: z.string().min(1),
})

function mapSessionUserToAuthUser(sessionUser: unknown): AuthUser | null {
    if (!sessionUser || typeof sessionUser !== 'object') return null

    const sessionRecord = sessionUser as Record<string, unknown>
    const rawId = sessionRecord.id
    const rawEmail = sessionRecord.email
    const rawRole = sessionRecord.role
    const rawName = sessionRecord.name

    if (typeof rawId !== 'string' || rawId.length === 0) return null
    if (typeof rawEmail !== 'string' || rawEmail.length === 0) return null
    if (!isAdminRole(rawRole)) return null

    return {
        id: rawId,
        email: rawEmail,
        role: rawRole,
        ...(typeof rawName === 'string' ? { name: rawName } : {}),
    }
}

async function revalidateAuthUser(candidate: AuthUser): Promise<AuthUser | null> {
    try {
        const admin = await db.admin.findUnique({
            where: { id: candidate.id },
            select: { id: true, email: true, name: true, role: true, isActive: true },
        })

        if (!admin || !admin.isActive || !isAdminRole(admin.role)) return null

        return {
            id: admin.id,
            email: admin.email,
            role: admin.role,
            name: admin.name,
        }
    } catch {
        // Fail closed when the current admin status cannot be verified.
        return null
    }
}

/**
 * Unified authentication helper that supports both NextAuth sessions and JWT tokens
 * Checks NextAuth session first, falls back to JWT token from Authorization header
 */
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
    // Try NextAuth session first (route handlers in NextAuth v5 are more reliable with auth() no args)
    try {
        const session = await auth()
        const mappedUser = mapSessionUserToAuthUser(session?.user)
        if (mappedUser) {
            const currentUser = await revalidateAuthUser(mappedUser)
            if (currentUser) return currentUser
        }
    } catch {
        // Continue to request-based auth and then JWT fallback
    }

    // In App Router route handlers, auth() reads the current request context directly.
    // The request-argument overload is limited to Pages Router APIs and is intentionally avoided here.

    // Fall back to JWT token
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null
    }

    const token = authHeader.substring(7)
    try {
        const jwtSecret = getJwtSecret()
        if (!jwtSecret) return null
        const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] })
        const parsed = adminJwtPayloadSchema.safeParse(decoded)
        if (!parsed.success) return null
        if (!isAdminRole(parsed.data.role)) return null
        return revalidateAuthUser({
            id: parsed.data.id,
            email: parsed.data.email,
            role: parsed.data.role,
        })
    } catch {
        return null
    }
}

/**
 * Check if user has required role
 */
export function hasRole(user: AuthUser, allowedRoles: readonly AdminRole[]): boolean
export function hasRole(user: AuthUser, allowedRoles: readonly string[]): boolean
export function hasRole(user: AuthUser, allowedRoles: readonly string[]): boolean {
    return allowedRoles.includes(user.role)
}

/**
 * Check if user can modify target admin (role hierarchy)
 */
export function canModifyAdmin(user: AuthUser, targetRole: AdminRole | string): boolean {
    const target = isAdminRole(targetRole) ? targetRole : null
    const userLevel = ADMIN_ROLE_LEVEL[user.role] ?? 0
    const targetLevel = target ? (ADMIN_ROLE_LEVEL[target] ?? 0) : 0
    return userLevel > targetLevel
}
