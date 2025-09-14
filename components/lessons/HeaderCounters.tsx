// HeaderCounters
// --------------
// Small summary row shown above the lessons header card.
// It displays three counters:
//  - checks: number of lessons with Receive complete
//  - stars: number of lessons fully mastered (Send complete)
//  - crowns: number of challenges mastered
// When any count increases, its tile does a tiny bounce for feedback.
import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, spacing, thresholds } from '../../theme/lessonTheme';
import AntennaWaves from './icons/AntennaWaves';
import Star from './icons/Star';
import Crown from './icons/Crown';

type Lesson = { id: string; label: string; chars: string[] };

type Props = {
  groupId: string;
  lessons: Lesson[];
  getLessonProgress: (lessonId: string) => { receiveScore: number; sendScore: number };
};

export default function HeaderCounters({ groupId, lessons, getLessonProgress }: Props) {
  const checks = React.useMemo(() => {
    // Count non-challenge lessons with receive >= threshold
    return lessons.reduce((acc, _l, i) => {
      const isChallenge = ((i + 1) % 3) === 0;
      if (isChallenge) return acc;
      const p = getLessonProgress(String(_l.id));
      return acc + (p.receiveScore >= thresholds.receive ? 1 : 0);
    }, 0);
  }, [lessons, getLessonProgress]);

  const stars = React.useMemo(() => {
    // Count non-challenge lessons with send >= threshold (mastery)
    return lessons.reduce((acc, _l, i) => {
      const isChallenge = ((i + 1) % 3) === 0;
      if (isChallenge) return acc;
      const p = getLessonProgress(String(_l.id));
      return acc + (p.sendScore >= thresholds.send ? 1 : 0);
    }, 0);
  }, [lessons, getLessonProgress]);

  const crowns = React.useMemo(() => {
    // There is one challenge after every two lessons.
    const challengeCount = Math.floor(lessons.length / 2);
    let total = 0;
    for (let i = 1; i <= challengeCount; i++) {
      const id = `ch-${i}`;
      const p = getLessonProgress(id);
      if (p.sendScore >= thresholds.send) total += 1;
    }
    return total;
  }, [lessons, getLessonProgress]);

  const scaleChecks = useBounceOnIncrease(checks);
  const scaleStars = useBounceOnIncrease(stars);
  const scaleCrowns = useBounceOnIncrease(crowns);

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.item, { transform: [{ scale: scaleChecks }] }]}>
        <AntennaWaves size={22} color={colors.green} />
        <Text style={styles.value}>{checks}</Text>
      </Animated.View>
      <Animated.View style={[styles.item, { transform: [{ scale: scaleStars }] }]}>
        <Star size={22} color={colors.gold} />
        <Text style={styles.value}>{stars}</Text>
      </Animated.View>
      <Animated.View style={[styles.item, { transform: [{ scale: scaleCrowns }] }]}>
        <Crown size={22} color={colors.gold} />
        <Text style={styles.value}>{crowns}</Text>
      </Animated.View>
    </View>
  );
}

function useBounceOnIncrease(value: number) {
  // Hook: returns an Animated.Value for a small bounce when `value` increases
  const prev = React.useRef(value);
  const scale = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (value > prev.current) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.12, duration: 100, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      ]).start();
    }
    prev.current = value;
  }, [value]);
  return scale;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    marginBottom: spacing(2),
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(1),
    backgroundColor: 'transparent',
    paddingVertical: spacing(0.5),
  },
  value: { color: colors.text, fontWeight: '800' },
});

