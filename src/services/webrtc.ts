import { io, Socket } from "socket.io-client";

export class WebRTCService {
  private pc: RTCPeerConnection;
  private localStream: MediaStream | null = null;
  private socket: Socket;
  private roomId: string | null = null;

  constructor() {
    this.socket = io();
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
  }

  async startStream(stream: MediaStream, roomId: string): Promise<void> {
    this.localStream = stream;
    this.roomId = roomId;
    
    stream.getTracks().forEach(track => this.pc.addTrack(track, stream));

    this.socket.emit("join", roomId);

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit("signal", { roomId, data: { type: 'candidate', candidate: event.candidate } });
      }
    };

    // Listen for viewer signals
    this.socket.on("signal", async ({ data }) => {
      if (data.type === 'answer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      } else if (data.type === 'candidate' && this.pc.remoteDescription) {
        await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    // When a viewer joins, send an offer
    this.socket.on("user-joined", async () => {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.socket.emit("signal", { roomId, data: { type: 'offer', offer } });
    });
  }

  async joinStream(roomId: string, onRemoteStream: (stream: MediaStream) => void) {
    this.roomId = roomId;
    this.socket.emit("join", roomId);

    this.pc.ontrack = (event) => {
      onRemoteStream(event.streams[0]);
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit("signal", { roomId, data: { type: 'candidate', candidate: event.candidate } });
      }
    };

    this.socket.on("signal", async ({ data }) => {
      if (data.type === 'offer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.socket.emit("signal", { roomId, data: { type: 'answer', answer } });
      } else if (data.type === 'candidate') {
        await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });
  }

  onRemoteTrigger(callback: (command: any) => void) {
    this.socket.on("trigger", ({ command }) => {
      callback(command);
    });
  }

  sendTrigger(command: any) {
    if (this.roomId) {
      this.socket.emit("trigger", { roomId: this.roomId, command });
    }
  }

  async captureFrame(videoElement: HTMLVideoElement): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoElement, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  }

  dispose() {
    this.localStream?.getTracks().forEach(t => t.stop());
    this.pc.close();
    this.socket.disconnect();
  }
}
