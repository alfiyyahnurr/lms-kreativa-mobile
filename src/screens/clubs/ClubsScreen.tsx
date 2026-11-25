import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { Trophy, Image as ImageIcon } from 'lucide-react-native';
import { api, API_BASE_URL } from '../../services/api';
import { storage } from '../../services/storage';
import { ClubItem, ClubReportItem } from '../../types';
import AppHeader from '../../components/navigation/AppHeader';
import EmptyState from '../../components/feedback/EmptyState';
import ClubDetailView from './ClubDetailView';

const WEEKDAY_EN = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  const raw = String(url).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${API_BASE_URL}${path}`;
}

function getFirstPhotoUrl(r: ClubReportItem): string | null {
  const main = resolveMediaUrl(r.photo_url);
  if (main) return main;
  let extra: unknown = r.photo_urls;
  if (typeof extra === 'string') {
    try {
      extra = JSON.parse(extra);
    } catch {
      extra = null;
    }
  }
  if (Array.isArray(extra)) {
    for (const u of extra) {
      const resolved = resolveMediaUrl(typeof u === 'string' ? u : null);
      if (resolved) return resolved;
    }
  }
  return null;
}

function formatWeekly(c: ClubItem): string {
  const day = c.meeting_weekday != null ? WEEKDAY_EN[Number(c.meeting_weekday)] : '';
  const start = c.meeting_start ? String(c.meeting_start).slice(0, 5) : '';
  const end = c.meeting_end ? String(c.meeting_end).slice(0, 5) : '';
  if (!day && !start) return c.schedule_text ? String(c.schedule_text) : 'Schedule TBA';
  return [day, start && end ? `${start}–${end}` : start, c.meeting_location ? String(c.meeting_location) : '']
    .filter(Boolean)
    .join(' · ');
}

export const ClubsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const scrollRef = useRef<any>(null);

  const [clubs, setClubs] = useState<ClubItem[]>([]);
  const [recentReports, setRecentReports] = useState<ClubReportItem[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null);
  const [openToReports, setOpenToReports] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const isFetchingRef = useRef<boolean>(false);

  // Reset view to root list and scroll to top on focus / blur
  useFocusEffect(
    useCallback(() => {
      if (!route.params?.isDetail) {
        setSelectedClubId(null);
        setOpenToReports(false);
      }
      scrollRef.current?.scrollTo({ y: 0, animated: false });

      return () => {
        setSelectedClubId(null);
        setOpenToReports(false);
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      };
    }, [route.params?.isDetail])
  );

  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('tabPress', () => {
      setSelectedClubId(null);
      setOpenToReports(false);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (route.params?.resetKey) {
      setSelectedClubId(null);
      setOpenToReports(false);
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
        const cached = await storage.getCache<{ clubs: ClubItem[]; recentReports: ClubReportItem[] }>(
          `kreativa_cache_clubs_${studentId}`
        );
        if (cached && isMounted) {
          if (Array.isArray(cached.clubs)) setClubs(cached.clubs);
          if (Array.isArray(cached.recentReports)) setRecentReports(cached.recentReports);
          setLoading(false);
        }
      } catch (err) {
        console.warn('[Clubs] Cache hydration error:', err);
      }
    }
    hydrateCache();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadClubs = useCallback(async (isRefresh = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isRefresh) {
      setRefreshing(true);
    }

    try {
      const data = await api.clubs.list();
      setClubs(data.clubs || []);
      setRecentReports(data.recentReports || []);

      const session = await storage.getStudentSession();
      const studentId = session?.studentId ?? session?.userId ?? 'default';
      await storage.setCache(`kreativa_cache_clubs_${studentId}`, data);
    } catch (err) {
      console.warn('[Clubs] Failed to load clubs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadClubs(false);
  }, [loadClubs]);

  const onRefresh = useCallback(() => {
    loadClubs(true);
  }, [loadClubs]);

  const handleOpenClub = (clubId: number, toReports = false) => {
    setOpenToReports(toReports);
    setSelectedClubId(clubId);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader
        title={selectedClubId ? 'Club Detail' : 'My Clubs'}
        showTitle
      />

      {selectedClubId ? (
        <ClubDetailView
          clubId={selectedClubId}
          onBack={() => {
            setSelectedClubId(null);
            setOpenToReports(false);
          }}
          initialScrollToReports={openToReports}
        />
      ) : (
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
          {/* Header Block (100% Web Aligned) */}
          <View style={styles.headerBlock}>
            <Text style={styles.pageTitle}>My Clubs</Text>
            <Text style={styles.pageSubtitle}>
              Extracurricular schedule, materials, scores, and documentation reports.
            </Text>
          </View>

          {loading && clubs.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          ) : clubs.length === 0 ? (
            <EmptyState
              boxed
              title="You are not a member of any club yet."
              customIcon={<Trophy size={32} color="#94A3B8" />}
            />
          ) : (
            <View style={styles.clubListGap}>
              {clubs.map((c) => (
                <TouchableOpacity
                  key={String(c.id)}
                  style={styles.clubCard}
                  onPress={() => handleOpenClub(c.id, false)}
                  activeOpacity={0.75}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.clubInfoWrap}>
                      <Text style={styles.clubName}>{c.name}</Text>
                      <Text style={styles.clubWeekly}>
                        Weekly: {formatWeekly(c)}
                        {c.coach_name ? ` · Coach: ${c.coach_name}` : ''}
                      </Text>
                      {c.description ? (
                        <Text style={styles.clubDescription} numberOfLines={2}>
                          {c.description}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.reportBadge}>
                      <ImageIcon size={12} color="#64748B" />
                      <Text style={styles.reportBadgeText}>
                        {Number(c.report_count ?? 0)} report{Number(c.report_count ?? 0) === 1 ? '' : 's'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Section: Documentation reports */}
          <View style={styles.reportsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Documentation reports</Text>
              <Text style={styles.sectionSubtitle}>Photos and summaries from your clubs</Text>
            </View>

            {recentReports.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>No documentation reports yet.</Text>
              </View>
            ) : (
              <View style={styles.reportsGrid}>
                {recentReports.map((r) => {
                  const photoUrl = getFirstPhotoUrl(r);
                  let formattedDate = '';
                  if (r.created_at) {
                    try {
                      formattedDate = new Date(r.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      });
                    } catch {
                      formattedDate = String(r.created_at).slice(0, 10);
                    }
                  }

                  return (
                    <TouchableOpacity
                      key={String(r.id)}
                      style={styles.reportCard}
                      onPress={() => handleOpenClub(r.club_id, true)}
                      activeOpacity={0.75}
                    >
                      {r.club_name ? (
                        <Text style={styles.reportClubBadge}>{r.club_name}</Text>
                      ) : null}
                      <Text style={styles.reportTitle}>{r.title}</Text>
                      {formattedDate ? (
                        <Text style={styles.reportDate}>{formattedDate}</Text>
                      ) : null}
                      {r.summary ? (
                        <Text style={styles.reportSummary} numberOfLines={2}>
                          {r.summary}
                        </Text>
                      ) : null}
                      {photoUrl ? (
                        <Image
                          source={{ uri: photoUrl }}
                          style={styles.reportCoverImage}
                          resizeMode="cover"
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      )}
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
  clubListGap: {
    gap: 12,
  },
  clubCard: {
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
  clubInfoWrap: {
    flex: 1,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  clubWeekly: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  clubDescription: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 16,
  },
  reportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reportBadgeText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  reportsSection: {
    marginTop: 24,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 18,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  emptyCardText: {
    fontSize: 14,
    color: '#475569',
  },
  reportsGrid: {
    gap: 12,
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  reportClubBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reportTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 2,
  },
  reportDate: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  reportSummary: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 16,
  },
  reportCoverImage: {
    marginTop: 8,
    borderRadius: 8,
    width: '100%',
    height: 140,
  },
});

export default ClubsScreen;
