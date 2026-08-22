import 'server-only'

export function getJwtSecret(): string | null {
    return process.env.JWT_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || null
}
