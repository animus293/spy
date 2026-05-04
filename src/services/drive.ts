export class DriveService {
  static async getAuthUrl(): Promise<string> {
    const res = await fetch('/api/auth/url');
    const { url } = await res.json();
    return url;
  }

  static async getStatus(): Promise<boolean> {
    const res = await fetch('/api/auth/status');
    const { isAuthenticated } = await res.json();
    return isAuthenticated;
  }

  static async uploadImage(imageData: string, filename: string): Promise<any> {
    const res = await fetch('/api/drive/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData, filename }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  }
}
