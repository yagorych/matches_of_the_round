import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MATCHES_URL } from '../config';
import { FavoriteButton } from '../components/FavoriteButton';
import { UpdatedAgo } from '../components/UpdatedAgo';
import { useFavorites } from '../hooks/useFavorites';
import type { Match, MatchesResponse, MatchStatus } from '../types/match';

type Filter = 'all' | 'upcoming' | 'finished';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'upcoming', label: 'Предстоящие' },
  { id: 'finished', label: 'Завершённые' },
];

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Предстоящий',
  live: 'Идёт',
  finished: 'Завершён',
  postponed: 'Перенесён',
};

function isMatch(value: unknown): value is Match {
  if (!value || typeof value !== 'object') return false;
  const match = value as Partial<Match>;
  const hasValidTeam = (team: unknown) => {
    if (!team || typeof team !== 'object') return false;
    const candidate = team as Partial<Match['home']>;
    return typeof candidate.id === 'string' && typeof candidate.name === 'string';
  };
  const hasValidScore = (score: unknown) => {
    if (score === null) return true;
    if (!score || typeof score !== 'object') return false;
    const candidate = score as Partial<NonNullable<Match['score']>>;
    return Number.isFinite(candidate.home) && Number.isFinite(candidate.away);
  };
  return (
    typeof match.id === 'string' &&
    typeof match.status === 'string' &&
    (typeof match.startsAt === 'string' || match.startsAt === null) &&
    hasValidTeam(match.home) && hasValidTeam(match.away) &&
    hasValidScore(match.score)
  );
}

function parseMatches(payload: unknown): MatchesResponse {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as MatchesResponse).matches)) {
    throw new Error('Сервер вернул данные в неизвестном формате.');
  }
  const response = payload as MatchesResponse;
  return { ...response, matches: response.matches.filter(isMatch) };
}

function formatStartTime(startsAt: string | null): string {
  if (!startsAt) return 'Дата и время уточняются';
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return 'Дата и время уточняются';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function getStatusLabel(status: MatchStatus): string {
  return STATUS_LABELS[status] ?? `Статус: ${status}`;
}

function MatchCard({ match, favorite, onToggleFavorite }: {
  match: Match;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={[styles.status, match.status === 'live' && styles.liveStatus]}>
          {getStatusLabel(match.status)}{match.status === 'live' && match.minute != null ? ` · ${match.minute}′` : ''}
        </Text>
        <Text style={styles.date}>{formatStartTime(match.startsAt)}</Text>
        <FavoriteButton active={favorite} onPress={onToggleFavorite} />
      </View>
      <View style={styles.teams}>
        <Text style={styles.team} numberOfLines={2}>{match.home.name}</Text>
        <Text style={styles.score} accessibilityLabel={match.score ? `Счёт ${match.score.home} ${match.score.away}` : undefined}>
          {match.score ? `${match.score.home} : ${match.score.away}` : '— : —'}
        </Text>
        <Text style={[styles.team, styles.awayTeam]} numberOfLines={2}>{match.away.name}</Text>
      </View>
    </View>
  );
}

export function MatchesScreen() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [round, setRound] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const { isFavorite, toggle } = useFavorites();

  const loadMatches = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetch(MATCHES_URL);
      if (!response.ok) throw new Error(`Не удалось загрузить матчи (${response.status}).`);
      const payload: unknown = await response.json();
      const result = parseMatches(payload);
      setMatches(result.matches);
      setRound(typeof result.round === 'number' ? result.round : null);
      setUpdatedAt(new Date());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить матчи.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadMatches(); }, [loadMatches]);

  const visibleMatches = useMemo(() => matches.filter((match) => {
    if (filter === 'finished') return match.status === 'finished';
    if (filter === 'upcoming') return match.status === 'scheduled' || match.status === 'live';
    return true;
  }), [filter, matches]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.helper}>Загружаем матчи…</Text>
      </View>
    );
  }

  if (error && matches.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Не удалось загрузить матчи</Text>
        <Text style={styles.helper}>{error}</Text>
        <Pressable style={styles.primaryButton} onPress={() => void loadMatches()} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Матчи тура{round != null ? ` · ${round}-й тур` : ''}</Text>
      <View style={styles.toolbar}>
        <View style={styles.filters}>
          {FILTERS.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setFilter(item.id)}
              style={[styles.filterButton, filter === item.id && styles.selectedFilter]}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === item.id }}
            >
              <Text style={[styles.filterText, filter === item.id && styles.selectedFilterText]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => void loadMatches(true)} style={styles.refreshButton} accessibilityRole="button">
          <Text style={styles.refreshText}>Обновить</Text>
        </Pressable>
        {updatedAt ? <UpdatedAgo since={updatedAt} /> : null}
      </View>
      {error ? <Text style={styles.inlineError}>{error} Показаны последние загруженные данные.</Text> : null}
      <FlatList
        data={visibleMatches}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MatchCard
            match={item}
            favorite={isFavorite(item.id)}
            onToggleFavorite={() => toggle(item.id)}
          />
        )}
        contentContainerStyle={visibleMatches.length === 0 ? styles.emptyList : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadMatches(true)} />}
        ListEmptyComponent={<Text style={styles.emptyText}>Матчей в этой категории пока нет.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#172033', marginBottom: 14 },
  helper: { fontSize: 15, color: '#667085', textAlign: 'center' },
  toolbar: { gap: 10, marginBottom: 12 },
  filters: { flexDirection: 'row', gap: 8 },
  filterButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, backgroundColor: '#e9edf3' },
  selectedFilter: { backgroundColor: '#2563eb' },
  filterText: { color: '#475467', fontSize: 13, fontWeight: '600' },
  selectedFilterText: { color: '#fff' },
  refreshButton: { alignSelf: 'flex-start', paddingVertical: 6 },
  refreshText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
  list: { paddingBottom: 24, gap: 10 },
  emptyList: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: '#667085', fontSize: 15, textAlign: 'center' },
  card: { padding: 14, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e7ec' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 14 },
  status: { color: '#667085', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  liveStatus: { color: '#c4320a' },
  date: { color: '#667085', fontSize: 12, textAlign: 'right', flexShrink: 1 },
  teams: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  team: { flex: 1, color: '#172033', fontSize: 15, fontWeight: '600' },
  awayTeam: { textAlign: 'right' },
  score: { minWidth: 54, textAlign: 'center', color: '#172033', fontSize: 16, fontWeight: '700' },
  primaryButton: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8, backgroundColor: '#2563eb' },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  inlineError: { color: '#b42318', marginBottom: 8, fontSize: 13 },
});
