import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CourseSessionDetail, SessionMaterialItem } from '../../types';
import { FONTS, SHADOWS } from '../../constants/theme';
import { API_BASE_URL } from '../../services/api';

interface SessionDetailViewProps {
  session: CourseSessionDetail;
  onBack: () => void;
}

export const SessionDetailView: React.FC<SessionDetailViewProps> = ({ session, onBack }) => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 16) + 115;

  const handleOpenUrl = (rawUrl?: string | null, label?: string) => {
    if (!rawUrl || !rawUrl.trim()) {
      Alert.alert('File Unavailable', 'No direct download link or resource attached to this item.');
      return;
    }
    const cleanUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
      ? rawUrl.trim()
      : `${API_BASE_URL}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl.trim()}`;

    Linking.openURL(cleanUrl).catch((err) => {
      console.warn('[SessionDetailView] Cannot open URL:', cleanUrl, err);
      Alert.alert(
        'Cannot Open Document',
        'Please check your internet connection or verify a browser is installed on your device.'
      );
    });
  };

  const materialsList: SessionMaterialItem[] =
    session.sessionMaterials && session.sessionMaterials.length > 0
      ? session.sessionMaterials
      : (session.materials || []).map((m, idx) => ({
          id: idx,
          title: typeof m === 'string' ? m : (m as any).title || 'Material',
          file_path: null,
          filePath: null,
          file_url: null,
          fileUrl: null,
          fileName: null,
          file_name: null,
          externalUrl: null,
          external_url: null,
          materialType: 'document',
          material_type: 'document',
          file_size: null,
        }));

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Back Button matching Screenshot 3: "← Back to Course" */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
          accessibilityLabel="Back to Course"
        >
          <Ionicons name="arrow-back" size={16} color="#475569" />
          <Text style={styles.backButtonText}>Back to Course</Text>
        </TouchableOpacity>

        {/* 2. Main Title and Status Badge matching Screenshot 3 */}
        <View style={styles.headerBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle} numberOfLines={2}>
              {session.title}
            </Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{session.status}</Text>
            </View>
          </View>

          {/* Subtitle matching Screenshot 3 */}
          <Text style={styles.subtitle}>
            {session.courseName} — {session.classCode} {session.academicYear} • Session {session.sessionNumber}
          </Text>
        </View>

        {/* 3. Card 1: BEFORE CLASS */}
        {Boolean(session.beforeClass?.prompt || session.hasPreLearning || session.pre_learning_enabled) && (
          <View style={styles.beforeClassCard}>
            <Text style={styles.cardHeaderTagAmber}>BEFORE CLASS</Text>
            <Text style={styles.activityHeading}>
              {session.beforeClass?.activityType || session.pre_learning_type || 'Pre-Class Activity'}{' '}
              <Text style={styles.activityDuration}>
                · {session.beforeClass?.duration || (session.pre_learning_minutes ? `${session.pre_learning_minutes} mins` : '15 mins')}
              </Text>
            </Text>
            <Text style={styles.cardBodyText}>
              {session.beforeClass?.prompt || session.pre_learning_instructions || 'Please review assigned reading or video prior to class.'}
            </Text>
            {Boolean(session.beforeClass?.resourceUrl || session.pre_learning_url || session.pre_learning_file_path) && (
              <TouchableOpacity
                style={styles.resourceLink}
                onPress={() =>
                  handleOpenUrl(
                    session.beforeClass?.resourceUrl || session.pre_learning_url || session.pre_learning_file_path,
                    session.pre_learning_file_name || 'Pre-Learning Resource'
                  )
                }
                activeOpacity={0.7}
              >
                <Ionicons name="download-outline" size={14} color="#B45309" style={{ marginRight: 4 }} />
                <Text style={styles.resourceLinkText}>
                  {session.pre_learning_file_name ? `Download ${session.pre_learning_file_name} ↓` : 'Open resource →'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 4. Card 2: Learning Objectives */}
        <View style={styles.neutralCard}>
          <Text style={styles.neutralCardTitle}>Learning Objectives</Text>
          <Text style={styles.cardBodyText}>
            {session.learningObjectives || 'No learning objectives specified.'}
          </Text>
        </View>

        {/* 5. Card 3: Content */}
        <View style={styles.neutralCard}>
          <Text style={styles.neutralCardTitle}>Content</Text>
          <Text style={styles.cardBodyText}>
            {session.inClassContent || session.description || 'No in-class content provided.'}
          </Text>
        </View>

        {/* 6. Card 4: Materials (Interactive Web-Style Download/Open) */}
        <View style={styles.neutralCard}>
          <View style={styles.neutralCardHeaderRow}>
            <Text style={styles.neutralCardTitle}>Materials</Text>
            {materialsList.length > 0 && (
              <View style={styles.materialsCountBadge}>
                <Text style={styles.materialsCountText}>{materialsList.length} files</Text>
              </View>
            )}
          </View>

          {materialsList.length === 0 ? (
            <Text style={styles.emptyMaterialsText}>No materials uploaded yet.</Text>
          ) : (
            <View style={styles.materialsListContainer}>
              {materialsList.map((item, idx) => {
                const title = item.title || item.fileName || item.file_name || 'Material Document';
                const rawUrl = item.file_url || item.fileUrl || item.filePath || item.file_path || item.externalUrl || item.external_url;
                const isLink = item.material_type === 'link' || Boolean(item.external_url || item.externalUrl);
                const fileSize = item.file_size;

                return (
                  <TouchableOpacity
                    key={idx}
                    style={styles.materialCardRow}
                    onPress={() => handleOpenUrl(rawUrl, title)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.materialIconCircle}>
                      <Ionicons
                        name={isLink ? 'link-outline' : 'document-text-outline'}
                        size={18}
                        color="#2563EB"
                      />
                    </View>

                    <View style={styles.materialInfoWrap}>
                      <Text style={styles.materialFileName} numberOfLines={2}>
                        {title}
                      </Text>
                      {fileSize ? (
                        <Text style={styles.materialMetaText}>{fileSize}</Text>
                      ) : (
                        <Text style={styles.materialMetaText}>
                          {isLink ? 'External Link' : 'PDF Document'}
                        </Text>
                      )}
                    </View>

                    <View style={styles.downloadPill}>
                      <Ionicons
                        name={isLink ? 'open-outline' : 'download-outline'}
                        size={13}
                        color="#2563EB"
                        style={{ marginRight: 3 }}
                      />
                      <Text style={styles.downloadPillText}>
                        {isLink ? 'Open' : 'Download'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* 7. Card 5: AFTER CLASS */}
        {Boolean(session.afterClass?.prompt || session.hasPostLearning || session.post_learning_enabled) && (
          <View style={styles.afterClassCard}>
            <Text style={styles.cardHeaderTagGreen}>AFTER CLASS</Text>
            <Text style={styles.activityHeading}>
              {session.afterClass?.activityType || session.post_learning_type || 'Post-Class Activity'}{' '}
              <Text style={styles.activityDuration}>
                · {session.afterClass?.duration || (session.post_learning_minutes ? `${session.post_learning_minutes} mins` : '10 mins')}
              </Text>
            </Text>
            <Text style={styles.cardBodyText}>
              {session.afterClass?.prompt || session.post_learning_instructions || 'Complete post-class reflection or follow-up exercises.'}
            </Text>
            {Boolean(session.afterClass?.resourceUrl || session.post_learning_url || session.post_learning_file_path) && (
              <TouchableOpacity
                style={styles.afterClassResourceLink}
                onPress={() =>
                  handleOpenUrl(
                    session.afterClass?.resourceUrl || session.post_learning_url || session.post_learning_file_path,
                    session.post_learning_file_name || 'Post-Learning Resource'
                  )
                }
                activeOpacity={0.7}
              >
                <Ionicons name="download-outline" size={14} color="#166534" style={{ marginRight: 4 }} />
                <Text style={styles.afterClassResourceLinkText}>
                  {session.post_learning_file_name ? `Download ${session.post_learning_file_name} ↓` : 'Open resource →'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 8. Card 6: Session Info */}
        <View style={styles.neutralCard}>
          <Text style={styles.neutralCardTitle}>Session Info</Text>

          {/* Date */}
          <View style={styles.infoField}>
            <Text style={styles.infoFieldLabel}>Date</Text>
            <Text style={styles.infoFieldValue}>{session.sessionInfo?.fullDate || session.date || 'TBD'}</Text>
          </View>

          {/* Time */}
          <View style={styles.infoField}>
            <Text style={styles.infoFieldLabel}>Time</Text>
            <Text style={styles.infoFieldValue}>
              {session.sessionInfo?.timeSlot ||
                (session.start_time && session.end_time
                  ? `${String(session.start_time).slice(0, 5)} - ${String(session.end_time).slice(0, 5)}`
                  : '—')}
            </Text>
          </View>

          {/* Location */}
          <View style={styles.infoField}>
            <Text style={styles.infoFieldLabel}>Location</Text>
            <Text style={styles.infoFieldValue}>
              {session.sessionInfo?.location || session.location || '—'}
            </Text>
          </View>

          {/* Independent Study Pills */}
          <View style={styles.infoField}>
            <Text style={styles.infoFieldLabel}>Independent study</Text>
            <View style={styles.pillsRow}>
              {(session.sessionInfo?.independentStudy || []).map((pill, idx) => {
                const isPre = pill.toLowerCase().includes('pre');
                return (
                  <View
                    key={idx}
                    style={[
                      styles.studyPill,
                      isPre ? styles.studyPillPre : styles.studyPillPost,
                    ]}
                  >
                    <Text
                      style={[
                        styles.studyPillText,
                        isPre ? styles.studyPillTextPre : styles.studyPillTextPost,
                      ]}
                    >
                      {pill}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
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
    gap: 14,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: '#475569',
  },
  headerBlock: {
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 6,
  },
  pageTitle: {
    fontFamily: FONTS.title,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0,
  },
  statusBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  statusBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13.5,
    color: '#64748B',
    lineHeight: 18,
  },
  /* Card 1: BEFORE CLASS */
  beforeClassCard: {
    backgroundColor: '#FEF9C3', // Warm yellow pastel
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 16,
  },
  cardHeaderTagAmber: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  activityHeading: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  activityDuration: {
    fontFamily: FONTS.regular,
    fontSize: 13.5,
    fontWeight: '400',
    color: '#64748B',
  },
  cardBodyText: {
    fontFamily: FONTS.regular,
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 8,
  },
  resourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
  },
  resourceLinkText: {
    fontFamily: FONTS.bold,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#B45309',
  },
  /* Neutral White Cards (Objectives, Content, Materials, Session Info) */
  neutralCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    ...SHADOWS.sm,
  },
  neutralCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  neutralCardTitle: {
    fontFamily: FONTS.titleSemiBold,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  materialsCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  materialsCountText: {
    fontFamily: FONTS.medium,
    fontSize: 11.5,
    color: '#64748B',
  },
  emptyMaterialsText: {
    fontFamily: FONTS.regular,
    fontSize: 13.5,
    color: '#64748B',
    lineHeight: 20,
  },
  materialsListContainer: {
    gap: 8,
  },
  materialCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  materialIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  materialInfoWrap: {
    flex: 1,
    marginRight: 8,
  },
  materialFileName: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#0F172A',
    lineHeight: 18,
  },
  materialMetaText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  downloadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  downloadPillText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#2563EB',
  },
  /* Card 5: AFTER CLASS */
  afterClassCard: {
    backgroundColor: '#F0FDF4', // Light green pastel
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 16,
  },
  afterClassResourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
  },
  afterClassResourceLinkText: {
    fontFamily: FONTS.bold,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#166534',
  },
  cardHeaderTagGreen: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  /* Session Info Key-Value Styles */
  infoField: {
    marginTop: 10,
  },
  infoFieldLabel: {
    fontFamily: FONTS.regular,
    fontSize: 12.5,
    color: '#64748B',
    marginBottom: 3,
  },
  infoFieldValue: {
    fontFamily: FONTS.medium,
    fontSize: 14.5,
    fontWeight: '500',
    color: '#0F172A',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  studyPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  studyPillPre: {
    backgroundColor: '#FEF3C7',
  },
  studyPillPost: {
    backgroundColor: '#DCFCE7',
  },
  studyPillText: {
    fontFamily: FONTS.bold,
    fontSize: 11.5,
    fontWeight: '700',
  },
  studyPillTextPre: {
    color: '#B45309',
  },
  studyPillTextPost: {
    color: '#15803D',
  },
});

export default SessionDetailView;
