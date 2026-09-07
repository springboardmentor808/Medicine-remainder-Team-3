import { emitToast } from '@/lib/api';

describe('emitToast utility', () => {
  it('dispatches pillsync:toast custom event with message and type', (done) => {
    const handler = (e) => {
      window.removeEventListener('pillsync:toast', handler);
      expect(e.detail.message).toBe('Email verified successfully!');
      expect(e.detail.type).toBe('success');
      done();
    };

    window.addEventListener('pillsync:toast', handler);
    emitToast('Email verified successfully!', 'success');
  });

  it('supports reverse argument order emitToast(type, message)', (done) => {
    const handler = (e) => {
      window.removeEventListener('pillsync:toast', handler);
      expect(e.detail.message).toBe('Invalid verification code');
      expect(e.detail.type).toBe('error');
      done();
    };

    window.addEventListener('pillsync:toast', handler);
    emitToast('error', 'Invalid verification code');
  });

  it('supports object argument emitToast({ type, message })', (done) => {
    const handler = (e) => {
      window.removeEventListener('pillsync:toast', handler);
      expect(e.detail.message).toBe('Verification code sent');
      expect(e.detail.type).toBe('info');
      done();
    };

    window.addEventListener('pillsync:toast', handler);
    emitToast({ type: 'info', message: 'Verification code sent' });
  });
});
