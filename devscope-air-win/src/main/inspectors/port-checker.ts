/**
 * DevScope - Fast Port Checker
 * Uses netstat for faster port checking than creating TCP servers
 */

import { safeExec } from './safe-exec'
import log from 'electron-log'
import { cacheManager } from './cache-manager'

const PORT_CACHE_TTL = 30 * 1000 // 30 seconds (ports can change frequently)

/**
 * Check multiple ports at once using netstat (much faster than TCP server approach)
 * Returns a map of port -> isInUse
 */
export async function checkPorts(ports: number[]): Promise<Map<number, boolean>> {
  const cacheKey = `ports:${ports.join(',')}`
  
  // Check cache first
  const cached = cacheManager.get<Map<number, boolean>>(cacheKey)
  if (cached) {
    return cached
  }
  
  const result = new Map<number, boolean>()
  
  try {
    // Use PowerShell to check listening ports (faster than netstat on Windows)
    const psResult = await safeExec('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {$_.LocalPort -in @(${ports.join(',')})} | Select-Object -ExpandProperty LocalPort`
    ], { timeout: 2000 })
    
    const listeningPorts = psResult.stdout
      .split('\n')
      .map(line => parseInt(line.trim()))
      .filter(port => !isNaN(port))
    
    // Mark all requested ports
    ports.forEach(port => {
      result.set(port, listeningPorts.includes(port))
    })
    
    // Cache the result
    cacheManager.set(cacheKey, result, PORT_CACHE_TTL)
    
    log.debug(`Port check: ${listeningPorts.length}/${ports.length} ports in use`)
  } catch (error) {
    log.debug('Fast port check failed, using fallback:', error)
    // Fallback: assume all ports are not in use
    ports.forEach(port => result.set(port, false))
  }
  
  return result
}

/**
 * Check a single port
 */
export async function isPortInUse(port: number): Promise<boolean> {
  const results = await checkPorts([port])
  return results.get(port) || false
}
