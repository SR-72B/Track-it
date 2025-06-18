// src/app/retailer/form-builder/form-builder.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service'; // Assuming AuthService is correctly located
import firebase from 'firebase/compat/app'; // Import for FieldValue serverTimestamp

export interface FormField {
  id: string; // Consider making this optional if generated dynamically or using array index
  type: 'text' | 'email' | 'phone' | 'radio' | 'upload' | 'textarea' | 'checkbox' | 'date' | 'number';
  label: string;
  required: boolean;
  options?: string[]; // For radio buttons, dropdowns
  description?: string; // Help text for the field
  placeholder?: string;
  defaultValue?: any;
  validationPatterns?: { pattern: string, message: string }[]; // For custom regex validation
  maxFileSizeMB?: number; // For file uploads
}

export interface OrderForm {
  id: string; // Document ID from Firestore
  retailerId: string;
  title: string;
  description?: string;
  fields: FormField[];
  active: boolean; // Whether the form is available for customers
  createdAt: any; // firebase.firestore.FieldValue | Date; (will be server timestamp)
  updatedAt: any; // firebase.firestore.FieldValue | Date; (will be server timestamp)
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
  private orderFormsCollection: AngularFirestoreCollection<OrderForm>;

  constructor(
    private firestore: AngularFirestore,
    private authService: AuthService // Keep if retailerId needs to be auto-filled or for permissions
  ) {
    this.orderFormsCollection = this.firestore.collection<OrderForm>('orderForms');
  }

  /**
   * Create a new order form.
   * @param formPartialData Partial form data, retailerId should be pre-filled by component.
   * @returns Promise with the created OrderForm object (including ID and server timestamps).
   */
  async createOrderForm(formPartialData: Omit<OrderForm, 'id' | 'createdAt' | 'updatedAt'>): Promise<OrderForm> {
    const formId = this.firestore.createId();
    const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();

    if (!formPartialData.retailerId) {
      // Attempt to get current user's retailerId if not provided, or throw error
      // This depends on your app's logic. For now, we'll assume it must be provided.
      throw new Error('Retailer ID is required to create a form.');
    }

    const newFormData: OrderForm = {
      id: formId, // Set the ID for the object we'll return
      ...formPartialData, // Spread the data from the component
      active: formPartialData.active !== undefined ? formPartialData.active : true, // Default to active
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
      // Ensure all required fields of OrderForm are present, using defaults if necessary from formPartialData
      // For example, if fields isn't in formPartialData, you might want a default:
      fields: formPartialData.fields || [],
      allowFileUpload: formPartialData.allowFileUpload || false,
      allowedFileTypes: formPartialData.allowedFileTypes || ['image/jpeg', 'image/png', 'application/pdf'],
    };

    try {
      await this.orderFormsCollection.doc(formId).set(newFormData);
      // To return the object with actual server-generated timestamps resolved as Dates,
      // you would typically fetch it after setting, or accept that the returned object
      // has FieldValue sentinels if you try to use createdAt/updatedAt immediately.
      // For simplicity in returning the ID and the shape, we return newFormData.
      // The component will get the resolved timestamps when it subscribes to getOrderForm or getRetailerForms.
      return newFormData; // Contains the ID and the data sent (timestamps are server-side)
    } catch (error) {
      console.error("Error creating order form in Firestore:", error);
      throw error; // Re-throw to be caught by the component
    }
  }

  /**
   * Update an existing order form.
   * @param formId ID of the form to update.
   * @param updates Partial form data to update.
   * @returns Promise<void>.
   */
  async updateOrderForm(formId: string, updates: Partial<OrderForm>): Promise<void> {
    if (!formId) {
      return Promise.reject(new Error('Form ID is required for update.'));
    }
    const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
    const updateData = { ...updates, updatedAt: serverTimestamp };

    try {
      return await this.orderFormsCollection.doc(formId).update(updateData);
    } catch (error) {
      console.error("Error updating order form:", formId, error);
      throw error;
    }
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
    return this.orderFormsCollection.doc<OrderForm>(formId)
      .valueChanges({ idField: 'id' }) // Map Firestore document ID to 'id' property
      .pipe(
        map(form => {
          if (!form) {
            // console.warn(`Form with ID ${formId} not found.`); // Can be noisy if form legitimately doesn't exist yet
            return null;
          }
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
    ).valueChanges({ idField: 'id' })
    .pipe(
      catchError(error => {
        console.error(`Error fetching forms for retailer ${retailerId}:`, error);
        return of([]);
      })
    );
  }

  /**
   * Get all active order forms for customer view.
   * @returns Observable array of active OrderForm objects.
   */
  getActiveForms(): Observable<OrderForm[]> {
    return this.firestore.collection<OrderForm>('orderForms', ref =>
      ref.where('active', '==', true).orderBy('title', 'asc')
    ).valueChanges({ idField: 'id' })
    .pipe(
      catchError(error => {
        console.error('Error fetching active forms:', error);
        return of([]);
      })
    );
  }

  /**
   * Delete an order form.
   * @param formId The ID of the form to delete.
   * @returns Promise<void>.
   */
  async deleteOrderForm(formId: string): Promise<void> {
    if (!formId) {
      return Promise.reject(new Error('Form ID is required for deletion.'));
    }
    try {
      return await this.orderFormsCollection.doc(formId).delete();
    } catch (error) {
      console.error("Error deleting order form:", formId, error);
      throw error;
    }
  }
}

