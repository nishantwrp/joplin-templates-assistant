"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  FileEdit,
  MessageSquare,
  Play,
  Eye,
  Code,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Info,
  Tag as TagIcon,
  Calendar,
  Folder,
  ThumbsUp,
  ThumbsDown,
  Heart,
  ExternalLink,
  Github
} from "lucide-react";
import { sendGAEvent } from '@next/third-parties/google';
import { joplin, createNoteWithTemplate } from "../../fake-joplin";
import manifest from "../../templates-plugin/manifest.json";
import styles from "./page.module.css";

interface Message {
  role: "ai" | "user" | "system";
  content: string | React.ReactNode;
  llm?: {
    provider: string;
    model: string;
  };
  feedback?: "up" | "down";
}

export default function Home() {
  const [editor1Content, setEditor1Content] = useState<string | undefined>(
    `<!-- \n  Templates Plugin: v${manifest.version}\n  Documentation: https://github.com/joplin/plugin-templates\n-->\n\n# Template Editor\n\nStart typing your Joplin template here...`
  );
  const [editor2Content, setEditor2Content] = useState<string | undefined>(
    "# Preview\n\nClick 'Try it out' to see a new note created from your template."
  );
  const [lastCreatedNote, setLastCreatedNote] = useState<any>(null);
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);
  const [previewMode, setPreviewMode] = useState<"source" | "rendered">("source");
  const [chatInput, setChatInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const initialMessages: Message[] = [
    {
      role: "ai",
      content: "Hello! I'm Albus. How can I help you with your Joplin templates today?"
    },
    {
      role: "system",
      content: (
        <div className={styles.sponsorshipMessage}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Heart size={14} fill="#e11d48" color="#e11d48" />
            <strong>Support Albus & Templates Plugin</strong>
          </div>
          <p style={{ fontSize: '13px', lineHeight: '1.5', marginBottom: '12px' }}>
            This assistant and the templates-plugin are built by <a href="https://nishantwrp.com" target="_blank" rel="noopener">Nishant Mittal</a>.
            Your support helps cover LLM costs and future development!
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <a href="https://github.com/sponsors/nishantwrp" target="_blank" rel="noopener" className={styles.supportLink}>
              GitHub Sponsors <ExternalLink size={12} />
            </a>
            <a href="https://buymeacoffee.com/nishantwrp" target="_blank" rel="noopener" className={styles.supportLink}>
              Buy Me a Coffee <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )
    },
  ];

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Demo Modal State
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [dontShowDemoAgain, setDontShowDemoAgain] = useState(false);

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogHtml, setDialogHtml] = useState("");
  const dialogResolverRef = useRef<((value: any) => void) | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const chatHistoryRef = useRef<HTMLDivElement>(null);

  // Track latest editor content via ref to avoid stale closures in handleTryItOut
  const editor1ContentRef = useRef(editor1Content);
  useEffect(() => {
    editor1ContentRef.current = editor1Content;
  }, [editor1Content]);

  // Initialize plugin, detect system theme and check for demo modal
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeMediaQuery.matches);

    const themeListener = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeMediaQuery.addEventListener('change', themeListener);

    const initPlugin = async () => {
      try {
        (window as any).joplin = joplin;
        console.log("Loading plugin...");
        require("../../templates-plugin/index.js");
        console.log("Plugin loaded successfully");
      } catch (error) {
        console.error("Error loading plugin:", error);
      }
    };

    initPlugin();

    // Check if user has opted out of demo video
    const hideDemo = localStorage.getItem("hide-demo-video");
    if (!hideDemo) {
      setIsDemoModalOpen(true);
    }

    return () => darkModeMediaQuery.removeEventListener('change', themeListener);
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages, isChatLoading]);

  const handleCloseDemoModal = () => {
    if (dontShowDemoAgain) {
      localStorage.setItem("hide-demo-video", "true");
    }
    setIsDemoModalOpen(false);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userPrompt = chatInput;
    setMessages((prev) => [...prev, { role: "user", content: userPrompt }]);
    setChatInput("");
    setIsChatLoading(true);

    sendGAEvent('event', 'chat_message_sent', {
      event_category: 'engagement',
      event_label: 'AI Chat'
    });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userPrompt,
          currentTemplate: editor1ContentRef.current
        }),
      });

      const data = await response.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: "ai", content: "Error: " + data.error },
        ]);
      } else {
        sendGAEvent('event', 'chat_response_received', {
          event_category: 'engagement',
          event_label: 'AI Chat',
          llm_provider: data.llm?.provider,
          llm_model: data.llm?.model
        });

        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            content: data.response,
            llm: data.llm
          },
        ]);

        if (data.updateTemplate && data.suggestedTemplate) {
          setEditor1Content(data.suggestedTemplate);
          sendGAEvent('event', 'chat_template_updated', {
            event_category: 'engagement',
            event_label: 'AI Chat',
            llm_provider: data.llm?.provider,
            llm_model: data.llm?.model
          });
        } else {
          sendGAEvent('event', 'chat_no_template_update', {
            event_category: 'engagement',
            event_label: 'AI Chat',
            llm_provider: data.llm?.provider,
            llm_model: data.llm?.model
          });
        }
      }
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "Failed to connect to AI assistant." },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleFeedback = (index: number, type: "up" | "down") => {
    const msg = messages[index];
    if (msg.role !== "ai") return;

    setMessages((prev) => {
      const newMessages = [...prev];
      newMessages[index] = { ...msg, feedback: type };
      return newMessages;
    });

    sendGAEvent('event', `chat_feedback_${type}`, {
      event_category: 'engagement',
      event_label: 'AI Feedback',
      llm_provider: msg.llm?.provider || 'unknown',
      llm_model: msg.llm?.model || 'unknown'
    });
  };

  const variableInputsCallback = useCallback((html: string) => {
    sendGAEvent('event', 'variables_dialog_shown', {
      event_category: 'engagement',
      event_label: 'Variable Input'
    });
    setDialogHtml(html);
    setIsDialogOpen(true);
    return new Promise<any>((resolve) => {
      dialogResolverRef.current = resolve;
    });
  }, []);

  const handleDialogClose = (action: 'ok' | 'cancel') => {
    const resolver = dialogResolverRef.current;
    if (!resolver) return;

    let result: any = { id: 'cancel' };

    if (action === 'ok') {
      const formData: any = {};
      if (formRef.current) {
        const data = new FormData(formRef.current);
        const variables: any = {};
        data.forEach((value, key) => {
          variables[key] = value;
        });
        const formName = formRef.current.name || "variables";
        formData[formName] = variables;
      }
      result = { id: 'ok', formData };
    }

    resolver(result);
    setIsDialogOpen(false);
    setDialogHtml("");
    dialogResolverRef.current = null;
  };

  const handleTryItOut = async () => {
    setError(null);
    sendGAEvent('event', 'try_it_out_click', {
      event_category: 'engagement',
      event_label: 'Template Execution'
    });

    try {
      const currentContent = editor1ContentRef.current ?? "";
      const note = await createNoteWithTemplate(currentContent, variableInputsCallback);
      if (note) {
        setLastCreatedNote(note);
        setEditor2Content(note.body);
      }
    } catch (err: any) {
      const errorMessage = err.message || "An unknown error occurred during template parsing.";
      setError(errorMessage);
      sendGAEvent('event', 'template_error', {
        event_category: 'error',
        event_label: errorMessage.substring(0, 100)
      });
    }
  };

  const editorTheme = isDarkMode ? "vs-dark" : "light";

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "Not set";
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className={styles.container}>
      {/* Demo Video Modal */}
      {isDemoModalOpen && (
        <div className={styles.modalOverlay} onClick={handleCloseDemoModal}>
          <div className={`${styles.modalContent} ${styles.videoModalContent}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>Albus Demo Video</div>
            <div className={styles.modalBody}>
              <div className={styles.videoContainer}>
                <iframe 
                  src="https://www.youtube.com/embed/VPaXE7Jv6xg?autoplay=1" 
                  title="Albus Demo Video"                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
            </div>
            <div className={styles.modalFooter} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <label className={styles.dontShowAgain}>
                <input
                  type="checkbox"
                  checked={dontShowDemoAgain}
                  onChange={(e) => setDontShowDemoAgain(e.target.checked)}
                />
                Don&apos;t show again
              </label>
              <button className={styles.tryButton} onClick={handleCloseDemoModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog */}
      {isDialogOpen && (
        <div className={styles.modalOverlay} onClick={() => handleDialogClose('cancel')}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>Template Variables</div>
            <div className={styles.modalBody}>
              <div
                dangerouslySetInnerHTML={{ __html: dialogHtml }}
                ref={(el) => {
                  if (el) {
                    const form = el.querySelector('form');
                    if (form) (formRef as any).current = form;
                  }
                }}
              />
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelButton} onClick={() => handleDialogClose('cancel')}>
                Cancel
              </button>
              <button className={styles.tryButton} onClick={() => handleDialogClose('ok')}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Section */}
      <section className={styles.editorSection}>
        <div className={styles.editorWrapper}>
          <div className={styles.editorHeader}>
            <div className={styles.headerTitle}>
              <FileEdit size={16} />
              <span>Template Editor</span>
            </div>
            <div className={styles.headerActions}>
              <button
                className={styles.githubLink}
                onClick={() => setIsDemoModalOpen(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <Play size={12} fill="currentColor" />
                Watch Demo
              </button>
              <a
                href="https://github.com/nishantwrp/joplin-templates-assistant"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.githubLink}
              >
                <Github size={14} />
                GitHub
              </a>
              <button className={styles.tryButton} onClick={handleTryItOut}>
                <Play size={12} fill="currentColor" />
                Try it out
              </button>
            </div>
          </div>
          <div className={styles.editor}>
            <Editor
              height="100%"
              language="markdown"
              theme={editorTheme}
              value={editor1Content}
              onChange={(value) => setEditor1Content(value)}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: "on",
                padding: { top: 16 },
                lineNumbers: "on",
                scrollBeyondLastLine: false,
              }}
            />
          </div>
        </div>
        <div className={styles.editorWrapper}>
          <div className={styles.editorHeader}>
            <div className={styles.headerTitle}>
              <FileEdit size={16} />
              <span>Preview</span>
            </div>
            <div className={styles.headerActions}>
              <div className={styles.toggleGroup}>
                <button
                  className={`${styles.toggleButton} ${previewMode === "source" ? styles.toggleActive : ""}`}
                  onClick={() => setPreviewMode("source")}
                  title="Show Source"
                >
                  <Code size={14} />
                </button>
                <button
                  className={`${styles.toggleButton} ${previewMode === "rendered" ? styles.toggleActive : ""}`}
                  onClick={() => setPreviewMode("rendered")}
                  title="Show Rendered"
                >
                  <Eye size={14} />
                </button>
              </div>
            </div>
          </div>
          <div className={styles.editor}>
            {error ? (
              <div className={styles.errorContainer}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontWeight: 'bold' }}>
                  <AlertCircle size={18} />
                  Template Error
                </div>
                {error}
              </div>
            ) : (
              <>
                {lastCreatedNote && (
                  <div className={styles.metadataSection}>
                    <div
                      className={styles.metadataHeader}
                      onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
                    >
                      {isMetadataExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <Info size={14} />
                      <span>Note Metadata</span>
                    </div>
                    {isMetadataExpanded && (
                      <div className={styles.metadataContent}>
                        <div className={styles.metadataItem}>
                          <span className={styles.metadataLabel}>Title</span>
                          <span className={styles.metadataValue}>{lastCreatedNote.title || "Untitled"}</span>
                        </div>
                        <div className={styles.metadataItem}>
                          <span className={styles.metadataLabel}>Notebook</span>
                          <span className={styles.metadataValue}>
                            <Folder size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                            {lastCreatedNote.folderId || "Default"}
                          </span>
                        </div>
                        <div className={styles.metadataItem}>
                          <span className={styles.metadataLabel}>Tags</span>
                          <div className={styles.tagList}>
                            {lastCreatedNote.tags && lastCreatedNote.tags.length > 0 ? (
                              lastCreatedNote.tags.map((tag: string, i: number) => (
                                <span key={i} className={styles.tag}>
                                  <TagIcon size={10} style={{ marginRight: '4px' }} />
                                  {tag}
                                </span>
                              ))
                            ) : (
                              <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No tags</span>
                            )}
                          </div>
                        </div>
                        {lastCreatedNote.todo_due !== undefined && (
                          <div className={styles.metadataItem}>
                            <span className={styles.metadataLabel}>Due</span>
                            <span className={styles.metadataValue}>
                              <Calendar size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                              {formatDate(lastCreatedNote.todo_due)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {previewMode === "source" ? (
                    <Editor
                      height="100%"
                      language="markdown"
                      theme={editorTheme}
                      value={editor2Content}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 14,
                        wordWrap: "on",
                        padding: { top: 16 },
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                      }}
                    />
                  ) : (
                    <div className={styles.renderedPreview}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {editor2Content || ""}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Chatbot Section */}
      <section className={styles.chatbotSection}>
        <div className={styles.editorHeader}>
          <div className={styles.headerTitle}>
            <a
              href="https://github.com/albusbot"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.headerLink}
            >
              <img
                src="https://avatars.githubusercontent.com/u/97315592?v=4"
                alt="Albus"
                className={styles.headerAvatar}
              />
              <span>Albus (Joplin Templates Assistant)</span>
            </a>
          </div>
        </div>
        <div className={styles.chatHistory} ref={chatHistoryRef}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`${styles.chatMessage} ${msg.role === "ai" ? styles.aiMessage :
                msg.role === "user" ? styles.userMessage :
                  styles.aiMessage // System messages also look like AI but with unique styles
                } ${msg.role === "ai" && idx > 1 ? styles.aiMessageWithFeedback : ""}`}
            >
              {msg.content}
              {msg.role === "ai" && idx > 1 && (
                <div className={styles.feedbackButtons}>
                  <button
                    className={`${styles.feedbackButton} ${msg.feedback === "up" ? styles.feedbackButtonActive : ""}`}
                    onClick={() => handleFeedback(idx, "up")}
                    title="Helpful"
                  >
                    <ThumbsUp size={12} fill={msg.feedback === "up" ? "currentColor" : "none"} />
                  </button>
                  <button
                    className={`${styles.feedbackButton} ${msg.feedback === "down" ? styles.feedbackButtonActive : ""}`}
                    onClick={() => handleFeedback(idx, "down")}
                    title="Not helpful"
                  >
                    <ThumbsDown size={12} fill={msg.feedback === "down" ? "currentColor" : "none"} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {isChatLoading && (
            <div className={styles.loadingDots}>
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
        </div>
        <div className={styles.inputArea}>
          <textarea
            className={styles.chatInput}
            placeholder={isChatLoading ? "Thinking..." : "Ask Albus for help with templates..."}
            rows={1}
            value={chatInput}
            disabled={isChatLoading}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <button
            className={styles.sendButton}
            onClick={handleSendMessage}
            disabled={isChatLoading || !chatInput.trim()}
          >
            <Send size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}
