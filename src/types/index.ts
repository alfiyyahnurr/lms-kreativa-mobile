export interface StudentProfile {
  userId: number;
  studentId: number;
  studentCode?: string | null;
  schoolId: number;
  fullName: string;
  email: string;
  role: 'student';
  schoolName: string;
  schoolLevel: string;
  classId: number;
  className: string | null;
  academicYearName: string | null;
  house: string | null;
  points: number;
  disciplinePts: number;
  literacyPts: number;
  habitsPts: number;
}

export interface Course {
  id: number;
  code: string;
  subject_code?: string | null;
  name: string;
  subject_name?: string | null;
  teacher: string;
  teacher_name?: string | null;
  sessions: number;
  session_count?: number;
  status: 'active' | 'archived' | string;
  class?: string;
  class_name?: string | null;
  description?: string | null;
  curriculum?: string;
  curriculum_name?: string | null;
  syllabus_title?: string | null;
  course_format?: 'traditional' | 'self_paced' | string;
  thumbnail_url?: string | null;
  completion_pct?: number;
  enrolled_count?: number;
}

export interface SelfPacedItem {
  id: number;
  section_id: number;
  title: string;
  item_type: 'video' | 'material' | 'quiz' | 'assignment' | string;
  order_index: number;
  content_html?: string | null;
  video_url?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  duration_minutes?: number | null;
  is_completed?: boolean;
  confidence_level?: 'understood' | 'partial' | 'not_understood' | null;
  is_locked?: boolean;
  quiz_id?: number | null;
  assignment_id?: number | null;
}

export interface SelfPacedSection {
  id: number;
  course_id: number;
  title: string;
  order_index: number;
  items: SelfPacedItem[];
}

export interface CourseContentResponse {
  course: Course;
  sections: SelfPacedSection[];
  total_items: number;
  completed_items: number;
  completion_percentage: number;
}

export interface CourseScoreDetail {
  id: number;
  category: string;
  title: string;
  score: number;
  max_score: number;
  weight?: number;
  feedback?: string | null;
  graded_at?: string | null;
}

export interface CourseForum {
  id: number;
  courseId: number;
  title: string;
  is_pinned?: boolean;
  forum_type?: string;
  post_count?: number;
  postsCount?: number;
  updatedAt?: string;
}

export interface Assignment {
  id: number;
  course_id?: number;
  course_name?: string;
  course: string;
  title: string;
  description?: string | null;
  instructions?: string | null;
  assignment_type?: 'individual' | 'group' | string;
  submission_type?: string;
  max_score?: number;
  pass_score?: number | null;
  weight?: number;
  due_date?: string | null;
  dueDate: string;
  score: string;
  status: 'pending' | 'submitted' | 'graded';
  submission_status?: 'graded' | 'submitted' | 'not_submitted' | 'pending' | null;
  submission_score?: number | string | null;
}

export interface AssignmentDetailResponse {
  assignment: Assignment;
  submission: {
    id: number;
    assignment_id: number;
    student_id: number;
    attempt_number: number;
    submission_text: string | null;
    submission_url: string | null;
    status: 'not_submitted' | 'submitted' | 'late' | 'graded' | 'returned';
    score: number | string | null;
    feedback: string | null;
    graded_at: string | null;
    submitted_at: string | null;
    updated_at: string | null;
  } | null;
  files: Array<{
    id: number;
    submission_id: number;
    file_name: string;
    file_path: string;
    file_size_bytes: number | null;
    mime_type: string | null;
  }>;
}

export interface QuizOption {
  id: number;
  optionLabel: string;
  optionText: string;
  isCorrect?: boolean;
}

export interface QuizQuestion {
  id: number;
  question_type: string;
  question_text: string;
  points: number;
  options: QuizOption[];
  explanation?: string | null;
}

export interface Quiz {
  id: number;
  title: string;
  course: string;
  duration: string;
  questions: number;
  questionsCount?: number;
  score: string;
  status: 'not started' | 'in progress' | 'completed' | string;
  attempt_status?: string | null;
  attempt_score?: number | string | null;
  date?: string;
  time?: string;
}

export interface HabitItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface HabitGroup {
  id: string;
  title: string;
  items: HabitItem[];
}

export interface HabitItemRow {
  id: number;
  category_id: string;
  item_label: string;
  is_checked: boolean;
}

export interface HabitDayRecord {
  id: number | null;
  record_date: string;
  categories_done: number;
  items: HabitItemRow[];
  points: number;
}

export interface HabitCategoryItem {
  id: string;
  label: string;
  items: string[];
}

export interface HabitsMonthResult {
  yearMonth: string;
  today: string;
  track: 'smp' | 'sma';
  categories: HabitCategoryItem[];
  days: HabitDayRecord[];
  pointsPerFullDay: number;
}

export interface ClassHabitRankItem {
  rank: number;
  name: string;
  points: number;
  isCurrentUser?: boolean;
}

export interface LiteracyEntry {
  id: number | string;
  title: string;
  author: string;
  readingType?: string;
  type: string;
  language: string;
  genre: string;
  pagesOrLength: string;
  finishedDate?: string;
  dateFinished: string;
  rating: string | number;
  vocabulary?: string;
  vocab?: string[];
  // 3-Tier Reflection Prompts & Texts
  claim?: string;
  claimPrompt?: string;
  reflectionClaim?: string;
  reflectionText?: string;
  evidence?: string;
  evidencePrompt?: string;
  sowhat?: string;
  sowhatPrompt?: string;
  connection?: string;
  createdAt?: string;
  // Backward compatibility fields
  bookTitle?: string;
  pagesRead?: number;
  minutesSpent?: number;
  reflection?: string;
  claimType?: string;
  date?: string;
}

export interface LiteracyFormData {
  title: string;
  author: string;
  type: string;
  language: string;
  genre: string;
  pagesOrLength: string;
  dateFinished: string;
  rating: string;
  vocabulary: string;
  // Step 1: Claim
  reflectionClaimPrompt: string;
  reflectionClaimText: string;
  // Step 2: Evidence
  reflectionEvidencePrompt: string;
  reflectionEvidenceText: string;
  // Step 3: So What?
  reflectionSoWhatPrompt: string;
  reflectionSoWhatText: string;
  // Step 4: Connection
  connection: string;
  // Backward compatibility
  reflectionClaim?: string;
  reflectionText?: string;
}

export interface LiteracyProgressStats {
  textsRead: number;
  textsTarget: number;
  genreVariety: number;
  genreTarget: number;
  avgRating: string;
  englishPercentage: number;
  englishTargetPercentage: number;
  level: string;
  schoolLevel?: string;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  author: string;
  date: string;
  isNew: boolean;
  read: boolean;
  publish_at?: string | null;
  created_by_name?: string | null;
  is_read?: boolean;
  school_id?: number;
  course_id?: number | null;
}

export interface LeaderboardHouse {
  rank: number;
  name: string;
  color: string;
  points: number;
  members: number;
  disciplinePts?: number;
  literacyPts?: number;
  habitsPts?: number;
}

export interface HouseLeaderboardRow {
  house_id: number;
  house: string;
  total_points: number;
  active_members: number;
  discipline_pts: number;
  literacy_pts: number;
  habits_pts: number;
}

export interface StudentRankRow {
  rank: number;
  student_id: number;
  full_name: string;
  nis?: string | null;
  class_name?: string | null;
  house: string | null;
  total_points: number;
  discipline_pts: number;
  literacy_pts: number;
  habits_pts: number;
}

export interface HouseTopContributor {
  rank: number;
  student_id: number;
  full_name: string;
  class_name?: string | null;
  total_points: number;
}

export interface PointsSummaryData {
  total: number;
  discipline: number;
  literacy: number;
  habits: number;
  houseName: string | null;
  className?: string | null;
  schoolLevel?: string | null;
  academicYearId?: number;
  termId?: number | null;
}

export interface PointsLedgerItem {
  id: number | string;
  source_type: string;
  source_label: string;
  poin: number;
  source_date: string | null;
  house_name: string | null;
}

export interface LeaderboardStudent {
  rank: number;
  name: string;
  class?: string;
  house: string | null;
  points: number;
  disciplinePts?: number;
  literacyPts?: number;
  habitsPts?: number;
  isCurrent?: boolean;
}

export interface ScheduleItem {
  id: string;
  time: string;
  subject: string;
  room: string;
  teacher: string;
  type: string;
}

export interface ExamItem {
  id: string;
  course: string;
  code: string;
  type: string;
  date: string;
  time: string;
  room: string;
  seatNumber: string;
  status: 'upcoming' | 'completed';
}

export interface SubjectGrade {
  id: string;
  subject: string;
  code: string;
  score: number;
  grade: string;
  attendance: string;
  comment: string;
}

export interface CourseSession {
  id: string;
  courseId: number;
  sessionNumber: number;
  title: string;
  date: string;
  hasPreLearning: boolean;
  hasPostLearning: boolean;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | string;
  // Live database fields from lms_sessions
  course_id?: number;
  session_number?: number;
  description?: string | null;
  learning_objectives?: string | null;
  session_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  pre_learning_enabled?: boolean;
  pre_learning_type?: string | null;
  pre_learning_minutes?: number | null;
  pre_learning_instructions?: string | null;
  pre_learning_url?: string | null;
  pre_learning_file_path?: string | null;
  pre_learning_file_name?: string | null;
  post_learning_enabled?: boolean;
  post_learning_type?: string | null;
  post_learning_minutes?: number | null;
  post_learning_instructions?: string | null;
  post_learning_url?: string | null;
  post_learning_file_path?: string | null;
  post_learning_file_name?: string | null;
  material_count?: number;
}

export interface SessionMaterialItem {
  id: number | string;
  title: string;
  materialType?: string | null;
  material_type?: string | null;
  filePath?: string | null;
  file_path?: string | null;
  fileName?: string | null;
  file_name?: string | null;
  externalUrl?: string | null;
  external_url?: string | null;
  file_url?: string | null;
  fileUrl?: string | null;
  file_size?: string | null;
}

export interface SessionBeforeClass {
  activityType: string;
  duration: string;
  prompt: string;
  resourceUrl?: string;
}

export interface SessionAfterClass {
  activityType: string;
  duration: string;
  prompt: string;
  resourceUrl?: string;
}

export interface SessionInfoMeta {
  fullDate: string;
  timeSlot?: string;
  location?: string;
  independentStudy?: string[];
}

export interface CourseSessionDetail extends CourseSession {
  courseName: string;
  classCode: string;
  academicYear: string;
  beforeClass: SessionBeforeClass;
  learningObjectives: string;
  inClassContent: string;
  materials: string[];
  sessionMaterials?: SessionMaterialItem[];
  afterClass: SessionAfterClass;
  sessionInfo: SessionInfoMeta;
}

export interface WeeklyPlanSession {
  // Database fields from Web LMS
  id?: number;
  course_id?: number;
  subject_name?: string;
  course_name?: string;
  session_date?: string;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  pre_learning_enabled?: boolean;
  post_learning_enabled?: boolean;
  pre_learning_minutes?: number | null;
  post_learning_minutes?: number | null;
  pre_done?: boolean;
  post_done?: boolean;

  // Normalized / legacy mobile alias fields
  sessionId: number;
  courseId: number;
  courseName: string;
  courseCode?: string;
  sessionNumber?: number;
  title: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri
  time: string; // e.g. "08:00 - 09:30"
  room?: string;
  teacher?: string;
  preDone: boolean;
  postDone: boolean;
  preQuestion?: string;
  postNote?: string;
  materials?: string[];
  status: 'completed' | 'in_progress' | 'scheduled' | string;
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'points' | 'info' | 'error';
  points?: number;
  message: string;
  duration?: number;
}

export interface PointHistoryItem {
  id: string;
  title: string;
  date: string;
  points: number;
}

export type SshsAspectItem = {
  id: number;
  item_key: string;
  label: string;
  score_kind: 'abc' | 'text';
  sort_order: number;
  description: string | null;
  score: string | null;
};

export type SshsAspectBlock = {
  id: number;
  code: string;
  title: string;
  sort_order: number;
  items: SshsAspectItem[];
};

export type SshsSubjectRow = {
  subject_id: number;
  subject_name: string;
  sort_order: number;
  key_learning_focus: string | null;
  ca: number | null;
  ma: number | null;
  term_average: number | null;
};

export type PublishedCardSummary = {
  id: number;
  class_name: string;
  term_name: string;
  term_number: number;
  academic_year_name: string;
  published_at: string | null;
};

export type PublishedCard = {
  id: number;
  school_level: 'secondary' | 'high_school';
  homeroom_comment: string | null;
  area_for_development: string | null;
  student_name: string;
  student_nis: string;
  class_name: string;
  phase: string | null;
  term_name: string;
  term_number: number;
  academic_year_name: string;
  school_name: string;
  school_logo_url: string | null;
  school_address: string | null;
  school_tagline: string | null;
  school_phone: string | null;
  school_email: string | null;
  school_website: string | null;
  principal_name: string | null;
  homeroom_teacher: string | null;
  subjects: SshsSubjectRow[];
  aspects: SshsAspectBlock[];
};


export interface DashboardStats {
  activeCourses: number;
  pendingAssignments: number;
  upcomingExams: number;
  sessionsThisWeek: number;
}

export interface DashboardPoints {
  total: number;
  discipline: number;
  literacy: number;
  habits: number;
  houseName: string | null;
  houseRank: number | null;
  houseTotal: number | null;
}

export interface DashboardUpcomingSession {
  id: number;
  title: string;
  courseName: string;
  course_name?: string;
  sessionDate: string;
  session_date?: string;
  startTime: string | null;
  start_time?: string | null;
  status: string;
}

export interface DashboardPendingAssignment {
  id: number;
  title: string;
  courseId: number;
  course_id?: number;
  courseName: string;
  course_name?: string;
  dueDate: string | null;
  due_date?: string | null;
}

export interface DashboardRecentScore {
  title: string;
  courseName: string;
  course_name?: string;
  score: number;
  maxScore: number;
  max_score?: number;
}

export interface DashboardAnnouncementItem {
  id: number;
  title: string;
  content: string;
  publishAt?: string | null;
  publish_at?: string | null;
  createdByName?: string;
}

export interface DashboardData {
  stats: DashboardStats;
  points: DashboardPoints | null;
  upcomingSessions: DashboardUpcomingSession[];
  pendingAssignments: DashboardPendingAssignment[];
  recentScores: DashboardRecentScore[];
  announcements: DashboardAnnouncementItem[];
  studentProfile?: {
    fullName?: string;
    className?: string | null;
    schoolName?: string;
    houseName?: string | null;
    academicYearName?: string | null;
  };
}

// ==========================================
// CLUBS TYPES
// ==========================================
export interface ClubItem {
  id: number;
  name: string;
  description?: string | null;
  schedule_text?: string | null;
  coach_name?: string | null;
  meeting_weekday?: number | null;
  meeting_start?: string | null;
  meeting_end?: string | null;
  meeting_location?: string | null;
  status?: string;
  joined_at?: string;
  report_count?: number;
}

export interface ClubReportItem {
  id: number;
  club_id: number;
  club_name?: string;
  title: string;
  summary?: string | null;
  photo_url?: string | null;
  photo_urls?: string[];
  created_at?: string;
  session_title?: string | null;
  session_date?: string | null;
}

export interface ClubSessionItem {
  id: number;
  title: string;
  session_date: string;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
}

export interface ClubMaterialItem {
  id: number;
  title: string;
  description?: string | null;
  file_url?: string | null;
  external_url?: string | null;
}

export interface ClubScoreItem {
  id: number;
  title: string;
  score: number;
  max_score: number;
  notes?: string | null;
  scored_at?: string | null;
}

export interface ClubDetailData {
  club: ClubItem;
  sessions: ClubSessionItem[];
  materials: ClubMaterialItem[];
  scores: ClubScoreItem[];
  reports: ClubReportItem[];
}

// ==========================================
// CALENDAR TYPES
// ==========================================
export interface CalendarEventItem {
  id: number | string;
  title: string;
  description?: string | null;
  start_datetime: string;
  end_datetime?: string | null;
  location?: string | null;
  event_type?: string | null;
  audience_type?: string | null;
}

