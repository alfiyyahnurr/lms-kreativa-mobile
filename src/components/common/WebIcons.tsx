import React from 'react';
import {
  Home,
  CalendarDays,
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  ScrollText,
  BookMarked,
  CheckCircle,
  Trophy,
  Megaphone,
  User,
  LogOut,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react-native';

export interface WebIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// 1. Dashboard: Home
export const HomeIcon: React.FC<WebIconProps> = (props) => <Home {...props} />;

// 2. Weekly Plan: Calendar with grid
export const CalendarIcon: React.FC<WebIconProps> = (props) => <CalendarDays {...props} />;

// 3. My Courses: BookOpen
export const BookOpenIcon: React.FC<WebIconProps> = (props) => <BookOpen {...props} />;

// 4. Assignments: ClipboardList
export const ClipboardListIcon: React.FC<WebIconProps> = (props) => <ClipboardList {...props} />;

// 5. Quizzes: FileText
export const FileTextIcon: React.FC<WebIconProps> = (props) => <FileText {...props} />;

// 6. Exams: GraduationCap
export const GraduationCapIcon: React.FC<WebIconProps> = (props) => <GraduationCap {...props} />;

// 7. Report Card: ScrollText
export const ScrollTextIcon: React.FC<WebIconProps> = (props) => <ScrollText {...props} />;

// 8. Literacy: BookMarked
export const BookMarkedIcon: React.FC<WebIconProps> = (props) => <BookMarked {...props} />;

// 9. Habits: CheckCircle
export const CheckCircleIcon: React.FC<WebIconProps> = (props) => <CheckCircle {...props} />;

// 10. Leaderboard: Trophy
export const TrophyIcon: React.FC<WebIconProps> = (props) => <Trophy {...props} />;

// 11. Announcements: Megaphone
export const MegaphoneIcon: React.FC<WebIconProps> = (props) => <Megaphone {...props} />;

// 12. Profile: User
export const UserIcon: React.FC<WebIconProps> = (props) => <User {...props} />;

// 13. Logout: LogOut
export const LogOutIcon: React.FC<WebIconProps> = (props) => <LogOut {...props} />;

// Chevrons
export const ChevronLeftIcon: React.FC<WebIconProps> = (props) => <ChevronLeft {...props} />;
export const ChevronUpIcon: React.FC<WebIconProps> = (props) => <ChevronUp {...props} />;
export const ChevronDownIcon: React.FC<WebIconProps> = (props) => <ChevronDown {...props} />;

// Close (✕) Icon
export const CloseIcon: React.FC<WebIconProps> = (props) => <X {...props} />;
