// src/app/shared/components/file-upload/file-upload.component.ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { FileService } from '../../services/file.service';

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.scss']
})
export class FileUploadComponent {
  @Input() allowedTypes: string[] = [];
  @Input() multiple: boolean = false;
  @Input() maxFiles: number = 5;
  @Input() maxSizeInMB: number = 10;
  @Output() filesSelected = new EventEmitter<File[]>();
  
  selectedFiles: File[] = [];

  constructor(
    private fileService: FileService,
    private alertController: AlertController
  ) {}

  /**
   * Handles file input change event
   * @param event The file input change event
   */
  onFileChange(event: any): void {
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;
    
    // Check number of files
    if (!this.multiple && files.length > 1) {
      this.showError('Only one file can be uploaded.');
      return;
    }
    
    if (this.multiple && files.length > this.maxFiles) {
      this.showError(`You can only upload a maximum of ${this.maxFiles} files.`);
      return;
    }
    
    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check file size
      if (file.size > this.maxSizeInMB * 1024 * 1024) {
        this.showError(`File ${file.name} exceeds the maximum file size of ${this.maxSizeInMB} MB.`);
        continue;
      }
      
      // Check file type if allowed types are specified
      if (this.allowedTypes.length > 0) {
        if (!this.fileService.validateFileType(file, this.allowedTypes)) {
          const allowedTypesStr = this.allowedTypes.join(', ');
          this.showError(`File ${file.name} has an invalid type. Allowed types: ${allowedTypesStr}`);
          continue;
        }
      }
      
      this.selectedFiles.push(file);
    }
    
    // Emit selected files
    this.filesSelected.emit(this.selectedFiles);
  }

  /**
   * Removes a file from the selected files
   * @param index The index of the file to remove
   */
  removeFile(index: number): void {
    if (index >= 0 && index < this.selectedFiles.length) {
      this.selectedFiles.splice(index, 1);
      this.filesSelected.emit(this.selectedFiles);
    }
  }

  /**
   * Shows an error alert
   * @param message The error message to display
   */
  async showError(message: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Error',
      message: message,
      buttons: ['OK']
    });
    
    await alert.present();
  }
}