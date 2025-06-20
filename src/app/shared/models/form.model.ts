// src/app/shared/models/form.model.ts
export interface FormField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'radio' | 'upload' | 'textarea' | 'number' | 'select' | 'checkbox';
  label: string;
  required: boolean;
  options?: string[]; // For radio buttons, select dropdowns, checkboxes
  description?: string;
  placeholder?: string;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
  order?: number; // For field ordering
}

export interface OrderForm {
  id: string;
  retailerId: string;
  title: string;
  description?: string;
  fields: FormField[];
  active: boolean;
  createdAt: any; // Firestore Timestamp or Date
  updatedAt: any; // Firestore Timestamp or Date
  allowFileUpload: boolean;
  allowedFileTypes: string[]; // e.g., ['png', 'jpg', 'pdf', 'heic']
  maxFileSize?: number; // in MB
  maxFiles?: number;
  cancellationPolicy?: string;
  cancellationDeadlineHours?: number; // Default 24 hours
  requiresApproval?: boolean;
  emailNotifications?: boolean;
  customCss?: string;
  submitButtonText?: string;
  successMessage?: string;
}

// Form submission data structure
export interface FormSubmissionData {
  [fieldId: string]: string | number | boolean | string[] | null;
}

// Form validation result
export interface FormValidationResult {
  isValid: boolean;
  errors: { [fieldId: string]: string };
}

// Form builder state
export interface FormBuilderState {
  form: OrderForm;
  selectedField: FormField | null;
  isDirty: boolean;
  isPreviewMode: boolean;
}
