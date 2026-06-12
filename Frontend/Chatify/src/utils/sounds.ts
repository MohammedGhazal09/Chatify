// Notification sound utility
let notificationSound: HTMLAudioElement | null = null;

export const playNotificationSound = () => {
  if (!notificationSound) {
    // Use a subtle notification sound (base64 encoded simple beep)
    notificationSound = new Audio(
      'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVIxL22q0dOibSwVO5Tr3qBYLR8TcLvp56VkQCgNWqXk8ql+Wj4aCVuGy/C8h2tJNAxVdcXwu41yUjkIT2624LuKdl5CChxPm9runICCXjQNABdYdoqchYBqYVUkBAMMSHKFsLqZgpyFYikBAB5VYWRtfpiTjId5XkUdAAoVNVJ1kbOtlpp8cWxBJAAdNlFjdYydnJqRiYV9aFMxDwsSN1htjKaglZaPi4l+b1s6HgsQNVVmh6KhmpSRjIqCdGRNOR8MEixIX3yYopuWkY2KhXxuXUcwHQwPNlhri5+emp+TjoqFe29hSzYhDhRCYnqQnp+en5ONiYR8c2ZTO0kUIRpPZ3qOl5qYmp6ai4aAgHJkVUNBMyINJFBmeYuUl5mamJiKhIF/c2dXSUU5MA0dQF55houTlpqalYuGgn50aVtOS0Q5IA0fRWR+houSkpWWloqGgX91al9RTUI5Hw0bPl55hIiOkJGVk4qGgX51bGBUTkU8MA8WN1l0g4eKj5GRk4qFgX51bWNYUklBNQ4cP194gYWIi4yPk4mFgX51bWZcU0pDOjAOFzhVcoGEh4qMjpCGhIF9dW5lXVVMRTsxHhI0TG6Bg4iKi46RjYaBfnZtZl1YUEk/OCMTKkdqi4SKjpKSj4mFfnhvZl5WTklBNCINKEhxg4eKjI6Pkol+fHVuZl5WUUQ9MjAOF0Fmf4GEhoiNj4yIfHl0bWRdV1BKQD0+LBgjQWN9g4aKjI+OjYl/e3RuZFtWUEpBOjIqDBYzVXl+goaKjpGPiIR7dW1mX1lTTUY9NS8cFDFRdH2BhIiMjo+JhIF6c2tkXlpTTkdBOzInGhAyUnR7f4OHi4+PhH97dnBpZF1YUEtGPzYrJhUUPFt5fYCDhouOjoiBe3Zxa2ZgWlVOSEE6Ni0fFhQ8Wnl9f4KGi46Lhn57dW9pY11XUURBODR='
    );
    notificationSound.volume = 0.3;
  }

  notificationSound.currentTime = 0;
  notificationSound.play().catch(() => {
    // Autoplay might be blocked, silently fail
  });
};

// Check if user has enabled sound notifications
export const isSoundEnabled = (): boolean => {
  return localStorage.getItem('chatify_sound_enabled') !== 'false';
};

export const setSoundEnabled = (enabled: boolean): void => {
  localStorage.setItem('chatify_sound_enabled', enabled ? 'true' : 'false');
};
