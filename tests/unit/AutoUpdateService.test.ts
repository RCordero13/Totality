/**
 * AutoUpdateService Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { EventEmitter } from 'events'

// Mock electron-updater
const mockAutoUpdater = {
  autoDownload: true,
  autoInstallOnAppQuit: true,
  allowDowngrade: true,
  logger: null,
  on: vi.fn(),
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
  quitAndInstall: vi.fn(),
} as unknown as typeof import('electron-updater').autoUpdater & EventEmitter

vi.mock('electron-updater', () => ({
  autoUpdater: mockAutoUpdater,
}))

// Mock database
vi.mock('../../src/main/database/DatabaseFactory', () => ({
  getDatabaseServiceSync: vi.fn(() => ({
    createNotification: vi.fn(),
    close: vi.fn(),
  })),
}))

vi.mock('../../src/main/ipc/utils/notificationEmitter', () => ({
  emitNotificationCreated: vi.fn(),
}))

describe('AutoUpdateService', () => {
  let service: import('../../src/main/services/AutoUpdateService').AutoUpdateService

  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset mock properties
    mockAutoUpdater.autoDownload = true
    mockAutoUpdater.autoInstallOnAppQuit = true
    mockAutoUpdater.allowDowngrade = true

    vi.resetModules()
    vi.useFakeTimers()
    const { AutoUpdateService } = await import('../../src/main/services/AutoUpdateService')
    service = new AutoUpdateService()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initialize()', () => {
    it('sets autoDownload to false', () => {
      service.initialize()
      expect(mockAutoUpdater.autoDownload).toBe(false)
    })

    it('sets autoInstallOnAppQuit to false', () => {
      service.initialize()
      expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(false)
    })

    it('sets allowDowngrade to false', () => {
      service.initialize()
      expect(mockAutoUpdater.allowDowngrade).toBe(false)
    })

    it('is idempotent — second call is a no-op', () => {
      service.initialize()
      service.initialize()
      // on() should only have been called once per event type
      const calls = vi.mocked(mockAutoUpdater.on).mock.calls
      const uniqueEvents = new Set(calls.map(([event]) => event))
      // Verify each event registered exactly once
      for (const event of ['checking-for-update', 'update-available', 'update-not-available',
        'download-progress', 'update-downloaded', 'error']) {
        const count = calls.filter(([e]) => e === event).length
        expect(count).toBe(1)
      }
      expect(uniqueEvents.size).toBe(6)
    })
  })

  describe('getState()', () => {
    it('starts in idle state', () => {
      const state = service.getState()
      expect(state.status).toBe('idle')
    })

    it('returns a copy, not the internal state object', () => {
      const state1 = service.getState()
      const state2 = service.getState()
      expect(state1).not.toBe(state2)
    })
  })
})
