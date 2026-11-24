import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useStudentData } from '../../context/StudentDataContext';
import { Course } from '../../types';
import { FONTS, SHADOWS } from '../../constants/theme';
import AppHeader from '../../components/navigation/AppHeader';
import CourseDetailView from './CourseDetailView';
import EmptyState from '../../components/feedback/EmptyState';
import ErrorState from '../../components/feedback/ErrorState';
import CardSkeleton from '../../components/feedback/CardSkeleton';

interface SelfPacedCardProps {
  course: Course;
  onPress: () => void;
}

const SelfPacedCard: React.FC<SelfPacedCardProps> = ({ course, onPress }) => {
  const [isHovered, setIsHovered] = useState(false);
  const pct = Math.min(100, Math.max(0, Number(course.completion_pct) || 0));
  const initial = (course.name || course.subject_name || 'C').charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      // @ts-ignore - web hover props
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={[styles.selfPacedCard, isHovered && styles.cardHovered]}
    >
      {/* Thumbnail Banner */}
      <View style={styles.thumbnailContainer}>
        {course.thumbnail_url ? (
          <Image
            source={{ uri: course.thumbnail_url }}
            style={styles.thumbnailImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.thumbnailFallback}>
            <Text style={styles.thumbnailInitial}>{initial}</Text>
          </View>
        )}
        <View style={styles.selfPacedBadge}>
          <Text style={styles.selfPacedBadgeText}>Self-Paced</Text>
        </View>
      </View>

      {/* Card Body */}
      <View style={styles.selfPacedBody}>
        <Text style={styles.courseTitle} numberOfLines={2}>
          {course.name || course.subject_name}
        </Text>
        <Text style={styles.teacherText} numberOfLines={1}>
          {course.teacher_name || course.teacher || 'No teacher assigned'}
        </Text>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.progressText}>{pct}% Complete</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

interface ClassCourseCardProps {
  course: Course;
  onPress: () => void;
}

const ClassCourseCard: React.FC<ClassCourseCardProps> = ({ course, onPress }) => {
  const [isHovered, setIsHovered] = useState(false);
  const sessionCount = Number(course.session_count ?? course.sessions ?? 0);
  const code = course.subject_code || course.code || 'CRS';
  const status = course.status || 'active';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      // @ts-ignore - web hover props
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={[styles.classCard, isHovered && styles.cardHovered]}
    >
      {/* Top Badges Row */}
      <View style={styles.badgeRow}>
        <View style={styles.codeBadge}>
          <Text style={styles.codeBadgeText}>{code}</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{status}</Text>
        </View>
      </View>

      {/* Course Title */}
      <Text style={styles.courseTitle} numberOfLines={2}>
        {course.name || course.subject_name}
      </Text>

      {/* Teacher Name */}
      <Text style={styles.teacherText} numberOfLines={1}>
        {course.teacher_name || course.teacher || 'No teacher assigned'}
      </Text>

      {/* Sessions Count */}
      <Text style={styles.sessionText}>
        {sessionCount} sessions
      </Text>
    </TouchableOpacity>
  );
};

export const CoursesScreen: React.FC = () => {
  const {
    courses,
    studentProfile,
    isCoursesLoading,
    fetchCourses,
    isLoading,
    isRefreshing,
    isError,
    errorMessage,
    refreshAllData,
  } = useStudentData();

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [localRefreshing, setLocalRefreshing] = useState(false);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const scrollRef = useRef<any>(null);
  const isFetchingRef = useRef(false);

  // Focus effect: fetch fresh courses on focus safely with mutex
  useFocusEffect(
    useCallback(() => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      fetchCourses()
        .catch(() => {})
        .finally(() => {
          isFetchingRef.current = false;
        });

      return () => {
        isFetchingRef.current = false;
      };
    }, [fetchCourses])
  );

  // Tab reset handler
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('tabPress', () => {
      setSelectedCourse(null);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });
    return unsubscribe;
  }, [navigation]);

  // Route reset param handler
  useEffect(() => {
    if (route.params?.resetKey) {
      setSelectedCourse(null);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [route.params?.resetKey]);

  // Handle pull to refresh
  const handleRefresh = async () => {
    setLocalRefreshing(true);
    try {
      await fetchCourses(true);
    } catch {
      // ignore
    } finally {
      setLocalRefreshing(false);
    }
  };

  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 16) + 110;

  const selfPacedCourses = courses.filter((c) => c.course_format === 'self_paced');
  const classCourses = courses.filter((c) => c.course_format !== 'self_paced');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title="My Courses" />

      {selectedCourse ? (
        <CourseDetailView
          course={selectedCourse}
          onBack={() => {
            setSelectedCourse(null);
            scrollRef.current?.scrollTo({ y: 0, animated: false });
          }}
        />
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={localRefreshing || isRefreshing}
              onRefresh={handleRefresh}
              colors={['#2563EB']}
              tintColor="#2563EB"
            />
          }
        >
          {/* Header Title */}
          <View style={styles.headerBox}>
            <Text style={styles.pageTitle}>My Courses</Text>
            <Text style={styles.pageSubtitle}>
              Academic Year {studentProfile?.academicYearName || '2026/2027'}
            </Text>
          </View>

          {/* Data State Guards */}
          {isCoursesLoading && courses.length === 0 ? (
            <CardSkeleton count={3} variant="course" />
          ) : isError ? (
            <ErrorState
              title="Failed to Load Courses"
              subtitle={errorMessage || undefined}
              onRetry={() => fetchCourses(true)}
            />
          ) : courses.length === 0 ? (
            <EmptyState
              icon="book-outline"
              message="No courses enrolled yet."
            />
          ) : (
            <View style={styles.contentSections}>
              {/* 1. Self-Paced Courses Section */}
              {selfPacedCourses.length > 0 && (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>SELF-PACED COURSES</Text>
                  <View style={styles.cardList}>
                    {selfPacedCourses.map((c) => (
                      <SelfPacedCard
                        key={c.id}
                        course={c}
                        onPress={() => setSelectedCourse(c)}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* 2. Class-Based Courses Section */}
              {classCourses.length > 0 && (
                <View style={styles.sectionBlock}>
                  {selfPacedCourses.length > 0 && (
                    <Text style={styles.sectionTitle}>CLASS-BASED COURSES</Text>
                  )}
                  <View style={styles.cardList}>
                    {classCourses.map((c) => (
                      <ClassCourseCard
                        key={c.id}
                        course={c}
                        onPress={() => setSelectedCourse(c)}
                      />
                    ))}
                  </View>
                </View>
              )}
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
    backgroundColor: '#F8FAFC',
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
    marginBottom: 20,
  },
  pageTitle: {
    fontFamily: FONTS.title,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0,
  },
  pageSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  contentSections: {
    gap: 24,
  },
  sectionBlock: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#64748B',
    textTransform: 'uppercase',
  },
  cardList: {
    gap: 16,
  },
  selfPacedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  thumbnailContainer: {
    width: '100%',
    height: 140,
    backgroundColor: '#4F46E5',
    position: 'relative',
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailFallback: {
    flex: 1,
    backgroundColor: '#4338CA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailInitial: {
    fontFamily: FONTS.bold,
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    opacity: 0.25,
  },
  selfPacedBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
  },
  selfPacedBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: '#4338CA',
  },
  selfPacedBody: {
    padding: 16,
  },
  progressContainer: {
    marginTop: 10,
    gap: 6,
  },
  progressBarTrack: {
    height: 7,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 999,
  },
  progressText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: '#4338CA',
  },
  classCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
    paddingVertical: 18,
    paddingHorizontal: 20,
    ...SHADOWS.sm,
  },
  cardHovered: {
    transform: [{ translateY: -2 }],
    borderTopColor: '#BFDBFE',
    borderRightColor: '#BFDBFE',
    borderBottomColor: '#BFDBFE',
    borderLeftColor: '#1D4ED8',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  codeBadge: {
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 3.5,
  },
  codeBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  statusPill: {
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 3.5,
  },
  statusPillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
  },
  courseTitle: {
    fontFamily: FONTS.title,
    fontSize: 16.5,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 23,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  teacherText: {
    fontFamily: FONTS.regular,
    fontSize: 13.5,
    color: '#64748B',
    marginBottom: 10,
  },
  sessionText: {
    fontFamily: FONTS.medium,
    fontSize: 12.5,
    color: '#94A3B8',
  },
});

export default CoursesScreen;
