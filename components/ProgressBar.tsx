// app/components/ProgressBar.tsx
// Compact “coin” summary row used on the Lessons home screen.
// Shows counts for: lessons received, challenges mastered, and lessons mastered.
import React from 'react';
import { View, Text } from 'react-native';
import Coin from './Coin';
import { Ionicons } from '@expo/vector-icons';

export interface ProgressCounts {
  lessonReceive: number; // lessons with Receive complete
  lessonBoth: number; // lessons mastered (Receive + Send)
  challengeReceive: number; // challenges with Receive complete
  challengeBoth: number; // challenges mastered
}

type CoinColor = 'green' | 'gold' | 'silver';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

function Item({ coin, icon, label }: { coin: CoinColor; icon: IconName; label: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Coin size={36} color={coin} kind="lesson">
        <Ionicons name={icon} size={18} color="rgba(255,255,255,0.95)" />
      </Coin>
      <Text style={{ color: '#fff', fontWeight: '800', marginLeft: 10, fontSize: 16 }}>{label}</Text>
    </View>
  );
}

export default function ProgressBar({ counts }: { counts: ProgressCounts }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 16 }}>
      <Item coin="green" icon="radio" label={counts.lessonReceive} />
      <Item coin="gold" icon="star" label={counts.challengeBoth} />
      <Item coin="silver" icon="wifi" label={counts.lessonBoth} />
    </View>
  );
}

