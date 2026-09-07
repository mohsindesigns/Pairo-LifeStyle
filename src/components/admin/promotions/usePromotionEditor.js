import { useState, useCallback } from 'react';

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

  const updateCondition = useCallback((path, value) => {
    setFormData(prev => {
      const newData = { ...prev };
      const parts = path.split('.');
      let current = newData.conditions;
      
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (part === 'rules') {
            const nextPart = parts[i+1];
            current = current.rules[parseInt(nextPart)];
            i++; // skip the index part
        } else {
            current = current[part];
        }
      }
      
      const lastPart = parts[parts.length - 1];
      current[lastPart] = value;
      
      return { ...newData };
    });
  }, []);

  const addRule = useCallback((path, type = 'rule') => {
    setFormData(prev => {
      const newData = { ...prev };
      let current = newData.conditions;
      
      if (path !== "") {
        const parts = path.split('.');
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (part === 'rules') {
              const nextPart = parts[i+1];
              current = current.rules[parseInt(nextPart)];
              i++;
          } else {
              current = current[part];
          }
        }
      }

      if (!current.rules) current.rules = [];
      
      if (type === 'group') {
        current.rules.push({ operator: 'AND', rules: [] });
      } else {
        current.rules.push({ field: 'subtotal', op: '>=', value: 0 });
      }

      return { ...newData };
    });
  }, []);

  const removeRule = useCallback((path, index) => {
    setFormData(prev => {
        const newData = { ...prev };
        let current = newData.conditions;
        
        if (path !== "") {
          const parts = path.split('.');
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (part === 'rules') {
                const nextPart = parts[i+1];
                current = current.rules[parseInt(nextPart)];
                i++;
            } else {
                current = current[part];
            }
          }
        }

        current.rules.splice(index, 1);
        return { ...newData };
    });
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
