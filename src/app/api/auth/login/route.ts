import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getJwtSecret } from '@/lib/jwt-secret'
const LOGIN_RATE_LIMIT = 10
const LOGIN_WINDOW_MS = 10 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const jwtSecret = getJwtSecret()
    if (!jwtSecret) {
      return NextResponse.json({ error: 'JWT_SECRET is not set in environment' }, { status: 500 })
    }

    const { email, password } = await request.json()
    const ip = getClientIp(request.headers)

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email и пароль обязательны' },
        { status: 400 }
      )
    }

    const limit = checkRateLimit(`admin-login:${ip}:${String(email).toLowerCase()}`, LOGIN_RATE_LIMIT, LOGIN_WINDOW_MS)
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.', retryAfterSec: limit.retryAfterSec },
        { status: 429 }
      )
    }

    const admin = await db.admin.findUnique({
      where: { email }
    })

    if (!admin) {
      return NextResponse.json(
        { error: 'Неверные учетные данные' },
        { status: 401 }
      )
    }

    // Check if user has a password (not OAuth-only user)
    if (!admin.password || !admin.hasPassword) {
      return NextResponse.json(
        { error: 'Этот аккаунт использует вход через Google. Используйте кнопку "Войти через Google"' },
        { status: 401 }
      )
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Неверные учетные данные' },
        { status: 401 }
      )
    }

    if (!admin.isActive) {
      return NextResponse.json(
        { error: 'Аккаунт деактивирован' },
        { status: 401 }
      )
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      jwtSecret,
      { expiresIn: '24h' }
    )

    await db.actionLog.create({
      data: {
        adminId: admin.id,
        action: 'LOGIN',
        entityType: 'ADMIN',
        entityId: admin.id,
        description: `Admin ${admin.name} logged in`
      }
    })

    return NextResponse.json({
      token,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        trialEndsAt: admin.trialEndsAt || null
      }
    })

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
