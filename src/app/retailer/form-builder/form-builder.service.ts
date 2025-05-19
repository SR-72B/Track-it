// src/app/retailer/form-builder/form-builder.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, from, of } from 'rxjs'; // Added 'of' for error handling
import { map, catchError } from 'rxjs/operators'; // Added 'catchError'
import { AuthService } from '../../auth/auth.service'; // Assuming AuthService is correctly located

export interface FormField {
  id: string; // Consider making this optional if generated dynamically or using array index
  type: 'text' | 'email' | 'phone' | 'radio' | 'upload' | 'textarea' | 'checkbox' | 'date' | 'number'; // Added more types
  label: string;
  required: boolean;
  options?: string[]; // For radio buttons, dropdowns
  description?: string; // Help text for the field
  placeholder?: string;
  defaultValue?: any;
  validationPatterns?: { pattern: string, message: string }[]; // For custom regex validation
  // For file uploads
  maxFileSizeMB?: number;
}

export interface OrderForm {
  id: string; // Document ID from Firestore
  retailerId: string;
  title: string;
  description?: string;
  fields: FormField[];
  active: boolean; // Whether the form is available for customers
  createdAt: any; // Firestore Timestamp or Date
  updatedAt: any; // Firestore Timestamp or Date
  allowFileUpload: boolean;
  allowedFileTypes: string[]; // e.g., ['image/png', 'application/pdf'] - use MIME types
  maxFilesAllowed?: number;
  cancellationPolicy?: string;
  submissionInstructions?: string; // Instructions shown to customer before/after submission
}

@Injectable({
  providedIn: 'root'
})
export class FormBuilderService {
  constructor(
    private firestore: AngularFirestore,
    private authService: AuthService // Keep if retailerId needs to be auto-filled or for permissions
  ) {}

  /**
   * Create a new order form.
   * @param form Partial form data, retailerId should be pre-filled.
   * @returns Promise with the created form ID.
   */
  createOrderForm(form: Partial<OrderForm>): Promise<string> {
    const formId = this.firestore.createId();
    const now = new Date(); // Will be converted to Firestore Timestamp

    // Ensure retailerId is provided
    if (!form.retailerId) {
      return Promise.reject(new Error('Retailer ID is required to create a form.'));
    }

    const orderForm: OrderForm = {
      id: formId, // This will be overridden by idField if valueChanges({idField:'id'}) is used on retrieval
      retailerId: form.retailerId,
      title: form.title || 'New Order Form',
      description: form.description || '',
      fields: form.fields || [],
      active: form.active !== undefined ? form.active : false, // Default to inactive until explicitly published
      createdAt: now,
      updatedAt: now,
      allowFileUpload: form.allowFileUpload || false,
      allowedFileTypes: form.allowedFileTypes || ['image/jpeg', 'image/png', 'application/pdf'],
      maxFilesAllowed: form.maxFilesAllowed || 1,
      cancellationPolicy: form.cancellationPolicy || 'Default cancellation policy applies.',
      submissionInstructions: form.submissionInstructions || 'Your order will be processed upon submission.'
    };

    return this.firestore.collection('orderForms').doc(formId).set(orderForm)
      .then(() => formId)
      .catch(error => {
        console.error("Error creating order form:", error);
        throw error;
      });
  }

  /**
   * Update an existing order form.
   * @param formId ID of the form to update.
   * @param updates Partial form data to update.
   * @returns Promise<void>.
   */
  updateOrderForm(formId: string, updates: Partial<OrderForm>): Promise<void> {
    if (!formId) {
      return Promise.reject(new Error('Form ID is required for update.'));
    }
    updates.updatedAt = new Date(); // Will be converted to Firestore Timestamp
    return this.firestore.collection('orderForms').doc(formId).update(updates)
      .catch(error => {
        console.error("Error updating order form:", formId, error);
        throw error;
      });
  }

  /**
   * Get a specific order form by ID.
   * @param formId The form ID to retrieve.
   * @returns Observable with the OrderForm or null if not found.
   */
  getOrderForm(formId: string): Observable<OrderForm | null> {
    if (!formId) {
      console.warn('Form ID not provided for getOrderForm.');
      return of(null);
    }
    return this.firestore.collection('orderForms').doc<OrderForm>(formId)
      .valueChanges({ idField: 'id' }) // Map Firestore document ID to 'id' property
      .pipe(
        map(form => {
          if (!form) {
            console.warn(`Form with ID ${formId} not found.`);
            return null;
          }
          // Optionally convert Timestamps to Dates here if needed globally
          // form.createdAt = form.createdAt?.toDate ? form.createdAt.toDate() : form.createdAt;
          // form.updatedAt = form.updatedAt?.toDate ? form.updatedAt.toDate() : form.updatedAt;
          return form;
        }),
        catchError(error => {
          console.error(`Error fetching order form ${formId}:`, error);
          return of(null); // Return null on error
        })
      );
  }

  /**
   * Get all forms for a specific retailer.
   * @param retailerId The retailer's user ID.
   * @returns Observable array of OrderForm objects.
   */
  getRetailerForms(retailerId: string): Observable<OrderForm[]> {
    if (!retailerId) {
      console.warn('Retailer ID not provided for getRetailerForms.');
      return of([]);
    }
    return this.firestore.collection<OrderForm>('orderForms', ref =>
      ref.where('retailerId', '==', retailerId).orderBy('createdAt', 'desc')
    ).valueChanges({ idField: 'id' }) // Map Firestore document ID to 'id' property
    .pipe(
      catchError(error => {
        console.error(`Error fetching forms for retailer ${retailerId}:`, error);
        return of([]); // Return empty array on error
      })
    );
  }

  /**
   * Get all active order forms for customer view.
   * @returns Observable array of active OrderForm objects.
   */
  getActiveForms(): Observable<OrderForm[]> {
    return this.firestore.collection<OrderForm>('orderForms', ref =>
      ref.where('active', '==', true).orderBy('title', 'asc') // Example: order by title
    ).valueChanges({ idField: 'id' }) // Map Firestore document ID to 'id' property
    .pipe(
      catchError(error => {
        console.error('Error fetching active forms:', error);
        return of([]); // Return empty array on error
      })
    );
  }


  /**
   * Delete an order form.
   * @param formId The ID of the form to delete.
   * @returns Promise<void>.
   */
  deleteOrderForm(formId: string): Promise<void> {
    if (!formId) {
      return Promise.reject(new Error('Form ID is required for deletion.'));
    }
    return this.firestore.collection('orderForms').doc(formId).delete()
      .catch(error => {
        console.error("Error deleting order form:", formId, error);
        throw error;
      });
  }
}

