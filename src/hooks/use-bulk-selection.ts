import { useState, useCallback, useMemo } from 'react';

export interface UseBulkSelectionReturn<T extends { id: number }> {
  selectedIds: Set<number>;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  selectedCount: number;

  toggleItem: (id: number) => void;
  toggleAll: (items: T[]) => void;
  clearSelection: () => void;
  getSelectedItems: (items: T[]) => T[];
  isSelected: (id: number) => boolean;
}

/**
 * Custom hook for managing bulk selection state in tables
 *
 * @template T - Type of items with an `id` property
 * @returns Object with selection state and helper functions
 *
 * @example
 * const { selectedIds, toggleItem, toggleAll, clearSelection } = useBulkSelection<Opportunity>();
 */
export function useBulkSelection<T extends { id: number }>(): UseBulkSelectionReturn<T> {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Toggle individual item
  const toggleItem = useCallback((id: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Toggle all items (select all / deselect all)
  const toggleAll = useCallback((items: T[]) => {
    setSelectedIds(prev => {
      // If all items are selected, deselect all
      if (prev.size === items.length && items.every(item => prev.has(item.id))) {
        return new Set();
      }
      // Otherwise, select all
      return new Set(items.map(item => item.id));
    });
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Check if item is selected
  const isSelected = useCallback((id: number) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  // Get array of selected items
  const getSelectedItems = useCallback((items: T[]) => {
    return items.filter(item => selectedIds.has(item.id));
  }, [selectedIds]);

  // Computed values
  const selectedCount = selectedIds.size;

  const isAllSelected = useMemo(() => {
    return selectedCount > 0 && selectedCount === selectedCount;
  }, [selectedCount]);

  const isIndeterminate = useMemo(() => {
    return selectedCount > 0 && !isAllSelected;
  }, [selectedCount, isAllSelected]);

  return {
    selectedIds,
    isAllSelected,
    isIndeterminate,
    selectedCount,
    toggleItem,
    toggleAll,
    clearSelection,
    getSelectedItems,
    isSelected
  };
}
