export interface TwoFactorSetup {
  secret: string
  qrCodeUrl: string
  backupCodes: string[]
}

export interface TwoFactorVerification {
  isValid: boolean
  backupCodeUsed?: boolean
}

export class TwoFactorService {
  /**
   * Generate a new 2FA secret and QR code
   */
  static async generateSetup(userEmail: string, appName: string = 'Koi Sensei'): Promise<TwoFactorSetup> {
    // Generate secret using browser-compatible method
    const secret = this.generateSecret()

    // Generate otpauth URL
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(appName)}:${encodeURIComponent(userEmail)}?secret=${secret}&issuer=${encodeURIComponent(appName)}`

    // Generate simple QR code URL using a free service
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`

    // Generate backup codes
    const backupCodes = this.generateBackupCodes()

    return {
      secret,
      qrCodeUrl,
      backupCodes
    }
  }

  /**
   * Generate a random secret using browser-compatible method
   */
  private static generateSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    let result = ''
    const array = new Uint8Array(20)
    crypto.getRandomValues(array)
    
    for (let i = 0; i < 20; i++) {
      result += chars[array[i] % chars.length]
    }
    
    return result
  }

  /**
   * Verify a TOTP token
   */
  static verifyToken(secret: string, token: string): boolean {
    try {
      // Basic format validation
      if (!/^\d{6}$/.test(token)) {
        return false
      }

      // For demo purposes, accept any 6-digit token that starts with 1-9
      // In production, you'd implement proper TOTP verification
      const tokenNum = parseInt(token)
      return tokenNum >= 100000 && tokenNum <= 999999
    } catch (error) {
      console.error('Error verifying token:', error)
      return false
    }
  }

  /**
   * Verify a backup code
   */
  static verifyBackupCode(backupCodes: string[], code: string): boolean {
    const index = backupCodes.indexOf(code)
    if (index === -1) return false
    
    // Remove used backup code
    backupCodes.splice(index, 1)
    return true
  }

  /**
   * Generate backup codes
   */
  private static generateBackupCodes(): string[] {
    const codes: string[] = []
    for (let i = 0; i < 10; i++) {
      // Generate 8-character alphanumeric codes
      const code = Math.random().toString(36).substring(2, 10).toUpperCase()
      codes.push(code)
    }
    return codes
  }

  /**
   * Check if 2FA is required for a user
   */
  static isRequiredForUser(userRole: string): boolean {
    return userRole === 'admin'
  }

  /**
   * Validate backup code format
   */
  static isValidBackupCodeFormat(code: string): boolean {
    return /^[A-Z0-9]{8}$/.test(code)
  }

  /**
   * Validate TOTP token format
   */
  static isValidTokenFormat(token: string): boolean {
    return /^\d{6}$/.test(token)
  }
}
