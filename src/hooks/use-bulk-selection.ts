import { useState, useCallback, useMemo } from 'react';

export interface UseBulkSelectionReturn<T extends { id: string | number }> {
  selectedIds: Set<string | number>;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  selectedCount: number;
  currentItems: T[];

  toggleItem: (id: string | number) => void;
  toggleAll: (items: T[]) => void;
  clearSelection: () => void;
  getSelectedItems: (items: T[]) => T[];
  isSelected: (id: string | number) => boolean;
}

/**
 * Custom hook for managing bulk selection state in tables
 *
 * @template T - Type of items with an `id` property (string or number)
 * @returns Object with selection state and helper functions
 *
 * @example
 * const { selectedIds, toggleItem, toggleAll, clearSelection } = useBulkSelection<Opportunity>();
 */
export function useBulkSelection<T extends { id: string | number }>(): UseBulkSelectionReturn<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [currentItems, setCurrentItems] = useState<T[]>([]);

  // Toggle individual item
  const toggleItem = useCallback((id: string | number) => {
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
    setCurrentItems(items);
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
  const isSelected = useCallback((id: string | number) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  // Get array of selected items
  const getSelectedItems = useCallback((items: T[]) => {
    return items.filter(item => selectedIds.has(item.id));
  }, [selectedIds]);

  // Computed values
  const selectedCount = selectedIds.size;

  const isAllSelected = useMemo(() => {
    return currentItems.length > 0 && selectedCount === currentItems.length;
  }, [selectedCount, currentItems.length]);

  const isIndeterminate = useMemo(() => {
    return selectedCount > 0 && !isAllSelected;
  }, [selectedCount, isAllSelected]);

  return {
    selectedIds,
    isAllSelected,
    isIndeterminate,
    selectedCount,
    currentItems,
    toggleItem,
    toggleAll,
    clearSelection,
    getSelectedItems,
    isSelected
  };
}
