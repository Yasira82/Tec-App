export const haptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate({ light: 10, medium: 25, heavy: 50 }[type]);
  }
};
