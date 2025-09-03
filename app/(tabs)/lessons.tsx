import { View, FlatList, StyleSheet } from 'react-native';
import colors from '../../constants/colors';
import { levels } from '../../constants/lessons';
import LessonCard from '../../components/LessonCard';
import HeaderMenu from '../../components/HeaderMenu';

export default function LessonsScreen() {
  return (
    <View style={styles.container}>
      <HeaderMenu title="Alphabet Lessons" />
      <FlatList
        data={levels}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => <LessonCard level={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
