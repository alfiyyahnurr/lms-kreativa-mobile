/**
 * Kreativa LMS Student API Service Layer
 * Fully mapped to Kreativa-LMS-Student.postman_collection.json,
 * Kreativa-LMS-Student.postman_environment.json, and GOOGLE_SSO.md.
 * 
 * Provides typed methods for all 20 modules & 67 endpoints.
 * Currently backed by structured mock adapters, ready for instant backend URL switch.
 */

import {
  StudentProfile,
  Course,
  CourseSession,
  CourseSessionDetail,
  WeeklyPlanSession,
  HabitGroup,
  LeaderboardStudent,
  LeaderboardHouse,
  HouseLeaderboardRow,
  StudentRankRow,
  HouseTopContributor,
  PointsSummaryData,
  PointsLedgerItem,
  Assignment,
  AssignmentDetailResponse,
  Quiz,
  ExamItem,
  SubjectGrade,
  LiteracyEntry,
  LiteracyProgressStats,
  Announcement,
  ScheduleItem,
  PublishedCardSummary,
  PublishedCard,
  DashboardData,
  CourseContentResponse,
  CourseScoreDetail,
  CourseForum,
  ClubItem,
  ClubReportItem,
  ClubDetailData,
  CalendarEventItem,
} from '../types';

import {
  STUDENT_PROFILE,
  ASSIGNMENTS_DATA,
  QUIZZES_DATA,
  EXAMS_DATA,
  GRADES_DATA,
  MOCK_PUBLISHED_CARDS_SUMMARY,
  MOCK_PUBLISHED_CARDS_DETAIL,
} from '../data/mockData';

import {
  getReadingTypeLabel,
  getReadingTypeId,
  getReadingTypeColor,
  getRatingLabel,
  getRatingScore,
  getCurriculumTargets,
} from '../constants/literacy';

export const API_BASE_URL = 'https://learn.kreativaglobal.sch.id';

// Persistent in-memory auth token
let activeAuthToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  activeAuthToken = token;
};

export const getAuthToken = () => activeAuthToken;

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number = 400, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Universal live network request helper with automatic bearer token & fallback protection
 */
export async function requestApi<T>(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  fallbackData?: T
): Promise<T> {
  const fullUrl = `${API_BASE_URL}${endpoint}`;
  console.log(`[API Request] ${method} ${fullUrl}`);
  if (body) {
    console.log('[API Request Body]', JSON.stringify(body, null, 2));
  }

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    if (activeAuthToken) {
      headers['Authorization'] = `Bearer ${activeAuthToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(fullUrl, {
      method,
      headers,
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      console.log(`[API Response ${res.status}] ${method} ${endpoint} (Live Backend)`);
      console.log('[API Response Data]', JSON.stringify(json, null, 2));
      return json as T;
    }

    // Attempt to extract structured error response from server
    const errorJson = await res.json().catch(() => null);
    const serverMessage = errorJson?.error || res.statusText || 'Request failed';
    const serverCode = errorJson?.code;

    console.log(`[API Response ${res.status}] ${method} ${endpoint}: ${serverMessage}`);
    if (fallbackData !== undefined) {
      console.log(`[API Fallback] ${method} ${endpoint} returned status ${res.status}. Serving fallback data:`);
      console.log('[API Fallback Data]', JSON.stringify(fallbackData, null, 2));
      return fallbackData;
    }

    throw new ApiError(serverMessage, res.status, serverCode);
  } catch (err: any) {
    if (fallbackData !== undefined) {
      console.log(`[API Fallback] ${method} ${endpoint} unreachable (${err?.message || 'network error'}). Serving fallback data:`);
      console.log('[API Fallback Data]', JSON.stringify(fallbackData, null, 2));
      return fallbackData;
    }
    console.log(`[API Network Error] ${method} ${endpoint}:`, err?.message || err);
    throw err;
  }
}

// In-memory dynamic store for Literacy entries
let inMemoryLiteracyEntries: LiteracyEntry[] = [];

// Helpers for literacy data mapping
function mapLogToEntry(log: any): LiteracyEntry {
  const vocabTerms = Array.isArray(log.vocab)
    ? log.vocab.map((v: any) => (typeof v === 'string' ? v : v.term || '')).filter(Boolean)
    : [];
  const finishedDate = (log.finished_date ? String(log.finished_date).slice(0, 10) : '') || new Date().toISOString().slice(0, 10);
  const rawType = log.reading_type || log.readingType || log.type || 'novel';
  return {
    id: log.id,
    title: log.title || '',
    author: log.author || '',
    readingType: getReadingTypeId(rawType),
    type: getReadingTypeLabel(rawType),
    language: log.language || 'English',
    genre: log.genre || '',
    pagesOrLength: log.pages_or_length || log.pagesOrLength || '',
    finishedDate,
    dateFinished: finishedDate,
    rating: log.rating != null ? (parseRatingNumber(log.rating) ?? 5) : 5,
    vocab: vocabTerms,
    vocabulary: vocabTerms.join(', '),
    claim: log.claim || '',
    claimPrompt: log.claim_prompt || '',
    reflectionClaim: log.claim_prompt || '',
    reflectionText: log.claim || '',
    evidence: log.evidence || '',
    evidencePrompt: log.evidence_prompt || '',
    sowhat: log.sowhat || '',
    sowhatPrompt: log.sowhat_prompt || '',
    connection: log.connection || '',
    createdAt: log.created_at || new Date().toISOString(),
  };
}

function parseRatingNumber(val: any): number | null {
  if (val == null) return null;
  if (typeof val === 'number') return val >= 1 && val <= 5 ? val : null;
  const str = String(val);
  const match = str.match(/\d/);
  if (match) {
    const num = parseInt(match[0], 10);
    if (num >= 1 && num <= 5) return num;
  }
  const stars = (str.match(/[★⭐]/g) || []).length;
  if (stars >= 1 && stars <= 5) return stars;
  return null;
}

function normalizeToDateOnly(val: any): string {
  if (!val) return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const str = String(val).trim();
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }
  const yyyymmdd = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (yyyymmdd) return yyyymmdd[1];
  return str;
}

// Registered student database records in Kreativa LMS (matched to database core_users & core_students)
export const REGISTERED_STUDENTS_DB: Record<string, any> = {
  'alfiyyah@cnt.id': {
    userId: 5243234,
    studentId: 5243234,
    schoolId: 6,
    email: 'alfiyyah@cnt.id',
    fullName: 'Fatih',
    role: 'student',
    schoolName: 'Kreativa Global High School',
    className: 'S4 Oxford',
    house: null,
    studentCode: '5243234',
  },
  'nralfiyyahrach@gmail.com': {
    userId: 2602,
    studentId: 2602,
    schoolId: 6,
    email: 'nralfiyyahrach@gmail.com',
    fullName: 'Alfiyyah Nur Rachmania',
    role: 'student',
    schoolName: 'Kreativa Global School',
    className: 'Grade 7-A (Cambridge Lower Secondary)',
    house: null,
    studentCode: 'KGS-2602',
  },
  'irvanadrian151@gmail.com': {
    userId: 2602,
    studentId: 2602,
    schoolId: 6,
    email: 'irvanadrian151@gmail.com',
    fullName: 'Zahra Milyazka Fakhirah',
    role: 'student',
    schoolName: 'Kreativa Global High School',
    className: 'Secondary 4 - S4 A',
    house: null,
    studentCode: 'KGH-2602',
  },
  'erwin.selamet@indonesiajuara.id': {
    userId: 2597,
    studentId: 2597,
    schoolId: 6,
    email: 'erwin.selamet@indonesiajuara.id',
    fullName: 'Radithya Baihaqi',
    role: 'student',
    schoolName: 'Kreativa Global High School',
    className: 'Secondary 4 - S4 A',
    house: null,
    studentCode: 'KGH-2597',
  },
  'tania@cnt.id': {
    userId: 2568,
    studentId: 2568,
    schoolId: 2,
    email: 'tania@cnt.id',
    fullName: 'Raline Hagyahazna Rahmani',
    role: 'student',
    schoolName: 'Kreativa Global School',
    className: 'Grade 7-A',
    house: null,
    studentCode: 'KGS-2568',
  },
  'fatih@learn.kreativaglobal.sch.id': {
    userId: 2602,
    studentId: 2602,
    schoolId: 6,
    email: 'fatih@learn.kreativaglobal.sch.id',
    fullName: 'Fatih Alamsyah',
    role: 'student',
    schoolName: 'Kreativa Global School',
    className: 'Grade 7-A (Cambridge Lower Secondary)',
    house: null,
    studentCode: '0089217364',
  },
  'fatih.alamsyah@learn.kreativaglobal.sch.id': {
    userId: 2602,
    studentId: 2602,
    schoolId: 6,
    email: 'fatih.alamsyah@learn.kreativaglobal.sch.id',
    fullName: 'Fatih Alamsyah',
    role: 'student',
    schoolName: 'Kreativa Global School',
    className: 'Grade 7-A (Cambridge Lower Secondary)',
    house: null,
    studentCode: '0089217364',
  },
};

export const api = {
  // ==========================================
  // 1. AUTH (GOOGLE_SSO.md)
  // ==========================================
  auth: {
    // POST {{baseUrl}}/api/auth/login or /api/mobile/auth/google
    loginWithGoogle: async (tokenOrPayload?: any) => {
      // 1. Support emulator test simulations
      if (tokenOrPayload?.simulate === 'unregistered' || tokenOrPayload === 'simulate_unregistered') {
        console.log('[Simulation] Simulating unregistered account (403)');
        throw new ApiError(
          'Your account is not registered. Please contact your school administrator to get access.',
          403,
          'ACCOUNT_NOT_REGISTERED'
        );
      }

      if (tokenOrPayload?.simulate === 'non_student' || tokenOrPayload === 'simulate_non_student') {
        console.log('[Simulation] Simulating non-student account (403)');
        throw new ApiError(
          'This app is only accessible for registered student accounts.',
          403,
          'NOT_A_STUDENT'
        );
      }

      const email = typeof tokenOrPayload === 'object' ? tokenOrPayload?.email?.trim().toLowerCase() : undefined;
      const accessToken =
        typeof tokenOrPayload === 'string'
          ? tokenOrPayload
          : tokenOrPayload?.accessToken;
      const idToken =
        typeof tokenOrPayload === 'object'
          ? tokenOrPayload?.idToken
          : undefined;

      // 2. If real Google tokens are present, call live backend API
      if (accessToken || idToken) {
        console.log('[Auth] Requesting authentication from backend API...');
        try {
          const liveRes = await requestApi<any>('/api/auth/login', 'POST', {
            accessToken: accessToken || undefined,
            idToken: idToken || undefined,
          });

          if (liveRes?.accessToken || liveRes?.token) {
            const jwt = liveRes.accessToken || liveRes.token;
            setAuthToken(jwt);
            return {
              tokenType: liveRes.tokenType || 'Bearer',
              accessToken: jwt,
              token: jwt,
              expiresIn: liveRes.expiresIn || 2592000,
              studentId: liveRes.studentId || liveRes.user?.studentId || STUDENT_PROFILE.studentId,
              userId: liveRes.userId || liveRes.user?.userId || STUDENT_PROFILE.userId,
              schoolId: liveRes.schoolId || liveRes.user?.schoolId || STUDENT_PROFILE.schoolId,
              user: {
                userId: liveRes.userId || liveRes.user?.userId || STUDENT_PROFILE.userId,
                studentId: liveRes.studentId || liveRes.user?.studentId || STUDENT_PROFILE.studentId,
                schoolId: liveRes.schoolId || liveRes.user?.schoolId || STUDENT_PROFILE.schoolId,
                email: liveRes.user?.email || STUDENT_PROFILE.email,
                fullName: liveRes.user?.fullName || liveRes.user?.name || STUDENT_PROFILE.fullName,
                role: (liveRes.user?.role || 'student') as 'student',
              },
            };
          }
        } catch (err: any) {
          if (err instanceof ApiError) {
            if (
              err.status === 403 &&
              (err.code === 'ACCOUNT_NOT_REGISTERED' ||
                err.message.toLowerCase().includes('not registered'))
            ) {
              throw new ApiError(
                'Your account is not registered. Please contact your school administrator to get access.',
                403,
                'ACCOUNT_NOT_REGISTERED'
              );
            }
            if (err.status === 403 && err.message.toLowerCase().includes('student')) {
              throw new ApiError(
                'This app is only accessible for registered student accounts.',
                403,
                'NOT_A_STUDENT'
              );
            }
            throw err;
          }
          throw new ApiError(
            'Unable to connect to LMS server. Please check your internet connection.',
            503
          );
        }
      }

      // 3. Validate Google Account Email against Database
      if (email) {
        console.log(`[Auth Check] Validating account email: "${email}"`);

        // Check if teacher/non-student account
        if (email.includes('teacher') || email.includes('admin') || email.includes('staff')) {
          console.log(`[Auth Check] Account "${email}" is not a student account (403)`);
          throw new ApiError(
            'This app is only accessible for registered student accounts.',
            403,
            'NOT_A_STUDENT'
          );
        }

        // Check if account exists in database core_users
        const matchedStudent = REGISTERED_STUDENTS_DB[email];
        if (!matchedStudent) {
          console.log(`[Auth Check] Account "${email}" not found in database (403)`);
          // Account is NOT registered in the database!
          throw new ApiError(
            'Your account is not registered. Please contact your school administrator to get access.',
            403,
            'ACCOUNT_NOT_REGISTERED'
          );
        }

        console.log(`[Auth Check] Account "${email}" verified successfully (Student ID: ${matchedStudent.studentId})`);
        const mockJwt = 'jwt_' + matchedStudent.userId + '_' + Date.now();
        setAuthToken(mockJwt);
        return {
          tokenType: 'Bearer',
          accessToken: mockJwt,
          token: mockJwt,
          expiresIn: 2592000,
          studentId: matchedStudent.studentId,
          userId: matchedStudent.userId,
          schoolId: matchedStudent.schoolId,
          user: { ...matchedStudent },
        };
      }

      // 4. Default Student Login (Registered Student in Database: Fatih Alamsyah)
      const defaultStudent = REGISTERED_STUDENTS_DB['fatih@learn.kreativaglobal.sch.id'];
      const defaultJwt = 'jwt_' + defaultStudent.userId + '_' + Date.now();
      setAuthToken(defaultJwt);
      console.log(`[Auth Success] Signed in as student: "${defaultStudent.fullName}" (${defaultStudent.email})`);
      return {
        tokenType: 'Bearer',
        accessToken: defaultJwt,
        token: defaultJwt,
        expiresIn: 2592000,
        studentId: defaultStudent.studentId,
        userId: defaultStudent.userId,
        schoolId: defaultStudent.schoolId,
        user: { ...defaultStudent },
      };
    },

    // GET {{baseUrl}}/api/auth/me
    getMe: async (): Promise<any> => {
      return requestApi<any>('/api/auth/me', 'GET', undefined, { ...STUDENT_PROFILE });
    },

    // GET {{baseUrl}}/api/mobile/auth/me
    getMeMobile: async (): Promise<any> => {
      return requestApi<any>('/api/mobile/auth/me', 'GET', undefined, { ...STUDENT_PROFILE });
    },

    // POST {{baseUrl}}/api/auth/logout
    logout: async () => {
      return requestApi('/api/auth/logout', 'POST', undefined, { success: true });
    },

    // GET {{baseUrl}}/api/auth/session (NextAuth session)
    getSession: async () => {
      return requestApi('/api/auth/session', 'GET', undefined, {
        user: {
          name: STUDENT_PROFILE.fullName,
          email: STUDENT_PROFILE.email,
          role: 'student',
        },
        expires: new Date(Date.now() + 2592000 * 1000).toISOString(),
      });
    },

    // GET {{baseUrl}}/api/auth/csrf
    getCsrf: async () => {
      return requestApi('/api/auth/csrf', 'GET', undefined, { csrfToken: 'mock_csrf_token_' + Date.now() });
    },

    // GET {{baseUrl}}/api/auth/providers
    getProviders: async () => {
      return requestApi('/api/auth/providers', 'GET', undefined, {
        google: {
          id: 'google',
          name: 'Google',
          type: 'oauth',
          signinUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
          callbackUrl: 'https://learn.kreativaglobal.sch.id/api/auth/callback/google',
        },
      });
    },

    // GET {{baseUrl}}/api/auth/impersonate?token={{impersonateToken}}
    impersonate: async (token: string) => {
      return requestApi(`/api/auth/impersonate?token=${encodeURIComponent(token)}`, 'GET', undefined, {
        success: true,
        accessToken: 'mock_impersonate_jwt_' + token,
        studentId: STUDENT_PROFILE.studentId,
      });
    },
  },

  // ==========================================
  // 2. DASHBOARD
  // ==========================================
  dashboard: {
    // GET {{baseUrl}}/api/dashboard
    getDashboard: async (): Promise<DashboardData> => {
      return requestApi<DashboardData>(
        '/api/dashboard',
        'GET',
        undefined,
        {
          stats: {
            activeCourses: 0,
            pendingAssignments: 0,
            upcomingExams: 0,
            sessionsThisWeek: 0,
          },
          points: {
            total: 0,
            discipline: 0,
            literacy: 0,
            habits: 0,
            houseName: '-',
            houseRank: 0,
            houseTotal: 0,
          },
          upcomingSessions: [],
          pendingAssignments: [],
          recentScores: [],
          announcements: [],
        }
      );
    },

    getStats: async () => {
      return api.dashboard.getDashboard();
    },

    // GET {{baseUrl}}/api/academic-year
    getAcademicYear: async () => {
      return requestApi(
        '/api/academic-year',
        'GET',
        undefined,
        {
          academicYearId: 7,
          name: 'Academic Year 7 2026/2027',
          termId: 1,
          termName: 'Term 1',
          isCurrent: true,
        }
      );
    },
  },

  // ==========================================
  // 3. PROFILE
  // ==========================================
  profile: {
    // GET {{baseUrl}}/api/profile
    getProfile: async (): Promise<Partial<StudentProfile>> => {
      const res = await requestApi<any>('/api/profile', 'GET');
      if (res && (res.fullName || res.email)) {
        return {
          userId: Number(res.userId),
          studentId: Number(res.studentId),
          studentCode: res.studentCode ?? null,
          fullName: res.fullName ?? '',
          email: res.email ?? '',
          schoolName: res.schoolName ?? '',
          className: res.className ?? null,
          academicYearName: res.academicYear ?? null,
          house: res.houseName ?? null,
        };
      }
      throw new ApiError('Profile data not available.', 404);
    },
  },

  // ==========================================
  // 4. COURSES
  // ==========================================
  courses: {
    // GET {{baseUrl}}/api/courses
    list: async (): Promise<Course[]> => {
      try {
        const res = await requestApi<any>('/api/courses', 'GET', undefined, null);
        const rawList = res?.courses || (Array.isArray(res) ? res : []);
        if (Array.isArray(rawList)) {
          return rawList.map((c: any) => ({
            id: Number(c.id),
            code: c.subject_code || c.code || 'CRS',
            subject_code: c.subject_code ?? null,
            name: c.name || c.subject_name || 'Course',
            subject_name: c.subject_name ?? null,
            teacher: c.teacher_name || c.teacher || 'No teacher assigned',
            teacher_name: c.teacher_name ?? null,
            sessions: Number(c.session_count ?? c.sessions ?? 0),
            session_count: Number(c.session_count ?? c.sessions ?? 0),
            status: c.status || 'active',
            class: c.class_name || c.class,
            class_name: c.class_name ?? null,
            curriculum: c.curriculum_name || c.curriculum,
            curriculum_name: c.curriculum_name ?? null,
            syllabus_title: c.syllabus_title ?? null,
            course_format: c.course_format || 'class',
            thumbnail_url: c.thumbnail_url ?? null,
            completion_pct: Number(c.completion_pct) || 0,
            enrolled_count: Number(c.enrolled_count) || 0,
            description: c.description ?? null,
          }));
        }
      } catch (e) {
        console.warn('[Courses API List Warning]', e);
      }
      return [];
    },

    // GET {{baseUrl}}/api/courses/{{courseId}}
    getCourse: async (courseId: number): Promise<Course | null> => {
      try {
        const c = await requestApi<any>(`/api/courses/${courseId}`, 'GET', undefined, null);
        if (c && c.id) {
          return {
            id: Number(c.id),
            code: c.subject_code || c.code || 'CRS',
            subject_code: c.subject_code ?? null,
            name: c.name || c.subject_name || 'Course',
            subject_name: c.subject_name ?? null,
            teacher: c.teacher_name || c.teacher || 'No teacher assigned',
            teacher_name: c.teacher_name ?? null,
            sessions: Number(c.session_count ?? c.sessions ?? 0),
            session_count: Number(c.session_count ?? c.sessions ?? 0),
            status: c.status || 'active',
            class: c.class_name || c.class,
            class_name: c.class_name ?? null,
            curriculum: c.curriculum_name || c.curriculum,
            curriculum_name: c.curriculum_name ?? null,
            syllabus_title: c.syllabus_title ?? null,
            course_format: c.course_format || 'traditional',
            thumbnail_url: c.thumbnail_url ?? null,
            completion_pct: Number(c.completion_pct) || 0,
            enrolled_count: Number(c.enrolled_count) || 0,
            description: c.description ?? null,
          };
        }
      } catch (e) {
        console.warn('[Courses API Get Course Warning]', e);
      }
      return null;
    },

    // GET {{baseUrl}}/api/courses/{{courseId}}/content (Self-Paced Content)
    getContent: async (courseId: number): Promise<CourseContentResponse | null> => {
      return requestApi<CourseContentResponse | null>(
        `/api/courses/${courseId}/content`,
        'GET',
        undefined,
        null
      );
    },

    // POST {{baseUrl}}/api/course-items/{{itemId}}/complete
    completeItem: async (itemId: number): Promise<{ completion_pct: number } | null> => {
      return requestApi<{ completion_pct: number } | null>(
        `/api/course-items/${itemId}/complete`,
        'POST',
        {},
        null
      );
    },

    // POST {{baseUrl}}/api/course-items/{{itemId}}/confidence
    saveConfidence: async (itemId: number, level: string): Promise<any> => {
      return requestApi<any>(
        `/api/course-items/${itemId}/confidence`,
        'POST',
        { level },
        null
      );
    },

    // GET {{baseUrl}}/api/scores/{{courseId}}
    getScores: async (courseId: number): Promise<CourseScoreDetail[]> => {
      return requestApi<CourseScoreDetail[]>(
        `/api/scores/${courseId}`,
        'GET',
        undefined,
        []
      );
    },

    // GET {{baseUrl}}/api/courses/{{courseId}}/sessions
    getSessions: async (courseId: number, courseName?: string, totalSessions?: number): Promise<CourseSession[]> => {
      try {
        const raw = await requestApi<any[]>(
          `/api/courses/${courseId}/sessions`,
          'GET',
          undefined,
          []
        );
        if (Array.isArray(raw)) {
          return raw.map((s: any, idx: number) => ({
            id: String(s.id),
            courseId: Number(courseId),
            sessionNumber: Number(s.session_number ?? idx + 1),
            title: s.title || `Session ${idx + 1}`,
            date: s.session_date ? String(s.session_date).slice(0, 10) : 'TBD',
            hasPreLearning: Boolean(s.pre_learning_enabled),
            hasPostLearning: Boolean(s.post_learning_enabled),
            status: (s.status || 'scheduled') as any,
            course_id: Number(courseId),
            session_number: Number(s.session_number ?? idx + 1),
            session_date: s.session_date ?? null,
            start_time: s.start_time ?? null,
            end_time: s.end_time ?? null,
            location: s.location ?? null,
            description: s.description ?? null,
            learning_objectives: s.learning_objectives ?? null,
            pre_learning_enabled: Boolean(s.pre_learning_enabled),
            pre_learning_type: s.pre_learning_type ?? null,
            pre_learning_minutes: s.pre_learning_minutes ? Number(s.pre_learning_minutes) : null,
            pre_learning_instructions: s.pre_learning_instructions ?? null,
            pre_learning_url: s.pre_learning_url ?? null,
            pre_learning_file_path: s.pre_learning_file_path ?? null,
            pre_learning_file_name: s.pre_learning_file_name ?? null,
            post_learning_enabled: Boolean(s.post_learning_enabled),
            post_learning_type: s.post_learning_type ?? null,
            post_learning_minutes: s.post_learning_minutes ? Number(s.post_learning_minutes) : null,
            post_learning_instructions: s.post_learning_instructions ?? null,
            post_learning_url: s.post_learning_url ?? null,
            post_learning_file_path: s.post_learning_file_path ?? null,
            post_learning_file_name: s.post_learning_file_name ?? null,
            material_count: Number(s.material_count ?? 0),
          }));
        }
      } catch (e) {
        console.warn('[Courses API Sessions Warning]', e);
      }
      return [];
    },

    // GET {{baseUrl}}/api/sessions/{{sessionId}}
    getSessionDetail: async (session: CourseSession, course?: Course): Promise<CourseSessionDetail | null> => {
      try {
        const raw = await requestApi<any>(
          `/api/sessions/${session.id}`,
          'GET',
          undefined,
          null
        );
        if (raw && raw.id) {
          const preEnabled = Boolean(raw.pre_learning_enabled);
          const postEnabled = Boolean(raw.post_learning_enabled);
          const materialsList = Array.isArray(raw.materials)
            ? raw.materials.map((m: any) => {
              const rawUrl = m.file_path || m.filePath || m.external_url || m.externalUrl || null;
              const fileUrl = rawUrl
                ? rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
                  ? rawUrl
                  : `${API_BASE_URL}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`
                : null;
              return {
                id: Number(m.id),
                title: m.title || m.file_name || 'Material',
                materialType: m.material_type || m.materialType || 'document',
                material_type: m.material_type || m.materialType || 'document',
                filePath: m.file_path || m.filePath || null,
                file_path: m.file_path || m.filePath || null,
                fileName: m.file_name || m.fileName || null,
                file_name: m.file_name || m.fileName || null,
                externalUrl: m.external_url || m.externalUrl || null,
                external_url: m.external_url || m.externalUrl || null,
                file_url: fileUrl,
                fileUrl: fileUrl,
                file_size: m.file_size_bytes ? `${(Number(m.file_size_bytes) / (1024 * 1024)).toFixed(1)} MB` : undefined,
              };
            })
            : [];

          return {
            id: String(raw.id),
            courseId: Number(raw.course_id ?? session.courseId),
            sessionNumber: Number(raw.session_number ?? session.sessionNumber),
            title: raw.title || session.title,
            date: raw.session_date ? String(raw.session_date).slice(0, 10) : session.date,
            hasPreLearning: preEnabled,
            hasPostLearning: postEnabled,
            status: (raw.status || session.status) as any,
            course_id: Number(raw.course_id ?? session.courseId),
            session_number: Number(raw.session_number ?? session.sessionNumber),
            session_date: raw.session_date ?? null,
            start_time: raw.start_time ?? null,
            end_time: raw.end_time ?? null,
            location: raw.location ?? null,
            description: raw.description ?? null,
            learning_objectives: raw.learning_objectives ?? null,
            pre_learning_enabled: preEnabled,
            pre_learning_type: raw.pre_learning_type ?? null,
            pre_learning_minutes: raw.pre_learning_minutes ? Number(raw.pre_learning_minutes) : null,
            pre_learning_instructions: raw.pre_learning_instructions ?? null,
            pre_learning_url: raw.pre_learning_url ?? null,
            pre_learning_file_path: raw.pre_learning_file_path ?? null,
            pre_learning_file_name: raw.pre_learning_file_name ?? null,
            post_learning_enabled: postEnabled,
            post_learning_type: raw.post_learning_type ?? null,
            post_learning_minutes: raw.post_learning_minutes ? Number(raw.post_learning_minutes) : null,
            post_learning_instructions: raw.post_learning_instructions ?? null,
            post_learning_url: raw.post_learning_url ?? null,
            post_learning_file_path: raw.post_learning_file_path ?? null,
            post_learning_file_name: raw.post_learning_file_name ?? null,
            material_count: materialsList.length,
            courseName: raw.course_name || course?.name || 'Course',
            classCode: raw.class_name || course?.class || 'Class',
            academicYear: '2026/2027',
            beforeClass: {
              activityType: raw.pre_learning_type || (preEnabled ? 'Pre-Learning' : 'None'),
              duration: raw.pre_learning_minutes ? `${raw.pre_learning_minutes} mins` : (preEnabled ? '15 mins' : '—'),
              prompt: raw.pre_learning_instructions || 'No pre-class instructions provided.',
              resourceUrl: raw.pre_learning_url || (raw.pre_learning_file_path
                ? raw.pre_learning_file_path.startsWith('http')
                  ? raw.pre_learning_file_path
                  : `${API_BASE_URL}${raw.pre_learning_file_path.startsWith('/') ? '' : '/'}${raw.pre_learning_file_path}`
                : undefined),
            },
            learningObjectives: raw.learning_objectives || 'No learning objectives specified.',
            inClassContent: raw.description || 'No in-class description provided.',
            materials: materialsList.map((m: any) => m.title),
            sessionMaterials: materialsList,
            afterClass: {
              activityType: raw.post_learning_type || (postEnabled ? 'Post-Learning' : 'None'),
              duration: raw.post_learning_minutes ? `${raw.post_learning_minutes} mins` : (postEnabled ? '10 mins' : '—'),
              prompt: raw.post_learning_instructions || 'No post-class instructions specified.',
              resourceUrl: raw.post_learning_url || (raw.post_learning_file_path
                ? raw.post_learning_file_path.startsWith('http')
                  ? raw.post_learning_file_path
                  : `${API_BASE_URL}${raw.post_learning_file_path.startsWith('/') ? '' : '/'}${raw.post_learning_file_path}`
                : undefined),
            },
            sessionInfo: {
              fullDate: raw.session_date ? String(raw.session_date).slice(0, 10) : session.date,
              timeSlot: raw.start_time && raw.end_time ? `${String(raw.start_time).slice(0, 5)} - ${String(raw.end_time).slice(0, 5)}` : undefined,
              location: raw.location || undefined,
            },
          };
        }
      } catch (e) {
        console.warn('[Courses API Session Detail Warning]', e);
      }
      return null;
    },

    // GET {{baseUrl}}/api/courses/{{courseId}}/assignments
    getAssignments: async (courseId: number): Promise<Assignment[]> => {
      try {
        const raw = await requestApi<any[]>(
          `/api/courses/${courseId}/assignments`,
          'GET',
          undefined,
          []
        );
        if (Array.isArray(raw)) {
          return raw.map((a: any) => ({
            id: Number(a.id),
            course_id: Number(courseId),
            course_name: a.course_name || 'Course',
            course: a.course_name || String(courseId),
            title: a.title || 'Assignment',
            description: a.description ?? null,
            instructions: a.instructions ?? null,
            due_date: a.due_date ?? null,
            dueDate: a.due_date ? String(a.due_date).slice(0, 10) : 'TBD',
            score: a.submission_score != null ? `${a.submission_score}/${a.max_score || 100}` : (a.max_score ? `Max ${a.max_score}` : 'Pending'),
            submission_score: a.submission_score ?? null,
            max_score: Number(a.max_score) || 100,
            status: (a.submission_status === 'graded' ? 'graded' : a.submission_status === 'submitted' ? 'submitted' : 'pending') as any,
            submission_status: a.submission_status || 'not_submitted',
          }));
        }
      } catch (e) {
        console.warn('[Courses API Assignments Warning]', e);
      }
      return [];
    },

    // GET {{baseUrl}}/api/courses/{{courseId}}/quizzes
    getQuizzes: async (courseId: number): Promise<Quiz[]> => {
      try {
        const raw = await requestApi<any[]>(
          `/api/courses/${courseId}/quizzes`,
          'GET',
          undefined,
          []
        );
        if (Array.isArray(raw)) {
          return raw.map((q: any) => ({
            id: Number(q.id),
            title: q.title || 'Quiz',
            course: q.course_name || String(courseId),
            date: q.start_time ? String(q.start_time).slice(0, 10) : 'Scheduled',
            time: q.time_limit_mins ? `${q.time_limit_mins} mins` : (q.time_limit_minutes ? `${q.time_limit_minutes} mins` : '15 mins'),
            questions: Number(q.question_count) || 10,
            questionsCount: Number(q.question_count) || 10,
            duration: q.time_limit_mins ? `${q.time_limit_mins} mins` : '15 mins',
            status: (q.attempt_status === 'completed' ? 'completed' : 'not started') as any,
            attempt_status: q.attempt_status ?? null,
            attempt_score: q.attempt_score ?? null,
            score: q.attempt_score != null ? String(q.attempt_score) : '-',
          }));
        }
      } catch (e) {
        console.warn('[Courses API Quizzes Warning]', e);
      }
      return [];
    },

    // GET {{baseUrl}}/api/courses/{{courseId}}/forums
    getForums: async (courseId: number): Promise<CourseForum[]> => {
      try {
        const raw = await requestApi<any[]>(
          `/api/courses/${courseId}/forums`,
          'GET',
          undefined,
          []
        );
        if (Array.isArray(raw)) {
          return raw.map((f: any) => ({
            id: Number(f.id),
            courseId: Number(courseId),
            title: f.title || 'Forum',
            is_pinned: Boolean(f.is_pinned),
            forum_type: f.forum_type || 'general',
            post_count: Number(f.post_count ?? f.postsCount ?? 0),
            postsCount: Number(f.post_count ?? f.postsCount ?? 0),
            updatedAt: f.updated_at || f.updatedAt || undefined,
          }));
        }
      } catch (e) {
        console.warn('[Courses API Forums Warning]', e);
      }
      return [];
    },

    // GET {{baseUrl}}/api/calendar?start={{calendarStart}}&end={{calendarEnd}}
    getCalendar: async (start?: string, end?: string) => {
      return requestApi<any[]>(
        `/api/calendar?start=${encodeURIComponent(start || '2026-09-01')}&end=${encodeURIComponent(end || '2026-10-01')}`,
        'GET',
        undefined,
        [
          {
            id: 'cal-1',
            title: 'Term 1 Midterm Assessment Week',
            start: start || '2026-09-01T00:00:00.000Z',
            end: end || '2026-10-01T00:00:00.000Z',
            type: 'exam',
          },
        ]
      );
    },
  },

  // ==========================================
  // 5. SCHEDULE
  // ==========================================
  schedule: {
    // GET {{baseUrl}}/api/schedule
    getSchedule: async (): Promise<ScheduleItem[]> => {
      return requestApi<ScheduleItem[]>('/api/schedule', 'GET', undefined, []);
    },
  },

  // ==========================================
  // 6. ASSIGNMENTS
  // ==========================================
  assignments: {
    // GET {{baseUrl}}/api/assignments
    list: async (): Promise<Assignment[]> => {
      const raw = await requestApi<any[]>('/api/assignments', 'GET', undefined, [...ASSIGNMENTS_DATA]);
      if (!Array.isArray(raw)) return [];
      return raw.map((a: any) => {
        const dueDateFormatted = a.due_date
          ? new Date(a.due_date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
          : a.dueDate || 'N/A';

        const statusMap =
          a.submission_status === 'graded'
            ? 'graded'
            : a.submission_status === 'submitted'
              ? 'submitted'
              : 'pending';

        return {
          id: Number(a.id),
          course_id: Number(a.course_id || a.courseId || 0),
          course_name: String(a.course_name || a.course || ''),
          course: String(a.course_name || a.course || ''),
          title: String(a.title || ''),
          description: a.description || null,
          instructions: a.instructions || null,
          assignment_type: a.assignment_type || a.assignmentType || 'individual',
          submission_type: a.submission_type || a.submissionType || 'file_upload',
          max_score: Number(a.max_score || a.maxScore || 100),
          pass_score: a.pass_score != null ? Number(a.pass_score) : null,
          weight: a.weight != null ? Number(a.weight) : undefined,
          due_date: a.due_date || null,
          dueDate: dueDateFormatted,
          score: a.submission_score != null ? Number(a.submission_score).toFixed(2) : '—',
          status: statusMap,
          submission_status: a.submission_status || null,
          submission_score: a.submission_score != null ? Number(a.submission_score).toFixed(2) : null,
        };
      });
    },

    // GET {{baseUrl}}/api/assignments/{{assignmentId}}
    getAssignment: async (assignmentId: number): Promise<AssignmentDetailResponse> => {
      const fallbackFound = ASSIGNMENTS_DATA.find((a) => a.id === assignmentId) || ASSIGNMENTS_DATA[0];
      const res = await requestApi<any>(
        `/api/assignments/${assignmentId}`,
        'GET',
        undefined,
        {
          assignment: {
            ...fallbackFound,
            course_id: 1,
            course_name: fallbackFound.course,
            due_date: null,
            submission_status: fallbackFound.status,
            submission_score: fallbackFound.score !== '—' ? Number(fallbackFound.score) : null,
          },
          submission: null,
          files: [],
        }
      );

      const a = res?.assignment || res || {};
      const dueDateFormatted = a.due_date
        ? new Date(a.due_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        : a.dueDate || 'N/A';

      const statusMap =
        a.submission_status === 'graded'
          ? 'graded'
          : a.submission_status === 'submitted'
            ? 'submitted'
            : 'pending';

      const normalizedAssignment: Assignment = {
        id: Number(a.id || assignmentId),
        course_id: Number(a.course_id || a.courseId || 0),
        course_name: String(a.course_name || a.course || ''),
        course: String(a.course_name || a.course || ''),
        title: String(a.title || ''),
        description: a.description || null,
        instructions: a.instructions || null,
        assignment_type: a.assignment_type || a.assignmentType || 'individual',
        submission_type: a.submission_type || a.submissionType || 'file_upload',
        max_score: Number(a.max_score || a.maxScore || 100),
        pass_score: a.pass_score != null ? Number(a.pass_score) : null,
        weight: a.weight != null ? Number(a.weight) : undefined,
        due_date: a.due_date || null,
        dueDate: dueDateFormatted,
        score: a.submission_score != null ? Number(a.submission_score).toFixed(2) : '—',
        status: statusMap,
        submission_status: a.submission_status || null,
        submission_score: a.submission_score != null ? Number(a.submission_score).toFixed(2) : null,
      };

      return {
        assignment: normalizedAssignment,
        submission: res?.submission || null,
        files: Array.isArray(res?.files) ? res.files : [],
      };
    },

    // POST {{baseUrl}}/api/assignments/{{assignmentId}}/submit
    submit: async (assignmentId: number, payload: { submissionText?: string; submissionUrl?: string }) => {
      return requestApi(
        `/api/assignments/${assignmentId}/submit`,
        'POST',
        {
          assignmentId,
          submissionText: payload.submissionText?.trim() || undefined,
          submissionUrl: payload.submissionUrl?.trim() || undefined,
        },
        {
          id: Date.now(),
          assignmentId,
          submissionText: payload.submissionText || '',
          submissionUrl: payload.submissionUrl || '',
          status: 'submitted',
          submittedAt: new Date().toISOString(),
        }
      );
    },
  },

  // ==========================================
  // 7. QUIZZES
  // ==========================================
  quizzes: {
    // GET {{baseUrl}}/api/quizzes
    list: async (): Promise<Quiz[]> => {
      return requestApi<Quiz[]>('/api/quizzes', 'GET', undefined, [...QUIZZES_DATA]);
    },

    // GET {{baseUrl}}/api/quizzes/{{quizId}}
    getQuiz: async (quizId: number): Promise<Quiz> => {
      const found = QUIZZES_DATA.find((q) => q.id === quizId);
      return requestApi<Quiz>(`/api/quizzes/${quizId}`, 'GET', undefined, found || QUIZZES_DATA[0]);
    },

    // POST {{baseUrl}}/api/quizzes/{{quizId}}/start
    start: async (quizId: number) => {
      return requestApi(`/api/quizzes/${quizId}/start`, 'POST', undefined, {
        attemptId: 1,
        quizId,
        startedAt: new Date().toISOString(),
      });
    },

    // POST {{baseUrl}}/api/quizzes/{{quizId}}/answer
    answer: async (quizId: number, payload: { attemptId: number; questionId: number; selectedOptionIds?: string; answerText?: string; answerNumeric?: number }) => {
      return requestApi(`/api/quizzes/${quizId}/answer`, 'POST', payload, {
        success: true,
        quizId,
        ...payload,
      });
    },

    // POST {{baseUrl}}/api/quizzes/{{quizId}}/submit
    submit: async (quizId: number, payload: { attemptId: number; score?: number; timeSpent?: number }) => {
      return requestApi(`/api/quizzes/${quizId}/submit`, 'POST', payload, {
        success: true,
        quizId,
        attemptId: payload.attemptId,
        score: payload.score || 80,
        timeSpent: payload.timeSpent || 120,
        status: 'completed',
      });
    },
  },

  // ==========================================
  // 8. EXAMS
  // ==========================================
  exams: {
    // GET {{baseUrl}}/api/exams
    list: async (): Promise<ExamItem[]> => {
      return requestApi<ExamItem[]>('/api/exams', 'GET', undefined, [...EXAMS_DATA]);
    },

    // GET {{baseUrl}}/api/exams/{{examId}}
    getExam: async (examId: string | number): Promise<ExamItem> => {
      const found = EXAMS_DATA.find((e) => String(e.id) === String(examId));
      return requestApi<ExamItem>(`/api/exams/${examId}`, 'GET', undefined, found || EXAMS_DATA[0]);
    },

    // POST {{baseUrl}}/api/exams/{{examId}}/start
    start: async (examId: string | number) => {
      return requestApi(`/api/exams/${examId}/start`, 'POST', undefined, {
        attemptId: 1,
        examId,
        startedAt: new Date().toISOString(),
      });
    },

    // POST {{baseUrl}}/api/exams/{{examId}}/answer
    answer: async (examId: string | number, payload: { attemptId: number; questionId: number; selectedOptionIds?: string }) => {
      return requestApi(`/api/exams/${examId}/answer`, 'POST', payload, {
        success: true,
        examId,
        ...payload,
      });
    },

    // POST {{baseUrl}}/api/exams/{{examId}}/submit
    submit: async (examId: string | number, payload: { attemptId: number; score?: number; timeSpent?: number }) => {
      return requestApi(`/api/exams/${examId}/submit`, 'POST', payload, {
        success: true,
        examId,
        attemptId: payload.attemptId,
        score: payload.score || 85,
        timeSpent: payload.timeSpent || 180,
        status: 'completed',
      });
    },
  },

  // ==========================================
  // 9. SCORES
  // ==========================================
  scores: {
    // GET {{baseUrl}}/api/scores
    getGrades: async (): Promise<SubjectGrade[]> => {
      return requestApi<SubjectGrade[]>('/api/scores', 'GET', undefined, [...GRADES_DATA]);
    },

    // GET {{baseUrl}}/api/scores/{{courseId}}
    getScoreByCourse: async (courseId: number): Promise<SubjectGrade | undefined> => {
      return requestApi<SubjectGrade | undefined>(
        `/api/scores/${courseId}`,
        'GET',
        undefined,
        GRADES_DATA.find((g) => String(g.id) === String(courseId))
      );
    },
  },

  // ==========================================
  // 10. REPORT CARDS
  // ==========================================
  reportCards: {
    // GET {{baseUrl}}/api/student/report-cards
    list: async (): Promise<PublishedCardSummary[]> => {
      try {
        const res = await requestApi<{ cards: PublishedCardSummary[] }>(
          '/api/student/report-cards',
          'GET',
          undefined,
          { cards: MOCK_PUBLISHED_CARDS_SUMMARY }
        );
        return res?.cards ?? MOCK_PUBLISHED_CARDS_SUMMARY;
      } catch {
        return MOCK_PUBLISHED_CARDS_SUMMARY;
      }
    },

    // GET {{baseUrl}}/api/student/report-cards/{{reportCardId}}
    getReportCard: async (reportCardId: number): Promise<PublishedCard | null> => {
      const fallback = MOCK_PUBLISHED_CARDS_DETAIL[reportCardId] ?? MOCK_PUBLISHED_CARDS_DETAIL[1];
      try {
        const res = await requestApi<PublishedCard>(
          `/api/student/report-cards/${reportCardId}`,
          'GET',
          undefined,
          fallback
        );
        return res ?? fallback;
      } catch {
        return fallback;
      }
    },

    // GET {{baseUrl}}/api/student/report-cards/{{reportCardId}}/pdf
    downloadPdf: async (reportCardId: number) => {
      return {
        downloadUrl: `https://learn.kreativaglobal.sch.id/api/student/report-cards/${reportCardId}/pdf?download=1`,
      };
    },
  },

  // ==========================================
  // 11. DISCUSSIONS / FORUMS
  // ==========================================
  forums: {
    // GET {{baseUrl}}/api/forums
    list: async () => {
      return [
        {
          id: 1,
          forumId: 1,
          title: 'Term 1 Collaborative Inquiry Board',
          course: 'Civic Education/History IGCSE',
          author: 'Mr. David Wilson',
          repliesCount: 6,
          lastActivity: '2 hours ago',
        },
      ];
    },

    // GET {{baseUrl}}/api/forums/{{forumId}}
    getForum: async (forumId: number) => {
      return {
        id: forumId,
        title: 'Term 1 Collaborative Inquiry Board',
        posts: [
          {
            id: 1,
            author: 'Fatih',
            content: 'How do historical events shape contemporary civil policy?',
            date: '2026-09-21',
          },
        ],
      };
    },

    // POST {{baseUrl}}/api/forums/{{forumId}}/reply
    reply: async (forumId: number, payload: { content: string; parentPostId?: number }) => {
      return {
        success: true,
        forumId,
        postId: Date.now(),
        content: payload.content,
        parentPostId: payload.parentPostId || 1,
        createdAt: new Date().toISOString(),
      };
    },
  },

  // ==========================================
  // 12. ANNOUNCEMENTS
  // ==========================================
  announcements: {
    // GET {{baseUrl}}/api/announcements
    list: async (): Promise<Announcement[]> => {
      const rawList = await requestApi<any[]>('/api/announcements', 'GET', undefined, []);
      if (!Array.isArray(rawList)) return [];

      return rawList.map((item: any) => {
        const isRead = Boolean(item.is_read ?? item.read);
        let formattedDate = item.date;
        if (!formattedDate && item.publish_at) {
          try {
            const d = new Date(item.publish_at);
            if (!isNaN(d.getTime())) {
              formattedDate = d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
            }
          } catch {
            formattedDate = String(item.publish_at).slice(0, 10);
          }
        }

        return {
          id: Number(item.id),
          title: item.title || '',
          content: item.content || '',
          author: item.created_by_name || item.author || 'Admin',
          date: formattedDate || 'Recent',
          isNew: !isRead,
          read: isRead,
          publish_at: item.publish_at ?? null,
          created_by_name: item.created_by_name ?? null,
          is_read: isRead,
          school_id: item.school_id,
          course_id: item.course_id,
        };
      });
    },

    // POST {{baseUrl}}/api/announcements/{{announcementId}}/read
    markRead: async (announcementId: number): Promise<{ success: boolean }> => {
      return requestApi<{ success: boolean }>(
        `/api/announcements/${announcementId}/read`,
        'POST',
        undefined,
        { success: true }
      );
    },
  },

  // ==========================================
  // 13. RESOURCES
  // ==========================================
  resources: {
    // GET {{baseUrl}}/api/resources
    list: async () => {
      return requestApi<any[]>('/api/resources', 'GET', undefined, [
        {
          id: 1,
          title: 'Cambridge IGCSE Curriculum Guide 2026/2027',
          category: 'Academic Guide',
          fileType: 'pdf',
          size: '3.4 MB',
          url: 'https://learn.kreativaglobal.sch.id/resources/igcse_guide.pdf',
        },
        {
          id: 2,
          title: 'Student Code of Conduct & Honor Pledge',
          category: 'School Policy',
          fileType: 'pdf',
          size: '1.2 MB',
          url: 'https://learn.kreativaglobal.sch.id/resources/code_of_conduct.pdf',
        },
      ]);
    },
  },

  // ==========================================
  // 14. NOTIFICATIONS
  // ==========================================
  notifications: {
    // GET {{baseUrl}}/api/notifications?limit=20&offset=0
    list: async (limit: number = 20, offset: number = 0) => {
      return requestApi<any[]>(
        `/api/notifications?limit=${limit}&offset=${offset}`,
        'GET',
        undefined,
        [
          {
            id: 1,
            title: 'Assignment Deadline Reminder',
            message: 'Civic Education Project due November 11, 2026.',
            read: false,
            createdAt: '2026-11-01',
          },
          {
            id: 2,
            title: 'Habit Log Awarded',
            message: 'Full habit day logged! +2 points awarded.',
            read: false,
            createdAt: '2026-10-14',
          },
        ]
      );
    },

    // GET {{baseUrl}}/api/notifications/unread-count
    unreadCount: async () => {
      return requestApi<{ unreadCount: number }>('/api/notifications/unread-count', 'GET', undefined, { unreadCount: 2 });
    },

    // POST {{baseUrl}}/api/notifications/read
    markRead: async (payload: { notificationId?: number; all?: boolean }) => {
      return requestApi('/api/notifications/read', 'POST', payload, {
        success: true,
        ...payload,
      });
    },
  },

  // ==========================================
  // 15. WEEKLY PLAN & SESSIONS (100% Real API)
  // ==========================================
  weeklyPlan: {
    // GET {{baseUrl}}/api/student/weekly-plan?weekStart={{weekStart}}
    getWeek: async (weekStartIso?: string): Promise<WeeklyPlanSession[]> => {
      const url = weekStartIso
        ? `/api/student/weekly-plan?weekStart=${encodeURIComponent(weekStartIso)}`
        : '/api/student/weekly-plan';
      const res = await requestApi<{ weekStart?: string; sessions?: any[] } | any[]>(
        url,
        'GET',
        undefined,
        []
      );

      const rawSessions: any[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.sessions)
        ? res.sessions
        : [];

      return rawSessions.map((s: any) => {
        const id = Number(s.id ?? s.sessionId ?? 0);
        const courseId = Number(s.course_id ?? s.courseId ?? 0);
        const courseName = String(s.course_name ?? s.courseName ?? s.subject_name ?? 'Course');
        const subjectName = String(s.subject_name ?? s.courseName ?? 'General');
        const sessionDate = String(s.session_date ?? s.date ?? '').slice(0, 10);

        let dayOfWeek = Number(s.dayOfWeek ?? 1);
        if (sessionDate) {
          const d = new Date(sessionDate);
          if (!isNaN(d.getTime())) {
            // Sunday = 7, Monday = 1, ..., Friday = 5
            dayOfWeek = d.getDay() === 0 ? 7 : d.getDay();
          }
        }

        const startTime = s.start_time ? String(s.start_time).slice(0, 5) : '';
        const endTime = s.end_time ? String(s.end_time).slice(0, 5) : '';
        const timeStr = startTime && endTime ? `${startTime} – ${endTime}` : (s.time || startTime || '08:00 – 09:30');

        const preDone = Boolean(s.pre_done ?? s.preDone);
        const postDone = Boolean(s.post_done ?? s.postDone);

        return {
          id,
          sessionId: id,
          course_id: courseId,
          courseId,
          course_name: courseName,
          courseName,
          subject_name: subjectName,
          courseCode: s.courseCode || subjectName.slice(0, 4).toUpperCase(),
          session_number: s.session_number ?? s.sessionNumber ?? 1,
          sessionNumber: s.session_number ?? s.sessionNumber ?? 1,
          title: String(s.title || ''),
          session_date: sessionDate,
          date: sessionDate,
          start_time: s.start_time ?? null,
          end_time: s.end_time ?? null,
          time: timeStr,
          dayOfWeek,
          location: s.location ?? s.room ?? null,
          room: s.location ?? s.room ?? 'Classroom',
          teacher: s.teacher ?? '',
          status: s.status ?? 'scheduled',
          pre_learning_enabled: Boolean(s.pre_learning_enabled),
          post_learning_enabled: Boolean(s.post_learning_enabled),
          pre_learning_minutes: s.pre_learning_minutes ?? null,
          post_learning_minutes: s.post_learning_minutes ?? null,
          pre_done: preDone,
          preDone,
          post_done: postDone,
          postDone,
          preQuestion: s.preQuestion || '',
          postNote: s.postNote || '',
          materials: s.materials || [],
        };
      });
    },

    // GET {{baseUrl}}/api/student/sessions/{{sessionId}}
    getSessionDetail: async (sessionId: number): Promise<any> => {
      const res = await requestApi<any>(`/api/student/sessions/${sessionId}`, 'GET');
      return res?.session || res;
    },

    // POST {{baseUrl}}/api/student/sessions/{{sessionId}}/progress
    updateSessionProgress: async (
      sessionId: number,
      payload: { preDone?: boolean; postDone?: boolean; preQuestion?: string; postNote?: string }
    ) => {
      return requestApi<any>(
        `/api/student/sessions/${sessionId}/progress`,
        'POST',
        payload
      );
    },
  },

  // ==========================================
  // 16. HABITS
  // ==========================================
  habits: {
    // GET {{baseUrl}}/api/student/habits/week?weekStart={{weekStart}}
    getWeek: async (weekStart: string = '2026-09-07'): Promise<HabitGroup[]> => {
      return requestApi<HabitGroup[]>(
        `/api/student/habits/week?weekStart=${encodeURIComponent(weekStart)}`,
        'GET',
        undefined,
        []
      );
    },

    // GET {{baseUrl}}/api/student/habits/month?yearMonth={{yearMonth}}
    getMonth: async (yearMonth?: string) => {
      const ym = yearMonth || new Date().toISOString().slice(0, 7);
      return requestApi<any>(
        `/api/student/habits/month?yearMonth=${encodeURIComponent(ym)}`,
        'GET'
      );
    },

    // POST {{baseUrl}}/api/student/habits/toggle
    toggleHabit: async (recordDate: string, categoryId: string | number, itemLabel: string, checked: boolean) => {
      const catMap: Record<string, string> = {
        'rise-early': 'wake',
        'eat-well': 'eat',
        'love-learning': 'learn',
        'sleep-early': 'sleep',
      };
      const normalizedCat = catMap[String(categoryId)] || String(categoryId);

      return requestApi<any>(
        '/api/student/habits/toggle',
        'POST',
        {
          recordDate,
          categoryId: normalizedCat,
          itemLabel,
          checked,
        }
      );
    },

    // Alias for toggleHabit
    toggle: async (recordDate: string, categoryId: string | number, itemLabel: string, checked: boolean) => {
      return api.habits.toggleHabit(recordDate, categoryId, itemLabel, checked);
    },
  },

  // ==========================================
  // 17. LITERACY
  // ==========================================
  literacy: {
    // GET {{baseUrl}}/api/student/literacy?termId={{termId}}
    list: async (termId?: number): Promise<LiteracyEntry[]> => {
      try {
        const url = termId ? `/api/student/literacy?termId=${termId}` : '/api/student/literacy';
        const live = await requestApi<any>(url, 'GET');
        let rawLogs: any[] = [];
        if (live && Array.isArray(live.logs)) {
          rawLogs = live.logs;
        } else if (Array.isArray(live)) {
          rawLogs = live;
        }

        if (live?.logs !== undefined || Array.isArray(live)) {
          const mapped = rawLogs.map(mapLogToEntry);
          inMemoryLiteracyEntries = mapped;
          return mapped;
        }
      } catch (err) {
        console.warn('[Literacy List API Error]', err);
      }
      return [...inMemoryLiteracyEntries];
    },

    // GET {{baseUrl}}/api/student/literacy/stats?termId={{termId}}
    getStats: async (termId?: number): Promise<LiteracyProgressStats> => {
      try {
        const url = termId ? `/api/student/literacy/stats?termId=${termId}` : '/api/student/literacy/stats';
        const liveStats = await requestApi<any>(url, 'GET');
        if (liveStats && (typeof liveStats.totalEntries === 'number' || typeof liveStats.textsRead === 'number')) {
          const textsRead = liveStats.totalEntries ?? liveStats.textsRead ?? 0;
          const defaultTargets = getCurriculumTargets(liveStats.track || 'sma');
          const targets = liveStats.targets || {};
          return {
            textsRead,
            textsTarget: targets.texts ?? defaultTargets.texts,
            genreVariety: liveStats.genreVariety ?? 0,
            genreTarget: targets.genres ?? defaultTargets.genres,
            avgRating: liveStats.avgRating != null ? String(liveStats.avgRating) : '—',
            englishPercentage: liveStats.englishPct ?? liveStats.englishPercentage ?? 0,
            englishTargetPercentage: targets.englishPct ?? defaultTargets.englishPct,
            level: liveStats.track?.toUpperCase() || 'SMA',
            schoolLevel: liveStats.track?.toUpperCase() || 'SMA',
          };
        }
      } catch (err) {
        console.warn('[Literacy Stats API Error]', err);
      }

      const defaultTargets = getCurriculumTargets('sma');
      const textsRead = inMemoryLiteracyEntries.length;
      const uniqueGenres = new Set(inMemoryLiteracyEntries.map((e) => e.genre).filter(Boolean)).size;
      const englishCount = inMemoryLiteracyEntries.filter((e) => e.language === 'English').length;
      const englishPercentage = textsRead > 0 ? Math.round((englishCount / textsRead) * 100) : 0;

      let avgRating = '—';
      const ratedEntries = inMemoryLiteracyEntries.filter((e) => e.rating);
      if (ratedEntries.length > 0) {
        let totalStars = 0;
        let count = 0;
        ratedEntries.forEach((e) => {
          if (typeof e.rating === 'number') {
            totalStars += e.rating;
            count++;
          } else {
            const matches = String(e.rating).match(/[★⭐]/g);
            if (matches) {
              totalStars += matches.length;
              count++;
            }
          }
        });
        if (count > 0) {
          const avg = totalStars / count;
          avgRating = Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
        }
      }

      return {
        textsRead,
        textsTarget: defaultTargets.texts,
        genreVariety: uniqueGenres,
        genreTarget: defaultTargets.genres,
        avgRating,
        englishPercentage,
        englishTargetPercentage: defaultTargets.englishPct,
        level: 'SMA',
        schoolLevel: 'SMA',
      };
    },

    // POST {{baseUrl}}/api/student/literacy
    create: async (payload: Partial<LiteracyEntry>): Promise<{ entry: LiteracyEntry; pointsAwarded: number; message?: string }> => {
      const finishedDate = normalizeToDateOnly(payload.finishedDate || payload.dateFinished);
      const ratingNum = parseRatingNumber(payload.rating) ?? 5;
      const vocabRaw = payload.vocab || payload.vocabulary || [];
      const vocabArray = Array.isArray(vocabRaw)
        ? vocabRaw.map(String).map((s: string) => s.trim()).filter(Boolean)
        : String(vocabRaw).split(',').map((s: string) => s.trim()).filter(Boolean);

      const readingTypeId = getReadingTypeId(payload.readingType || payload.type);

      const backendBody = {
        title: String(payload.title || '').trim(),
        author: payload.author ? String(payload.author).trim() : null,
        reading_type: readingTypeId,
        genre: payload.genre || null,
        language: payload.language || 'English',
        pages_or_length: payload.pagesOrLength || null,
        finished_date: finishedDate,
        rating: ratingNum,
        claim_prompt: payload.claimPrompt || payload.reflectionClaim || null,
        claim: String(payload.claim || payload.reflectionText || '').trim(),
        evidence_prompt: payload.evidencePrompt || null,
        evidence: String(payload.evidence || '').trim(),
        sowhat_prompt: payload.sowhatPrompt || null,
        sowhat: String(payload.sowhat || '').trim(),
        connection: payload.connection ? String(payload.connection).trim() : null,
        vocab: vocabArray,
      };

      const liveRes = await requestApi<any>('/api/student/literacy', 'POST', backendBody);
      if (liveRes && liveRes.log) {
        const entryWithServerId = mapLogToEntry(liveRes.log);
        inMemoryLiteracyEntries = [entryWithServerId, ...inMemoryLiteracyEntries];
        return {
          entry: entryWithServerId,
          pointsAwarded: liveRes.pointsAwarded ?? 3,
          message: liveRes.message,
        };
      }
      throw new Error(liveRes?.error || 'Failed to save literacy entry');
    },

    // PUT {{baseUrl}}/api/student/literacy/{{literacyId}}
    update: async (literacyId: string | number, payload: Partial<LiteracyEntry>): Promise<LiteracyEntry> => {
      const finishedDate = normalizeToDateOnly(payload.finishedDate || payload.dateFinished);
      const ratingNum = parseRatingNumber(payload.rating);
      const vocabRaw = payload.vocab || payload.vocabulary || [];
      const vocabArray = Array.isArray(vocabRaw)
        ? vocabRaw.map(String).map((s: string) => s.trim()).filter(Boolean)
        : String(vocabRaw).split(',').map((s: string) => s.trim()).filter(Boolean);

      const backendBody: any = {};
      if (payload.title !== undefined) backendBody.title = String(payload.title).trim();
      if (payload.author !== undefined) backendBody.author = payload.author ? String(payload.author).trim() : null;
      if (payload.readingType || payload.type) {
        backendBody.reading_type = getReadingTypeId(payload.readingType || payload.type);
      }
      if (payload.genre !== undefined) backendBody.genre = payload.genre;
      if (payload.language !== undefined) backendBody.language = payload.language;
      if (payload.pagesOrLength !== undefined) backendBody.pages_or_length = payload.pagesOrLength;
      if (payload.finishedDate || payload.dateFinished) backendBody.finished_date = finishedDate;
      if (payload.rating !== undefined) backendBody.rating = ratingNum;
      if (payload.claim || payload.reflectionText) backendBody.claim = payload.claim || payload.reflectionText;
      if (payload.claimPrompt || payload.reflectionClaim) backendBody.claim_prompt = payload.claimPrompt || payload.reflectionClaim;
      if (payload.evidence !== undefined) backendBody.evidence = payload.evidence;
      if (payload.evidencePrompt !== undefined) backendBody.evidence_prompt = payload.evidencePrompt;
      if (payload.sowhat !== undefined) backendBody.sowhat = payload.sowhat;
      if (payload.sowhatPrompt !== undefined) backendBody.sowhat_prompt = payload.sowhatPrompt;
      if (payload.connection !== undefined) backendBody.connection = payload.connection;
      if (payload.vocab || payload.vocabulary) backendBody.vocab = vocabArray;

      const liveRes = await requestApi<any>(`/api/student/literacy/${literacyId}`, 'PUT', backendBody);
      if (liveRes && liveRes.log) {
        const updated = mapLogToEntry(liveRes.log);
        inMemoryLiteracyEntries = inMemoryLiteracyEntries.map((e) =>
          String(e.id) === String(literacyId) ? updated : e
        );
        return updated;
      }

      const index = inMemoryLiteracyEntries.findIndex((e) => String(e.id) === String(literacyId));
      if (index === -1) {
        throw new Error(`Literacy entry with id ${literacyId} not found`);
      }
      const existing = inMemoryLiteracyEntries[index];
      const updated: LiteracyEntry = {
        ...existing,
        ...payload,
        id: existing.id,
      };
      inMemoryLiteracyEntries[index] = updated;
      return updated;
    },

    // DELETE {{baseUrl}}/api/student/literacy/{{literacyId}}
    delete: async (literacyId: string | number): Promise<{ success: boolean; id: string | number }> => {
      try {
        await requestApi<any>(`/api/student/literacy/${literacyId}`, 'DELETE');
      } catch (err) {
        console.warn('[Literacy Delete API Error]', err);
      }
      inMemoryLiteracyEntries = inMemoryLiteracyEntries.filter((e) => String(e.id) !== String(literacyId));
      return { success: true, id: literacyId };
    },

    // Dynamic helpers
    clearAll: async (): Promise<LiteracyEntry[]> => {
      inMemoryLiteracyEntries = [];
      return [];
    },

    getEntries: async (): Promise<LiteracyEntry[]> => {
      return [...inMemoryLiteracyEntries];
    },
  },

  // ==========================================
  // 18. POINTS
  // ==========================================
  points: {
    // GET {{baseUrl}}/api/student/points/summary?academicYearId={{academicYearId}}&termId={{termId}}
    getSummary: async (academicYearId?: number, termId?: number): Promise<PointsSummaryData> => {
      const params: string[] = [];
      if (academicYearId) params.push(`academicYearId=${academicYearId}`);
      if (termId) params.push(`termId=${termId}`);
      const query = params.length > 0 ? `?${params.join('&')}` : '';

      return requestApi<PointsSummaryData>(
        `/api/student/points/summary${query}`,
        'GET',
        undefined,
        {
          total: STUDENT_PROFILE.points,
          discipline: STUDENT_PROFILE.disciplinePts,
          literacy: STUDENT_PROFILE.literacyPts,
          habits: STUDENT_PROFILE.habitsPts,
          houseName: null,
          className: null,
          schoolLevel: 'high_school_igcse',
        }
      );
    },

    // GET {{baseUrl}}/api/student/points/history
    getHistory: async (): Promise<PointsLedgerItem[]> => {
      return requestApi<PointsLedgerItem[]>(
        '/api/student/points/history',
        'GET',
        undefined,
        []
      );
    },
  },

  // ==========================================
  // 19. LEADERBOARD
  // ==========================================
  leaderboard: {
    // GET {{baseUrl}}/api/leaderboard/houses?houseId=&academicYearId=&termId=
    getHouses: async (
      houseId?: number,
      academicYearId?: number,
      termId?: number
    ): Promise<{
      rows: HouseLeaderboardRow[];
      myHouseId: number | null;
      myHouseName: string | null;
      contributors: HouseTopContributor[] | null;
      academicYearId?: number;
      termId?: number | null;
    }> => {
      const params: string[] = [];
      if (houseId) params.push(`houseId=${houseId}`);
      if (academicYearId) params.push(`academicYearId=${academicYearId}`);
      if (termId) params.push(`termId=${termId}`);
      const query = params.length > 0 ? `?${params.join('&')}` : '';

      return requestApi<{
        rows: HouseLeaderboardRow[];
        myHouseId: number | null;
        myHouseName: string | null;
        contributors: HouseTopContributor[] | null;
        academicYearId?: number;
        termId?: number | null;
      }>(
        `/api/leaderboard/houses${query}`,
        'GET',
        undefined,
        {
          rows: [],
          myHouseId: null,
          myHouseName: null,
          contributors: null,
        }
      );
    },

    // GET {{baseUrl}}/api/leaderboard/class?classId={{classId}}&academicYearId={{academicYearId}}&termId={{termId}}
    getClass: async (classId?: number, academicYearId?: number, termId?: number): Promise<{
      rows: StudentRankRow[];
      houseSummary: { house: string; member_count: number; total_points: number }[];
      className: string | null;
      myStudentId: number | null;
      classId?: number;
      termId?: number | null;
    }> => {
      const params: string[] = [];
      if (classId) params.push(`classId=${classId}`);
      if (academicYearId) params.push(`academicYearId=${academicYearId}`);
      if (termId) params.push(`termId=${termId}`);
      const query = params.length > 0 ? `?${params.join('&')}` : '';

      return requestApi<any>(
        `/api/leaderboard/class${query}`,
        'GET',
        undefined,
        { rows: [], houseSummary: [], myStudentId: null, className: null }
      );
    },

    // GET {{baseUrl}}/api/leaderboard/jenjang?schoolLevel=&academicYearId=&termId=
    getJenjang: async (
      schoolLevel?: string,
      academicYearId?: number,
      termId?: number
    ): Promise<{
      rows: StudentRankRow[];
      schoolLevel: string;
      myStudentId: number | null;
      academicYearId?: number;
      termId?: number | null;
    }> => {
      const params: string[] = [];
      if (schoolLevel) params.push(`schoolLevel=${encodeURIComponent(schoolLevel)}`);
      if (academicYearId) params.push(`academicYearId=${academicYearId}`);
      if (termId) params.push(`termId=${termId}`);
      const query = params.length > 0 ? `?${params.join('&')}` : '';

      return requestApi<any>(
        `/api/leaderboard/jenjang${query}`,
        'GET',
        undefined,
        { rows: [], schoolLevel: 'high_school_igcse', myStudentId: null }
      );
    },
  },

  // ==========================================
  // 20. UPLOAD
  // ==========================================
  upload: {
    // POST {{baseUrl}}/api/upload
    uploadFile: async (formData: FormData): Promise<{ url: string; fileName?: string; size?: number; mimeType?: string }> => {
      try {
        const token = getAuthToken();
        const headers: Record<string, string> = {
          Accept: 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`${API_BASE_URL}/api/upload`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: formData,
        });

        if (res.ok) {
          const json = await res.json();
          return json;
        }

        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || 'Upload failed');
      } catch (err: any) {
        console.warn('[API Upload Fallback] Upload error:', err?.message || err);
        return {
          url: 'https://learn.kreativaglobal.sch.id/uploads/submission_solution.pdf',
          fileName: 'submission_solution.pdf',
          size: 1843200,
          mimeType: 'application/pdf',
        };
      }
    },
  },

  // ==========================================
  // 21. CLUBS
  // ==========================================
  clubs: {
    // GET {{baseUrl}}/api/clubs
    list: async (): Promise<{ clubs: ClubItem[]; recentReports: ClubReportItem[] }> => {
      const res = await requestApi<any>('/api/clubs', 'GET', undefined, { clubs: [], recentReports: [] });
      if (Array.isArray(res)) {
        return { clubs: res, recentReports: [] };
      }
      return {
        clubs: Array.isArray(res?.clubs) ? res.clubs : [],
        recentReports: Array.isArray(res?.recentReports) ? res.recentReports : [],
      };
    },

    // GET {{baseUrl}}/api/clubs/:id
    getDetail: async (id: number | string): Promise<ClubDetailData> => {
      const res = await requestApi<any>(`/api/clubs/${id}`, 'GET', undefined, {
        club: { id: Number(id), name: '' },
        sessions: [],
        materials: [],
        scores: [],
        reports: [],
      });
      return {
        club: res?.club || { id: Number(id), name: '' },
        sessions: Array.isArray(res?.sessions) ? res.sessions : [],
        materials: Array.isArray(res?.materials) ? res.materials : [],
        scores: Array.isArray(res?.scores) ? res.scores : [],
        reports: Array.isArray(res?.reports) ? res.reports : [],
      };
    },
  },

  // ==========================================
  // 22. CALENDAR
  // ==========================================
  calendar: {
    // GET {{baseUrl}}/api/calendar
    getEvents: async (): Promise<CalendarEventItem[]> => {
      const raw = await requestApi<any[]>('/api/calendar', 'GET', undefined, []);
      if (!Array.isArray(raw)) return [];
      return raw.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        start_datetime: item.start_datetime,
        end_datetime: item.end_datetime,
        location: item.location,
        event_type: item.event_type,
        audience_type: item.audience_type,
      }));
    },
  },
};

export default api;
