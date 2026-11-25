import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useStudentData } from '../../context/StudentDataContext';
import { storage } from '../../services/storage';
import { StudentProfile } from '../../types';
import AppHeader from '../../components/navigation/AppHeader';
import CardSkeleton from '../../components/feedback/CardSkeleton';
import ErrorState from '../../components/feedback/ErrorState';
import { FONTS, SHADOWS } from '../../constants/theme';

export const ProfileScreen: React.FC = () => {
  const { studentProfile, fetchProfile } = useStudentData();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const scrollRef = useRef<any>(null);
  const { width } = useWindowDimensions();
  const isTwoColumns = width >= 640;

  const [profile, setProfile] = useState<Partial<StudentProfile> | null>(
    studentProfile?.fullName ? studentProfile : null
  );
  const [loading, setLoading] = useState<boolean>(!studentProfile?.fullName);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  // Instant SWR Cache-First Hydration (< 0.05s)
  useEffect(() => {
    let isMounted = true;
    async function hydrateCache() {
      try {
        const session = await storage.getStudentSession();
        const studentId = session?.studentId ?? session?.userId ?? 'default';
        const cached = await storage.getCache<Partial<StudentProfile>>(
          `kreativa_cache_profile_${studentId}`
        );
        if (cached && cached.fullName && isMounted) {
          setProfile(cached);
          setLoading(false);
        }
      } catch (e) {
        console.warn('[Profile Cache Hydration Warning]', e);
      }
    }
    hydrateCache();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch live profile from GET /api/profile via StudentDataContext (keeps Sidebar & Profile synced)
  const loadProfile = useCallback(
    async (isRefresh = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      if (isRefresh) {
        setRefreshing(true);
      }
      setError(null);

      try {
        const liveProfile = await fetchProfile();
        if (liveProfile && liveProfile.fullName) {
          setProfile(liveProfile);
        } else if (!profile?.fullName && !studentProfile?.fullName) {
          setError('Failed to load profile from server.');
        }
      } catch (err: any) {
        console.warn('[Profile Load Error]', err?.message || err);
        setError(err?.message || 'Failed to load profile from server.');
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchProfile, profile?.fullName, studentProfile?.fullName]
  );

  // Sync live API and scroll to top on focus / blur
  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      loadProfile(false);
      return () => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      };
    }, [loadProfile])
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

  const onRefresh = useCallback(() => {
    loadProfile(true);
  }, [loadProfile]);

  const activeProfile = profile ?? studentProfile;
  const initials = activeProfile?.fullName
    ? activeProfile.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'ST';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title="Profile" />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
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
        {/* Web PageHeader Alignment */}
        <View style={styles.headerBox}>
          <Text style={styles.pageTitle}>Profile</Text>
          <Text style={styles.pageSubtitle}>Your student information</Text>
        </View>

        {loading && !activeProfile?.fullName ? (
          <View style={styles.cardWrapper}>
            <CardSkeleton />
          </View>
        ) : error && !activeProfile?.fullName ? (
          <View style={styles.cardWrapper}>
            <ErrorState subtitle={error} onRetry={() => loadProfile(false)} />
          </View>
        ) : !activeProfile?.fullName ? (
          <Text style={styles.emptyText}>Profile data not available.</Text>
        ) : (
          <View style={styles.cardWrapper}>
            {/* Web Card Alignment: bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm */}
            <View style={styles.profileCard}>
              {/* Top Row: Avatar + Name + Email */}
              <View style={styles.topRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitial}>{initials}</Text>
                </View>
                <View style={styles.topDetails}>
                  <Text style={styles.studentName}>{activeProfile.fullName}</Text>
                  <Text style={styles.studentEmail}>{activeProfile.email}</Text>
                </View>
              </View>

              {/* Details Grid: grid-cols-1 sm:grid-cols-2 gap-4 */}
              <View style={[styles.fieldsGrid, isTwoColumns && styles.fieldsGridTwoCols]}>
                <View style={[styles.fieldGroup, isTwoColumns && styles.fieldGroupHalf]}>
                  <Text style={styles.fieldLabel}>SCHOOL</Text>
                  <Text style={styles.fieldValue}>{activeProfile.schoolName || 'N/A'}</Text>
                </View>

                <View style={[styles.fieldGroup, isTwoColumns && styles.fieldGroupHalf]}>
                  <Text style={styles.fieldLabel}>CLASS</Text>
                  <Text style={styles.fieldValue}>
                    {activeProfile.className || 'Not assigned'}
                  </Text>
                </View>

                <View style={[styles.fieldGroup, isTwoColumns && styles.fieldGroupHalf]}>
                  <Text style={styles.fieldLabel}>ACADEMIC YEAR</Text>
                  <Text style={styles.fieldValue}>
                    {activeProfile.academicYearName || 'N/A'}
                  </Text>
                </View>

                {activeProfile.studentCode ? (
                  <View style={[styles.fieldGroup, isTwoColumns && styles.fieldGroupHalf]}>
                    <Text style={styles.fieldLabel}>STUDENT ID</Text>
                    <Text style={styles.fieldValue}>{activeProfile.studentCode}</Text>
                  </View>
                ) : null}

                {activeProfile.house ? (
                  <View style={[styles.fieldGroup, isTwoColumns && styles.fieldGroupHalf]}>
                    <Text style={styles.fieldLabel}>HOUSE</Text>
                    <Text style={styles.fieldValue}>{activeProfile.house}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Matches Web LMS student layout bg
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
    marginBottom: 24, // Matches Web mb-6
  },
  pageTitle: {
    fontFamily: FONTS.title,
    fontSize: 24, // Matches Web text-2xl
    lineHeight: 32,
    fontWeight: '700', // Matches Web font-bold
    color: '#0F172A',
  },
  pageSubtitle: {
    fontSize: 14, // Matches Web text-sm
    fontFamily: FONTS.regular,
    color: '#475569', // Matches Web text-[#475569]
    marginTop: 4, // Matches Web mt-1
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 672, // Matches Web max-w-2xl
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12, // Matches Web rounded-xl
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20, // Matches Web p-5
    ...SHADOWS.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16, // Matches Web gap-4
    marginBottom: 24, // Matches Web mb-6
  },
  avatarCircle: {
    width: 64, // Matches Web w-16
    height: 64, // Matches Web h-16
    borderRadius: 32,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 20, // Matches Web text-xl
    fontFamily: FONTS.title,
    fontWeight: '700', // Matches Web font-bold
    color: '#FFFFFF',
  },
  topDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 18, // Matches Web text-lg
    fontFamily: FONTS.title,
    fontWeight: '600', // Matches Web font-semibold
    color: '#0F172A',
  },
  studentEmail: {
    fontSize: 14, // Matches Web text-sm
    fontFamily: FONTS.regular,
    color: '#475569', // Matches Web text-[#475569]
    marginTop: 2,
  },
  fieldsGrid: {
    gap: 16, // Matches Web gap-4
  },
  fieldsGridTwoCols: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  fieldGroup: {
    width: '100%',
  },
  fieldGroupHalf: {
    width: '48%',
  },
  fieldLabel: {
    fontSize: 12, // Matches Web text-xs
    fontFamily: FONTS.semiBold,
    color: '#94A3B8', // Matches Web text-[#94A3B8]
    letterSpacing: 0.6, // Matches Web tracking-wider
    textTransform: 'uppercase',
  },
  fieldValue: {
    fontSize: 14, // Matches Web text-sm
    fontFamily: FONTS.regular,
    color: '#0F172A', // Matches Web text-[#0F172A]
    marginTop: 4, // Matches Web mt-1
  },
  emptyText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#475569',
  },
});

export default ProfileScreen;
