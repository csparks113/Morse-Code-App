// app/components/LessonNode.tsx
import React from 'react';
import { View, Text } from 'react-native';
import Coin from './Coin';
import { palette } from '@/constants/coinTheme';
import { LessonNodeData } from '@/types/progress';

export default function LessonNode({ data }: { data: LessonNodeData }) {
  const color =
    data.completion === 'active' ? 'blue' :
    data.completion === 'receiveComplete' ? 'green' :
    data.completion === 'bothComplete' ? 'purple' : 'gray';

  const isActive = data.completion === 'active';

  const morseColor = data.completion === 'locked' ? palette.grayMuted : '#FFFFFF';

  return (
    <View accessible accessibilityRole="button" accessibilityLabel={data.title}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 20, textAlign: 'center', marginBottom: 6 }}>
        {data.title}
      </Text>
      {!!data.subtitle && (
        <Text style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 8}}>
          {data.subtitle}
        </Text>
      )}
      <Coin color={color as any} kind="lesson" glow={isActive}>
        {/* Render Morse code (stack vertically if >2) */}
        <View style={{ gap: 0 }}>
          {data.morse.map((m, i) => (
            <Text key={i} style={{ color: morseColor, fontSize: 30, fontWeight: '900', textAlign: 'center' }}>{m}</Text>
          ))}
        </View>
      </Coin>
    </View>
  );
}
