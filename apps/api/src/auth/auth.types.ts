export type CurrentUser = {
  sub: string
  email?: string
  name?: string
  roles: string[]
  raw: Record<string, unknown>
}
