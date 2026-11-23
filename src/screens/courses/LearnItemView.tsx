import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SHADOWS } from '../../constants/theme';
import { SelfPacedItem, CourseContentResponse } from '../../types';
import { api } from '../../services/api';

interface LearnItemViewProps {
  courseId: number;
  courseTitle: string;
  initialItem: SelfPacedItem;
  contentData: CourseContentResponse | null;
  onBack: () => void;
  onItemUpdated?: (updatedContent: CourseContentResponse) => void;
}

// Simple and clean HTML tag stripper & paragraph formatter
function renderFormattedHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n$1\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/<[^>]+>/g, '')
    .trim();
}

export const LearnItemView: React.FC<LearnItemViewProps> = ({
  courseId,
  courseTitle,
  initialItem,
  contentData,
  onBack,
  onItemUpdated,
}) => {
  const insets = useSafeAreaInsets();
  const [currentItem, setCurrentItem] = useState<SelfPacedItem>(initialItem);
  const [marking, setMarking] = useState(false);
  const [confidenceSaving, setConfidenceSaving] = useState(false);
  const [confidence, setConfidence] = useState<'understood' | 'partial' | 'not_understood' | null>(
    initialItem.confidence_level || null
  );
  const [completionPct, setCompletionPct] = useState<number>(
    contentData?.completion_percentage || 0
  );

  // Flatten all items across sections for sequential prev/next navigation
  const allItems = React.useMemo(() => {
    if (!contentData?.sections) return [initialItem];
    return contentData.sections.flatMap((s) => s.items);
  }, [contentData, initialItem]);

  const currentIndex = allItems.findIndex((i) => i.id === currentItem.id);
  const prevItem = currentIndex > 0 ? allItems[currentIndex - 1] : null;
  const nextItem = currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null;

  useEffect(() => {
    setCurrentItem(initialItem);
    setConfidence(initialItem.confidence_level || null);
  }, [initialItem]);

  const handleMarkComplete = async () => {
    if (marking || currentItem.is_completed) return;
    setMarking(true);
    try {
      const res = await api.courses.completeItem(currentItem.id);
      if (res && res.completion_pct !== undefined) {
        setCompletionPct(res.completion_pct);
      }
      setCurrentItem((prev) => ({ ...prev, is_completed: true }));
      // Notify parent to refresh content
      const freshContent = await api.courses.getContent(courseId);
      if (freshContent && onItemUpdated) {
        onItemUpdated(freshContent);
      }
    } catch (e) {
      console.warn('[LearnItem] Failed to mark complete:', e);
    } finally {
      setMarking(false);
    }
  };

  const handleConfidence = async (level: 'understood' | 'partial' | 'not_understood') => {
    if (confidenceSaving) return;
    setConfidenceSaving(true);
    setConfidence(level);
    try {
      await api.courses.saveConfidence(currentItem.id, level);
      setCurrentItem((prev) => ({ ...prev, confidence_level: level }));
    } catch (e) {
      console.warn('[LearnItem] Failed to save confidence:', e);
    } finally {
      setConfidenceSaving(false);
    }
  };

  const navigateToItem = (item: SelfPacedItem) => {
    setCurrentItem(item);
    setConfidence(item.confidence_level || null);
  };

  const handleNext = async () => {
    if (!currentItem.is_completed) {
      await handleMarkComplete();
    }
    if (nextItem && !nextItem.is_locked) {
      navigateToItem(nextItem);
    }
  };

  const isCompleted = Boolean(currentItem.is_completed);

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerCourseTitle} numberOfLines={1}>
            {courseTitle}
          </Text>
          <Text style={styles.headerItemTitle} numberOfLines={1}>
            {currentItem.title}
          </Text>
        </View>

        {/* Progress Pill */}
        <View style={styles.progressPill}>
          <Text style={styles.progressPillText}>{completionPct}%</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Item Locked Guard */}
        {currentItem.is_locked ? (
          <View style={styles.lockedCard}>
            <Ionicons name="lock-closed" size={44} color="#94A3B8" />
            <Text style={styles.lockedTitle}>Lesson Locked</Text>
            <Text style={styles.lockedSubtitle}>
              Please complete the previous lessons before opening this lesson.
            </Text>
            <TouchableOpacity style={styles.outlineBtn} onPress={onBack}>
              <Text style={styles.outlineBtnText}>Return to Course</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.contentCard}>
            {/* 1. Video Lesson */}
            {currentItem.item_type === 'video' && (
              <View style={styles.mediaContainer}>
                <View style={styles.videoPlaceholder}>
                  <Ionicons name="play-circle" size={56} color="#FFFFFF" />
                  <Text style={styles.videoTitle}>{currentItem.title}</Text>
                  {currentItem.video_url && (
                    <TouchableOpacity
                      style={styles.openVideoBtn}
                      onPress={() => Linking.openURL(currentItem.video_url!)}
                    >
                      <Ionicons name="open-outline" size={16} color="#2563EB" />
                      <Text style={styles.openVideoBtnText}>Open Video in Browser</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* 2. Reading Material */}
            {currentItem.item_type === 'material' && (
              <View style={styles.materialContainer}>
                <View style={styles.materialHeader}>
                  <View style={styles.materialIconCircle}>
                    <Ionicons name="document-text" size={20} color="#2563EB" />
                  </View>
                  <Text style={styles.materialTitle}>{currentItem.title}</Text>
                </View>

                {currentItem.content_html ? (
                  <Text style={styles.htmlText}>
                    {renderFormattedHtml(currentItem.content_html)}
                  </Text>
                ) : (
                  <Text style={styles.emptyText}>No text content available.</Text>
                )}

                {/* Attachments */}
                {currentItem.attachment_url && (
                  <TouchableOpacity
                    style={styles.attachmentButton}
                    onPress={() => Linking.openURL(currentItem.attachment_url!)}
                  >
                    <Ionicons name="download-outline" size={18} color="#2563EB" />
                    <Text style={styles.attachmentText} numberOfLines={1}>
                      Download: {currentItem.attachment_name || 'Attached Material'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* 3. Quiz Lesson */}
            {currentItem.item_type === 'quiz' && (
              <View style={styles.specialCard}>
                <View style={[styles.specialIconCircle, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="help-circle" size={32} color="#7C3AED" />
                </View>
                <Text style={styles.specialTitle}>{currentItem.title}</Text>
                <Text style={styles.specialSubtitle}>
                  Test your understanding of this module to complete this section.
                </Text>
                {isCompleted && (
                  <View style={styles.completedBadgeRow}>
                    <Ionicons name="checkmark-circle" size={18} color="#15803D" />
                    <Text style={styles.completedBadgeText}>Quiz Completed</Text>
                  </View>
                )}
              </View>
            )}

            {/* 4. Assignment Lesson */}
            {currentItem.item_type === 'assignment' && (
              <View style={styles.specialCard}>
                <View style={[styles.specialIconCircle, { backgroundColor: '#FFEDD5' }]}>
                  <Ionicons name="clipboard" size={32} color="#EA580C" />
                </View>
                <Text style={styles.specialTitle}>{currentItem.title}</Text>
                <Text style={styles.specialSubtitle}>
                  Submit your assignment work to complete this requirement.
                </Text>
                {isCompleted && (
                  <View style={styles.completedBadgeRow}>
                    <Ionicons name="checkmark-circle" size={18} color="#15803D" />
                    <Text style={styles.completedBadgeText}>Assignment Submitted</Text>
                  </View>
                )}
              </View>
            )}

            {/* Completion Button */}
            <View style={styles.completeSection}>
              {isCompleted ? (
                <View style={styles.completedBanner}>
                  <Ionicons name="checkmark-circle" size={20} color="#15803D" />
                  <Text style={styles.completedBannerText}>Lesson Completed</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.completeBtn}
                  onPress={handleMarkComplete}
                  disabled={marking}
                  activeOpacity={0.85}
                >
                  {marking ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                      <Text style={styles.completeBtnText}>Mark as Completed</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Confidence Feedback Section */}
            <View style={styles.confidenceSection}>
              <Text style={styles.confidenceLabel}>
                How well do you understand this topic?
              </Text>
              <View style={styles.confidenceButtonsRow}>
                <TouchableOpacity
                  style={[
                    styles.confidencePill,
                    styles.confidenceGreen,
                    confidence === 'understood' && styles.confidenceGreenActive,
                  ]}
                  onPress={() => handleConfidence('understood')}
                  disabled={confidenceSaving}
                >
                  <Text
                    style={[
                      styles.confidencePillText,
                      confidence === 'understood' && styles.confidencePillTextActive,
                    ]}
                  >
                    Understood
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confidencePill,
                    styles.confidenceAmber,
                    confidence === 'partial' && styles.confidenceAmberActive,
                  ]}
                  onPress={() => handleConfidence('partial')}
                  disabled={confidenceSaving}
                >
                  <Text
                    style={[
                      styles.confidencePillText,
                      confidence === 'partial' && styles.confidencePillTextActive,
                    ]}
                  >
                    Somewhat
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confidencePill,
                    styles.confidenceRed,
                    confidence === 'not_understood' && styles.confidenceRedActive,
                  ]}
                  onPress={() => handleConfidence('not_understood')}
                  disabled={confidenceSaving}
                >
                  <Text
                    style={[
                      styles.confidencePillText,
                      confidence === 'not_understood' && styles.confidencePillTextActive,
                    ]}
                  >
                    Need Review
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Step Navigation Bar */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.navBtn, !prevItem && styles.navBtnDisabled]}
          disabled={!prevItem}
          onPress={() => prevItem && navigateToItem(prevItem)}
        >
          <Ionicons name="chevron-back" size={18} color={prevItem ? '#0F172A' : '#CBD5E1'} />
          <Text style={[styles.navBtnText, !prevItem && styles.navBtnTextDisabled]}>
            Previous
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navBtn,
            styles.navBtnNext,
            (!nextItem || nextItem.is_locked) && !isCompleted && styles.navBtnDisabled,
          ]}
          onPress={handleNext}
        >
          <Text style={[styles.navBtnText, styles.navBtnTextNext]}>
            Next Lesson
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: '#0F172A',
  },
  headerTitleBox: {
    flex: 1,
  },
  headerCourseTitle: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#64748B',
  },
  headerItemTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#0F172A',
  },
  progressPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  progressPillText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#2563EB',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  lockedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  lockedTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: '#0F172A',
  },
  lockedSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  outlineBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  outlineBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: '#334155',
  },
  mediaContainer: {
    width: '100%',
  },
  videoPlaceholder: {
    width: '100%',
    height: 210,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  videoTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  openVideoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  openVideoBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#2563EB',
  },
  materialContainer: {
    padding: 20,
  },
  materialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  materialIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  materialTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: '#0F172A',
    flex: 1,
  },
  htmlText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#334155',
    lineHeight: 24,
  },
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 20,
  },
  attachmentText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#2563EB',
    flex: 1,
  },
  specialCard: {
    padding: 32,
    alignItems: 'center',
    gap: 10,
  },
  specialIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  specialTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: '#0F172A',
    textAlign: 'center',
  },
  specialSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 280,
  },
  completedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  completedBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#15803D',
  },
  completeSection: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 16,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
  },
  completeBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    paddingVertical: 10,
    borderRadius: 10,
  },
  completedBannerText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#15803D',
  },
  confidenceSection: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 16,
    backgroundColor: '#F8FAFC',
  },
  confidenceLabel: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 10,
  },
  confidenceButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  confidencePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  confidencePillText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  confidencePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  confidenceGreen: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  confidenceGreenActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  confidenceAmber: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  confidenceAmberActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  confidenceRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  confidenceRedActive: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  navBtnNext: {
    backgroundColor: '#2563EB',
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: '#0F172A',
  },
  navBtnTextNext: {
    color: '#FFFFFF',
    fontFamily: FONTS.semiBold,
  },
  navBtnTextDisabled: {
    color: '#94A3B8',
  },
});

export default LearnItemView;
