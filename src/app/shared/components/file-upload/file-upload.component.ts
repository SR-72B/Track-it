// src/app/shared/components/file-upload/file-upload.component.ts
import { Component, EventEmitter, Input, Output, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { FileService } from '../../services/file.service';

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule
  ]
})
export class FileUploadComponent {
  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef<HTMLInputElement>;
  
  @Input() allowedTypes: string[] = [];
  @Input() multiple: boolean = false;
  @Input() maxFiles: number = 5;
  @Input() maxSizeInMB: number = 10;
  @Input() disabled: boolean = false;
  @Input() showPreview: boolean = true;
  @Input() acceptedMimeTypes: string[] = [];
  @Output() filesSelected = new EventEmitter<File[]>();
  @Output() fileRemoved = new EventEmitter<File>();
  @Output() filesCleared = new EventEmitter<void>();
  @Output() uploadError = new EventEmitter<string>();
  
  selectedFiles: File[] = [];
  isUploading: boolean = false;
  uploadProgress: number = 0;
  isDragOver: boolean = false;

  constructor(
    private fileService: FileService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  /**
   * Handles file input change event
   * @param event The file input change event
   */
  onFileChange(event: any): void {
    const files: FileList = event.target.files;
    this.processFiles(files);
    // Reset the input value to allow selecting the same file again
    event.target.value = '';
  }

  /**
   * Handles drag over event
   * @param event The drag event
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.disabled) {
      this.isDragOver = true;
    }
  }

  /**
   * Handles drag leave event
   * @param event The drag event
   */
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  /**
   * Handles file drop event
   * @param event The drop event
   */
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    
    if (this.disabled) return;
    
    const files = event.dataTransfer?.files;
    if (files) {
      this.processFiles(files);
    }
  }

  /**
   * Processes the selected files
   * @param files The FileList to process
   */
  private processFiles(files: FileList | null): void {
    if (!files || files.length === 0) return;
    
    // Clear previous selections if not multiple
    if (!this.multiple) {
      this.selectedFiles = [];
    }
    
    // Check total number of files
    const totalFiles = this.selectedFiles.length + files.length;
    if (this.multiple && totalFiles > this.maxFiles) {
      this.showError(`You can only upload a maximum of ${this.maxFiles} files. Currently selected: ${this.selectedFiles.length}`);
      return;
    }
    
    if (!this.multiple && files.length > 1) {
      this.showError('Only one file can be uploaded.');
      return;
    }
    
    // Process each file
    const validFiles: File[] = [];
    const errors: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validation = this.validateFile(file);
      
      if (validation.isValid) {
        // Check for duplicates
        if (!this.isDuplicateFile(file)) {
          validFiles.push(file);
        } else {
          errors.push(`File "${file.name}" is already selected.`);
        }
      } else {
        errors.push(validation.error!);
      }
    }
    
    // Show errors if any
    if (errors.length > 0) {
      this.showErrors(errors);
    }
    
    // Add valid files to selection
    if (validFiles.length > 0) {
      this.selectedFiles.push(...validFiles);
      this.filesSelected.emit(this.selectedFiles);
      this.showSuccessToast(`${validFiles.length} file(s) selected successfully.`);
    }
  }

  /**
   * Validates a single file
   * @param file The file to validate
   * @returns Validation result
   */
  private validateFile(file: File): { isValid: boolean; error?: string } {
    // Check file size
    if (file.size > this.maxSizeInMB * 1024 * 1024) {
      return {
        isValid: false,
        error: `File "${file.name}" (${this.getFormattedFileSize(file.size)}) exceeds the maximum file size of ${this.maxSizeInMB} MB.`
      };
    }
    
    // Check file type if allowed types are specified
    if (this.allowedTypes.length > 0) {
      if (!this.fileService.validateFileType(file, this.allowedTypes)) {
        const allowedTypesStr = this.allowedTypes.join(', ');
        return {
          isValid: false,
          error: `File "${file.name}" has an invalid type. Allowed types: ${allowedTypesStr}`
        };
      }
    }
    
    // Check MIME type if specified
    if (this.acceptedMimeTypes.length > 0) {
      if (!this.acceptedMimeTypes.includes(file.type)) {
        return {
          isValid: false,
          error: `File "${file.name}" has an unsupported MIME type: ${file.type}`
        };
      }
    }
    
    return { isValid: true };
  }

  /**
   * Checks if a file is already selected
   * @param file The file to check
   * @returns True if duplicate, false otherwise
   */
  private isDuplicateFile(file: File): boolean {
    return this.selectedFiles.some(selectedFile => 
      selectedFile.name === file.name && 
      selectedFile.size === file.size &&
      selectedFile.lastModified === file.lastModified
    );
  }

  /**
   * Removes a file from the selected files
   * @param index The index of the file to remove
   */
  removeFile(index: number): void {
    if (index >= 0 && index < this.selectedFiles.length) {
      const removedFile = this.selectedFiles.splice(index, 1)[0];
      this.filesSelected.emit(this.selectedFiles);
      this.fileRemoved.emit(removedFile);
      this.showSuccessToast(`File "${removedFile.name}" removed.`);
    }
  }

  /**
   * Clears all selected files
   */
  clearFiles(): void {
    this.selectedFiles = [];
    this.filesSelected.emit(this.selectedFiles);
    this.filesCleared.emit();
    this.showSuccessToast('All files cleared.');
  }

  /**
   * Gets the formatted file size
   * @param sizeInBytes The file size in bytes
   * @returns Formatted file size string
   */
  getFormattedFileSize(sizeInBytes: number): string {
    if (sizeInBytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(sizeInBytes) / Math.log(k));
    
    return `${parseFloat((sizeInBytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  /**
   * Gets the file type icon based on file extension
   * @param fileName The file name
   * @returns Icon name for the file type
   */
  getFileTypeIcon(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'pdf':
        return 'document-text-outline';
      case 'doc':
      case 'docx':
        return 'document-outline';
      case 'xls':
      case 'xlsx':
        return 'grid-outline';
      case 'ppt':
      case 'pptx':
        return 'easel-outline';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'webp':
        return 'image-outline';
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'wmv':
        return 'videocam-outline';
      case 'mp3':
      case 'wav':
      case 'flac':
        return 'musical-notes-outline';
      case 'zip':
      case 'rar':
      case '7z':
        return 'archive-outline';
      default:
        return 'document-outline';
    }
  }

  /**
   * Triggers the file input click
   */
  triggerFileInput(): void {
    if (!this.disabled && this.fileInput) {
      this.fileInput.nativeElement.click();
    }
  }

  /**
   * Shows an error alert
   * @param message The error message to display
   */
  async showError(message: string): Promise<void> {
    this.uploadError.emit(message);
    
    const alert = await this.alertController.create({
      header: 'Upload Error',
      message: message,
      buttons: ['OK'],
      cssClass: 'error-alert'
    });
    
    await alert.present();
  }

  /**
   * Shows multiple errors
   * @param errors Array of error messages
   */
  async showErrors(errors: string[]): Promise<void> {
    const message = errors.join('\n\n');
    await this.showError(message);
  }

  /**
   * Shows a success toast
   * @param message The success message
   */
  async showSuccessToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      color: 'success',
      position: 'top',
      buttons: [
        {
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    
    await toast.present();
  }
}

