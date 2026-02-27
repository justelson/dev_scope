export type ParsedPairingLink = {
  pairingId: string
  token: string
}

export function parsePairingDeepLink(link: string): ParsedPairingLink | null {
  try {
    const url = new URL(link)
    const pairingId = url.searchParams.get('pairingId')?.trim() || ''
    const token = url.searchParams.get('token')?.trim() || ''
    if (!pairingId || !token) return null
    return { pairingId, token }
  } catch {
    return null
  }
}
