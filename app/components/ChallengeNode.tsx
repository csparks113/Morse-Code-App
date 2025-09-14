// app/components/ChallengeNode.tsx
import React from 'react';
import { View, Text } from 'react-native';
import Coin from './Coin';
import { ChallengeNodeData } from '@/types/progress';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function ChallengeNode({ data }: { data: ChallengeNodeData }) {
  const color =
    data.completion === 'active' ? 'blue' :
    data.completion === 'receiveComplete' ? 'silver' :
    data.completion === 'bothComplete' ? 'gold' : 'gray';

  const isActive = data.completion === 'active';

  return (
    <View accessible accessibilityRole="button" accessibilityLabel="Challenge">
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 20, textAlign: 'center', marginBottom: 10 }}>
        Challenge
      </Text>
      <Coin color={color as any} kind="challenge" glow={isActive}>
        {data.completion === 'receiveComplete' ? (
          <Ionicons name="star" size={28} color="rgba(255,255,255,0.9)" />
        ) : (
          <MaterialCommunityIcons name="crown" size={28} color="rgba(255,255,255,0.9)" />
        )}
      </Coin>
    </View>
  );
}
