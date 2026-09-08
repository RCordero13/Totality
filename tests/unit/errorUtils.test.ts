/**
 * errorUtils Unit Tests
 *
 * Tests for error handling utility functions.
 */

import { describe, it, expect } from 'vitest'
import {
  getErrorMessage,
  isNodeError,
  isHttpError,
  HttpError,
  getErrorCode,
} from '../../src/main/services/utils/errorUtils'

// ============================================================================
// getErrorMessage
// ============================================================================

describe('getErrorMessage', () => {
  it('should extract message from Error instance', () => {
    expect(getErrorMessage(new Error('something failed'))).toBe('something failed')
  })

  it('should convert string to message', () => {
    expect(getErrorMessage('raw string error')).toBe('raw string error')
  })

  it('should convert number to string', () => {
    expect(getErrorMessage(404)).toBe('404')
  })

  it('should convert null to string', () => {
    expect(getErrorMessage(null)).toBe('null')
  })

  it('should convert undefined to string', () => {
    expect(getErrorMessage(undefined)).toBe('undefined')
  })

  it('should convert object to string', () => {
    expect(getErrorMessage({ code: 'ERR' })).toBe('[object Object]')
  })
})

// ============================================================================
// isNodeError
// ============================================================================

describe('isNodeError', () => {
  it('should return true for Error with code property', () => {
    const err = new Error('ENOENT') as NodeJS.ErrnoException
    err.code = 'ENOENT'
    expect(isNodeError(err)).toBe(true)
  })

  it('should return false for plain Error without code', () => {
    expect(isNodeError(new Error('plain error'))).toBe(false)
  })

  it('should return false for non-Error objects', () => {
    expect(isNodeError({ code: 'ENOENT' })).toBe(false)
  })

  it('should return false for strings', () => {
    expect(isNodeError('ENOENT')).toBe(false)
  })

  it('should return false for null', () => {
    expect(isNodeError(null)).toBe(false)
  })
})

// ============================================================================
// isHttpError
// ============================================================================

describe('isHttpError', () => {
  it('should return true for HttpError instances', () => {
    const err = new HttpError(404, 'Not found', 'Not Found')
    expect(isHttpError(err)).toBe(true)
  })

  it('should return false for plain Error', () => {
    expect(isHttpError(new Error('network error'))).toBe(false)
  })

  it('should return false for non-Error objects', () => {
    expect(isHttpError({ status: 500 })).toBe(false)
  })

  it('should return false for null', () => {
    expect(isHttpError(null)).toBe(false)
  })
})

// ============================================================================
// HttpError
// ============================================================================

describe('HttpError', () => {
  it('should expose status and data properties', () => {
    const err = new HttpError(403, { error: 'forbidden' }, 'Forbidden')
    expect(err.status).toBe(403)
    expect(err.data).toEqual({ error: 'forbidden' })
    expect(err.message).toBe('Forbidden')
    expect(err.name).toBe('HttpError')
  })

  it('should be an instance of Error', () => {
    const err = new HttpError(500, null, 'Server Error')
    expect(err).toBeInstanceOf(Error)
  })
})

// ============================================================================
// getErrorCode
// ============================================================================

describe('getErrorCode', () => {
  it('should return code from Node.js error', () => {
    const err = new Error('File not found') as NodeJS.ErrnoException
    err.code = 'ENOENT'
    expect(getErrorCode(err)).toBe('ENOENT')
  })

  it('should return undefined for plain Error', () => {
    expect(getErrorCode(new Error('plain'))).toBeUndefined()
  })

  it('should return undefined for non-Error', () => {
    expect(getErrorCode('string')).toBeUndefined()
  })
})
