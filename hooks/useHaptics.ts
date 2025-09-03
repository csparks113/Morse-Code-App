import * as Haptics from 'expo-haptics';

export default function useHaptics() {
  return {
    success: () =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    error: () =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  };
}
