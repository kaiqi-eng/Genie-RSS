import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import logger, { createLogger, info, warn, error, debug } from '../../src/utils/logger.js';

describe('Logger', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {})
    };
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  describe('default logger', () => {
    it('should have default context', () => {
      expect(logger.context).toBe('app');
    });

    it('should log info messages', () => {
      logger.info('test message');
      expect(consoleSpy.log).toHaveBeenCalled();

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(output.level).toBe('INFO');
      expect(output.message).toBe('test message');
      expect(output.timestamp).toBeDefined();
    });

    it('should log error messages', () => {
      logger.error('error message');
      expect(consoleSpy.error).toHaveBeenCalled();

      const output = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(output.level).toBe('ERROR');
      expect(output.message).toBe('error message');
    });

    it('should log warn messages', () => {
      logger.warn('warning message');
      expect(consoleSpy.warn).toHaveBeenCalled();

      const output = JSON.parse(consoleSpy.warn.mock.calls[0][0]);
      expect(output.level).toBe('WARN');
    });

    it('should include metadata', () => {
      logger.info('with meta', { key: 'value', count: 42 });

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(output.meta.key).toBe('value');
      expect(output.meta.count).toBe(42);
    });

    it('should handle Error objects', () => {
      const err = new Error('test error');
      logger.error('error occurred', err);

      const output = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(output.meta.error.name).toBe('Error');
      expect(output.meta.error.message).toBe('test error');
      expect(output.meta.error.stack).toBeDefined();
    });
  });

  describe('createLogger', () => {
    it('should create logger with custom context', () => {
      const customLogger = createLogger('custom');
      expect(customLogger.context).toBe('custom');
    });

    it('should include context in output', () => {
      const customLogger = createLogger('myservice');
      customLogger.info('test');

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(output.context).toBe('myservice');
    });
  });

  describe('child logger', () => {
    it('should create child with extended context', () => {
      const parent = createLogger('parent');
      const child = parent.child('child');

      expect(child.context).toBe('parent:child');
    });
  });

  describe('convenience functions', () => {
    it('should export info function', () => {
      info('info test');
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should export warn function', () => {
      warn('warn test');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should export error function', () => {
      error('error test');
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });
});
