import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import {
  ArrowLeft,
  FileText,
  AlertCircle,
  Upload,
  X,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { FONTS } from '../../constants/theme';
import { Assignment, AssignmentDetailResponse } from '../../types';
import { api } from '../../services/api';
import ToastAlert from '../../components/feedback/ToastAlert';

interface UploadedFileItem {
  url: string;
  name: string;
  size: number;
}

interface AssignmentDetailViewProps {
  assignment: Assignment;
  onBack: () => void;
  onSubmitSuccess?: (assignmentId: number, note?: string) => void;
  backLabel?: string;
}

export const AssignmentDetailView: React.FC<AssignmentDetailViewProps> = ({
  assignment: initialAssignment,
  onBack,
  onSubmitSuccess,
  backLabel = 'Back to Assignments',
}) => {
  const [detailData, setDetailData] = useState<AssignmentDetailResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(true);
  const [submissionText, setSubmissionText] = useState<string>('');
  const [files, setFiles] = useState<UploadedFileItem[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const scrollRef = useRef<any>(null);

  // Fetch full live assignment & submission detail from backend
  const fetchDetail = useCallback(async () => {
    // If dummy testing assignment, use mock detail without network request
    if (initialAssignment.id === 999999) {
      setIsLoadingDetail(false);
      setDetailData({
        assignment: initialAssignment,
        submission: null,
        files: [],
      });
      return;
    }

    try {
      setIsLoadingDetail(true);
      const res = await api.assignments.getAssignment(initialAssignment.id);
      setDetailData(res);
      if (res?.submission) {
        setSubmissionText(res.submission.submission_text || '');
        if (res.submission.submission_url) {
          const loadedFiles: UploadedFileItem[] = res.submission.submission_url
            .split(',')
            .map((urlStr: string, idx: number) => {
              const clean = urlStr.trim();
              const name = decodeURIComponent(
                clean.split('/').pop()?.replace(/^\d+-/, '') || `File ${idx + 1}`
              );
              return { url: clean, name, size: 0 };
            });
          setFiles(loadedFiles);
        }
      }
    } catch (err: any) {
      console.error('Failed to load assignment detail:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  }, [initialAssignment]);

  useEffect(() => {
    fetchDetail();
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [fetchDetail]);

  const assignment = detailData?.assignment || initialAssignment;
  const submission = detailData?.submission;

  // Real date & deadline logic matching Web LMS
  const isBeforeDeadline = assignment.due_date
    ? new Date(assignment.due_date) >= new Date()
    : true;
  const isExpired = !isBeforeDeadline;
  const isGraded = submission?.status === 'graded' || assignment.status === 'graded';
  const canResubmit = Boolean(submission && !isGraded && isBeforeDeadline);

  // Formatting helpers matching Web LMS
  const formatDetailDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatTimestamp = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Score formatter ensuring 2 decimal places matching Web LMS (NUMERIC(6,2))
  const formatScoreDisplay = (val: any) => {
    if (val == null || val === '—') return null;
    const n = Number(val);
    return isNaN(n) ? String(val) : n.toFixed(2);
  };

  const handleOpenUrl = (url: string) => {
    const clean = url.trim();
    if (!clean) return;
    const finalUrl = clean.startsWith('http') ? clean : `https://${clean}`;
    Linking.openURL(finalUrl).catch((err) =>
      console.error('Failed to open URL:', err)
    );
  };

  // Document Picker & Upload Handler matching Web LMS
  const handlePickAndUploadFile = async () => {
    try {
      setErrorMessage(null);
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'image/*',
          'video/mp4',
          'application/zip',
          'application/x-zip-compressed',
        ],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB matching Web LMS

      for (const asset of result.assets) {
        if (asset.size && asset.size > MAX_FILE_SIZE_BYTES) {
          setErrorMessage(
            `"${asset.name}" exceeds the 10MB limit. Please choose a smaller file.`
          );
          continue;
        }

        setIsUploading(true);

        try {
          // If dummy testing assignment, simulate instant successful upload
          if (assignment.id === 999999) {
            const simulatedUrl = `https://mock.blob.kreativa.sch.id/${Date.now()}-${asset.name}`;
            setFiles((prev) => [
              ...prev,
              {
                url: simulatedUrl,
                name: asset.name,
                size: asset.size || 0,
              },
            ]);
          } else {
            const formData = new FormData();
            formData.append('file', {
              uri: asset.uri,
              name: asset.name,
              type: asset.mimeType || 'application/octet-stream',
            } as any);
            formData.append('folder', 'submissions');

            const res = await api.upload.uploadFile(formData);
            setFiles((prev) => [
              ...prev,
              {
                url: res.url,
                name: asset.name,
                size: asset.size || 0,
              },
            ]);
          }
        } catch (err: any) {
          console.error('File upload error:', err);
          setErrorMessage(
            `Failed to upload "${asset.name}". ${err?.message || 'Please try again.'}`
          );
        } finally {
          setIsUploading(false);
        }
      }
    } catch (err: any) {
      console.error('Document picker error:', err);
      setErrorMessage('Failed to open document picker. Please try again.');
      setIsUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Handler
  const handleSubmit = async () => {
    const fileUrls = files.map((f) => f.url);

    if (!submissionText.trim() && fileUrls.length === 0) {
      setErrorMessage('Please provide text or upload at least one file.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      // Handle dummy testing assignment (id: 999999) mock submission
      if (assignment.id === 999999) {
        setTimeout(() => {
          setIsSubmitting(false);
          const nowIso = new Date().toISOString();
          setDetailData({
            assignment: {
              ...assignment,
              status: 'submitted',
              submission_status: 'submitted',
            },
            submission: {
              id: 999999,
              assignment_id: 999999,
              student_id: 1,
              attempt_number: 1,
              submission_text: submissionText.trim() || null,
              submission_url: fileUrls.length > 0 ? fileUrls.join(',') : null,
              status: 'submitted',
              score: null,
              feedback: null,
              graded_at: null,
              submitted_at: nowIso,
              updated_at: nowIso,
            },
            files: [],
          });
          setToastMessage(
            canResubmit
              ? 'Assignment successfully resubmitted!'
              : 'Assignment successfully submitted!'
          );
          if (onSubmitSuccess) {
            onSubmitSuccess(999999, submissionText);
          }
        }, 500);
        return;
      }

      await api.assignments.submit(assignment.id, {
        submissionText: submissionText.trim() || undefined,
        submissionUrl: fileUrls.length > 0 ? fileUrls.join(',') : undefined,
      });

      setToastMessage(
        canResubmit
          ? 'Assignment successfully resubmitted!'
          : 'Assignment successfully submitted!'
      );

      // Re-fetch detail to get updated submission state
      await fetchDetail();

      if (onSubmitSuccess) {
        onSubmitSuccess(assignment.id, submissionText);
      }
    } catch (err: any) {
      console.error('Submit error:', err);
      setErrorMessage(err?.message || 'Failed to submit assignment. Please try again.');
    } finally {
      if (assignment.id !== 999999) {
        setIsSubmitting(false);
      }
    }
  };

  const finalScore =
    submission?.score != null
      ? submission.score
      : assignment.submission_score != null
        ? assignment.submission_score
        : null;

  const currentStatus = isGraded
    ? 'graded'
    : submission?.status === 'submitted' ||
      assignment.submission_status === 'submitted' ||
      assignment.status === 'submitted'
      ? 'submitted'
      : 'pending';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ToastAlert
        visible={Boolean(toastMessage)}
        message={toastMessage || ''}
        type="success"
        floating
        onClose={() => setToastMessage(null)}
      />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. Back Button matching Web LMS BackButton (ArrowLeft, text-[#475569] mb-4) */}
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={16} color="#475569" strokeWidth={2} />
          <Text style={styles.backBtnText}>{backLabel}</Text>
        </TouchableOpacity>

        {/* 2. Header Section matching Web LMS PageHeader (Title and Badge inline, description below) */}
        <View style={styles.headerBox}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.assignmentTitle}>{assignment.title}</Text>
            <View
              style={[
                styles.badgePill,
                currentStatus === 'graded'
                  ? styles.badgeGraded
                  : currentStatus === 'submitted'
                    ? styles.badgeSubmitted
                    : styles.badgePending,
              ]}
            >
              <Text
                style={[
                  styles.badgePillText,
                  currentStatus === 'graded'
                    ? styles.badgeTextGraded
                    : currentStatus === 'submitted'
                      ? styles.badgeTextSubmitted
                      : styles.badgeTextPending,
                ]}
              >
                {currentStatus === 'pending' ? 'Not submitted' : currentStatus}
              </Text>
            </View>
          </View>

          <Text style={styles.courseSubtitle}>
            {assignment.course_name || assignment.course}
          </Text>
        </View>

        {isLoadingDetail && !detailData ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.loadingText}>Loading assignment details...</Text>
          </View>
        ) : (
          <View style={styles.cardsStack}>
            {/* 3. Card: Instructions matching Web LMS */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Instructions</Text>
              <Text style={styles.instructionsText}>
                {(assignment.description || 'No instructions provided.').replace(/\\n/g, '\n')}
              </Text>
            </View>

            {/* 4. Card: Submission Area matching Web LMS logic */}
            {isExpired && !submission ? (
              /* Case 4A: Deadline Passed & Not Submitted */
              <View style={styles.card}>
                <View style={styles.expiredBox}>
                  <View style={styles.expiredIconCircle}>
                    <AlertCircle size={20} color="#DC2626" strokeWidth={2} />
                  </View>
                  <Text style={styles.expiredTitle}>Deadline Passed</Text>
                  <Text style={styles.expiredDesc}>
                    The submission deadline has passed. You can no longer submit this assignment.
                  </Text>
                </View>
              </View>
            ) : submission && !canResubmit ? (
              /* Case 4B: Already Submitted & Locked (Graded or Past Deadline) */
              <View style={styles.card}>
                <Text style={styles.cardSectionTitle}>Your Submission</Text>
                <View style={styles.submissionReadOnlyWrap}>
                  {submission.submission_text ? (
                    <View style={styles.submittedTextBox}>
                      <Text style={styles.submittedContentText}>
                        {submission.submission_text}
                      </Text>
                    </View>
                  ) : null}

                  {submission.submission_url ? (
                    <View style={styles.uploadedFilesWrap}>
                      <Text style={styles.filesSectionLabel}>Uploaded Files:</Text>
                      {submission.submission_url.split(',').map((urlStr: string, idx: number) => {
                        const clean = urlStr.trim();
                        const fileName = decodeURIComponent(
                          clean.split('/').pop()?.replace(/^\d+-/, '') || `File ${idx + 1}`
                        );
                        return (
                          <TouchableOpacity
                            key={idx}
                            onPress={() => handleOpenUrl(clean)}
                            style={styles.fileRow}
                            activeOpacity={0.7}
                          >
                            <FileText size={16} color="#2563EB" strokeWidth={2} />
                            <Text style={styles.fileNameText} numberOfLines={1}>
                              {fileName}
                            </Text>
                            <Text style={styles.downloadHint}>Download ↓</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : null}

                  <View style={styles.submissionMetaFooter}>
                    <Text style={styles.metaTimestampText}>
                      Submitted:{' '}
                      {submission.submitted_at
                        ? formatTimestamp(submission.submitted_at)
                        : 'N/A'}
                    </Text>
                    {submission.updated_at &&
                      submission.updated_at !== submission.submitted_at && (
                        <Text style={styles.metaTimestampText}>
                          Last updated: {formatTimestamp(submission.updated_at)}
                        </Text>
                      )}
                    {isGraded && (
                      <Text style={styles.gradedLockNotice}>
                        This submission has been graded and can no longer be edited.
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            ) : (
              /* Case 4C: Active Submission / Resubmission Form (Identical to Web submission-form.tsx) */
              <View style={styles.card}>
                <Text style={styles.cardSectionTitle}>
                  {canResubmit ? 'Edit & Resubmit' : 'Submit Your Work'}
                </Text>
                {canResubmit && (
                  <Text style={styles.resubmitNotice}>
                    You can update your submission before the deadline.
                  </Text>
                )}

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>
                    Answer / Text <Text style={styles.optionalLabel}>(optional)</Text>
                  </Text>
                  <TextInput
                    style={styles.textArea}
                    value={submissionText}
                    onChangeText={setSubmissionText}
                    placeholder="Type your answer here..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                {/* File Upload Section matching Web LMS */}
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>
                    File Upload{' '}
                    <Text style={styles.optionalLabel}>
                      (optional, multiple files allowed)
                    </Text>
                  </Text>

                  {/* List of picked files matching Web LMS */}
                  {files.length > 0 && (
                    <View style={styles.selectedFilesList}>
                      {files.map((file, index) => (
                        <View key={index} style={styles.selectedFileItem}>
                          <FileText size={16} color="#2563EB" strokeWidth={2} />
                          <Text style={styles.selectedFileName} numberOfLines={1}>
                            {file.name}
                          </Text>
                          {file.size > 0 && (
                            <Text style={styles.selectedFileSize}>
                              {(file.size / 1024 / 1024).toFixed(1)}MB
                            </Text>
                          )}
                          <TouchableOpacity
                            onPress={() => removeFile(index)}
                            style={styles.fileRemoveBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <X size={16} color="#94A3B8" strokeWidth={2} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Dashed Upload Button matching Web LMS */}
                  <TouchableOpacity
                    onPress={handlePickAndUploadFile}
                    disabled={isUploading}
                    style={styles.uploadDashedBox}
                    activeOpacity={0.7}
                  >
                    {isUploading ? (
                      <ActivityIndicator size="small" color="#2563EB" />
                    ) : (
                      <Upload size={20} color="#94A3B8" strokeWidth={2} />
                    )}
                    <Text style={styles.uploadDashedText}>
                      {isUploading
                        ? 'Uploading...'
                        : files.length > 0
                          ? 'Add more files'
                          : 'Click to upload files'}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.uploadHelperText}>
                    Max 10MB per file. Accepted: PDF, DOC, DOCX, JPG, PNG, MP4, ZIP, PPTX, XLSX.
                  </Text>
                </View>

                {errorMessage && (
                  <View style={styles.errorAlertBox}>
                    <AlertCircle size={16} color="#DC2626" strokeWidth={2} />
                    <Text style={styles.errorAlertText}>{errorMessage}</Text>
                  </View>
                )}

                {/* Button variant="ok" -> Green #16A34A matching Web LMS Button */}
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={
                    isSubmitting ||
                    isUploading ||
                    (!submissionText.trim() && files.length === 0)
                  }
                  style={[
                    styles.submitBtnOk,
                    (isSubmitting ||
                      isUploading ||
                      (!submissionText.trim() && files.length === 0)) &&
                      styles.submitBtnDisabled,
                  ]}
                  activeOpacity={0.8}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {canResubmit ? 'Resubmit Assignment' : 'Submit Assignment'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* 5. Card: Feedback & Score (Shown if Graded) */}
            {finalScore != null && (
              <View style={styles.card}>
                <Text style={styles.cardSectionTitle}>Feedback</Text>
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreNumber}>{formatScoreDisplay(finalScore)}</Text>
                  <Text style={styles.scoreDenominator}>
                    / {assignment.max_score || 100}
                  </Text>
                </View>
                {submission?.feedback ? (
                  <Text style={styles.feedbackText}>{submission.feedback}</Text>
                ) : null}
              </View>
            )}

            {/* 6. Card: Details matching Web LMS Sidebar (Vertical dl Stack) */}
            <View style={styles.card}>
              <Text style={styles.cardDetailsTitle}>Details</Text>
              <View style={styles.detailsVerticalList}>
                {assignment.due_date ? (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailDt}>Due Date</Text>
                    <Text
                      style={[
                        styles.detailDd,
                        isExpired && styles.detailDdExpired,
                      ]}
                    >
                      {formatDetailDate(assignment.due_date)}
                      {isExpired && ' (expired)'}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.detailItem}>
                  <Text style={styles.detailDt}>Max Score</Text>
                  <Text style={styles.detailDd}>
                    {assignment.max_score || 100}
                  </Text>
                </View>

                {assignment.assignment_type ? (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailDt}>Type</Text>
                    <Text style={[styles.detailDd, styles.capitalize]}>
                      {assignment.assignment_type}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Slate-50 background matching Web LMS
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 108,
  },
  // BackButton matching Web LMS BackButton (inline-flex items-center gap-1.5 text-sm text-[#475569] mb-4)
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: '#475569',
  },
  // PageHeader matching Web LMS PageHeader
  headerBox: {
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  assignmentTitle: {
    fontFamily: FONTS.title,
    fontSize: 24,
    lineHeight: 32,
    color: '#0F172A',
  },
  courseSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    marginTop: 4,
  },
  badgePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  badgePending: {
    backgroundColor: '#FFEDD5', // orange-100
  },
  badgeSubmitted: {
    backgroundColor: '#DBEAFE', // blue-100
  },
  badgeGraded: {
    backgroundColor: '#DCFCE7', // green-100
  },
  badgePillText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  badgeTextPending: {
    color: '#9A3412', // orange-800
  },
  badgeTextSubmitted: {
    color: '#1E40AF', // blue-800
  },
  badgeTextGraded: {
    color: '#166534', // green-800
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
  },
  cardsStack: {
    gap: 14,
  },
  // Card matching Web LMS Card (bg-white rounded-xl border border-[#E2E8F0] shadow-sm)
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 18,
    paddingVertical: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardSectionTitle: {
    fontFamily: FONTS.titleSemiBold,
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 12,
  },
  cardDetailsTitle: {
    fontFamily: FONTS.titleSemiBold,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 12,
  },
  instructionsText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
  },
  // Expired Card State
  expiredBox: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  expiredIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  expiredTitle: {
    fontFamily: FONTS.titleSemiBold,
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 4,
  },
  expiredDesc: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    textAlign: 'center',
  },
  resubmitNotice: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#475569',
    marginTop: -8,
    marginBottom: 14,
  },
  formGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    fontWeight: '500',
    color: '#0F172A',
    marginBottom: 6,
  },
  subFieldLabel: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 6,
  },
  optionalLabel: {
    color: '#94A3B8',
    fontWeight: '400',
  },
  textArea: {
    height: 110,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  // Selected files list matching Web LMS (space-y-2 mb-3)
  selectedFilesList: {
    gap: 8,
    marginBottom: 10,
  },
  selectedFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectedFileName: {
    flex: 1,
    fontSize: 13.5,
    color: '#2563EB',
    fontWeight: '500',
  },
  selectedFileSize: {
    fontSize: 12,
    color: '#94A3B8',
  },
  fileRemoveBtn: {
    padding: 4,
  },
  // Dashed upload zone matching Web LMS (border-2 border-dashed border-[#E2E8F0] rounded-lg p-4)
  uploadDashedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    marginBottom: 4,
  },
  uploadDashedText: {
    fontSize: 13.5,
    color: '#475569',
    fontWeight: '500',
  },
  uploadHelperText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  errorAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginBottom: 16,
  },
  errorAlertText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
  },
  // Green Submit Button (variant="ok" #16A34A matching Web LMS)
  submitBtnOk: {
    height: 44,
    backgroundColor: '#16A34A',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  submissionReadOnlyWrap: {
    gap: 12,
  },
  submittedTextBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  submittedContentText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
  uploadedFilesWrap: {
    gap: 8,
  },
  filesSectionLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 2,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fileNameText: {
    flex: 1,
    fontSize: 14,
    color: '#2563EB',
  },
  downloadHint: {
    fontSize: 12,
    color: '#94A3B8',
  },
  submissionMetaFooter: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 4,
    marginTop: 4,
  },
  metaTimestampText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  gradedLockNotice: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 8,
  },
  scoreNumber: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: '#16A34A',
  },
  scoreDenominator: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#475569',
  },
  feedbackText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
  // Details Section (Vertical dl Stack matching Web LMS)
  detailsVerticalList: {
    gap: 12,
  },
  detailItem: {
    gap: 2,
  },
  detailDt: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#94A3B8',
  },
  detailDd: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#0F172A',
  },
  detailDdExpired: {
    color: '#DC2626',
    fontWeight: '600',
  },
  capitalize: {
    textTransform: 'capitalize',
  },
});

export default AssignmentDetailView;
