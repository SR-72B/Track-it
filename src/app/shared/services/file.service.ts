// src/app/shared/services/file.service.ts
import { Injectable } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { from, Observable, forkJoin } from 'rxjs';
import { switchMap, last, map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class FileService {
  constructor(private storage: AngularFireStorage) {}

  /**
   * Uploads a file to Firebase Storage
   * @param file The file to upload
   * @param path The storage path
   * @returns Observable with download URL
   */
  uploadFile(file: File, path: string): Observable<string> {
    const storageRef = this.storage.ref(path);
    const uploadTask = this.storage.upload(path, file);

    return uploadTask.snapshotChanges().pipe(
      last(), // Wait for the last snapshot (upload complete)
      switchMap(() => storageRef.getDownloadURL()),
      catchError(error => {
        console.error('Error uploading file:', error);
        throw error;
      })
    );
  }

  /**
   * Uploads multiple files to Firebase Storage
   * @param files Array of files to upload
   * @param basePath Base storage path
   * @returns Observable array of download URLs
   */
  uploadMultipleFiles(files: File[], basePath: string): Observable<string[]> {
    if (!files || files.length === 0) {
      return from(Promise.resolve([]));
    }

    const uploadObservables = files.map((file, index) => {
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${basePath}/${timestamp}_${index}_${sanitizedFileName}`;
      return this.uploadFile(file, path);
    });

    return forkJoin(uploadObservables);
  }

  /**
   * Uploads a file with progress tracking
   * @param file The file to upload
   * @param path The storage path
   * @returns Observable with upload progress and download URL
   */
  uploadFileWithProgress(file: File, path: string): Observable<{ progress: number; downloadURL?: string }> {
    const storageRef = this.storage.ref(path);
    const uploadTask = this.storage.upload(path, file);

    return uploadTask.percentageChanges().pipe(
      map(progress => ({ progress: progress || 0 })),
      switchMap(progressData => {
        if (progressData.progress === 100) {
          return storageRef.getDownloadURL().pipe(
            map(downloadURL => ({ progress: 100, downloadURL }))
          );
        }
        return from([progressData]);
      }),
      catchError(error => {
        console.error('Error uploading file with progress:', error);
        throw error;
      })
    );
  }

  /**
   * Deletes a file from Firebase Storage
   * @param fileUrl The download URL of the file to delete
   * @returns Observable of void
   */
  deleteFile(fileUrl: string): Observable<void> {
    try {
      const storageRef = this.storage.refFromURL(fileUrl);
      return from(storageRef.delete()).pipe(
        catchError(error => {
          console.error('Error deleting file:', error);
          throw error;
        })
      );
    } catch (error) {
      console.error('Invalid file URL:', fileUrl);
      throw new Error('Invalid file URL provided');
    }
  }

  /**
   * Deletes multiple files from Firebase Storage
   * @param fileUrls Array of download URLs to delete
   * @returns Observable of void
   */
  deleteMultipleFiles(fileUrls: string[]): Observable<void[]> {
    if (!fileUrls || fileUrls.length === 0) {
      return from(Promise.resolve([]));
    }

    const deleteObservables = fileUrls.map(url => this.deleteFile(url));
    return forkJoin(deleteObservables);
  }

  /**
   * Validates file type against allowed types
   * @param file The file to validate
   * @param allowedTypes Array of allowed file extensions
   * @returns Boolean indicating if file type is allowed
   */
  validateFileType(file: File, allowedTypes: string[]): boolean {
    if (!file || !file.name) return false;
    
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    return allowedTypes.map(type => type.toLowerCase()).includes(fileExtension);
  }

  /**
   * Validates file size against maximum allowed size
   * @param file The file to validate
   * @param maxSizeInMB Maximum file size in MB
   * @returns Boolean indicating if file size is valid
   */
  validateFileSize(file: File, maxSizeInMB: number): boolean {
    if (!file) return false;
    
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    return file.size <= maxSizeInBytes;
  }

  /**
   * Validates multiple aspects of a file
   * @param file The file to validate
   * @param allowedTypes Array of allowed file extensions
   * @param maxSizeInMB Maximum file size in MB
   * @returns Validation result object
   */
  validateFile(file: File, allowedTypes: string[], maxSizeInMB: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!file) {
      errors.push('No file provided');
      return { isValid: false, errors };
    }

    if (!this.validateFileType(file, allowedTypes)) {
      errors.push(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
    }

    if (!this.validateFileSize(file, maxSizeInMB)) {
      errors.push(`File size exceeds ${maxSizeInMB}MB limit`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Gets file size in a human-readable format
   * @param size File size in bytes
   * @returns Formatted file size string (e.g., "2.5 MB")
   */
  formatFileSize(size: number): string {
    if (!size || size === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(size) / Math.log(k));
    
    return `${parseFloat((size / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
  }

  /**
   * Gets the MIME type of a file based on its extension
   * @param fileName The file name
   * @returns MIME type string
   */
  getMimeType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    
    const mimeTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
      'txt': 'text/plain'
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }

  /**
   * Generates a unique file path
   * @param basePath Base storage path
   * @param fileName Original file name
   * @param userId Optional user ID for organization
   * @returns Unique file path
   */
  generateUniqueFilePath(basePath: string, fileName: string, userId?: string): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    let path = `${basePath}/${timestamp}_${randomString}_${sanitizedFileName}`;
    
    if (userId) {
      path = `${basePath}/${userId}/${timestamp}_${randomString}_${sanitizedFileName}`;
    }
    
    return path;
  }
}
