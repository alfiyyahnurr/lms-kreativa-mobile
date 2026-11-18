import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SHADOWS } from '../../constants/theme';
import { api } from '../../services/api';
import { storage } from '../../services/storage';
import { Announcement } from '../../types';
import AppHeader from '../../components/navigation/AppHeader';

// Web LMS Design Tokens
const SEC_HS = {
  navy: '#1B2D4F',
  border: '#E5E0D8',
  white: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  blue: '#2563EB',
  blueLight: '#DBEAFE',
  blueDark: '#1D4ED8',
} as const;

export const AnnouncementsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const scrollRef = useRef<any>(null);

  // Live Backend States
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  // Scroll to top on focus
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

  const isFetchingRef = useRef<boolean>(false);

  // Instant SWR Cache-First Hydration (< 0.05s)
  useEffect(() => {
    let isMounted = true;
    async function hydrateCache() {
      try {
        const session = await storage.getStudentSession();
        const studentId = session?.studentId ?? session?.userId ?? 'default';
        const cached = await storage.getCache<Announcement[]>(`kreativa_cache_announcements_${studentId}`);
        if (cached && Array.isArray(cached) && cached.length > 0 && isMounted) {
          setItems(cached);
          setLoading(false); // Instant render!
        }
      } catch (e) {
        console.warn('[Announcements Cache Hydration Warning]', e);
      }
    }
    hydrateCache();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load announcements from Live Backend API (Stable & Guarded)
  const loadAnnouncements = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      setError(null);
      const data = await api.announcements.list();
      if (Array.isArray(data)) {
        setItems(data);
        // Persist latest data snapshot to local cache in background
        void (async () => {
          try {
            const session = await storage.getStudentSession();
            const studentId = session?.studentId ?? session?.userId ?? 'default';
            await storage.setCache(`kreativa_cache_announcements_${studentId}`, data);
          } catch {
            // ignore cache write error
          }
        })();
      }
    } catch (err: any) {
      console.warn('[Announcements Load Error]', err?.message || err);
      setError(err?.message || 'Failed to load announcements.');
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadAnnouncements();
    }, [loadAnnouncements])
  );

  // Scoped Pull-to-Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAnnouncements();
  }, [loadAnnouncements]);

  // Handle open announcement detail & mark as read
  const handleOpenAnnouncement = useCallback(async (item: Announcement) => {
    setSelectedAnnouncement(item);

    // If unread, optimistically update UI and send markRead to backend
    if (!item.read) {
      setItems((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, read: true, isNew: false, is_read: true } : a))
      );

      try {
        await api.announcements.markRead(item.id);
      } catch (err: any) {
        console.warn('[Announcements MarkRead Error]', err?.message || err);
      }
    }
  }, []);

  const unreadCount = useMemo(() => {
    return items.filter((a) => !a.read).length;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (filter === 'unread') {
      return items.filter((a) => !a.read);
    }
    return items;
  }, [items, filter]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader showTitle={false} />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[SEC_HS.navy]}
            tintColor={SEC_HS.navy}
          />
        }
      >
        {/* Header Title & Subtitle matching Web LMS */}
        <View style={styles.headerBox}>
          <Text style={styles.pageTitle}>Announcements</Text>
          <Text style={styles.pageSubtitle}>
            Important updates from your courses and school
          </Text>
        </View>

        {/* Filter Pills: All vs Unread */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
            onPress={() => setFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterBtnText, filter === 'all' && styles.filterBtnTextActive]}>
              All ({items.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterBtn, filter === 'unread' && styles.filterBtnActive]}
            onPress={() => setFilter('unread')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterBtnText, filter === 'unread' && styles.filterBtnTextActive]}>
              Unread {unreadCount > 0 ? `(${unreadCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading Spinner */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={SEC_HS.navy} />
            <Text style={styles.loadingText}>Loading announcements...</Text>
          </View>
        ) : null}

        {/* Error Notice */}
        {error && !loading ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={24} color="#B91C1C" />
            <Text style={styles.errorTitle}>Failed to Load Announcements</Text>
            <Text style={styles.errorSubtitle}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadAnnouncements} activeOpacity={0.7}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Empty State matching Web LMS */}
        {!loading && !error && filteredItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="megaphone-outline" size={32} color={SEC_HS.muted} style={{ marginBottom: 8 }} />
            <Text style={styles.emptyTitle}>
              {filter === 'unread' ? 'No unread announcements.' : 'No announcements.'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'unread'
                ? 'All recent updates have already been marked as read.'
                : 'There are currently no active announcements from your school.'}
            </Text>
          </View>
        ) : null}

        {/* List of Announcement Cards matching Web LMS */}
        {!loading &&
          filteredItems.map((item) => {
            const isUnread = !item.read;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.card,
                  isUnread ? styles.cardUnread : styles.cardRead,
                ]}
                onPress={() => handleOpenAnnouncement(item)}
                activeOpacity={0.7}
              >
                {/* Title Row + "New" badge */}
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  {isUnread && (
                    <View style={styles.badgeNew}>
                      <Text style={styles.badgeNewText}>New</Text>
                    </View>
                  )}
                </View>

                {/* Content Snippet (line-clamp-2 matching Web LMS) */}
                <Text style={styles.cardSnippet} numberOfLines={2}>
                  {item.content}
                </Text>

                {/* Meta: Author • Date matching Web LMS */}
                <Text style={styles.cardMeta}>
                  {item.author}
                  {item.date ? ` • ${item.date}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
      </ScrollView>

      {/* Announcement Detail Modal */}
      <Modal
        visible={Boolean(selectedAnnouncement)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAnnouncement(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.modalTitle}>{selectedAnnouncement?.title}</Text>
                <Text style={styles.modalMeta}>
                  {selectedAnnouncement?.author}
                  {selectedAnnouncement?.date ? ` • ${selectedAnnouncement?.date}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedAnnouncement(null)}
                style={styles.modalCloseIconBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView
              style={styles.modalBodyScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalBodyText}>
                {selectedAnnouncement?.content}
              </Text>
            </ScrollView>

            {/* Modal Footer */}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setSelectedAnnouncement(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgApp,
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
    marginTop: 4,
    marginBottom: 16,
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
    fontSize: 13.5,
    color: '#64748B',
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  filterBtnActive: {
    backgroundColor: SEC_HS.navy,
  },
  filterBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  filterBtnTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#64748B',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 32,
    alignItems: 'center',
    marginTop: 10,
    ...SHADOWS.sm,
  },
  emptyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '700',
  },
  emptySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    padding: 24,
    alignItems: 'center',
    marginTop: 10,
  },
  errorTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#B91C1C',
    fontWeight: '700',
    marginTop: 6,
  },
  errorSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12.5,
    color: '#7F1D1D',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  retryBtn: {
    backgroundColor: '#B91C1C',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12.5,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 14,
    ...SHADOWS.sm,
  },
  cardUnread: {
    borderLeftWidth: 4.5,
    borderLeftColor: SEC_HS.blue,
  },
  cardRead: {
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontFamily: FONTS.title,
    fontSize: 15.5,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 22,
    flexShrink: 1,
  },
  badgeNew: {
    backgroundColor: SEC_HS.blueLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeNewText: {
    fontFamily: FONTS.medium,
    fontSize: 11.5,
    fontWeight: '600',
    color: SEC_HS.blueDark,
  },
  cardSnippet: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#475569',
    lineHeight: 19.5,
    marginBottom: 10,
  },
  cardMeta: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#94A3B8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxHeight: '80%',
    padding: 22,
    ...SHADOWS.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 14,
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: FONTS.title,
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 24,
  },
  modalMeta: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  modalCloseIconBtn: {
    padding: 4,
  },
  modalBodyScroll: {
    maxHeight: 340,
    marginBottom: 16,
  },
  modalBodyText: {
    fontFamily: FONTS.regular,
    fontSize: 14.5,
    lineHeight: 22,
    color: '#334155',
  },
  modalCloseBtn: {
    backgroundColor: SEC_HS.navy,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default AnnouncementsScreen;
