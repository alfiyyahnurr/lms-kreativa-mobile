import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { api } from '../../services/api';
import { storage } from '../../services/storage';
import { ClubDetailData, ClubItem, ClubReportItem } from '../../types';

interface ClubDetailViewProps {
  clubId: number;
  onBack: () => void;
  initialScrollToReports?: boolean;
}

const WEEKDAY_EN = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatWeekly(c?: ClubItem): string {
  if (!c) return '';
  const day = c.meeting_weekday != null ? WEEKDAY_EN[Number(c.meeting_weekday)] : '';
  const start = c.meeting_start ? String(c.meeting_start).slice(0, 5) : '';
  const end = c.meeting_end ? String(c.meeting_end).slice(0, 5) : '';
  if (!day && !start) return c.schedule_text ? String(c.schedule_text) : 'Not set yet';
  return [day, start && end ? `${start}–${end}` : start, c.meeting_location ? String(c.meeting_location) : '']
    .filter(Boolean)
    .join(' · ');
}

function collectPhotos(r: ClubReportItem): string[] {
  const photos: string[] = [];
  if (r.photo_url) photos.push(String(r.photo_url));
  if (Array.isArray(r.photo_urls)) {
    for (const u of r.photo_urls) {
      if (u && !photos.includes(String(u))) photos.push(String(u));
    }
  }
  return photos;
}

export const ClubDetailView: React.FC<ClubDetailViewProps> = ({
  clubId,
  onBack,
  initialScrollToReports = false,
}) => {
  const scrollRef = useRef<any>(null);
  const reportsSectionY = useRef<number>(0);

  const [detail, setDetail] = useState<ClubDetailData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const isFetchingRef = useRef<boolean>(false);

  // SWR Cache Hydration
  useEffect(() => {
    let isMounted = true;
    async function hydrateCache() {
      try {
        const session = await storage.getStudentSession();
        const studentId = session?.studentId ?? session?.userId ?? 'default';
        const cached = await storage.getCache<ClubDetailData>(`kreativa_cache_club_detail_${studentId}_${clubId}`);
        if (cached && cached.club && isMounted) {
          setDetail(cached);
          setLoading(false);
        }
      } catch (err) {
        console.warn('[ClubDetail] Cache hydration error:', err);
      }
    }
    hydrateCache();
    return () => {
      isMounted = false;
    };
  }, [clubId]);

  const loadDetail = useCallback(async (isRefresh = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isRefresh) {
      setRefreshing(true);
    }

    try {
      const data = await api.clubs.getDetail(clubId);
      setDetail(data);

      const session = await storage.getStudentSession();
      const studentId = session?.studentId ?? session?.userId ?? 'default';
      await storage.setCache(`kreativa_cache_club_detail_${studentId}_${clubId}`, data);
    } catch (err) {
      console.warn('[ClubDetail] Failed to load club detail:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [clubId]);

  useEffect(() => {
    loadDetail(false);
  }, [loadDetail]);

  const onRefresh = useCallback(() => {
    loadDetail(true);
  }, [loadDetail]);

  const handleOpenLink = (url?: string | null) => {
    if (!url) return;
    Linking.openURL(url).catch((err) => {
      console.warn('[ClubDetail] Failed to open URL:', err);
    });
  };

  const club = detail?.club;
  const sessions = detail?.sessions || [];
  const materials = detail?.materials || [];
  const scores = detail?.scores || [];
  const reports = detail?.reports || [];

  return (
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
      {/* 1. Back to Clubs Button (Web Aligned) */}
      <TouchableOpacity
        onPress={onBack}
        style={styles.backBtn}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <ChevronLeft size={18} color="#2563EB" strokeWidth={2.5} />
        <Text style={styles.backText}>Back to Clubs</Text>
      </TouchableOpacity>

      {loading && !detail ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <>
          {/* 2. Club Header Info */}
          <View style={styles.headerBlock}>
            <Text style={styles.clubTitle}>{club?.name || 'Club Detail'}</Text>
            <Text style={styles.clubMeta}>
              Weekly schedule: {formatWeekly(club)}
              {club?.coach_name ? ` · Coach: ${club.coach_name}` : ''}
            </Text>
            {club?.description ? (
              <Text style={styles.clubDescription}>{club.description}</Text>
            ) : null}
          </View>

          {/* 3. Section: Documentation Reports */}
          <View
            style={styles.sectionWrap}
            onLayout={(e) => {
              reportsSectionY.current = e.nativeEvent.layout.y;
              if (initialScrollToReports) {
                scrollRef.current?.scrollTo({ y: e.nativeEvent.layout.y, animated: true });
              }
            }}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Documentation reports</Text>
              <Text style={styles.sectionSubtitle}>Activity photos and summaries from coaches</Text>
            </View>

            {reports.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No documentation reports yet.</Text>
              </View>
            ) : (
              <View style={styles.listGap}>
                {reports.map((r) => {
                  const photos = collectPhotos(r);
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
                    <View key={String(r.id)} style={styles.reportCard}>
                      <Text style={styles.reportTitle}>{r.title}</Text>
                      <Text style={styles.reportDateSession}>
                        {formattedDate}
                        {r.session_title
                          ? ` · Session: ${r.session_title}${r.session_date ? ` (${r.session_date})` : ''}`
                          : ''}
                      </Text>

                      {r.summary ? (
                        <Text style={styles.reportSummary}>{r.summary}</Text>
                      ) : null}

                      {photos.length > 0 ? (
                        <View style={[styles.photoGrid, photos.length > 1 && styles.photoGridTwoCols]}>
                          {photos.map((src, index) => (
                            <Image
                              key={`${src}_${index}`}
                              source={{ uri: src }}
                              style={photos.length > 1 ? styles.photoThumbTwoCols : styles.photoThumbFull}
                              resizeMode="cover"
                            />
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* 4. Section: Sessions this term */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Sessions this term</Text>
              <Text style={styles.sectionSubtitle}>
                Actual meetings. The weekly time above is the standing club schedule.
              </Text>
            </View>

            {sessions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No sessions yet.</Text>
              </View>
            ) : (
              <View style={styles.listGap}>
                {sessions.map((s) => (
                  <View key={String(s.id)} style={styles.itemCard}>
                    <Text style={styles.itemTitle}>{s.title}</Text>
                    <Text style={styles.itemMeta}>
                      {s.session_date}
                      {s.start_time ? ` · ${String(s.start_time).slice(0, 5)}` : ''}
                      {s.end_time ? `–${String(s.end_time).slice(0, 5)}` : ''}
                      {s.location ? ` · ${s.location}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* 5. Section: Materials */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Materials</Text>
            </View>

            {materials.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No materials yet.</Text>
              </View>
            ) : (
              <View style={styles.listGap}>
                {materials.map((m) => {
                  const targetUrl = m.external_url || m.file_url;
                  return (
                    <View key={String(m.id)} style={styles.itemCard}>
                      {targetUrl ? (
                        <TouchableOpacity
                          onPress={() => handleOpenLink(targetUrl)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.materialLink}>{m.title}</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.itemTitle}>{m.title}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* 6. Section: My scores */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My scores</Text>
            </View>

            {scores.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No scores yet.</Text>
              </View>
            ) : (
              <View style={styles.listGap}>
                {scores.map((s) => (
                  <View key={String(s.id)} style={styles.scoreCard}>
                    <Text style={styles.itemTitle}>{s.title}</Text>
                    <Text style={styles.scoreText}>
                      {s.score}/{s.max_score}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563EB',
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBlock: {
    marginBottom: 20,
  },
  clubTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  clubMeta: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
    lineHeight: 20,
  },
  clubDescription: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    lineHeight: 20,
  },
  sectionWrap: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 10,
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
  emptyText: {
    fontSize: 14,
    color: '#475569',
  },
  listGap: {
    gap: 12,
  },
  itemCard: {
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
  scoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#0F172A',
  },
  itemMeta: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  materialLink: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2563EB',
    textDecorationLine: 'underline',
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  reportCard: {
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
  reportTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  reportDateSession: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  reportSummary: {
    fontSize: 13,
    color: '#475569',
    marginTop: 8,
    lineHeight: 18,
  },
  photoGrid: {
    marginTop: 10,
    gap: 8,
  },
  photoGridTwoCols: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  photoThumbFull: {
    width: '100%',
    height: 180,
    borderRadius: 8,
  },
  photoThumbTwoCols: {
    width: '48.5%',
    height: 120,
    borderRadius: 8,
  },
});

export default ClubDetailView;
