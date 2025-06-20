// src/app/shared/services/error.service.ts
import { Injectable } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular';

export interface ErrorDetails {
  message: string;
  code?: string;
  context?: string;
  timestamp?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorService {
  constructor(
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  /**
   * Display an error message as a toast notification
   * @param message The error message to display
   * @param duration How long to show the toast (in ms)
   * @param position Position of the toast
   */
  async showError(
    message: string, 
    duration: number = 4000, 
    position: 'top' | 'middle' | 'bottom' = 'top'
  ): Promise<void> {
    const toast = await this.toastController.create({
      message: message,
      duration: duration,
      position: position,
      color: 'danger',
      buttons: [
        {
          icon: 'close',
          role: 'cancel',
          handler: () => {
            console.log('Error toast dismissed');
          }
        }
      ],
      cssClass: 'error-toast'
    });
    
    await toast.present();
  }

  /**
   * Display a success message as a toast notification
   * @param message The success message to display
   * @param duration How long to show the toast (in ms)
   */
  async showSuccess(message: string, duration: number = 3000): Promise<void> {
    const toast = await this.toastController.create({
      message: message,
      duration: duration,
      position: 'top',
      color: 'success',
      buttons: [
        {
          icon: 'checkmark-circle',
          role: 'cancel'
        }
      ],
      cssClass: 'success-toast'
    });
    
    await toast.present();
  }

  /**
   * Display a warning message as a toast notification
   * @param message The warning message to display
   * @param duration How long to show the toast (in ms)
   */
  async showWarning(message: string, duration: number = 3000): Promise<void> {
    const toast = await this.toastController.create({
      message: message,
      duration: duration,
      position: 'top',
      color: 'warning',
      buttons: [
        {
          icon: 'warning',
          role: 'cancel'
        }
      ],
      cssClass: 'warning-toast'
    });
    
    await toast.present();
  }

  /**
   * Display an error alert with detailed information
   * @param title The alert title
   * @param message The error message
   * @param error Optional error object for additional details
   */
  async showErrorAlert(title: string, message: string, error?: any): Promise<void> {
    const alert = await this.alertController.create({
      header: title,
      message: message,
      buttons: [
        {
          text: 'OK',
          role: 'cancel',
          handler: () => {
            if (error) {
              console.error('Error details:', error);
            }
          }
        }
      ],
      cssClass: 'error-alert'
    });

    await alert.present();
  }

  /**
   * Parse and format Firebase authentication errors
   * @param error The error object from Firebase
   * @returns A user-friendly error message
   */
  parseAuthError(error: any): string {
    const errorCode = error?.code || '';
    
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'This email address is already in use. Please use a different email or log in.';
      case 'auth/invalid-email':
        return 'Invalid email address. Please check and try again.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'auth/user-not-found':
        return 'No account found with this email. Please check or create a new account.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect email or password. Please try again or reset your password.';
      case 'auth/weak-password':
        return 'Password is too weak. Please use a stronger password with at least 6 characters.';
      case 'auth/requires-recent-login':
        return 'This action requires recent authentication. Please log in again.';
      case 'auth/too-many-requests':
        return 'Too many unsuccessful login attempts. Please try again later or reset your password.';
      case 'auth/operation-not-allowed':
        return 'This sign-in method is not enabled. Please contact support.';
      case 'auth/invalid-action-code':
        return 'The action code is invalid. This can happen if the code is malformed, expired, or has already been used.';
      case 'auth/expired-action-code':
        return 'The action code has expired. Please request a new one.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection and try again.';
      default:
        return error?.message || 'An unexpected authentication error occurred. Please try again.';
    }
  }

  /**
   * Parse and format Firestore database errors
   * @param error The error object from Firestore
   * @returns A user-friendly error message
   */
  parseFirestoreError(error: any): string {
    const errorCode = error?.code || '';
    
    switch (errorCode) {
      case 'permission-denied':
        return 'You do not have permission to perform this action.';
      case 'not-found':
        return 'The requested document was not found.';
      case 'already-exists':
        return 'The document already exists.';
      case 'resource-exhausted':
        return 'Quota exceeded. Please try again later.';
      case 'failed-precondition':
        return 'Operation could not be executed in the current system state.';
      case 'unavailable':
        return 'The service is currently unavailable. Please try again later.';
      case 'deadline-exceeded':
        return 'The operation took too long to complete. Please try again.';
      case 'invalid-argument':
        return 'Invalid data provided. Please check your input and try again.';
      case 'unauthenticated':
        return 'You must be logged in to perform this action.';
      case 'aborted':
        return 'The operation was aborted due to a conflict. Please try again.';
      default:
        return error?.message || 'A database error occurred. Please try again.';
    }
  }

  /**
   * Parse and format Firebase Storage errors
   * @param error The error object from Firebase Storage
   * @returns A user-friendly error message
   */
  parseStorageError(error: any): string {
    const errorCode = error?.code || '';
    
    switch (errorCode) {
      case 'storage/object-not-found':
        return 'File not found.';
      case 'storage/unauthorized':
        return 'You do not have permission to access this file.';
      case 'storage/canceled':
        return 'File upload was cancelled.';
      case 'storage/unknown':
        return 'An unknown error occurred during file operation.';
      case 'storage/invalid-format':
        return 'Invalid file format.';
      case 'storage/invalid-event-name':
        return 'Invalid operation requested.';
      case 'storage/invalid-url':
        return 'Invalid file URL provided.';
      case 'storage/invalid-argument':
        return 'Invalid file operation argument.';
      case 'storage/no-default-bucket':
        return 'No storage bucket configured.';
      case 'storage/cannot-slice-blob':
        return 'File processing error occurred.';
      case 'storage/server-file-wrong-size':
        return 'File size mismatch occurred.';
      default:
        return error?.message || 'A file operation error occurred. Please try again.';
    }
  }

  /**
   * Handle and display any type of error
   * @param error The error object
   * @param context Optional context for the error
   * @param showAlert Whether to show an alert instead of toast
   */
  async handleError(error: any, context?: string, showAlert: boolean = false): Promise<void> {
    let errorMessage: string;
    
    // Determine error type and parse accordingly
    if (error?.code?.startsWith('auth/')) {
      errorMessage = this.parseAuthError(error);
    } else if (error?.code?.startsWith('firestore/') || error?.code?.includes('permission-denied')) {
      errorMessage = this.parseFirestoreError(error);
    } else if (error?.code?.startsWith('storage/')) {
      errorMessage = this.parseStorageError(error);
    } else {
      errorMessage = error?.message || 'An unexpected error occurred. Please try again.';
    }

    // Log error for debugging
    console.error('Error handled by ErrorService:', {
      error,
      context,
      parsedMessage: errorMessage,
      timestamp: new Date()
    });

    // Display error to user
    if (showAlert) {
      await this.showErrorAlert('Error', errorMessage, error);
    } else {
      await this.showError(errorMessage);
    }
  }

  /**
   * Log error details for debugging
   * @param error The error object
   * @param context Optional context
   */
  logError(error: any, context?: string): void {
    const errorDetails: ErrorDetails = {
      message: error?.message || 'Unknown error',
      code: error?.code,
      context: context,
      timestamp: new Date()
    };

    console.error('ErrorService Log:', errorDetails);
    
    // Here you could also send to external logging service
    // this.sendToLoggingService(errorDetails);
  }
}
