/**
 * GeminiService Core Unit Tests
 *
 * Tests the API key lifecycle, isConfigured state, rate limit detection,
 * and explanation caching. Does NOT test GeminiTools (covered separately).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// vi.hoisted ensures these are defined before vi.mock() runs
const mockGenerateContent = vi.hoisted(() => vi.fn())

vi.mock('@google/genai', () => ({
  // Use regular function (not arrow) so `new GoogleGenAI(...)` works
  GoogleGenAI: vi.fn(function GoogleGenAI() {
    return { models: { generateContent: mockGenerateContent } }
  }),
}))

const mockGetSetting = vi.hoisted(() => vi.fn())
vi.mock('../../src/main/database/getDatabase', () => ({
  getDatabase: vi.fn(() => ({ getSetting: mockGetSetting })),
}))

import { GeminiService, RateLimitError } from '../../src/main/services/GeminiService'

function setKey(key: string | null, enabled = true) {
  mockGetSetting.mockImplementation((k: string) => {
    if (k === 'gemini_api_key') return key
    if (k === 'ai_enabled') return enabled ? null : 'false'
    return null
  })
}

describe('GeminiService — key lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('isConfigured() returns false when no API key is set', () => {
    setKey(null)
    const svc = new GeminiService()
    expect(svc.isConfigured()).toBe(false)
  })

  it('isConfigured() returns true when API key is present and AI enabled', () => {
    setKey('test-key')
    const svc = new GeminiService()
    expect(svc.isConfigured()).toBe(true)
  })

  it('isConfigured() returns false when ai_enabled is "false"', () => {
    setKey('test-key', false)
    const svc = new GeminiService()
    expect(svc.isConfigured()).toBe(false)
  })

  it('refreshApiKey() picks up newly set key', () => {
    setKey(null)
    const svc = new GeminiService()
    expect(svc.isConfigured()).toBe(false)

    setKey('new-key')
    svc.refreshApiKey()
    expect(svc.isConfigured()).toBe(true)
  })

  it('refreshApiKey() clears client when key is removed', () => {
    setKey('existing-key')
    const svc = new GeminiService()
    expect(svc.isConfigured()).toBe(true)

    setKey(null)
    svc.refreshApiKey()
    expect(svc.isConfigured()).toBe(false)
  })
})

describe('GeminiService — rate limit detection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateContent.mockReset()
  })

  it('getRateLimitInfo() returns not-limited by default', () => {
    setKey('test-key')
    const svc = new GeminiService()
    const info = svc.getRateLimitInfo()
    expect(info.limited).toBe(false)
    expect(info.retryAfterSeconds).toBe(0)
  })

  it('throws RateLimitError when API returns 429', async () => {
    setKey('test-key')
    const svc = new GeminiService()
    mockGenerateContent.mockRejectedValue({
      status: 429,
      message: 'Too Many Requests',
      headers: { get: () => null },
    })

    await expect(
      svc.sendMessage({ messages: [{ role: 'user', content: 'hello' }] })
    ).rejects.toBeInstanceOf(RateLimitError)
  })

  it('getRateLimitInfo() returns limited after a 429 error', async () => {
    setKey('test-key')
    const svc = new GeminiService()
    mockGenerateContent.mockRejectedValue({
      status: 429,
      message: 'Too Many Requests',
      headers: { get: () => null },
    })

    await expect(
      svc.sendMessage({ messages: [{ role: 'user', content: 'hello' }] })
    ).rejects.toBeInstanceOf(RateLimitError)

    const info = svc.getRateLimitInfo()
    expect(info.limited).toBe(true)
    expect(info.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('extracts retry-after-ms header when present', async () => {
    setKey('test-key')
    const svc = new GeminiService()
    mockGenerateContent.mockRejectedValue({
      status: 429,
      message: 'Rate limited',
      headers: { get: (name: string) => name === 'retry-after-ms' ? '60000' : null },
    })

    try {
      await svc.sendMessage({ messages: [{ role: 'user', content: 'hi' }] })
    } catch (e) {
      expect(e).toBeInstanceOf(RateLimitError)
      expect((e as RateLimitError).retryAfterSeconds).toBe(60)
    }
  })
})

describe('GeminiService — explanation cache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateContent.mockReset()
  })

  it('returns cached result on second call for same item', async () => {
    setKey('test-key')
    const svc = new GeminiService()
    mockGenerateContent.mockResolvedValue({
      text: 'This is a great 1080p encode.',
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
    })

    const params = { title: 'Test Movie', resolution: '1080p', videoCodec: 'H.264' }
    const result1 = await svc.explainQualityScore(params)
    const result2 = await svc.explainQualityScore(params)

    // SDK called only once — second call served from cache
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    expect(result1).toBe(result2)
  })
})
