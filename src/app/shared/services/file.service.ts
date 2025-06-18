// src/app/shared/services/file.service.ts
import { Injectable } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { from, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

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
    
    return from(uploadTask).pipe(
      switchMap(() => storageRef.getDownloadURL())
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
    
    const uploadPromises = files.map((file, index) => {
      const path = `${basePath}/${Date.now()}_${index}_${file.name}`;
      return this.uploadFile(file, path).toPromise();
    });
    
    return from(Promise.all(uploadPromises));
  }

  /**
   * Deletes a file from Firebase Storage
   * @param fileUrl The download URL of the file to delete
   * @returns Observable of void
   */
  deleteFile(fileUrl: string): Observable<void> {
    const storageRef = this.storage.refFromURL(fileUrl);
    return from(storageRef.delete());
  }

  /**
   * Validates file type against allowed types
   * @param file The file to validate
   * @param allowedTypes Array of allowed file extensions
   * @returns Boolean indicating if file type is allowed
   */
  validateFileType(file: File, allowedTypes: string[]): boolean {
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    return allowedTypes.includes(fileExtension);
  }

  /**
   * Gets file size in a human-readable format
   * @param size File size in bytes
   * @returns Formatted file size string (e.g., "2.5 MB")
   */
  formatFileSize(size: number): string {
    if (size < 1024) {
      return size + ' B';
    } else if (size < 1024 * 1024) {
      return (size / 1024).toFixed(1) + ' KB';
    } else if (size < 1024 * 1024 * 1024) {
      return (size / (1024 * 1024)).toFixed(1) + ' MB';
    } else {
      return (size / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    }
  }
}