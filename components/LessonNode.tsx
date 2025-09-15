// app/components/LessonNode.tsx
import React from 'react';
import { View, Text } from 'react-native';
import Coin from './Coin';
import { coinPalette as palette } from '@/theme/lessonTheme';
import { LessonNodeData } from '@/types/progress';

export default function LessonNode({ data }: { data: LessonNodeData }) {
  const color =
    data.completion === 'active'
      ? 'blue'
      : data.completion === 'receiveComplete'
        ? 'green'
        : data.completion === 'bothComplete'
          ? 'gold'
          : 'gray';

  const isActive = data.completion === 'active';
  const ringHex =
    color === 'blue'
      ? palette.blue
      : color === 'green'
        ? palette.green
        : color === 'gold'
          ? palette.gold
          : palette.grayMuted;

  return (
    <View accessible accessibilityRole="button" accessibilityLabel={data.title}>
      <Text
        style={{
          color: '#fff',
          fontWeight: '700',
          fontSize: 20,
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        {data.title}
      </Text>
      {/* {!!data.subtitle && (
        <Text style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 8}}>
          {data.subtitle}
        </Text>
      )} */}
      <Coin color={color as any} kind="lesson" glow={isActive}>
        {data.completion === 'locked' ? (
          <Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '900' }}>
            ?
          </Text>
        ) : (
          <View>
            {!!data.subtitle && (
              <Text
                style={{
                  color:
                    data.completion === 'active' ||
                    data.completion === 'receiveComplete'
                      ? '#FFFFFF'
                      : ringHex,
                  fontSize: 22,
                  fontWeight: '700',
                  textAlign: 'center',
                }}
              >
                {data.subtitle}
              </Text>
            )}
            {/* {data.morse.map((m, i) => (
              <Text key={i} style={{ color: isInactive, fontSize: 30, fontWeight: '900', textAlign: 'center' }}>{m}</Text>
            ))} */}
          </View>
        )}
      </Coin>
    </View>
  );
}
