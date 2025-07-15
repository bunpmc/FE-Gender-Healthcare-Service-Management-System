import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, debounceTime } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  DoctorRecommendation,
} from '../../models/chatbot.model';

@Component({
  selector: 'app-support-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './support-chat.component.html',
  styleUrls: ['./support-chat.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportChatComponent implements AfterViewChecked, OnDestroy {
  @ViewChild('messageInput') messageInput!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('chatBody') chatBody!: ElementRef<HTMLDivElement>;

  showChatPanel = false;
  message = '';
  isTyping = false;
  isConnected = true;
  unreadCount = 0;
  sessionId?: string;
  userId?: string;

  // Dùng duy nhất 1 message cho UI
  currentMsg: ChatMessage | null = null;
  showClearBtn = false;

  // Quick replies, chỉ lấy 1 reply đầu cho UI
  quickReplyText: string = '';
  showQuickReplies = false;

  private destroy$ = new Subject<void>();
  private shouldScrollToBottom = false;
  private messageIdCounter = 0;
  private readonly API_BASE_URL = 'https://8dbff9af74e4.ngrok-free.app';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService
  ) {
    this.initQuickReplies();
    this.initializeChat();

    this.translate.onLangChange.subscribe(() => {
      this.initQuickReplies();
      this.initializeChat();
    });
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initQuickReplies() {
    this.translate.get('AI_CHAT.QUICK_REPLIES').subscribe((list) => {
      if (Array.isArray(list) && list.length > 0) {
        this.quickReplyText = list[0];
        this.showQuickReplies = true;
      } else {
        this.quickReplyText = '';
        this.showQuickReplies = false;
      }
      this.cdr.markForCheck();
    });
  }

  private initializeChat() {
    this.translate.get('AI_CHAT.WELCOME').subscribe((welcomeMsg) => {
      this.setCurrentMsg({
        id: this.generateMessageId(),
        from: 'bot',
        text: welcomeMsg,
        timestamp: new Date(),
      });
      this.showClearBtn = false;
      this.cdr.markForCheck();
    });
  }

  private generateMessageId(): string {
    return `msg_${++this.messageIdCounter}_${Date.now()}`;
  }

  private setCurrentMsg(msg: ChatMessage, showClear: boolean = false): void {
    this.currentMsg = msg;
    this.showClearBtn = showClear;
    this.shouldScrollToBottom = true;
    if (msg.from === 'bot' && !this.showChatPanel) this.unreadCount++;
    this.cdr.markForCheck();
  }

  private scrollToBottom(): void {
    if (this.chatBody?.nativeElement) {
      const element = this.chatBody.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  toggleChat(): void {
    this.showChatPanel = !this.showChatPanel;
    if (this.showChatPanel) {
      this.unreadCount = 0;
      this.cdr.markForCheck();
      setTimeout(() => {
        this.messageInput?.nativeElement?.focus();
      }, 300);
    }
  }

  sendMessage(messageText?: string): void {
    const userMessage = (messageText || this.message).trim();
    if (!userMessage) return;

    // Show user message
    this.setCurrentMsg(
      {
        id: this.generateMessageId(),
        from: 'user',
        text: userMessage,
        timestamp: new Date(),
      },
      true
    );

    this.message = '';
    this.isTyping = true;
    this.cdr.markForCheck();

    const chatRequest: ChatRequest = {
      query: userMessage,
      user_id: this.userId,
    };

    this.http
      .post<ChatResponse>(`${this.API_BASE_URL}/chat`, chatRequest)
      .pipe(takeUntil(this.destroy$), debounceTime(100))
      .subscribe({
        next: (response) => {
          this.isTyping = false;
          if (response.session_id && !this.userId) {
            this.sessionId = response.session_id;
          }
          this.setCurrentMsg(
            {
              id: this.generateMessageId(),
              from: 'bot',
              text: response.response,
              timestamp: new Date(),
              doctorRecommendations: response.doctor_recommendations,
            },
            true
          );

          if (
            response.doctor_recommendations &&
            response.doctor_recommendations.length > 0
          ) {
            this.translate
              .get('AI_CHAT.DOCTOR_FOUND', {
                count: response.doctor_recommendations.length,
              })
              .subscribe((msg) => {
                setTimeout(() => {
                  this.setCurrentMsg(
                    {
                      id: this.generateMessageId(),
                      from: 'bot',
                      text: msg,
                      timestamp: new Date(),
                    },
                    true
                  );
                }, 1000);
              });
          }
        },
        error: (error) => {
          this.isTyping = false;
          this.isConnected = false;
          this.getErrorMessage(error);

          setTimeout(() => {
            this.isConnected = true;
            this.cdr.markForCheck();
          }, 3000);
        },
      });
  }

  private getErrorMessage(error: any): void {
    let key = 'AI_CHAT.ERROR.DEFAULT';
    if (error.status === 0) key = 'AI_CHAT.ERROR.CONNECTION_LOST';
    else if (error.status >= 500) key = 'AI_CHAT.ERROR.SERVER';
    else if (error.status === 429) key = 'AI_CHAT.ERROR.TOO_MANY';
    else if (error.status === 503) key = 'AI_CHAT.ERROR.SERVICE_UNAVAILABLE';
    else if (error.status === 404) key = 'AI_CHAT.ERROR.NOT_FOUND';

    this.translate.get(key, { status: error.status }).subscribe((msg) => {
      this.setCurrentMsg(
        {
          id: this.generateMessageId(),
          from: 'bot',
          text: msg,
          timestamp: new Date(),
        },
        true
      );
    });
  }

  sendQuickReply(reply: string): void {
    this.sendMessage(reply);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  clearChat(): void {
    this.initializeChat();
    this.sessionId = undefined;
    this.cdr.markForCheck();
  }

  formatTime(timestamp?: Date): string {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
