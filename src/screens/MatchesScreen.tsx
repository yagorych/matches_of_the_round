import { StyleSheet, Text, View } from 'react-native';

// Экран будет реализован на следующем этапе.
export function MatchesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Матчи тура</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700' },
});
