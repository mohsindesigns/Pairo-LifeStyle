import { useState, useCallback } from 'react';
import { setConditionValue, addConditionRule, removeConditionRule } from './promotionEditorUtils';

/**
 * Custom hook to manage the recursive state of a Promotion.
 */
export default function usePromotionEditor(initialData) {
  const [formData, setFormData] = useState(initialData || {
    title: "",
    code: "",
    adminStatus: "Draft",
    priority: 0,
    exclusive: false,
    stackable: false,
    startDate: null,
    endDate: null,
    usageLimits: { maxTotalUses: null, maxUsesPerCustomer: 1 },
    conditions: { operator: 'AND', rules: [] },
    actions: []
  });

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // --- RECURSIVE CONDITION UPDATES ---
  // Fully immutable (see promotionEditorUtils) so StrictMode's double-invoked
  // updaters can't apply an add/remove twice.

  const updateCondition = useCallback((path, value) => {
    setFormData(prev => ({ ...prev, conditions: setConditionValue(prev.conditions, path, value) }));
  }, []);

  const addRule = useCallback((path, type = 'rule') => {
    setFormData(prev => ({ ...prev, conditions: addConditionRule(prev.conditions, path, type) }));
  }, []);

  const removeRule = useCallback((path, index) => {
    setFormData(prev => ({ ...prev, conditions: removeConditionRule(prev.conditions, path, index) }));
  }, []);

  // --- ACTION UPDATES ---

  const addAction = () => {
    setFormData(prev => ({
      ...prev,
      actions: [...prev.actions, { type: 'percentage_discount', target: 'cart', value: 0 }]
    }));
  };

  const removeAction = (index) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }));
  };

  const updateAction = (index, field, value) => {
    setFormData(prev => {
      const newActions = [...prev.actions];
      newActions[index] = { ...newActions[index], [field]: value };
      return { ...prev, actions: newActions };
    });
  };

  return {
    formData,
    setFormData,
    updateField,
    updateCondition,
    addRule,
    removeRule,
    addAction,
    removeAction,
    updateAction
  };
}
