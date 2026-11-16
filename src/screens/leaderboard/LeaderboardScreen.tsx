import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import AppHeader from '../../components/navigation/AppHeader';
import { FONTS, SHADOWS } from '../../constants/theme';
import { api } from '../../services/api';
import {
  HouseLeaderboardRow,
  StudentRankRow,
  HouseTopContributor,
  PointsSummaryData,
  PointsLedgerItem,
} from '../../types';

// Web LMS Design Tokens (SEC_HS)
const SEC_HS = {
  navy: '#1B2D4F',
  navyMid: '#2C4370',
  navyLight: '#3D5A8A',
  navyBg: '#EEF2F8',
  teal: '#1A5F6E',
  tealMid: '#2A7F91',
  tealLight: '#E6F4F7',
  amber: '#B8842A',
  amberLight: '#FEF6DC',
  green: '#2E7D52',
  greenLight: '#E3F5EC',
  greenDark: '#1E5C3A',
  coral: '#C0506A',
  lavender: '#6B5EA8',
  cream: '#FAFAF8',
  warm: '#F7F3EC',
  border: '#E5E0D8',
  white: '#FFFFFF',
  text: '#1C1917',
  muted: '#78716C',
  red: '#B91C1C',
  blue: '#2563EB',
  blueLight: '#DBEAFE',
} as const;

// Official House Colors matching Web LMS (lib/sec-hs-theme.ts)
const HOUSE_COLOR: Record<string, string> = {
  Alexandria: SEC_HS.navy,
  Medina: SEC_HS.teal,
  Cordova: SEC_HS.amber,
  Seville: SEC_HS.green,
  Damascus: SEC_HS.coral,
  Granada: SEC_HS.lavender,
};

function getHouseColor(name: string | null | undefined): string {
  if (!name) return SEC_HS.muted;
  return HOUSE_COLOR[name] ?? SEC_HS.muted;
}

const JENJANG_LABEL: Record<string, string> = {
  lower_secondary: 'Lower Secondary',
  high_school_igcse: 'IGCSE',
  high_school_alevel: 'A Level',
};

export const LeaderboardScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'house' | 'jenjang' | 'class'>('house');
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const scrollRef = useRef<any>(null);

  // Live Backend States
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [summary, setSummary] = useState<PointsSummaryData | null>(null);
  const [houses, setHouses] = useState<HouseLeaderboardRow[]>([]);
  const [myHouseId, setMyHouseId] = useState<number | null>(null);
  const [myHouseName, setMyHouseName] = useState<string | null>(null);
  const [selectedHouseId, setSelectedHouseId] = useState<number | null>(null);
  const [contributors, setContributors] = useState<HouseTopContributor[]>([]);
  const [loadingContrib, setLoadingContrib] = useState<boolean>(false);
  const [jenjangRows, setJenjangRows] = useState<StudentRankRow[]>([]);
  const [schoolLevel, setSchoolLevel] = useState<string>('high_school_igcse');
  const [classRows, setClassRows] = useState<StudentRankRow[]>([]);
  const [houseSummary, setHouseSummary] = useState<
    { house: string; member_count: number; total_points: number }[]
  >([]);
  const [className, setClassName] = useState<string | null>(null);
  const [myStudentId, setMyStudentId] = useState<number | null>(null);
  const [history, setHistory] = useState<PointsLedgerItem[]>([]);

  // Scroll to top on navigation/focus
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

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  // Load contributors for a selected house
  const loadContributors = useCallback(async (houseId: number) => {
    setSelectedHouseId(houseId);
    setLoadingContrib(true);
    try {
      const res = await api.leaderboard.getHouses(houseId);
      if (res && Array.isArray(res.contributors)) {
        setContributors(res.contributors);
      } else {
        setContributors([]);
      }
    } catch (err: any) {
      console.warn('[Contributors Load Error]', err?.message || err);
    } finally {
      setLoadingContrib(false);
    }
  }, []);

  // Main data loader fetching all 5 endpoints in parallel
  const loadLeaderboardData = useCallback(async () => {
    try {
      const [sumRes, housesRes, jenjangRes, classRes, histRes] = await Promise.all([
        api.points.getSummary(),
        api.leaderboard.getHouses(),
        api.leaderboard.getJenjang(),
        api.leaderboard.getClass(),
        api.points.getHistory(),
      ]);

      if (sumRes) {
        setSummary(sumRes);
        if (sumRes.houseName) setMyHouseName(sumRes.houseName);
        if (sumRes.className) setClassName(sumRes.className);
        if (sumRes.schoolLevel) setSchoolLevel(sumRes.schoolLevel);
      }

      if (housesRes && Array.isArray(housesRes.rows)) {
        setHouses(housesRes.rows);
        if (housesRes.myHouseId != null) setMyHouseId(housesRes.myHouseId);
        if (housesRes.myHouseName) setMyHouseName(housesRes.myHouseName);

        const initialHouse = selectedHouseId ?? housesRes.myHouseId ?? housesRes.rows[0]?.house_id;
        if (initialHouse) {
          setSelectedHouseId(initialHouse);
          if (housesRes.contributors && Array.isArray(housesRes.contributors)) {
            setContributors(housesRes.contributors);
          } else {
            void loadContributors(initialHouse);
          }
        }
      }

      if (jenjangRes && Array.isArray(jenjangRes.rows)) {
        setJenjangRows(jenjangRes.rows);
        if (jenjangRes.schoolLevel) setSchoolLevel(jenjangRes.schoolLevel);
        if (jenjangRes.myStudentId != null) setMyStudentId(jenjangRes.myStudentId);
      }

      if (classRes && Array.isArray(classRes.rows)) {
        setClassRows(classRes.rows);
        if (Array.isArray(classRes.houseSummary)) setHouseSummary(classRes.houseSummary);
        if (classRes.className) setClassName(classRes.className);
        if (classRes.myStudentId != null) setMyStudentId(classRes.myStudentId);
      }

      if (Array.isArray(histRes)) {
        setHistory(histRes);
      }
    } catch (err: any) {
      console.warn('[Leaderboard Load Error]', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, [selectedHouseId, loadContributors]);

  // Initial load on screen focus
  useFocusEffect(
    useCallback(() => {
      loadLeaderboardData();
    }, [loadLeaderboardData])
  );

  // Pure Pull-to-Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadLeaderboardData();
    } finally {
      setRefreshing(false);
    }
  }, [loadLeaderboardData]);

  // Dynamic podium top 3 from classRows
  const firstPlace = classRows[0];
  const secondPlace = classRows[1];
  const thirdPlace = classRows[2];

  // Leading class house summary
  const leadingClassHouse = houseSummary[0];

  // Maximum house points for progress bar
  const maxHousePoints = useMemo(() => {
    if (houses.length === 0) return 10;
    return Math.max(...houses.map((h) => h.total_points), 10);
  }, [houses]);

  // Selected house details
  const selectedHouse = useMemo(() => {
    return houses.find((h) => h.house_id === selectedHouseId);
  }, [houses, selectedHouseId]);

  const displayTotal = summary?.total ?? 0;
  const displayHouse = summary?.houseName ?? myHouseName;
  const currentLevelLabel = JENJANG_LABEL[schoolLevel] || schoolLevel || 'IGCSE';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title="Leaderboard" />

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
        {/* Header Title matching Web LMS */}
        <View style={styles.headerBox}>
          <Text style={styles.pageTitle}>Leaderboard</Text>
          <Text style={styles.pageSubtitle}>
            {myHouseName ? `House ${myHouseName} · ${currentLevelLabel}` : currentLevelLabel}
          </Text>
        </View>

        {/* Top Individual Points Card matching Web LMS */}
        <View style={styles.pointsCard}>
          <Text style={styles.pointsBigText}>
            {displayTotal >= 0 ? '+' : ''}
            <Text style={styles.pointsConsolasNumberBig}>{displayTotal}</Text>
          </Text>
          <Text style={styles.pointsLabel}>
            individual points{displayHouse ? ` · House ${displayHouse}` : ''}
          </Text>
          {summary ? (
            <Text style={styles.pointsSubDetail}>
              <Text style={styles.pointsCategoryLabelD}>D </Text>
              <Text style={[styles.pointsConsolasNumber, styles.pointsCategoryNumD]}>
                {summary.discipline || 0}
              </Text>
              <Text style={styles.pointsSubDetailDot}>  ·  </Text>
              <Text style={styles.pointsCategoryLabelL}>L </Text>
              <Text style={[styles.pointsConsolasNumber, styles.pointsCategoryNumL]}>
                {summary.literacy || 0}
              </Text>
              <Text style={styles.pointsSubDetailDot}>  ·  </Text>
              <Text style={styles.pointsCategoryLabelH}>H </Text>
              <Text style={[styles.pointsConsolasNumber, styles.pointsCategoryNumH]}>
                {summary.habits || 0}
              </Text>
            </Text>
          ) : null}
        </View>

        {/* Tabs Row matching Web LMS */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'house' && styles.tabButtonActive]}
            onPress={() => setActiveTab('house')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'house' && styles.tabTextActive]}>
              House
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'jenjang' && styles.tabButtonActive]}
            onPress={() => setActiveTab('jenjang')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'jenjang' && styles.tabTextActive]}>
              Jenjang
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'class' && styles.tabButtonActive]}
            onPress={() => setActiveTab('class')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'class' && styles.tabTextActive]}>
              Class
            </Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={SEC_HS.navy} />
            <Text style={styles.loadingText}>Loading leaderboard...</Text>
          </View>
        ) : null}

        {/* TAB 1: HOUSE */}
        {activeTab === 'house' && !loading && (
          <View style={styles.tabContentContainer}>
            {houses.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No house points yet.</Text>
              </View>
            ) : (
              <View style={styles.houseList}>
                {houses.map((house, idx) => {
                  const isMine = myHouseId != null && house.house_id === myHouseId;
                  const isSelected = selectedHouseId === house.house_id;
                  const houseColorVal = getHouseColor(house.house);
                  const pct = Math.max(4, Math.round((house.total_points / maxHousePoints) * 100));

                  return (
                    <TouchableOpacity
                      key={house.house_id || house.house}
                      style={[
                        styles.houseCard,
                        isMine && styles.houseCardMine,
                        isSelected && !isMine && styles.houseCardSelected,
                      ]}
                      onPress={() => loadContributors(house.house_id)}
                      activeOpacity={0.7}
                    >
                      {/* Top Line */}
                      <View style={styles.houseHeaderRow}>
                        <View style={styles.houseLeftGroup}>
                          <Text style={styles.houseRank}>#{idx + 1}</Text>
                          <View
                            style={[styles.houseDot, { backgroundColor: houseColorVal }]}
                          />
                          <Text
                            style={[
                              styles.houseName,
                              isMine && { color: SEC_HS.navy },
                            ]}
                          >
                            {house.house}
                            {isMine ? ' (you)' : ''}
                          </Text>
                        </View>
                        <Text style={styles.housePoints}>
                          <Text style={styles.pointsConsolasNumber}>{house.total_points}</Text> pts
                        </Text>
                      </View>

                      {/* Progress Track */}
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              backgroundColor: houseColorVal,
                              width: `${pct}%`,
                            },
                          ]}
                        />
                      </View>

                      {/* Bottom Stats Breakdown matching Web LMS */}
                      <Text style={styles.houseMembersText}>
                        {house.active_members} members  ·  D{' '}
                        <Text style={styles.pointsConsolasNumber}>{house.discipline_pts || 0}</Text>  L{' '}
                        <Text style={styles.pointsConsolasNumber}>{house.literacy_pts || 0}</Text>  H{' '}
                        <Text style={styles.pointsConsolasNumber}>{house.habits_pts || 0}</Text>
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Top Contributors Card for Selected House matching Web LMS */}
            {selectedHouseId ? (
              <View style={styles.contributorsCard}>
                <Text style={styles.contributorsTitle}>
                  Top contributors{loadingContrib ? '…' : ''} · {selectedHouse?.house || 'House'}
                </Text>
                {contributors.length === 0 && !loadingContrib ? (
                  <Text style={styles.contributorsEmptyText}>
                    Tap a house to load top contributors, or no points yet.
                  </Text>
                ) : (
                  <View style={styles.contributorsList}>
                    {contributors.map((c) => (
                      <View key={c.student_id} style={styles.contributorRow}>
                        <View style={styles.contributorLeft}>
                          <Text style={styles.contributorRank}>#{c.rank}</Text>
                          <Text style={styles.contributorName} numberOfLines={1}>
                            {c.full_name}
                          </Text>
                          {c.class_name ? (
                            <Text style={styles.contributorClass}> · {c.class_name}</Text>
                          ) : null}
                        </View>
                        <Text style={styles.contributorPoints}>{c.total_points}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : null}
          </View>
        )}

        {/* TAB 2: JENJANG */}
        {activeTab === 'jenjang' && !loading && (
          <View style={styles.tabContentContainer}>
            <Text style={styles.sectionSubtitle}>Ranking · {currentLevelLabel}</Text>

            {jenjangRows.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No jenjang rankings yet.</Text>
              </View>
            ) : (
              <View style={styles.tableCard}>
                {/* Table Header */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.thCell, styles.colJenjangRank]}>Rank</Text>
                  <Text style={[styles.thCell, styles.colJenjangName]}>Name</Text>
                  <Text style={[styles.thCell, styles.colJenjangClass]}>Class</Text>
                  <Text style={[styles.thCell, styles.colJenjangHouse]}>House</Text>
                  <Text style={[styles.thCell, styles.colJenjangPoints]}>Points</Text>
                </View>

                {/* Table Rows */}
                {jenjangRows.map((item) => {
                  const isYou = myStudentId != null && item.student_id === myStudentId;
                  const houseColorVal = getHouseColor(item.house);

                  return (
                    <View
                      key={item.student_id}
                      style={[styles.tableRow, isYou && styles.tableRowHighlight]}
                    >
                      <Text
                        style={[
                          styles.tdRank,
                          styles.colJenjangRank,
                          isYou && styles.textHighlight,
                        ]}
                      >
                        #{item.rank}
                      </Text>
                      <View style={[styles.colJenjangName, styles.nameCellWrapper]}>
                        <View style={styles.nameRowInline}>
                          <Text
                            style={[styles.tdNameText, isYou && styles.textHighlight]}
                            numberOfLines={1}
                          >
                            {item.full_name}
                          </Text>
                          {isYou && <Text style={styles.youInlineText}>(you)</Text>}
                        </View>

                        {/* D, L, H breakdown badges */}
                        {(item.discipline_pts !== 0 ||
                          item.literacy_pts !== 0 ||
                          item.habits_pts !== 0) && (
                          <View style={styles.categoryPillsRow}>
                            {item.discipline_pts !== 0 && (
                              <View style={styles.categoryPillDiscipline}>
                                <Text style={styles.categoryPillDisciplineText}>
                                  D {item.discipline_pts}
                                </Text>
                              </View>
                            )}
                            {item.literacy_pts !== 0 && (
                              <View style={styles.categoryPillLiteracy}>
                                <Text style={styles.categoryPillLiteracyText}>
                                  L {item.literacy_pts}
                                </Text>
                              </View>
                            )}
                            {item.habits_pts !== 0 && (
                              <View style={styles.categoryPillHabits}>
                                <Text style={styles.categoryPillHabitsText}>
                                  H {item.habits_pts}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                      <Text style={[styles.tdClass, styles.colJenjangClass]}>
                        {item.class_name ?? '—'}
                      </Text>
                      <Text
                        style={[
                          styles.tdHouse,
                          styles.colJenjangHouse,
                          { color: houseColorVal },
                        ]}
                      >
                        {item.house ?? '—'}
                      </Text>
                      <Text
                        style={[
                          styles.tdPoints,
                          styles.colJenjangPoints,
                          isYou && styles.textHighlight,
                          { fontFamily: FONTS.consolas },
                        ]}
                      >
                        {item.total_points}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* TAB 3: CLASS (PODIUM + TABLE) */}
        {activeTab === 'class' && !loading && (
          <View style={styles.tabContentContainer}>
            <Text style={styles.classHeaderTitle}>
              {className ? `Class ${className}` : 'My class'}
            </Text>
            {leadingClassHouse ? (
              <Text style={styles.classHeaderSub}>
                {leadingClassHouse.house} leads in this class with{' '}
                {leadingClassHouse.total_points} pts from {leadingClassHouse.member_count} members
              </Text>
            ) : (
              <Text style={styles.classHeaderSub}>
                Ranking of students in your class
              </Text>
            )}

            {/* Dynamic Podium Graphics matching Web LMS */}
            {classRows.length > 0 ? (
              <View style={styles.podiumContainer}>
                {/* 2nd Place (Left) */}
                <View style={styles.podiumCol}>
                  <View style={styles.medalCircle}>
                    <Text style={styles.medalIcon}>🥈</Text>
                  </View>
                  <Text style={styles.podiumStudentName} numberOfLines={1}>
                    {secondPlace ? secondPlace.full_name : '—'}
                  </Text>
                  <Text style={styles.podiumPts}>
                    {secondPlace ? secondPlace.total_points : 0}
                  </Text>
                  <View
                    style={[
                      styles.podiumPedestal,
                      { height: 95 },
                      secondPlace && myStudentId === secondPlace.student_id && styles.podiumPedestalMine,
                    ]}
                  />
                </View>

                {/* 1st Place (Center - Tallest) */}
                <View style={styles.podiumCol}>
                  <View style={styles.medalCircle}>
                    <Text style={styles.medalIcon}>🥇</Text>
                  </View>
                  <Text style={styles.podiumStudentName} numberOfLines={1}>
                    {firstPlace ? firstPlace.full_name : '—'}
                  </Text>
                  <Text style={styles.podiumPts}>
                    {firstPlace ? firstPlace.total_points : 0}
                  </Text>
                  <View
                    style={[
                      styles.podiumPedestal,
                      { height: 125 },
                      firstPlace && myStudentId === firstPlace.student_id && styles.podiumPedestalMine,
                    ]}
                  />
                </View>

                {/* 3rd Place (Right - Shortest) */}
                <View style={styles.podiumCol}>
                  <View style={styles.medalCircle}>
                    <Text style={styles.medalIcon}>🥉</Text>
                  </View>
                  <Text style={styles.podiumStudentName} numberOfLines={1}>
                    {thirdPlace ? thirdPlace.full_name : '—'}
                  </Text>
                  <Text style={styles.podiumPts}>
                    {thirdPlace ? thirdPlace.total_points : 0}
                  </Text>
                  <View
                    style={[
                      styles.podiumPedestal,
                      { height: 75 },
                      thirdPlace && myStudentId === thirdPlace.student_id && styles.podiumPedestalMine,
                    ]}
                  />
                </View>
              </View>
            ) : null}

            {/* Table below podium matching Web LMS */}
            {classRows.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No class rankings yet.</Text>
              </View>
            ) : (
              <View style={styles.tableCard}>
                {/* Table Header */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.thCell, styles.colClassRank]}>Rank</Text>
                  <Text style={[styles.thCell, styles.colClassName]}>Name</Text>
                  <Text style={[styles.thCell, styles.colClassHouse]}>House</Text>
                  <Text style={[styles.thCell, styles.colClassPoints]}>Points</Text>
                </View>

                {/* Table Rows with dynamic class leaderboard */}
                {classRows.map((item) => {
                  const isYou = myStudentId != null && item.student_id === myStudentId;
                  const houseColorVal = getHouseColor(item.house);

                  return (
                    <View
                      key={item.student_id}
                      style={[styles.tableRow, isYou && styles.tableRowHighlight]}
                    >
                      <Text
                        style={[
                          styles.tdRank,
                          styles.colClassRank,
                          isYou && styles.textHighlight,
                        ]}
                      >
                        #{item.rank}
                      </Text>
                      <View style={[styles.colClassName, styles.nameCellWrapper]}>
                        <View style={styles.nameRowInline}>
                          <Text
                            style={[styles.tdNameText, isYou && styles.textHighlight]}
                            numberOfLines={1}
                          >
                            {item.full_name}
                          </Text>
                          {isYou && <Text style={styles.youInlineText}>(you)</Text>}
                        </View>

                        {/* Dynamic D, L, H breakdown badges */}
                        {(item.discipline_pts !== 0 ||
                          item.literacy_pts !== 0 ||
                          item.habits_pts !== 0) && (
                          <View style={styles.categoryPillsRow}>
                            {item.discipline_pts !== 0 && (
                              <View style={styles.categoryPillDiscipline}>
                                <Text style={styles.categoryPillDisciplineText}>
                                  D {item.discipline_pts}
                                </Text>
                              </View>
                            )}
                            {item.literacy_pts !== 0 && (
                              <View style={styles.categoryPillLiteracy}>
                                <Text style={styles.categoryPillLiteracyText}>
                                  L {item.literacy_pts}
                                </Text>
                              </View>
                            )}
                            {item.habits_pts !== 0 && (
                              <View style={styles.categoryPillHabits}>
                                <Text style={styles.categoryPillHabitsText}>
                                  H {item.habits_pts}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.tdHouse,
                          styles.colClassHouse,
                          { color: houseColorVal },
                        ]}
                      >
                        {item.house ?? '—'}
                      </Text>
                      <Text
                        style={[
                          styles.tdPoints,
                          styles.colClassPoints,
                          isYou && styles.textHighlight,
                          { fontFamily: FONTS.consolas },
                        ]}
                      >
                        {item.total_points}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* My points history Card (Visible across tabs matching Web LMS) */}
        {!loading && (
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>My points history</Text>
            {history.length > 0 ? (
              history.map((item, index) => {
                const isLast = index === history.length - 1;
                const isPositive = item.poin >= 0;
                return (
                  <View
                    key={item.id ?? index}
                    style={[styles.historyRow, isLast && styles.historyRowLast]}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.historyItemTitle} numberOfLines={1}>
                        {item.source_label}
                      </Text>
                      {item.source_date ? (
                        <Text style={styles.historyItemDate}>{item.source_date}</Text>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.historyPointsBadge,
                        !isPositive && styles.historyPointsBadgeNegative,
                      ]}
                    >
                      {isPositive ? `+${item.poin}` : item.poin}
                    </Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.historyEmptyText}>No points entries yet.</Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  pointsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 20,
    paddingHorizontal: 18,
    marginBottom: 20,
  },
  pointsBigText: {
    fontFamily: FONTS.title,
    fontSize: 34,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  pointsConsolasNumberBig: {
    fontFamily: FONTS.consolas,
    fontSize: 34,
    fontWeight: '800',
    color: '#0F172A',
  },
  pointsConsolasNumber: {
    fontFamily: FONTS.consolas,
    fontWeight: '700',
  },
  pointsLabel: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
  },
  pointsSubDetail: {
    fontFamily: FONTS.medium,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  pointsCategoryLabelD: {
    fontFamily: FONTS.bold,
    fontWeight: '700',
    color: '#7E22CE',
  },
  pointsCategoryNumD: {
    color: '#7E22CE',
  },
  pointsCategoryLabelL: {
    fontFamily: FONTS.bold,
    fontWeight: '700',
    color: '#0F766E',
  },
  pointsCategoryNumL: {
    color: '#0F766E',
  },
  pointsCategoryLabelH: {
    fontFamily: FONTS.bold,
    fontWeight: '700',
    color: '#15803D',
  },
  pointsCategoryNumH: {
    color: '#15803D',
  },
  pointsSubDetailDot: {
    color: '#CBD5E1',
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 16,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#2563EB',
  },
  tabText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    fontFamily: FONTS.bold,
    color: '#2563EB',
    fontWeight: '700',
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
  tabContentContainer: {
    paddingTop: 4,
  },
  emptyCard: {
    backgroundColor: '#FAF8F5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFECE6',
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#64748B',
  },
  houseList: {
    gap: 12,
    marginBottom: 16,
  },
  houseCard: {
    backgroundColor: '#FAF8F5',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFECE6',
    padding: 16,
  },
  houseCardMine: {
    backgroundColor: '#EEF2F8',
    borderColor: '#1B2D4F',
  },
  houseCardSelected: {
    borderColor: '#94A3B8',
  },
  houseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  houseLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  houseRank: {
    fontFamily: FONTS.bold,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#64748B',
    width: 24,
  },
  houseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  houseName: {
    fontFamily: FONTS.bold,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  housePoints: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F5EFE6',
    overflow: 'hidden',
    marginBottom: 8,
    justifyContent: 'center',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  houseMembersText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#64748B',
  },
  contributorsCard: {
    backgroundColor: '#FAF8F5',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFECE6',
    padding: 16,
    marginBottom: 16,
  },
  contributorsTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  contributorsEmptyText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#64748B',
  },
  contributorsList: {
    gap: 10,
  },
  contributorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contributorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  contributorRank: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#64748B',
    width: 26,
  },
  contributorName: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    flexShrink: 1,
  },
  contributorClass: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#64748B',
  },
  contributorPoints: {
    fontFamily: FONTS.consolas,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  historyCard: {
    backgroundColor: '#FAF8F5',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFECE6',
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginTop: 8,
    marginBottom: 20,
  },
  historyTitle: {
    fontFamily: FONTS.title,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  historyEmptyText: {
    fontFamily: FONTS.regular,
    fontSize: 13.5,
    color: '#64748B',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFECE6',
  },
  historyRowLast: {
    borderBottomWidth: 0,
  },
  historyItemTitle: {
    fontFamily: FONTS.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: '#1E293B',
  },
  historyItemDate: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  historyPointsBadge: {
    fontFamily: FONTS.consolas,
    fontSize: 15,
    fontWeight: '700',
    color: '#15803D',
  },
  historyPointsBadgeNegative: {
    color: '#B91C1C',
  },
  sectionSubtitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
  },
  classHeaderTitle: {
    fontFamily: FONTS.title,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  classHeaderSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#64748B',
    marginBottom: 20,
  },
  podiumContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
    paddingTop: 10,
  },
  podiumCol: {
    flex: 1,
    alignItems: 'center',
  },
  medalCircle: {
    marginBottom: 6,
  },
  medalIcon: {
    fontSize: 22,
  },
  podiumStudentName: {
    fontFamily: FONTS.bold,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 2,
  },
  podiumPts: {
    fontFamily: FONTS.consolas,
    fontSize: 13.5,
    fontWeight: '800',
    color: '#2563EB',
    marginBottom: 6,
  },
  podiumPedestal: {
    width: '100%',
    backgroundColor: '#E0E7FF',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  podiumPedestalMine: {
    backgroundColor: '#BFDBFE',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    ...SHADOWS.sm,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  thCell: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowHighlight: {
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 3.5,
    borderLeftColor: '#2563EB',
  },
  nameCellWrapper: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  nameRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tdNameText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    flexShrink: 1,
  },
  youInlineText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#2563EB',
  },
  categoryPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  categoryPillDiscipline: {
    backgroundColor: '#F3E8FF',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPillDisciplineText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    fontWeight: '700',
    color: '#7E22CE',
  },
  categoryPillLiteracy: {
    backgroundColor: '#CCFBF1',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPillLiteracyText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  categoryPillHabits: {
    backgroundColor: '#DCFCE7',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPillHabitsText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  textHighlight: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  tdRank: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  tdClass: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#64748B',
  },
  tdHouse: {
    fontFamily: FONTS.semiBold,
    fontSize: 12.5,
    fontWeight: '600',
  },
  tdPoints: {
    fontFamily: FONTS.consolas,
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  // Dedicated column layouts for Jenjang Table (5 columns)
  colJenjangRank: {
    width: 36,
  },
  colJenjangName: {
    flex: 1,
    paddingRight: 6,
  },
  colJenjangClass: {
    width: 74,
  },
  colJenjangHouse: {
    width: 72,
    textAlign: 'center',
  },
  colJenjangPoints: {
    width: 44,
    textAlign: 'right',
  },
  // Dedicated column layouts for Class Table (4 columns)
  colClassRank: {
    width: 38,
  },
  colClassName: {
    flex: 1,
    paddingRight: 6,
  },
  colClassHouse: {
    width: 90,
    textAlign: 'center',
  },
  colClassPoints: {
    width: 48,
    textAlign: 'right',
  },
});

export default LeaderboardScreen;
