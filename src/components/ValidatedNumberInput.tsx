import React, {
  ChangeEvent,
  FC,
  useCallback,
  useEffect,
  useState,
} from 'react';
import type { ValidationResult } from '../types';

export interface ValidationRule {
  validate: (value: string) => boolean;
  message: string;
}

export interface ValidatedNumberInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (result: ValidationResult) => void;
  placeholder?: string;
  disabled?: boolean;
  maxValue?: bigint;
  maxValueLabel?: string;
  className?: string;
  autoFocus?: boolean;
}

const DEFAULT_VALIDATIONS: ValidationRule[] = [
  {
    validate: (value: string) => {
      if (!value || value.trim() === '') return false;
      return true;
    },
    message: 'Amount is required',
  },
  {
    validate: (value: string) => {
      const num = Number(value);
      return !isNaN(num) && num > 0;
    },
    message: 'Amount must be greater than 0',
  },
  {
    validate: (value: string) => {
      const num = Number(value);
      return !isNaN(num) && isFinite(num);
    },
    message: 'Amount must be a valid number',
  },
];

export const ValidatedNumberInput: FC<ValidatedNumberInputProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder = 'Enter amount',
  disabled = false,
  maxValue,
  maxValueLabel = 'balance',
  className = 'form-input',
  autoFocus = false,
}) => {
  const [validationState, setValidationState] = useState<ValidationResult>({
    success: true,
    value: '',
  });
  const [touched, setTouched] = useState(false);

  const validateValue = useCallback(
    (inputValue: string): ValidationResult => {
      // Empty value - don't show error until touched
      if (!inputValue || inputValue.trim() === '') {
        if (touched) {
          return {
            success: false,
            value: inputValue,
            error: 'Amount is required',
          };
        }
        return { success: true, value: inputValue };
      }

      for (const rule of DEFAULT_VALIDATIONS) {
        if (!rule.validate(inputValue)) {
          return {
            success: false,
            value: inputValue,
            error: rule.message,
          };
        }
      }

      if (maxValue !== undefined) {
        try {
          const inputBigInt = BigInt(inputValue);
          if (inputBigInt > maxValue) {
            return {
              success: false,
              value: inputValue,
              error: `Amount cannot exceed ${maxValueLabel}`,
            };
          }
        } catch {
          return {
            success: false,
            value: inputValue,
            error: 'Invalid amount format',
          };
        }
      }

      return { success: true, value: inputValue };
    },
    [maxValue, maxValueLabel, touched]
  );

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;

    if (newValue === '') {
      const result = validateValue(newValue);
      setValidationState(result);
      onChange(result);
      return;
    }

    // Auto-correct leading decimal point first (before regex check)
    if (newValue.startsWith('.')) {
      newValue = '0' + newValue;
    }

    const validNumberRegex = /^(\d+\.?\d*)$/;
    if (!validNumberRegex.test(newValue)) {
      return;
    }

    // Auto-correct leading zeros (except "0" and "0.x")
    if (
      newValue.length > 1 &&
      newValue.startsWith('0') &&
      newValue[1] !== '.'
    ) {
      newValue = newValue.replace(/^0+/, '');
      // If all zeros were removed, keep one zero
      if (newValue === '') {
        newValue = '0';
      }
    }

    // Prevent multiple decimal points
    const decimalCount = (newValue.match(/\./g) || []).length;
    if (decimalCount > 1) {
      return;
    }

    const result = validateValue(newValue);
    setValidationState(result);
    onChange(result);
  };

  const handleBlur = () => {
    setTouched(true);
    const result = validateValue(value);
    setValidationState(result);
    onChange(result);
  };

  useEffect(() => {
    if (value && touched) {
      const result = validateValue(value);
      setValidationState(result);
    }
  }, [value, validateValue, touched]);

  const hasError = !validationState.success && touched;
  const inputClassName = `${className} ${hasError ? 'input-error' : ''}`;

  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        pattern="[0-9]*\.?[0-9]*"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClassName}
        autoFocus={autoFocus}
      />
      {hasError && (
        <span className="error-message">{validationState.error}</span>
      )}
    </div>
  );
};
