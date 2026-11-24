import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { CalendarDays } from 'lucide-react-native';
import { api } from '../../services/api';
import { storage } from '../../services/storage';
import { CalendarEventItem } from '../../types';
import AppHeader from '../../components/navigation/AppHeader';
import EmptyState from '../../components/feedback/EmptyState';

function formatEventDateTime(startIso: string, endIso?: string | null): string {
  try {
    const startDate = new Date(startIso);
    if (isNaN(startDate.getTime())) return startIso;

    const dateStr = startDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const startTimeStr = startDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    if (!endIso) {
      return `${dateStr}, ${startTimeStr}`;
    }

    const endDate = new Date(endIso);
    if (isNaN(endDate.getTime())) {
      return `${dateStr}, ${startTimeStr}`;
    }

    const endTimeStr = endDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    return `${dateStr}, ${startTimeStr} – ${endTimeStr}`;
  } catch {
    return startIso;
  }
}

export const CalendarScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const scrollRef = useRef<any>(null);

  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const isFetchingRef = useRef<boolean>(false);

  // Scroll to top on focus / blur
  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      return () => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      };
    }, [])
  );

  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('tabPress', () => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (route.params?.resetKey) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [route.params?.resetKey]);

  // SWR Cache Hydration
  useEffect(() => {
    let isMounted = true;
    async function hydrateCache() {
      try {
        const session = await storage.getStudentSession();
        const studentId = session?.studentId ?? session?.userId ?? 'default';
        const cached = await storage.getCache<CalendarEventItem[]>(`kreativa_cache_calendar_${studentId}`);
        if (cached && Array.isArray(cached) && cached.length > 0 && isMounted) {
          setEvents(cached);
          setLoading(false);
        }
      } catch (err) {
        console.warn('[Calendar] Cache hydration error:', err);
      }
    }
    hydrateCache();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadEvents = useCallback(async (isRefresh = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isRefresh) {
      setRefreshing(true);
    }

    try {
      const data = await api.calendar.getEvents();
      setEvents(data);

      const session = await storage.getStudentSession();
      const studentId = session?.studentId ?? session?.userId ?? 'default';
      await storage.setCache(`kreativa_cache_calendar_${studentId}`, data);
    } catch (err) {
      console.warn('[Calendar] Failed to load calendar events:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadEvents(false);
  }, [loadEvents]);

  const onRefresh = useCallback(() => {
    loadEvents(true);
  }, [loadEvents]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader title="Calendar" showTitle />

      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2563EB']}
            tintColor="#2563EB"
          />
        }
      >
        {/* Page Title & Subtitle (Web LMS 100% Alignment) */}
        <View style={styles.headerBlock}>
          <Text style={styles.pageTitle}>Calendar</Text>
          <Text style={styles.pageSubtitle}>
            Review sessions, club schedules, and reminders. Check your Gmail for calendar invites.
          </Text>
        </View>

        {loading && events.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : events.length === 0 ? (
          <EmptyState
            boxed
            title="No upcoming events."
            customIcon={<CalendarDays size={32} color="#94A3B8" />}
          />
        ) : (
          <View style={styles.listContainer}>
            {events.map((e) => (
              <View key={String(e.id)} style={styles.eventCard}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.eventTitle}>{e.title}</Text>
                  {e.audience_type ? (
                    <Text style={styles.audienceBadge}>{e.audience_type}</Text>
                  ) : null}
                </View>

                <Text style={styles.eventDateTime}>
                  {formatEventDateTime(e.start_datetime, e.end_datetime)}
                </Text>

                {e.location ? (
                  <Text style={styles.eventLocation}>Location: {e.location}</Text>
                ) : null}

                {e.description ? (
                  <Text style={styles.eventDescription}>{e.description}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  headerBlock: {
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
    lineHeight: 20,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    gap: 12,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  eventTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 22,
  },
  audienceBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  eventDateTime: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  eventLocation: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  eventDescription: {
    fontSize: 13,
    color: '#475569',
    marginTop: 8,
    lineHeight: 20,
  },
});

export default CalendarScreen;
