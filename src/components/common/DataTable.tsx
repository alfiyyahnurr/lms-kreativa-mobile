import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { FONTS } from '../../constants/theme';

export interface TableColumn<T> {
  key: string;
  header: string;
  width?: number;
  render: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  onRowPress?: (item: T) => void;
  pageSize?: number;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  onRowPress,
  pageSize = 10,
  emptyMessage = 'No data available.',
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, data.length);
  const pageData = data.slice(startIndex, endIndex);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (data.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.tableCard}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.tableInner}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={[styles.cellBase, styles.numCol]}>
              <Text style={styles.headerText}>#</Text>
            </View>
            {columns.map((col) => (
              <View
                key={col.key}
                style={[styles.cellBase, { width: col.width || 140 }]}
              >
                <Text style={styles.headerText} numberOfLines={1}>
                  {col.header}
                </Text>
              </View>
            ))}
          </View>

          {/* Data Rows */}
          {pageData.map((item, idx) => {
            const isLast = idx === pageData.length - 1;
            const RowWrapper: any = onRowPress ? TouchableOpacity : View;
            return (
              <RowWrapper
                key={idx}
                onPress={onRowPress ? () => onRowPress(item) : undefined}
                activeOpacity={0.7}
                style={[styles.dataRow, isLast && styles.dataRowLast]}
              >
                <View style={[styles.cellBase, styles.numCol]}>
                  <Text style={styles.numText}>{startIndex + idx + 1}</Text>
                </View>
                {columns.map((col) => (
                  <View
                    key={col.key}
                    style={[styles.cellBase, { width: col.width || 140 }]}
                  >
                    {col.render(item)}
                  </View>
                ))}
              </RowWrapper>
            );
          })}
        </View>
      </ScrollView>

      {/* Pagination Footer (matching Web DataTable) */}
      {data.length > pageSize && (
        <View style={styles.paginationBar}>
          <Text style={styles.paginationInfo}>
            Showing {startIndex + 1}–{endIndex} of {data.length}
          </Text>
          <View style={styles.paginationControls}>
            <TouchableOpacity
              onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              style={[styles.pageBtn, safePage <= 1 && styles.pageBtnDisabled]}
              activeOpacity={0.7}
            >
              <ChevronLeft size={16} color={safePage <= 1 ? '#CBD5E1' : '#475569'} />
            </TouchableOpacity>
            <Text style={styles.pageIndicator}>
              {safePage} / {totalPages}
            </Text>
            <TouchableOpacity
              onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              style={[styles.pageBtn, safePage >= totalPages && styles.pageBtnDisabled]}
              activeOpacity={0.7}
            >
              <ChevronRight size={16} color={safePage >= totalPages ? '#CBD5E1' : '#475569'} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#475569',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  tableInner: {
    minWidth: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  dataRowLast: {
    borderBottomWidth: 0,
  },
  cellBase: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  numCol: {
    width: 42,
  },
  headerText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  numText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#94A3B8',
  },
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  paginationInfo: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#64748B',
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnDisabled: {
    opacity: 0.5,
  },
  pageIndicator: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#0F172A',
    minWidth: 36,
    textAlign: 'center',
  },
});

export default DataTable;

