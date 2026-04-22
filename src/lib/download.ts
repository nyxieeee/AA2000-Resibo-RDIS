import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  // If running on a native device (Android/iOS)
  if (Capacitor.isNativePlatform()) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        try {
          const base64data = (reader.result as string).split(',')[1];
          await Filesystem.writeFile({
            path: filename,
            data: base64data,
            directory: Directory.Documents,
          });
          alert(`Success! File saved to your Documents folder:\n${filename}`);
          resolve();
        } catch (e: any) {
          alert('Error saving file: ' + e.message);
          reject(e);
        }
      };
      
      reader.onerror = () => {
        alert('Failed to read file data.');
        reject(new Error('Failed to read file data'));
      };
      
      reader.readAsDataURL(blob);
    });
  } 
  // If running in a normal web browser
  else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
