import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"

const API_BASE = process.env.CHRONOSOPS_API_BASE || "http://localhost:4000"

async function handleRequest(
  req: NextRequest,
  params: { path: string[] }
) {
  const token = await getToken({ 
    req: req as any, 
    secret: process.env.NEXTAUTH_SECRET 
  })
  const accessToken = (token as any)?.accessToken

  const path = params.path.join("/")
  const url = `${API_BASE}/${path}${req.nextUrl.search}`

  const headers: HeadersInit = {
    "Content-Type": req.headers.get("content-type") || "application/json",
  }

  // For Keycloak SSO, use the access token
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`
  } 
  // For credentials-based auth (dev-admin), we don't have a real JWT
  // The API should have AUTH_REQUIRED=false for this to work, or implement
  // a dev token generator
  else if (token && (token as any).sub === "dev-admin") {
    // For dev credentials, we can create a simple mock token
    // In production, you'd want to generate a proper JWT
    // For now, API must have AUTH_REQUIRED=false to allow this
    headers["X-Dev-User"] = "dev-admin"
  }

  const body = req.method !== "GET" && req.method !== "HEAD" 
    ? await req.text() 
    : undefined

  const res = await fetch(url, {
    method: req.method,
    headers,
    body,
  })

  const responseBody = await res.text()
  
  return new NextResponse(responseBody, {
    status: res.status,
    statusText: res.statusText,
    headers: {
      "Content-Type": res.headers.get("content-type") || "application/json",
    },
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  const resolvedParams = await Promise.resolve(params)
  return handleRequest(req, resolvedParams)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  const resolvedParams = await Promise.resolve(params)
  return handleRequest(req, resolvedParams)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  const resolvedParams = await Promise.resolve(params)
  return handleRequest(req, resolvedParams)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  const resolvedParams = await Promise.resolve(params)
  return handleRequest(req, resolvedParams)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  const resolvedParams = await Promise.resolve(params)
  return handleRequest(req, resolvedParams)
}
