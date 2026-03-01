import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Logger', () => {
  beforeEach(() => {
    vi.stubEnv('LOG_LEVEL', 'DEBUG');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('default mode: debug() calls console.debug', async () => {
    const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const { logger } = await import('./logger.js');

    logger.debug('test message');

    expect(consoleSpy).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });

  it('default mode: info() calls console.info', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { logger } = await import('./logger.js');

    logger.info('test message');

    expect(consoleSpy).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });

  it('default mode: warn() calls console.warn', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { logger } = await import('./logger.js');

    logger.warn('test message');

    expect(consoleSpy).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });

  it('default mode: error() calls console.error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { logger } = await import('./logger.js');

    logger.error('test message');

    expect(consoleSpy).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });

  it('useStderr(): debug() calls console.error instead of console.debug', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { logger } = await import('./logger.js');

    logger.useStderr();
    logger.debug('test message');

    expect(debugSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledOnce();
    debugSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('useStderr(): info() calls console.error instead of console.info', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { logger } = await import('./logger.js');

    logger.useStderr();
    logger.info('test message');

    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledOnce();
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('useStderr(): warn() calls console.error instead of console.warn', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { logger } = await import('./logger.js');

    logger.useStderr();
    logger.warn('test message');

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('useStderr(): error() still calls console.error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { logger } = await import('./logger.js');

    logger.useStderr();
    logger.error('test message');

    expect(consoleSpy).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });

  it('useStderr() is idempotent: calling multiple times causes no issues', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { logger } = await import('./logger.js');

    logger.useStderr();
    logger.useStderr();
    logger.useStderr();
    logger.info('test message');

    expect(consoleSpy).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });
});
