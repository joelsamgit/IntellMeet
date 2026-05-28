export interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  role: "admin" | "member";
}

export interface Meeting {
  _id: string;
  title: string;
  hostId: string;
  participants: User[];
  startTime: string;
  endTime?: string;
  status: "scheduled" | "live" | "ended";
  summary?: string;
  actionItems?: ActionItem[];
  recording?: string;
}

export interface ActionItem {
  _id: string;
  text: string;
  assignee: User;
  status: "pending" | "done";
  meetingId: string;
}

export interface Message {
  _id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: string;
  type?: 'text' | 'system' | 'file';
  reactions?: Array<{ user?: string; emoji: string; createdAt?: string }>;
  clientMessageId?: string;
}

export interface Task {
  _id: string;
  title: string;
  description?: string;
  assignee?: User;
  status: "todo" | "inprogress" | "done";
  priority: "low" | "medium" | "high";
}

export interface Notification {
  _id: string;
  message: string;
  read: boolean;
  createdAt: string;
  type: "mention" | "action_item" | "meeting" | "system";
}

export interface Participant {
  userId: string;
  socketId: string;
  userName: string;
  joinedAt: number;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isSpeaking?: boolean;
  isScreenSharing?: boolean;
  isHost?: boolean;
}

export interface TranscriptSegment {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  startTime?: number;
  endTime?: number;
}

export interface AISummary {
  _id: string;
  meeting: string;
  summary: string;
  keyPoints: string[];
  sentiment: string;
  sentimentScore: number;
  engagementScore: number;
  talkTimeDistribution: Record<string, number>;
  followUpNotes: string;
  status: 'processing' | 'completed' | 'failed';
}

export interface MeetingActionItem {
  _id: string;
  meeting: string;
  text: string;
  assigneeName: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in-progress' | 'completed';
  source: string;
  dueDate?: string;
}

export interface AIProgress {
  step: 'transcription' | 'summary' | 'actionItems';
  status: 'processing' | 'completed' | 'failed';
  message: string;
}

export interface AIWorkflowResult {
  transcript: {
    _id: string;
    fullText: string;
    language: string;
    duration?: number;
    segments: Array<{
      text: string;
      startTime?: number;
      endTime?: number;
      speakerName?: string;
      confidence?: number;
    }>;
  };
  summary: AISummary;
  actionItems: MeetingActionItem[];
}