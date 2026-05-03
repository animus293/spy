import { auth, db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  onSnapshot, 
  updateDoc, 
  getDoc,
  query,
  where,
  serverTimestamp,
  type DocumentData
} from 'firebase/firestore';

export type SignalingSession = {
  id: string;
  hostId: string;
  status: 'waiting' | 'connected' | 'closed';
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  createdAt: any;
};

export class WebRTCService {
  private pc: RTCPeerConnection;
  private localStream: MediaStream | null = null;
  private sessionId: string | null = null;

  constructor() {
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
  }

  async startStream(stream: MediaStream): Promise<string> {
    this.localStream = stream;
    stream.getTracks().forEach(track => this.pc.addTrack(track, stream));

    const sessionRef = await addDoc(collection(db, 'sessions'), {
      hostId: auth.currentUser?.uid,
      status: 'waiting',
      createdAt: serverTimestamp(),
    });

    this.sessionId = sessionRef.id;

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(collection(db, `sessions/${this.sessionId}/iceCandidates`), event.candidate.toJSON());
      }
    };

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    await setDoc(doc(db, 'sessions', this.sessionId), {
      offer: { type: offer.type, sdp: offer.sdp },
    }, { merge: true });

    // Listen for answer
    onSnapshot(doc(db, 'sessions', this.sessionId), async (snapshot) => {
      const data = snapshot.data();
      if (data?.answer && !this.pc.currentRemoteDescription) {
        const answer = new RTCSessionDescription(data.answer);
        await this.pc.setRemoteDescription(answer);
      }
    });

    return this.sessionId;
  }

  async joinStream(sessionId: string, onRemoteStream: (stream: MediaStream) => void) {
    this.sessionId = sessionId;

    this.pc.ontrack = (event) => {
      onRemoteStream(event.streams[0]);
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(collection(db, `sessions/${this.sessionId}/iceCandidates`), event.candidate.toJSON());
      }
    };

    const sessionRef = doc(db, 'sessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);
    const data = sessionSnap.data();

    if (!data?.offer) throw new Error('No offer found');

    await this.pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    await updateDoc(sessionRef, {
      answer: { type: answer.type, sdp: answer.sdp },
      status: 'connected',
    });

    // Listen for ICE candidates
    onSnapshot(collection(db, `sessions/${this.sessionId}/iceCandidates`), (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          await this.pc.addIceCandidate(candidate);
        }
      });
    });
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
  }
}
