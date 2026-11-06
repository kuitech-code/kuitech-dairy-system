import { useEffect, useState } from 'react';

export const useToday = () => {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    let timeoutId;

    const scheduleNextDay = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timeoutId = window.setTimeout(() => {
        setToday(new Date());
        scheduleNextDay();
      }, nextMidnight.getTime() - now.getTime());
    };

    const refresh = () => setToday(new Date());
    scheduleNextDay();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return today;
};
