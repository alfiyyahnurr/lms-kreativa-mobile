import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabParamList } from '../../types/navigation';
import { Assignment } from '../../types';
import { api } from '../../services/api';
import { storage } from '../../services/storage';
import AppHeader from '../../components/navigation/AppHeader';
import ToastAlert from '../../components/feedback/ToastAlert';
import CardSkeleton from '../../components/feedback/CardSkeleton';
import ErrorState from '../../components/feedback/ErrorState';
import { FONTS } from '../../constants/theme';
import AssignmentDetailView from './AssignmentDetailView';

export const AssignmentsScreen: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<BottomTabParamList, 'AssignmentsTab'>>();
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const scrollRef = useRef<any>(null);

  // Formatting helper matching Web LMS format(new Date(...), 'MMM d, yyyy')
  const formatDueDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Score formatter ensuring 2 decimal places matching Web LMS (NUMERIC(6,2))
  const formatScoreDisplay = (val: any) => {
    if (val == null || val === '—') return null;
    const n = Number(val);
    return isNaN(n) ? String(val) : n.toFixed(2);
  };

  const isFetchingRef = useRef<boolean>(false);

  // Instant SWR Cache-First Hydration (< 0.05s)
  useEffect(() => {
    let isMounted = true;
    async function hydrateCache() {
      try {
        const session = await storage.getStudentSession();
        const studentId = session?.studentId ?? session?.userId ?? 'default';
        const cached = await storage.getCache<Assignment[]>(`kreativa_cache_assignments_${studentId}`);
        if (cached && Array.isArray(cached) && cached.length > 0 && isMounted) {
          setAssignments(cached.filter((a) => a.id !== 999999));
          setIsLoading(false); // Instant render!
        }
      } catch (e) {
        console.warn('[Assignments Cache Hydration Warning]', e);
      }
    }
    hydrateCache();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch live assignments from API (Stable & Guarded)
  const fetchAssignments = useCallback(async (isRefresh = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setIsError(false);
      setErrorMessage(null);

      const data = await api.assignments.list();
      setAssignments(data.filter((a) => a.id !== 999999));

      // Persist latest data snapshot to local cache in background
      void (async () => {
        try {
          const session = await storage.getStudentSession();
          const studentId = session?.studentId ?? session?.userId ?? 'default';
          await storage.setCache(`kreativa_cache_assignments_${studentId}`, data);
        } catch {
          // ignore cache write error
        }
      })();
    } catch (err: any) {
      console.error('Failed to load assignments:', err);
      setIsError(true);
      setErrorMessage(err?.message || 'Failed to load assignments from server.');
      setAssignments((prev) => prev.filter((a) => a.id !== 999999));
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Sync on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchAssignments();
    }, [fetchAssignments])
  );

  // Auto-close assignment detail and scroll to top when navigating away
  useFocusEffect(
    useCallback(() => {
      return () => {
        setSelectedAssignment(null);
        setToastMessage(null);
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      };
    }, [])
  );

  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('tabPress', () => {
      setSelectedAssignment(null);
      setToastMessage(null);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if ((route.params as any)?.resetKey) {
      setSelectedAssignment(null);
      setToastMessage(null);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [(route.params as any)?.resetKey]);

  useEffect(() => {
    if (route.params?.assignmentId) {
      const found = assignments.find((a) => a.id === route.params?.assignmentId);
      if (found) {
        setSelectedAssignment(found);
        navigation.setParams({ isDetail: true, assignmentId: undefined });
      }
    }
  }, [route.params?.assignmentId, assignments]);

  useEffect(() => {
    if (route.params?.isDetail === false && selectedAssignment !== null) {
      setSelectedAssignment(null);
    }
  }, [route.params?.isDetail]);

  const handleSelectAssignment = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    navigation.setParams({ isDetail: true });
  };

  const handleBack = () => {
    setSelectedAssignment(null);
    navigation.setParams({ isDetail: false, assignmentId: undefined });
    fetchAssignments(); // Refresh list to get updated submission status
  };

  const handleSubmissionSuccess = (assignmentId: number) => {
    setAssignments((prev) =>
      prev.map((a) => (a.id === assignmentId ? { ...a, status: 'submitted', submission_status: 'submitted' } : a))
    );
    const target = assignments.find((a) => a.id === assignmentId);
    setToastMessage(`Assignment "${target?.title || 'Assignment'}" successfully submitted!`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title="Assignments" />

      <ToastAlert
        visible={Boolean(toastMessage)}
        message={toastMessage || ''}
        type="success"
        floating
        onClose={() => setToastMessage(null)}
      />

      {selectedAssignment ? (
        <AssignmentDetailView
          assignment={selectedAssignment}
          onBack={handleBack}
          onSubmitSuccess={handleSubmissionSuccess}
          backLabel="Back to Assignments"
        />
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchAssignments(true)}
              colors={['#2563EB']}
              tintColor={'#2563EB'}
            />
          }
        >
          {/* Header Title & Subtitle matching Web LMS */}
          <View style={styles.headerBox}>
            <Text style={styles.pageTitle}>Assignments</Text>
            <Text style={styles.pageSubtitle}>All assignments across your courses</Text>
          </View>

          {/* Loading & Error States */}
          {isLoading && !isRefreshing ? (
            <CardSkeleton count={3} variant="assignment" />
          ) : isError && assignments.length === 0 ? (
            <ErrorState
              title="Failed to Load Assignments"
              subtitle={errorMessage || undefined}
              onRetry={() => fetchAssignments()}
            />
          ) : assignments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No assignments found.</Text>
            </View>
          ) : (
            /* Card Grid View (100% Identical to Web LMS CardList - Grid Aja) */
            <View style={styles.cardList}>
              {assignments.map((assignment) => {
                const courseName = assignment.course_name || assignment.course || 'Course';
                const formattedDueDate = formatDueDate(assignment.due_date || assignment.dueDate);
                const score =
                  assignment.submission_score != null
                    ? assignment.submission_score
                    : assignment.score && assignment.score !== '—'
                      ? assignment.score
                      : null;
                const status = assignment.submission_status || assignment.status || 'pending';

                return (
                  <TouchableOpacity
                    key={assignment.id}
                    onPress={() => handleSelectAssignment(assignment)}
                    activeOpacity={0.75}
                    style={styles.assignmentCard}
                  >
                    <Text style={styles.assignmentTitle} numberOfLines={2}>
                      {assignment.title}
                    </Text>
                    {/* Subtitle murni tanpa kata '(expired)' matching Web LMS */}
                    <Text style={styles.assignmentSubtitle} numberOfLines={2}>
                      {courseName} • Due: {formattedDueDate}
                    </Text>

                    <View style={styles.cardFooter}>
                      <View
                        style={[
                          styles.badgePill,
                          status === 'graded'
                            ? styles.badgeGraded
                            : status === 'submitted'
                              ? styles.badgeSubmitted
                              : styles.badgePending,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgePillText,
                            status === 'graded'
                              ? styles.badgeTextGraded
                              : status === 'submitted'
                                ? styles.badgeTextSubmitted
                                : styles.badgeTextPending,
                          ]}
                        >
                          {status}
                        </Text>
                      </View>

                      {score != null && (
                        <Text style={styles.scoreText}>
                          {formatScoreDisplay(score)}/{assignment.max_score || 100}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Slate-50 background matching Web LMS
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 108,
  },
  headerBox: {
    marginBottom: 16,
  },
  pageTitle: {
    fontFamily: FONTS.title,
    fontSize: 24,
    lineHeight: 32,
    color: '#0F172A',
  },
  pageSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    marginTop: 4,
  },
  // Card List matching Web LMS with compact 12px mobile spacing
  cardList: {
    gap: 12,
  },
  // Card styling matching Web LMS Card with compact 16px padding
  assignmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  assignmentTitle: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 20,
    marginBottom: 3,
  },
  assignmentSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  badgePending: {
    backgroundColor: '#FFEDD5', // orange-100
  },
  badgeSubmitted: {
    backgroundColor: '#DBEAFE', // blue-100
  },
  badgeGraded: {
    backgroundColor: '#DCFCE7', // green-100
  },
  badgePillText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  badgeTextPending: {
    color: '#9A3412', // orange-800
  },
  badgeTextSubmitted: {
    color: '#1E40AF', // blue-800
  },
  badgeTextGraded: {
    color: '#166534', // green-800
  },
  scoreText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#16A34A',
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#64748B',
  },
});

export default AssignmentsScreen;
