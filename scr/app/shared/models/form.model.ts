// src/app/shared/models/form.model.ts (continued)
export interface FormField {
    id: string;
    type: 'text' | 'email' | 'phone' | 'radio' | 'upload';
    label: string;
    required: boolean;
    options?: string[]; // For radio buttons
    description?: string;
  }
  
  export interface OrderForm {
    id: string;
    retailerId: string;
    title: string;
    description?: string;
    fields: FormField[];
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    allowFileUpload: boolean;
    allowedFileTypes: string[]; // e.g., ['png', 'heic']
    cancellationPolicy?: string;
  }