// Global Data Cache - Simple solution to persist data across pages
// This prevents data from disappearing when navigating between pages

interface GlobalDataCache {
  koi: any[]
  waterParameters: any[]
  waterChanges: any[]
  userPreferences: any
  lastLoaded: {
    koi: number
    waterParameters: number
    waterChanges: number
    userPreferences: number
  }
}

class DataCache {
  private cache: GlobalDataCache = {
    koi: [],
    waterParameters: [],
    waterChanges: [],
    userPreferences: null,
    lastLoaded: {
      koi: 0,
      waterParameters: 0,
      waterChanges: 0,
      userPreferences: 0
    }
  }

  private cacheTimeout = 5 * 60 * 1000 // 5 minutes

  setKoi(koi: any[]) {
    this.cache.koi = koi
    this.cache.lastLoaded.koi = Date.now()
  }

  getKoi(): any[] {
    if (Date.now() - this.cache.lastLoaded.koi > this.cacheTimeout) {
      return []
    }
    return this.cache.koi
  }

  setWaterParameters(params: any[]) {
    this.cache.waterParameters = params
    this.cache.lastLoaded.waterParameters = Date.now()
  }

  getWaterParameters(): any[] {
    if (Date.now() - this.cache.lastLoaded.waterParameters > this.cacheTimeout) {
      return []
    }
    return this.cache.waterParameters
  }

  setWaterChanges(changes: any[]) {
    this.cache.waterChanges = changes
    this.cache.lastLoaded.waterChanges = Date.now()
  }

  getWaterChanges(): any[] {
    if (Date.now() - this.cache.lastLoaded.waterChanges > this.cacheTimeout) {
      return []
    }
    return this.cache.waterChanges
  }

  setUserPreferences(prefs: any) {
    this.cache.userPreferences = prefs
    this.cache.lastLoaded.userPreferences = Date.now()
  }

  getUserPreferences(): any {
    if (Date.now() - this.cache.lastLoaded.userPreferences > this.cacheTimeout) {
      return null
    }
    return this.cache.userPreferences
  }

  clearCache() {
    this.cache = {
      koi: [],
      waterParameters: [],
      waterChanges: [],
      userPreferences: null,
      lastLoaded: {
        koi: 0,
        waterParameters: 0,
        waterChanges: 0,
        userPreferences: 0
      }
    }
  }

  hasValidData(): boolean {
    const now = Date.now()
    return (
      (now - this.cache.lastLoaded.koi < this.cacheTimeout && this.cache.koi.length > 0) ||
      (now - this.cache.lastLoaded.waterParameters < this.cacheTimeout && this.cache.waterParameters.length > 0) ||
      (now - this.cache.lastLoaded.waterChanges < this.cacheTimeout && this.cache.waterChanges.length > 0)
    )
  }
}

export const globalDataCache = new DataCache()

