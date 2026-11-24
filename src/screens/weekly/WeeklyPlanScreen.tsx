import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import AppHeader from '../../components/navigation/AppHeader';
import ToastAlert from '../../components/feedback/ToastAlert';
import EmptyState from '../../components/feedback/EmptyState';
import { useStudentData } from '../../context/StudentDataContext';
import { api } from '../../services/api';
import { storage } from '../../services/storage';
import { WeeklyPlanSession } from '../../types';
import WeeklyPlanDetailView from './WeeklyPlanDetailView';
import {
  SEC_HS,
  subjectPastel,
  timeSlotLabel,
  getMondayOfWeek,
  addDays,
  formatWeekRangeLabel,
} from './weeklyPlanTheme';

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

export const WeeklyPlanScreen: React.FC = () => {
  const { studentProfile } = useStudentData();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const scrollRef = useRef<any>(null);

  const currentMonday = useMemo(() => getMondayOfWeek(), []);
  const [weekStart, setWeekStart] = useState<string>(currentMonday);
  const [sessions, setSessions] = useState<WeeklyPlanSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<WeeklyPlanSession | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  // Compute dates for Mon–Fri (5 days)
  const dayDates = useMemo(
    () => [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Auto-select today if viewing current week, else default to Monday (0)
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayIdx = dayDates.indexOf(today);
    setSelectedDayIndex(todayIdx >= 0 ? todayIdx : 0);
  }, [dayDates]);

  // Group sessions by day of week (0 = Monday, ..., 4 = Friday)
  const byDay = useMemo(() => {
    const groups: WeeklyPlanSession[][] = [[], [], [], [], []];
    for (const s of sessions) {
      const dateStr = s.session_date || s.date;
      for (let i = 0; i < 5; i++) {
        if (dateStr === dayDates[i]) {
          groups[i].push(s);
          break;
        }
      }
    }
    // Sort each day's sessions by start_time
    for (const group of groups) {
      group.sort((a, b) => {
        const tA = a.start_time || a.time || '';
        const tB = b.start_time || b.time || '';
        return tA.localeCompare(tB);
      });
    }
    return groups;
  }, [sessions, dayDates]);

  // Reset scroll and states on navigation focus
  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      return () => {
        setSelectedSessionDetail(null);
        setToastMessage(null);
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      };
    }, [])
  );

  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('tabPress', () => {
      setSelectedSessionDetail(null);
      setToastMessage(null);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (route.params?.resetKey) {
      setSelectedSessionDetail(null);
      setToastMessage(null);
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
        const cacheKey = `kreativa_cache_weekly_plan_${studentId}_${weekStart}`;
        const cached = await storage.getCache<WeeklyPlanSession[]>(cacheKey);
        if (cached && Array.isArray(cached) && isMounted) {
          setSessions(cached);
          setLoading(false);
        }
      } catch (err) {
        console.warn('[WeeklyPlan] Cache hydration error:', err);
      }
    }
    hydrateCache();
    return () => {
      isMounted = false;
    };
  }, [weekStart]);

  // Real API Fetch
  const loadSessions = useCallback(async (isRefresh = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isRefresh) {
      setRefreshing(true);
    }

    try {
      const data = await api.weeklyPlan.getWeek(weekStart);
      setSessions(data);

      const session = await storage.getStudentSession();
      const studentId = session?.studentId ?? session?.userId ?? 'default';
      const cacheKey = `kreativa_cache_weekly_plan_${studentId}_${weekStart}`;
      await storage.setCache(cacheKey, data);
    } catch (err) {
      console.warn('[WeeklyPlan] Failed to fetch weekly sessions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [weekStart]);

  useEffect(() => {
    loadSessions(false);
  }, [loadSessions]);

  const onRefresh = useCallback(() => {
    loadSessions(true);
  }, [loadSessions]);

  // Week navigation
  const canGoNext = weekStart < currentMonday;
  const handlePrevWeek = () => {
    setWeekStart((prev) => addDays(prev, -7));
  };
  const handleNextWeek = () => {
    if (canGoNext) {
      setWeekStart((prev) => addDays(prev, 7));
    }
  };

  const rangeLabel = useMemo(() => formatWeekRangeLabel(weekStart), [weekStart]);
  const profileLine = [studentProfile.className, studentProfile.schoolName].filter(Boolean).join(', ');

  // If session detail view is open
  if (selectedSessionDetail) {
    const selectedDayLabel = DAY_SHORT[selectedDayIndex] || 'Monday';
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader showTitle={false} />
        <ToastAlert
          visible={Boolean(toastMessage)}
          message={toastMessage || ''}
          type="success"
          floating
          onClose={() => setToastMessage(null)}
        />
        <WeeklyPlanDetailView
          session={selectedSessionDetail}
          dayName={selectedDayLabel}
          onBack={() => setSelectedSessionDetail(null)}
          onUpdateSession={(updated) => {
            // Update in-memory session list
            setSessions((prev) =>
              prev.map((item) =>
                item.sessionId === updated.sessionId ? { ...item, ...updated } : item
              )
            );
            setToastMessage(`Updated progress for ${updated.courseName}`);
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader showTitle={false} />

      <ToastAlert
        visible={Boolean(toastMessage)}
        message={toastMessage || ''}
        type="success"
        floating
        onClose={() => setToastMessage(null)}
      />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1B2D4F']}
            tintColor="#1B2D4F"
          />
        }
      >
        {/* Header Title (Web LMS 100% Alignment) */}
        <View style={styles.headerBox}>
          <Text style={styles.pageTitle}>Weekly Plan</Text>
        </View>

        {/* YOUR PROFILE Box */}
        {(studentProfile.fullName || profileLine) && (
          <View style={styles.profileBox}>
            <Text style={styles.profileLabel}>YOUR PROFILE</Text>
            {studentProfile.fullName ? (
              <Text style={styles.profileName}>{studentProfile.fullName}</Text>
            ) : null}
            {profileLine ? (
              <Text style={styles.profileDetails}>{profileLine}</Text>
            ) : null}
          </View>
        )}

        {/* Week Navigator Row */}
        <View style={styles.navigatorRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={handlePrevWeek}
            activeOpacity={0.7}
          >
            <ChevronLeft size={16} color={SEC_HS.navy} strokeWidth={2.5} />
            <Text style={styles.navButtonText}>Prev</Text>
          </TouchableOpacity>

          <Text style={styles.rangeLabelText}>
            {rangeLabel}
          </Text>

          <TouchableOpacity
            style={[styles.navButton, !canGoNext && styles.navButtonDisabled]}
            onPress={handleNextWeek}
            disabled={!canGoNext}
            activeOpacity={canGoNext ? 0.7 : 1}
          >
            <Text
              style={[
                styles.navButtonText,
                !canGoNext && styles.navButtonTextDisabled,
              ]}
            >
              Next
            </Text>
            <ChevronRight
              size={16}
              color={canGoNext ? SEC_HS.navy : '#94A3B8'}
              strokeWidth={2.5}
            />
          </TouchableOpacity>
        </View>

        {loading && sessions.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={SEC_HS.navy} />
          </View>
        ) : sessions.length === 0 ? (
          <EmptyState
            boxed
            title="No sessions scheduled this week."
          />
        ) : (
          <>
            {/* 5 Day Selector Chips (Scrollable Horizontal Row) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayTabsRow}
            >
              {DAY_SHORT.map((label, idx) => {
                const isSelected = selectedDayIndex === idx;
                const count = byDay[idx].length;
                const dayNum = dayDates[idx].slice(8, 10).replace(/^0/, '');

                return (
                  <TouchableOpacity
                    key={label}
                    onPress={() => setSelectedDayIndex(idx)}
                    style={[styles.dayChip, isSelected ? styles.dayChipSelected : styles.dayChipUnselected]}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.dayChipTitle,
                        isSelected ? styles.dayChipTitleSelected : styles.dayChipTitleUnselected,
                      ]}
                    >
                      {label} {dayNum}
                    </Text>
                    <Text style={styles.dayChipSubtitle}>
                      {count} lesson{count === 1 ? '' : 's'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Today's Schedule Section Title */}
            <Text style={styles.scheduleTitle}>Today&apos;s schedule</Text>

            {byDay[selectedDayIndex].length === 0 ? (
              <EmptyState
                boxed
                title="No sessions on this day."
              />
            ) : (
              /* Timeline 3-Column Layout (Web Mobile Aligned) */
              <View style={styles.timelineList}>
                {byDay[selectedDayIndex].map((session, idx) => {
                  const isLast = idx === byDay[selectedDayIndex].length - 1;
                  const pastel = subjectPastel(session.subject_name || session.courseName);
                  const subjectTitle = session.subject_name || session.courseName;

                  return (
                    <View key={String(session.id || session.sessionId || idx)} style={styles.timelineRow}>
                      {/* 1. Time Column (72px) */}
                      <View style={styles.timeColumn}>
                        <Text style={styles.timeLabel}>
                          {timeSlotLabel(session.start_time, session.end_time)}
                        </Text>
                      </View>

                      {/* 2. Timeline Bullet & Connector Line */}
                      <View style={styles.bulletColumn}>
                        <View style={styles.bulletDot} />
                        {!isLast && <View style={styles.connectorLine} />}
                      </View>

                      {/* 3. Subject Pastel Card */}
                      <View style={styles.cardColumn}>
                        <TouchableOpacity
                          style={[styles.subjectCard, { backgroundColor: pastel.bg }]}
                          onPress={() => setSelectedSessionDetail(session)}
                          activeOpacity={0.85}
                        >
                          <View style={styles.subjectBadgeWrap}>
                            <Text style={[styles.subjectBadgeText, { color: pastel.text }]}>
                              {subjectTitle}
                            </Text>
                          </View>
                          {session.title ? (
                            <Text style={styles.subjectTopic} numberOfLines={2}>
                              {session.title}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerBox: {
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: SEC_HS.navy,
    letterSpacing: -0.3,
  },
  profileBox: {
    backgroundColor: SEC_HS.white,
    borderWidth: 1,
    borderColor: SEC_HS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  profileLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: SEC_HS.muted,
    marginBottom: 4,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: SEC_HS.navy,
  },
  profileDetails: {
    fontSize: 13,
    color: SEC_HS.muted,
    marginTop: 2,
  },
  navigatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SEC_HS.border,
    backgroundColor: SEC_HS.white,
  },
  navButtonDisabled: {
    backgroundColor: SEC_HS.warm,
    borderColor: SEC_HS.border,
  },
  navButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: SEC_HS.navy,
  },
  navButtonTextDisabled: {
    color: '#94A3B8',
  },
  rangeLabelText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: SEC_HS.navy,
    lineHeight: 19,
    paddingHorizontal: 4,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayTabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
    marginBottom: 16,
  },
  dayChip: {
    minWidth: 68,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipSelected: {
    backgroundColor: SEC_HS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 0,
  },
  dayChipUnselected: {
    backgroundColor: SEC_HS.warm,
    borderWidth: 1,
    borderColor: SEC_HS.border,
  },
  dayChipTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  dayChipTitleSelected: {
    color: SEC_HS.navy,
  },
  dayChipTitleUnselected: {
    color: SEC_HS.muted,
  },
  dayChipSubtitle: {
    fontSize: 10,
    color: SEC_HS.muted,
    marginTop: 2,
  },
  scheduleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: SEC_HS.navy,
    marginBottom: 12,
  },
  timelineList: {
    marginTop: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 74,
  },
  timeColumn: {
    width: 72,
    paddingTop: 12,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SEC_HS.muted,
    lineHeight: 16,
  },
  bulletColumn: {
    width: 20,
    alignItems: 'center',
    position: 'relative',
  },
  bulletDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: SEC_HS.navy,
    marginTop: 15,
    zIndex: 2,
  },
  connectorLine: {
    position: 'absolute',
    top: 25,
    bottom: 0,
    width: 2,
    backgroundColor: SEC_HS.border,
    zIndex: 1,
  },
  cardColumn: {
    flex: 1,
    paddingLeft: 6,
    paddingBottom: 12,
  },
  subjectCard: {
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  subjectBadgeWrap: {
    alignSelf: 'flex-start',
    backgroundColor: SEC_HS.white,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 6,
  },
  subjectBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  subjectTopic: {
    fontSize: 13,
    fontWeight: '500',
    color: SEC_HS.text,
    lineHeight: 18,
  },
});

export default WeeklyPlanScreen;
