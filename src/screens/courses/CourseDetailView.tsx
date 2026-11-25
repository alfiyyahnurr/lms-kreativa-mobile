import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, SHADOWS, FONTS } from '../../constants/theme';
import {
  Course,
  CourseSession,
  CourseSessionDetail,
  Assignment,
  Quiz,
  SubjectGrade,
  SelfPacedItem,
  SelfPacedSection,
  CourseContentResponse,
  CourseScoreDetail,
  CourseForum,
} from '../../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, API_BASE_URL } from '../../services/api';
import { useStudentData } from '../../context/StudentDataContext';
import AssignmentDetailView from '../assignments/AssignmentDetailView';
import SessionDetailView from './SessionDetailView';
import LearnItemView from './LearnItemView';
import CalendarDatePickerModal from '../../components/modals/CalendarDatePickerModal';

interface CourseDetailViewProps {
  course: Course;
  onBack: () => void;
}

type TabType = 'overview' | 'sessions' | 'assignments' | 'quizzes' | 'grade' | 'forums';
type SelfPacedPane = 'lessons' | 'assignments' | 'quizzes';
export type PrePostOption = 'any' | 'has_pre' | 'has_post' | 'has_pre_or_post' | 'in_class_only';

const PRE_POST_OPTIONS: { key: PrePostOption; label: string }[] = [
  { key: 'any', label: 'Any' },
  { key: 'has_pre', label: 'Has Pre' },
  { key: 'has_post', label: 'Has Post' },
  { key: 'has_pre_or_post', label: 'Has Pre or Post' },
  { key: 'in_class_only', label: 'In-class only' },
];

export const CourseDetailView: React.FC<CourseDetailViewProps> = ({ course, onBack }) => {
  const { coursesAcademicYearId, studentProfile } = useStudentData();
  const isSelfPaced = course.course_format === 'self_paced';

  // Navigation states
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selfPacedPane, setSelfPacedPane] = useState<SelfPacedPane>('lessons');
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedSession, setSelectedSession] = useState<CourseSessionDetail | null>(null);
  const [selectedLearnItem, setSelectedLearnItem] = useState<SelfPacedItem | null>(null);

  // Self-Paced dynamic content state
  const [contentData, setContentData] = useState<CourseContentResponse | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});
  const [isContentLoading, setIsContentLoading] = useState<boolean>(false);

  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 16) + 115;

  // Class-based dynamic lists
  const [liveSessions, setLiveSessions] = useState<CourseSession[]>([]);
  const [liveAssignments, setLiveAssignments] = useState<Assignment[]>([]);
  const [liveQuizzes, setLiveQuizzes] = useState<Quiz[]>([]);
  const [liveForums, setLiveForums] = useState<CourseForum[]>([]);
  const [liveScores, setLiveScores] = useState<CourseScoreDetail[]>([]);

  // Accordion & Filter states for Class sessions
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [prePostFilter, setPrePostFilter] = useState<PrePostOption>('any');
  const [isPrePostDropdownOpen, setIsPrePostDropdownOpen] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'from' | 'to'>('from');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<any>(null);

  // Mutex locks to prevent duplicate network calls or infinite loops
  const isContentFetchingRef = useRef(false);
  const isSessionsFetchingRef = useRef(false);
  const isAssignmentsFetchingRef = useRef(false);
  const isQuizzesFetchingRef = useRef(false);
  const isForumsFetchingRef = useRef(false);
  const isScoresFetchingRef = useRef(false);

  // Keyboard listeners for smooth scrolling
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      if (e?.endCoordinates?.height) {
        setKeyboardHeight(e.endCoordinates.height);
      }
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Reset any open subviews when course ID changes
  useEffect(() => {
    setExpandedSessionId(null);
    setSelectedSession(null);
    setSelectedAssignment(null);
    setSelectedLearnItem(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [course.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [activeTab, selfPacedPane]);

  // ==========================================
  // Data Loaders with Mutex Guarding
  // ==========================================

  // Load Self-Paced Content
  const loadSelfPacedContent = useCallback(async () => {
    if (isContentFetchingRef.current) return;
    isContentFetchingRef.current = true;
    setIsContentLoading(true);
    try {
      const data = await api.courses.getContent(course.id);
      if (data) {
        setContentData(data);
        // Expand first section by default
        if (data.sections && data.sections.length > 0) {
          setExpandedSections((prev) => ({
            ...prev,
            [data.sections[0].id]: true,
          }));
        }
      }
    } catch (e) {
      console.warn('[CourseDetailView] Content load warning:', e);
    } finally {
      isContentFetchingRef.current = false;
      setIsContentLoading(false);
    }
  }, [course.id]);

  // Load Class Sessions
  const loadSessions = useCallback(async () => {
    if (isSessionsFetchingRef.current) return;
    isSessionsFetchingRef.current = true;
    try {
      const sessions = await api.courses.getSessions(course.id, course.name, course.sessions);
      if (Array.isArray(sessions) && sessions.length > 0) {
        setLiveSessions(sessions);
      }
    } catch (e) {
      console.warn('[CourseDetailView] Sessions load warning:', e);
    } finally {
      isSessionsFetchingRef.current = false;
    }
  }, [course.id, course.name, course.sessions]);

  // Load Assignments
  const loadAssignments = useCallback(async () => {
    if (isAssignmentsFetchingRef.current) return;
    isAssignmentsFetchingRef.current = true;
    try {
      const assignments = await api.courses.getAssignments(course.id);
      setLiveAssignments(assignments);
    } catch (e) {
      console.warn('[CourseDetailView] Assignments load warning:', e);
    } finally {
      isAssignmentsFetchingRef.current = false;
    }
  }, [course.id]);

  // Load Quizzes
  const loadQuizzes = useCallback(async () => {
    if (isQuizzesFetchingRef.current) return;
    isQuizzesFetchingRef.current = true;
    try {
      const quizzes = await api.courses.getQuizzes(course.id);
      setLiveQuizzes(quizzes);
    } catch (e) {
      console.warn('[CourseDetailView] Quizzes load warning:', e);
    } finally {
      isQuizzesFetchingRef.current = false;
    }
  }, [course.id]);

  // Load Forums
  const loadForums = useCallback(async () => {
    if (isForumsFetchingRef.current) return;
    isForumsFetchingRef.current = true;
    try {
      const forums = await api.courses.getForums(course.id);
      setLiveForums(forums);
    } catch (e) {
      console.warn('[CourseDetailView] Forums load warning:', e);
    } finally {
      isForumsFetchingRef.current = false;
    }
  }, [course.id]);

  // Load Scores
  const loadScores = useCallback(async () => {
    if (isScoresFetchingRef.current) return;
    isScoresFetchingRef.current = true;
    try {
      const scores = await api.courses.getScores(course.id);
      setLiveScores(scores);
    } catch (e) {
      console.warn('[CourseDetailView] Scores load warning:', e);
    } finally {
      isScoresFetchingRef.current = false;
    }
  }, [course.id]);

  // Trigger initial fetch based on course format
  useEffect(() => {
    if (isSelfPaced) {
      loadSelfPacedContent();
      loadAssignments();
      loadQuizzes();
    } else {
      loadSessions();
      loadAssignments();
      loadQuizzes();
      loadForums();
      loadScores();
    }
  }, [isSelfPaced, loadSelfPacedContent, loadSessions, loadAssignments, loadQuizzes, loadForums, loadScores]);

  // ==========================================
  // Filter Handlers
  // ==========================================

  const toggleStatus = (st: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]
    );
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedStatuses([]);
    setPrePostFilter('any');
    setFromDate('');
    setToDate('');
    setIsPrePostDropdownOpen(false);
  };

  const parseToTimestamp = (dateStr: string): number | null => {
    if (!dateStr || !dateStr.trim()) return null;
    const trimmed = dateStr.trim();
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        return isNaN(d.getTime()) ? null : d.getTime();
      }
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d.getTime();
  };

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    const fromTime = parseToTimestamp(fromDate);
    const toTime = parseToTimestamp(toDate);

    return liveSessions.filter((s) => {
      const matchesSearch = !searchQuery.trim() || s.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(s.status);

      let matchesPrePost = true;
      if (prePostFilter === 'has_pre') {
        matchesPrePost = Boolean(s.hasPreLearning);
      } else if (prePostFilter === 'has_post') {
        matchesPrePost = Boolean(s.hasPostLearning);
      } else if (prePostFilter === 'has_pre_or_post') {
        matchesPrePost = Boolean(s.hasPreLearning || s.hasPostLearning);
      } else if (prePostFilter === 'in_class_only') {
        matchesPrePost = !s.hasPreLearning && !s.hasPostLearning;
      }

      const sessionTime = parseToTimestamp(s.date);
      const matchesFromDate = !fromTime || (sessionTime !== null && sessionTime >= fromTime);
      const matchesToDate = !toTime || (sessionTime !== null && sessionTime <= toTime);

      return matchesSearch && matchesStatus && matchesPrePost && matchesFromDate && matchesToDate;
    });
  }, [liveSessions, searchQuery, selectedStatuses, prePostFilter, fromDate, toDate]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedStatuses.length > 0) count += 1;
    if (prePostFilter !== 'any') count += 1;
    if (fromDate.trim().length > 0) count += 1;
    if (toDate.trim().length > 0) count += 1;
    return count;
  }, [selectedStatuses, prePostFilter, fromDate, toDate]);

  const handleBack = () => {
    setExpandedSessionId(null);
    setSelectedSession(null);
    setSelectedAssignment(null);
    setSelectedLearnItem(null);
    onBack();
  };

  const handleOpenResourceUrl = (rawUrl?: string | null) => {
    if (!rawUrl || !rawUrl.trim()) return;
    const cleanUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
      ? rawUrl.trim()
      : `${API_BASE_URL}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl.trim()}`;

    Linking.openURL(cleanUrl).catch((err) => {
      console.warn('[CourseDetailView] Cannot open resource URL:', cleanUrl, err);
    });
  };

  const handleOpenFullSession = async (session: CourseSession) => {
    try {
      const full = await api.courses.getSessionDetail(session, course);
      if (full) {
        setSelectedSession(full);
        return;
      }
    } catch (e) {
      console.warn('[CourseDetailView] Session detail fetch error:', e);
    }

    // Direct mapping from live session fields
    const preEnabled = Boolean(session.pre_learning_enabled ?? session.hasPreLearning);
    const postEnabled = Boolean(session.post_learning_enabled ?? session.hasPostLearning);
    setSelectedSession({
      ...session,
      courseName: course.name || course.subject_name || 'Course',
      classCode: course.class_name || course.class || 'Class',
      academicYear:
        coursesAcademicYearId != null
          ? `Academic Year ${coursesAcademicYearId}`
          : studentProfile?.academicYearName || '',
      beforeClass: {
        activityType: session.pre_learning_type || (preEnabled ? 'Pre-Learning' : 'None'),
        duration: session.pre_learning_minutes ? `${session.pre_learning_minutes} mins` : (preEnabled ? '15 mins' : '—'),
        prompt: session.pre_learning_instructions || 'No pre-class preparation specified.',
        resourceUrl: session.pre_learning_url || undefined,
      },
      learningObjectives: session.learning_objectives || 'No learning objectives specified.',
      inClassContent: session.description || 'No in-class description provided.',
      materials: [],
      afterClass: {
        activityType: session.post_learning_type || (postEnabled ? 'Post-Learning' : 'None'),
        duration: session.post_learning_minutes ? `${session.post_learning_minutes} mins` : (postEnabled ? '10 mins' : '—'),
        prompt: session.post_learning_instructions || 'No post-class task specified.',
      },
      sessionInfo: {
        fullDate: session.date,
        timeSlot: session.start_time && session.end_time ? `${String(session.start_time).slice(0, 5)} - ${String(session.end_time).slice(0, 5)}` : undefined,
        location: session.location || undefined,
      },
    });
  };

  // Subviews routing
  if (selectedLearnItem) {
    return (
      <LearnItemView
        courseId={course.id}
        courseTitle={course.name || course.subject_name || 'Course'}
        initialItem={selectedLearnItem}
        contentData={contentData}
        onBack={() => setSelectedLearnItem(null)}
        onItemUpdated={(updated) => setContentData(updated)}
      />
    );
  }

  if (selectedAssignment) {
    return (
      <AssignmentDetailView
        assignment={selectedAssignment}
        onBack={() => setSelectedAssignment(null)}
        backLabel="Back to Course"
      />
    );
  }

  if (selectedSession) {
    return (
      <SessionDetailView
        session={selectedSession}
        onBack={() => {
          setSelectedSession(null);
          setExpandedSessionId(null);
        }}
      />
    );
  }

  // ==========================================
  // Render Mode 1: Self-Paced Course View
  // ==========================================
  if (isSelfPaced) {
    const sections = contentData?.sections || [];
    const totalItems = contentData?.total_items || 0;
    const completedItems = contentData?.completed_items || 0;
    const remainingItems = Math.max(0, totalItems - completedItems);
    const completionPct = contentData?.completion_percentage ?? course.completion_pct ?? 0;

    // Find first incomplete unlocked item or first item
    const allItems = sections.flatMap((s) => s.items);
    const startItem = allItems.find((i) => !i.is_completed && !i.is_locked) || allItems[0];

    const toggleSection = (id: number) => {
      setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    return (
      <View style={styles.container}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={17} color="#475569" />
            <Text style={styles.backButtonText}>Back to Courses</Text>
          </TouchableOpacity>

          {/* Self-Paced Banner */}
          <View style={styles.headerBlock}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.courseTitle}>{course.name || course.subject_name}</Text>
              <View style={styles.selfPacedPill}>
                <Text style={styles.selfPacedPillText}>Self-Paced</Text>
              </View>
            </View>

            <Text style={styles.courseSubtitle}>
              {course.teacher_name || course.teacher || 'No teacher assigned'}
            </Text>

            {/* Progress Bar & Start Learning Button */}
            <View style={styles.selfPacedActionBar}>
              <View style={styles.selfPacedProgressPill}>
                <View style={styles.miniProgressTrack}>
                  <View style={[styles.miniProgressFill, { width: `${completionPct}%` }]} />
                </View>
                <Text style={styles.selfPacedProgressText}>{completionPct}% Complete</Text>
              </View>

              {startItem && (
                <TouchableOpacity
                  style={styles.startLearningBtn}
                  onPress={() => setSelectedLearnItem(startItem)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.startLearningBtnText}>
                    {completionPct > 0 ? 'Continue Learning' : 'Start Learning'}
                  </Text>
                  <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Stats Bar */}
          <View style={styles.selfPacedStatsRow}>
            <Text style={styles.statsText}>{totalItems} lessons</Text>
            <Text style={styles.statsDot}>·</Text>
            <Text style={styles.statsText}>{completedItems} completed</Text>
            <Text style={styles.statsDot}>·</Text>
            <Text style={styles.statsText}>{remainingItems} remaining</Text>
          </View>

          {/* 3 Panes: Lessons, Assignments, Quizzes */}
          <View style={styles.tabsWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScrollContent}>
              <TouchableOpacity
                style={[styles.tabButton, selfPacedPane === 'lessons' && styles.tabButtonActive]}
                onPress={() => setSelfPacedPane('lessons')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabButtonText, selfPacedPane === 'lessons' && styles.tabButtonTextActive]}>
                  Lessons
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, selfPacedPane === 'assignments' && styles.tabButtonActive]}
                onPress={() => setSelfPacedPane('assignments')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabButtonText, selfPacedPane === 'assignments' && styles.tabButtonTextActive]}>
                  Assignments ({liveAssignments.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, selfPacedPane === 'quizzes' && styles.tabButtonActive]}
                onPress={() => setSelfPacedPane('quizzes')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabButtonText, selfPacedPane === 'quizzes' && styles.tabButtonTextActive]}>
                  Quizzes ({liveQuizzes.length})
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Pane 1: Lessons Accordion */}
          {selfPacedPane === 'lessons' && (
            <View style={styles.lessonsContainer}>
              {isContentLoading && sections.length === 0 ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.loadingText}>Loading curriculum...</Text>
                </View>
              ) : sections.length === 0 ? (
                <View style={styles.emptyCenteredContainer}>
                  <Text style={styles.emptyCenteredText}>No lessons added to this course yet.</Text>
                </View>
              ) : (
                sections.map((section, secIdx) => {
                  const isExpanded = Boolean(expandedSections[section.id]);
                  const completedInSection = section.items.filter((i) => i.is_completed).length;

                  return (
                    <View key={section.id} style={styles.sectionAccordion}>
                      <TouchableOpacity
                        style={styles.sectionHeader}
                        onPress={() => toggleSection(section.id)}
                        activeOpacity={0.75}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sectionNumber}>SECTION {secIdx + 1}</Text>
                          <Text style={styles.sectionHeading}>{section.title}</Text>
                        </View>
                        <View style={styles.sectionRightBadge}>
                          <Text style={styles.sectionCounter}>
                            {completedInSection}/{section.items.length}
                          </Text>
                          <Ionicons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color="#64748B"
                          />
                        </View>
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={styles.sectionItemsList}>
                          {section.items.map((item) => {
                            const isItemCompleted = Boolean(item.is_completed);
                            const isLocked = Boolean(item.is_locked);

                            return (
                              <TouchableOpacity
                                key={item.id}
                                style={[
                                  styles.itemRow,
                                  isLocked && styles.itemRowLocked,
                                ]}
                                onPress={() => {
                                  if (!isLocked) setSelectedLearnItem(item);
                                }}
                                disabled={isLocked}
                                activeOpacity={0.7}
                              >
                                <View style={styles.itemIconCircle}>
                                  {isLocked ? (
                                    <Ionicons name="lock-closed" size={16} color="#94A3B8" />
                                  ) : isItemCompleted ? (
                                    <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                                  ) : (
                                    <Ionicons name="ellipse-outline" size={18} color="#CBD5E1" />
                                  )}
                                </View>

                                <View style={styles.itemDetails}>
                                  <Text
                                    style={[
                                      styles.itemTitle,
                                      (isLocked || isItemCompleted) && styles.itemTitleMuted,
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {item.title}{isLocked ? ' (Locked)' : ''}
                                  </Text>
                                  <View style={styles.itemMetaRow}>
                                    {item.item_type === 'video' && (
                                      <Text style={styles.itemMetaText}>🎥 Video</Text>
                                    )}
                                    {item.item_type === 'material' && (
                                      <Text style={styles.itemMetaText}>📄 Reading</Text>
                                    )}
                                    {item.item_type === 'quiz' && (
                                      <Text style={styles.itemMetaText}>❓ Quiz</Text>
                                    )}
                                    {item.item_type === 'assignment' && (
                                      <Text style={styles.itemMetaText}>📋 Assignment</Text>
                                    )}
                                  </View>
                                </View>

                                {!isLocked && (
                                  <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* Pane 2: Assignments */}
          {selfPacedPane === 'assignments' && (
            <View style={styles.assignmentsContainer}>
              {liveAssignments.length === 0 ? (
                <View style={styles.emptyCenteredContainer}>
                  <Text style={styles.emptyCenteredText}>No assignments for this course yet.</Text>
                </View>
              ) : (
                liveAssignments.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={styles.assignmentCard}
                    onPress={() => setSelectedAssignment(a)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.assignmentTopRow}>
                      <Text style={styles.assignmentTitle} numberOfLines={2}>
                        {a.title}
                      </Text>
                      <View
                        style={[
                          styles.pendingPill,
                          a.status === 'graded' && styles.gradedPill,
                        ]}
                      >
                        <Text
                          style={[
                            styles.pendingPillText,
                            a.status === 'graded' && styles.gradedPillText,
                          ]}
                        >
                          {a.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.assignmentDueDate}>Due: {a.dueDate || 'No due date'}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* Pane 3: Quizzes */}
          {selfPacedPane === 'quizzes' && (
            <View style={styles.quizzesContainer}>
              {liveQuizzes.length === 0 ? (
                <View style={styles.emptyCenteredContainer}>
                  <Text style={styles.emptyCenteredText}>No quizzes for this course yet.</Text>
                </View>
              ) : (
                liveQuizzes.map((q) => (
                  <View key={q.id} style={styles.assignmentCard}>
                    <View style={styles.assignmentTopRow}>
                      <Text style={styles.assignmentTitle}>{q.title}</Text>
                      <View style={styles.scheduledPill}>
                        <Text style={styles.scheduledPillText}>{q.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.assignmentDueDate}>
                      {q.questions} Questions • {q.duration}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ==========================================
  // Render Mode 2: Class-Based Course View (6 Tabs)
  // ==========================================
  const tabs: { key: TabType; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'assignments', label: 'Assignments' },
    { key: 'quizzes', label: 'Quizzes' },
    { key: 'grade', label: 'My Grade' },
    { key: 'forums', label: 'Forums' },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 68 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 80 : bottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={17} color="#475569" />
          <Text style={styles.backButtonText}>Back to Courses</Text>
        </TouchableOpacity>

        {/* Course Header Banner */}
        <View style={styles.headerBlock}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.courseTitle}>{course.name || course.subject_name}</Text>
            <View style={styles.activePill}>
              <Text style={styles.activePillText}>{course.status || 'active'}</Text>
            </View>
          </View>

          <Text style={styles.courseSubtitle}>
            {course.class || course.class_name || 'Regular Class'} •{' '}
            {course.teacher_name || course.teacher || 'No teacher assigned'}
          </Text>
        </View>

        {/* 6 Horizontal Underline Tabs */}
        <View style={styles.tabsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsScrollContent}
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tabButton, isActive && styles.tabButtonActive]}
                  onPress={() => setActiveTab(tab.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <View style={styles.overviewCard}>
            <View style={styles.overviewSection}>
              <Text style={styles.overviewLabel}>TEACHER</Text>
              <Text style={styles.overviewValue}>
                {course.teacher_name || course.teacher || 'No teacher assigned'}
              </Text>
            </View>

            <View style={styles.overviewSection}>
              <Text style={styles.overviewLabel}>CLASS</Text>
              <Text style={styles.overviewValue}>
                {course.class || course.class_name || 'Regular Class'}
              </Text>
            </View>

            <View style={styles.overviewSection}>
              <Text style={styles.overviewLabel}>DESCRIPTION</Text>
              <Text style={styles.overviewValueMuted}>
                {course.description || 'No course description available.'}
              </Text>
            </View>

            <View style={styles.overviewDivider} />

            <View style={styles.overviewFooterRow}>
              <View style={styles.overviewCol}>
                <Text style={styles.overviewLabel}>SESSIONS</Text>
                <Text style={styles.overviewStatValue}>
                  {course.session_count ?? course.sessions ?? 0}
                </Text>
              </View>
              <View style={styles.overviewCol}>
                <Text style={styles.overviewLabel}>CURRICULUM</Text>
                <Text style={styles.overviewStatValue}>
                  {course.curriculum || course.curriculum_name || 'Standard Curriculum'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Tab 2: Sessions */}
        {activeTab === 'sessions' && (
          <View style={styles.sessionsContainer}>
            {/* Search & Advanced Filter Card */}
            <View style={styles.searchCard}>
              <Text style={styles.searchCardTitle}>Search sessions</Text>
              <View style={styles.searchInputWrap}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by title..."
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              <TouchableOpacity
                style={styles.advancedFilterBtn}
                onPress={() => setIsAdvancedOpen((prev) => !prev)}
                activeOpacity={0.7}
              >
                <View style={styles.filterBtnLeft}>
                  <Ionicons name="filter-outline" size={16} color="#0F172A" />
                  <Text style={styles.filterBtnText}>Advanced Filters</Text>
                  {activeFilterCount > 0 && (
                    <View style={styles.filterCountBadge}>
                      <Text style={styles.filterCountText}>{activeFilterCount}</Text>
                    </View>
                  )}
                </View>
                <Ionicons
                  name={isAdvancedOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#64748B"
                />
              </TouchableOpacity>

              {/* Collapsible Filter Panel */}
              {isAdvancedOpen && (
                <View style={styles.advancedFilterPanel}>
                  {/* Status Multi-Select */}
                  <Text style={styles.filterSectionTitle}>Status</Text>
                  <View style={styles.statusChipsWrap}>
                    {['scheduled', 'in_progress', 'completed', 'cancelled'].map((st) => {
                      const isSelected = selectedStatuses.includes(st);
                      return (
                        <TouchableOpacity
                          key={st}
                          style={[styles.statusChip, isSelected && styles.statusChipSelected]}
                          onPress={() => toggleStatus(st)}
                          activeOpacity={0.75}
                        >
                          <Text
                            style={[
                              styles.statusChipText,
                              isSelected && styles.statusChipTextSelected,
                            ]}
                          >
                            {st}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Pre / Post Learning Filter */}
                  <Text style={styles.filterSectionTitle}>Pre / Post Learning</Text>
                  <TouchableOpacity
                    style={styles.prePostSelectTrigger}
                    onPress={() => setIsPrePostDropdownOpen((prev) => !prev)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.prePostSelectValue}>
                      {PRE_POST_OPTIONS.find((o) => o.key === prePostFilter)?.label || 'Any'}
                    </Text>
                    <Ionicons
                      name={isPrePostDropdownOpen ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#64748B"
                    />
                  </TouchableOpacity>

                  {isPrePostDropdownOpen && (
                    <View style={styles.prePostDropdownCard}>
                      {PRE_POST_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[
                            styles.prePostOptionRow,
                            prePostFilter === opt.key && styles.prePostOptionSelected,
                          ]}
                          onPress={() => {
                            setPrePostFilter(opt.key);
                            setIsPrePostDropdownOpen(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.prePostOptionText,
                              prePostFilter === opt.key && styles.prePostOptionTextSelected,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Date Range Selectors */}
                  <View style={styles.dateRow}>
                    <View style={styles.dateCol}>
                      <Text style={styles.filterSectionTitle}>From</Text>
                      <TouchableOpacity
                        style={styles.datePickerField}
                        onPress={() => {
                          setDatePickerTarget('from');
                          setIsDatePickerOpen(true);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.datePickerValueText, !fromDate && styles.datePickerPlaceholder]}>
                          {fromDate || 'dd/mm/yyyy'}
                        </Text>
                        <Ionicons name="calendar-outline" size={16} color="#0F172A" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.dateCol}>
                      <Text style={styles.filterSectionTitle}>To</Text>
                      <TouchableOpacity
                        style={styles.datePickerField}
                        onPress={() => {
                          setDatePickerTarget('to');
                          setIsDatePickerOpen(true);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.datePickerValueText, !toDate && styles.datePickerPlaceholder]}>
                          {toDate || 'dd/mm/yyyy'}
                        </Text>
                        <Ionicons name="calendar-outline" size={16} color="#0F172A" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* Showing summary text */}
              <Text style={styles.showingCounterText}>
                Showing {filteredSessions.length} of {liveSessions.length} sessions
              </Text>
            </View>

            {/* Individual Session Cards */}
            {filteredSessions.length === 0 ? (
              <View style={styles.emptySessionsContainer}>
                <Text style={styles.emptySessionsText}>
                  No sessions match your filters.
                </Text>
                {(searchQuery.trim().length > 0 || selectedStatuses.length > 0 || prePostFilter !== 'any' || fromDate !== '' || toDate !== '') && (
                  <TouchableOpacity
                    style={styles.resetFiltersBtn}
                    onPress={handleClearFilters}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.resetFiltersBtnText}>Reset Filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              filteredSessions.map((session) => {
                const isExpanded = expandedSessionId === session.id;

                return (
                  <View key={session.id} style={styles.sessionCard}>
                    <TouchableOpacity
                      style={styles.sessionCardHeader}
                      onPress={() => setExpandedSessionId(isExpanded ? null : session.id)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.sessionCircle}>
                        <Text style={styles.sessionCircleNumber}>{session.sessionNumber}</Text>
                      </View>

                      <View style={styles.sessionCenterWrap}>
                        <Text style={styles.sessionTitle} numberOfLines={1}>
                          {session.title}
                        </Text>
                        <Text style={styles.sessionDate}>{session.date}</Text>
                        <View style={styles.tagsRow}>
                          {(session.hasPreLearning || session.pre_learning_enabled) && (
                            <View style={styles.preTag}>
                              <Text style={styles.preTagText}>Pre</Text>
                            </View>
                          )}
                          {(session.hasPostLearning || session.post_learning_enabled) && (
                            <View style={styles.postTag}>
                              <Text style={styles.postTagText}>Post</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <View style={styles.sessionRightWrap}>
                        <View style={styles.scheduledPill}>
                          <Text style={styles.scheduledPillText}>{session.status}</Text>
                        </View>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={isExpanded ? '#2563EB' : '#94A3B8'}
                          style={{ marginTop: 6 }}
                        />
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.accordionBody}>
                        {/* BEFORE CLASS */}
                        {(session.hasPreLearning || session.pre_learning_enabled) && (
                          <View style={styles.accBeforeClassCard}>
                            <Text style={styles.accTagAmber}>BEFORE CLASS</Text>
                            <Text style={styles.accActivityHeading}>
                              {session.pre_learning_type || 'Pre-Class Activity'}{' '}
                              <Text style={styles.accActivityDuration}>
                                · {session.pre_learning_minutes ? `${session.pre_learning_minutes} mins` : '15 mins'}
                              </Text>
                            </Text>
                            <Text style={styles.accBodyText}>
                              {session.pre_learning_instructions || 'Please review assigned reading or video prior to class.'}
                            </Text>
                            {Boolean(session.pre_learning_url || session.pre_learning_file_path) && (
                              <TouchableOpacity
                                style={styles.accResourceBtnAmber}
                                onPress={() => handleOpenResourceUrl(session.pre_learning_url || session.pre_learning_file_path)}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="download-outline" size={13} color="#B45309" style={{ marginRight: 4 }} />
                                <Text style={styles.accResourceBtnTextAmber}>
                                  {session.pre_learning_file_name ? `Download ${session.pre_learning_file_name} ↓` : 'Open resource →'}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}

                        {/* LEARNING OBJECTIVES */}
                        {Boolean(session.learning_objectives) && (
                          <View style={styles.accNeutralCard}>
                            <Text style={styles.accTagNeutral}>LEARNING OBJECTIVES</Text>
                            <Text style={styles.accBodyTextDark}>{session.learning_objectives}</Text>
                          </View>
                        )}

                        {/* IN CLASS */}
                        {Boolean(session.description) && (
                          <View style={styles.accNeutralCard}>
                            <Text style={styles.accTagNeutral}>IN CLASS</Text>
                            <Text style={styles.accBodyTextDark}>{session.description}</Text>
                          </View>
                        )}

                        {/* AFTER CLASS */}
                        {(session.hasPostLearning || session.post_learning_enabled) && (
                          <View style={styles.accAfterClassCard}>
                            <Text style={styles.accTagGreen}>AFTER CLASS</Text>
                            <Text style={styles.accActivityHeading}>
                              {session.post_learning_type || 'Post-Class Activity'}{' '}
                              <Text style={styles.accActivityDuration}>
                                · {session.post_learning_minutes ? `${session.post_learning_minutes} mins` : '10 mins'}
                              </Text>
                            </Text>
                            <Text style={styles.accBodyText}>
                              {session.post_learning_instructions || 'Complete post-class reflection or follow-up exercises.'}
                            </Text>
                            {Boolean(session.post_learning_url || session.post_learning_file_path) && (
                              <TouchableOpacity
                                style={styles.accResourceBtnGreen}
                                onPress={() => handleOpenResourceUrl(session.post_learning_url || session.post_learning_file_path)}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="download-outline" size={13} color="#166534" style={{ marginRight: 4 }} />
                                <Text style={styles.accResourceBtnTextGreen}>
                                  {session.post_learning_file_name ? `Download ${session.post_learning_file_name} ↓` : 'Open resource →'}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}

                        {/* Open Full Session */}
                        <TouchableOpacity
                          style={styles.openFullSessionBtn}
                          onPress={() => handleOpenFullSession(session)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.openFullSessionText}>Open full session →</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Tab 3: Assignments */}
        {activeTab === 'assignments' && (
          <View style={styles.assignmentsContainer}>
            {liveAssignments.length === 0 ? (
              <View style={styles.emptyCenteredContainer}>
                <Text style={styles.emptyCenteredText}>No assignments assigned yet.</Text>
              </View>
            ) : (
              liveAssignments.map((assignment) => (
                <TouchableOpacity
                  key={assignment.id}
                  style={styles.assignmentCard}
                  onPress={() => setSelectedAssignment(assignment)}
                  activeOpacity={0.7}
                >
                  <View style={styles.assignmentTopRow}>
                    <Text style={styles.assignmentTitle} numberOfLines={2}>
                      {assignment.title}
                    </Text>
                    <View
                      style={[
                        styles.pendingPill,
                        assignment.status === 'graded' && styles.gradedPill,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pendingPillText,
                          assignment.status === 'graded' && styles.gradedPillText,
                        ]}
                      >
                        {assignment.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.assignmentDueDate}>Due: {assignment.dueDate || 'No due date'}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Tab 4: Quizzes */}
        {activeTab === 'quizzes' && (
          <View style={styles.quizzesContainer}>
            {liveQuizzes.length === 0 ? (
              <View style={styles.emptyCenteredContainer}>
                <Text style={styles.emptyCenteredText}>No checkpoint quizzes yet.</Text>
              </View>
            ) : (
              liveQuizzes.map((quiz) => (
                <View key={quiz.id} style={styles.assignmentCard}>
                  <View style={styles.assignmentTopRow}>
                    <Text style={styles.assignmentTitle}>{quiz.title}</Text>
                    <View style={styles.scheduledPill}>
                      <Text style={styles.scheduledPillText}>{quiz.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.assignmentDueDate}>
                    {quiz.questions} Questions • {quiz.duration}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* Tab 5: My Grade */}
        {activeTab === 'grade' && (
          <View style={styles.gradeContainer}>
            {liveScores.length === 0 ? (
              <View style={styles.emptyCenteredContainer}>
                <Text style={styles.emptyCenteredText}>No grades recorded yet.</Text>
              </View>
            ) : (
              liveScores.map((scoreItem) => (
                <View key={scoreItem.id} style={styles.scoreCard}>
                  <View style={styles.scoreTopRow}>
                    <View style={styles.scoreCategoryBadge}>
                      <Text style={styles.scoreCategoryText}>{scoreItem.category}</Text>
                    </View>
                    <Text style={styles.scoreValue}>
                      {scoreItem.score} / {scoreItem.max_score}
                    </Text>
                  </View>
                  <Text style={styles.scoreTitle}>{scoreItem.title}</Text>
                  {scoreItem.feedback && (
                    <Text style={styles.scoreFeedback}>"{scoreItem.feedback}"</Text>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* Tab 6: Forums */}
        {activeTab === 'forums' && (
          <View style={styles.forumsContainer}>
            {liveForums.length === 0 ? (
              <View style={styles.emptyCenteredContainer}>
                <Text style={styles.emptyCenteredText}>No discussion forums yet.</Text>
              </View>
            ) : (
              liveForums.map((forum) => (
                <View key={forum.id} style={styles.forumCard}>
                  <View style={styles.forumTopRow}>
                    {forum.is_pinned && (
                      <View style={styles.pinnedBadge}>
                        <Ionicons name="pin" size={12} color="#2563EB" />
                        <Text style={styles.pinnedBadgeText}>Pinned</Text>
                      </View>
                    )}
                    <Text style={styles.forumPostsCount}>
                      {forum.post_count ?? forum.postsCount ?? 0} posts
                    </Text>
                  </View>
                  <Text style={styles.forumTitle}>{forum.title}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Interactive Calendar Date Picker Modal */}
      <CalendarDatePickerModal
        visible={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        title={datePickerTarget === 'from' ? 'Select Start Date (From)' : 'Select End Date (To)'}
        initialDate={datePickerTarget === 'from' ? fromDate : toDate}
        onSelectDate={(selected) => {
          if (datePickerTarget === 'from') {
            setFromDate(selected);
          } else {
            setToDate(selected);
          }
        }}
      />
    </KeyboardAvoidingView>
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
    paddingTop: 12,
    paddingBottom: 108,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 14.5,
    fontWeight: '500',
    color: '#475569',
    marginLeft: 6,
  },
  headerBlock: {
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  courseTitle: {
    fontFamily: FONTS.title,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 10,
  },
  activePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  activePillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
  },
  selfPacedPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  selfPacedPillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: '#4338CA',
  },
  courseSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#475569',
  },
  selfPacedActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 12,
    flexWrap: 'wrap',
  },
  selfPacedProgressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  miniProgressTrack: {
    width: 80,
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 999,
  },
  selfPacedProgressText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#2563EB',
  },
  startLearningBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  startLearningBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  selfPacedStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  statsText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#475569',
  },
  statsDot: {
    color: '#94A3B8',
  },
  tabsWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 16,
  },
  tabsScrollContent: {
    flexDirection: 'row',
    gap: 12,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#2563EB',
  },
  tabButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 14.5,
    fontWeight: '500',
    color: '#64748B',
  },
  tabButtonTextActive: {
    fontFamily: FONTS.semiBold,
    fontWeight: '600',
    color: '#2563EB',
  },
  lessonsContainer: {
    gap: 12,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 30,
  },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#64748B',
  },
  sectionAccordion: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sectionNumber: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#64748B',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  sectionHeading: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#0F172A',
  },
  sectionRightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionCounter: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#64748B',
  },
  sectionItemsList: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 12,
  },
  itemRowLocked: {
    opacity: 0.65,
  },
  itemIconCircle: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDetails: {
    flex: 1,
  },
  itemTitle: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: '#0F172A',
  },
  itemTitleMuted: {
    color: '#64748B',
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  itemMetaText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#94A3B8',
  },
  overviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    ...SHADOWS.sm,
  },
  overviewSection: {
    marginBottom: 16,
  },
  overviewLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  overviewValue: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: '#0F172A',
  },
  overviewValueMuted: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
  overviewDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },
  overviewFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overviewCol: {
    flex: 1,
  },
  overviewStatValue: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#0F172A',
  },
  sessionsContainer: {
    gap: 16,
  },
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    ...SHADOWS.sm,
  },
  searchCardTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 10,
  },
  searchInputWrap: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    height: 40,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#0F172A',
  },
  advancedFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  filterBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 13.5,
    color: '#0F172A',
  },
  filterCountBadge: {
    backgroundColor: '#2563EB',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  filterCountText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  advancedFilterPanel: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 14,
    gap: 10,
  },
  filterSectionTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#475569',
    marginBottom: 4,
  },
  statusChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusChipSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#93C5FD',
  },
  statusChipText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#475569',
  },
  statusChipTextSelected: {
    color: '#1D4ED8',
    fontWeight: '600',
  },
  prePostSelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 8,
  },
  prePostSelectValue: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#0F172A',
  },
  prePostDropdownCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  prePostOptionRow: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  prePostOptionSelected: {
    backgroundColor: '#EFF6FF',
  },
  prePostOptionText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#334155',
  },
  prePostOptionTextSelected: {
    color: '#2563EB',
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateCol: {
    flex: 1,
  },
  datePickerField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
  },
  datePickerValueText: {
    fontFamily: FONTS.regular,
    fontSize: 12.5,
    color: '#0F172A',
  },
  datePickerPlaceholder: {
    color: '#94A3B8',
  },
  showingCounterText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
  emptySessionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptySessionsText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#64748B',
  },
  resetFiltersBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  resetFiltersBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12.5,
    color: '#2563EB',
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  sessionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  sessionCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionCircleNumber: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#2563EB',
  },
  sessionCenterWrap: {
    flex: 1,
  },
  sessionTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 2,
  },
  sessionDate: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  preTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  preTagText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: '#D97706',
  },
  postTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  postTagText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: '#15803D',
  },
  sessionRightWrap: {
    alignItems: 'flex-end',
  },
  scheduledPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  scheduledPillText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: '#475569',
  },
  accordionBody: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    padding: 16,
    gap: 12,
    backgroundColor: '#F8FAFC',
  },
  accBeforeClassCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
  },
  accTagAmber: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#B45309',
    marginBottom: 4,
  },
  accActivityHeading: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#78350F',
    marginBottom: 4,
  },
  accActivityDuration: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#92400E',
  },
  accBodyText: {
    fontFamily: FONTS.regular,
    fontSize: 12.5,
    color: '#78350F',
    lineHeight: 18,
  },
  accResourceBtnAmber: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginTop: 8,
  },
  accResourceBtnTextAmber: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#B45309',
  },
  accNeutralCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
  },
  accTagNeutral: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#64748B',
    marginBottom: 4,
  },
  accBodyTextDark: {
    fontFamily: FONTS.regular,
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18,
  },
  accAfterClassCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 12,
  },
  accResourceBtnGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginTop: 8,
  },
  accResourceBtnTextGreen: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#166534',
  },
  accTagGreen: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#15803D',
    marginBottom: 4,
  },
  openFullSessionBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  openFullSessionText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#2563EB',
  },
  assignmentsContainer: {
    gap: 12,
  },
  assignmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    ...SHADOWS.sm,
  },
  assignmentTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 10,
  },
  assignmentTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#0F172A',
    flex: 1,
  },
  pendingPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 999,
  },
  pendingPillText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: '#D97706',
  },
  gradedPill: {
    backgroundColor: '#DCFCE7',
  },
  gradedPillText: {
    color: '#15803D',
  },
  assignmentDueDate: {
    fontFamily: FONTS.regular,
    fontSize: 12.5,
    color: '#64748B',
  },
  quizzesContainer: {
    gap: 12,
  },
  gradeContainer: {
    gap: 12,
  },
  scoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 6,
    ...SHADOWS.sm,
  },
  scoreTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreCategoryBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  scoreCategoryText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: '#2563EB',
    textTransform: 'uppercase',
  },
  scoreValue: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#0F172A',
  },
  scoreTitle: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: '#334155',
  },
  scoreFeedback: {
    fontFamily: FONTS.regular,
    fontSize: 12.5,
    color: '#64748B',
    fontStyle: 'italic',
  },
  forumsContainer: {
    gap: 12,
  },
  forumCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 8,
    ...SHADOWS.sm,
  },
  forumTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pinnedBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: '#2563EB',
  },
  forumPostsCount: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#64748B',
  },
  forumTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#0F172A',
  },
  emptyCenteredContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 32,
    alignItems: 'center',
  },
  emptyCenteredText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#64748B',
  },
});

export default CourseDetailView;
