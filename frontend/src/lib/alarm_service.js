// ── Hybrid Alarm & Local Notification Service (Web Audio API + Audio Element + Capacitor) ──

let activeOscillators = [];
let activeAudioElement = null;

/**
 * Initialize local offline alarm & notification permissions
 */
export const initLocalNotifications = async () => {
  if (typeof window === 'undefined') return;
  console.log('[AlarmService] Initializing offline alarm & notification service...');
  try {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      await Notification.requestPermission();
    }
  } catch (err) {
    console.warn('[AlarmService] Notification permission request error:', err);
  }
};

/**
 * Schedule native background alarm or local browser notification
 */
export const scheduleLocalAlarm = async ({ id, title, body, scheduleTime }) => {
  console.log(`[AlarmService] Scheduled alarm for medicine: ${title} at ${scheduleTime}`);
  if (typeof window === 'undefined') return;

  const targetDate = new Date(scheduleTime);
  const now = new Date();
  const delayMs = targetDate.getTime() - now.getTime();

  if (delayMs > 0 && delayMs < 24 * 60 * 60 * 1000) {
    setTimeout(() => {
      triggerAlarm({ title, body });
    }, delayMs);
  }
};

/**
 * Trigger immediate alarm (audio + browser notification)
 */
export const triggerAlarm = ({ title = 'Medication Reminder', body = 'Time to take your medication!' } = {}) => {
  playWebAudioAlarm();

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'pillsync-med-alarm',
        requireInteraction: true,
      });
    } catch (e) {
      console.warn('[AlarmService] Native notification dispatch failed:', e);
    }
  }
};

/**
 * Stop any playing alarm sound
 */
export const stopAlarm = () => {
  activeOscillators.forEach((osc) => {
    try {
      osc.stop();
      osc.disconnect();
    } catch {
      // already stopped
    }
  });
  activeOscillators = [];

  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {
      // ignore
    }
    activeAudioElement = null;
  }
  console.log('[AlarmService] Alarm silenced.');
};

/**
 * Web Audio API Medical Two-Tone Chime Synthesizer with fallback to /sounds/alarm.mp3
 */
export const playWebAudioAlarm = () => {
  if (typeof window === 'undefined') return;

  stopAlarm(); // clear previous alarm

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('Web Audio API not supported');
    }

    const audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    // Two-tone chime: High gentle chime sequence (880Hz -> 1174Hz)
    const playChimeTone = (freq, startTime, duration) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Smooth attack and release envelope
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.4, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
      activeOscillators.push(osc);
    };

    const now = audioCtx.currentTime;
    // Chime pulse 1
    playChimeTone(880, now + 0.0, 0.4);       // A5
    playChimeTone(1174.66, now + 0.25, 0.5);  // D6

    // Chime pulse 2
    playChimeTone(880, now + 0.9, 0.4);       // A5
    playChimeTone(1174.66, now + 1.15, 0.5);  // D6

    // Chime pulse 3
    playChimeTone(880, now + 1.8, 0.4);       // A5
    playChimeTone(1318.51, now + 2.05, 0.8);  // E6

    setTimeout(() => {
      audioCtx.close().catch(() => {});
    }, 4000);

    console.log('[AlarmService] Medical chime alarm played via Web Audio API.');
  } catch (e) {
    console.warn('[AlarmService] Web Audio synthesis failed, attempting audio element fallback:', e);
    try {
      const audio = new Audio('/sounds/alarm.mp3');
      audio.volume = 0.6;
      audio.play().catch((playErr) => {
        console.log('[AlarmService] Audio playback waiting for user interaction:', playErr.message);
      });
      activeAudioElement = audio;
    } catch (audioErr) {
      console.log('[AlarmService] Audio element fallback unavailable:', audioErr);
    }
  }
};
