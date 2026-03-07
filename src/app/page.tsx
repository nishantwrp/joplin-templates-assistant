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
  Folder
} from "lucide-react";
import { joplin, createNoteWithTemplate } from "../../fake-joplin";
import styles from "./page.module.css";

export default function Home() {
  const [editor1Content, setEditor1Content] = useState<string | undefined>(
    "# Template Editor\n\nStart typing your Joplin template here..."
  );
  const [editor2Content, setEditor2Content] = useState<string | undefined>(
    "# Preview\n\nClick 'Try it out' to see the result here."
  );
  const [lastCreatedNote, setLastCreatedNote] = useState<any>(null);
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);
  const [previewMode, setPreviewMode] = useState<"source" | "rendered">("source");
  const [chatInput, setChatInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState([
    { role: "ai", content: "Hello! How can I help you with your templates today?" },
  ]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
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

  // Initialize plugin and detect system theme
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
    return () => darkModeMediaQuery.removeEventListener('change', themeListener);
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: chatInput }]);
    setChatInput("");
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "I'm a placeholder AI. I received your message: " + chatInput },
      ]);
    }, 1000);
  };

  const variableInputsCallback = useCallback((html: string) => {
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
    try {
      const currentContent = editor1ContentRef.current ?? "";
      const note = await createNoteWithTemplate(currentContent, variableInputsCallback);
      if (note) {
        setLastCreatedNote(note);
        setEditor2Content(note.body);
        setIsMetadataExpanded(true); // Auto-expand when a new note is created
      }
    } catch (err: any) {
      setError(err.message || "An unknown error occurred during template parsing.");
    }
  };

  const editorTheme = isDarkMode ? "vs-dark" : "light";

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "Not set";
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className={styles.container}>
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
            <button className={styles.tryButton} onClick={handleTryItOut}>
              <Play size={12} fill="currentColor" />
              Try it out
            </button>
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
            <MessageSquare size={16} />
            <span>AI Assistant</span>
          </div>
        </div>
        <div className={styles.chatHistory} ref={chatHistoryRef}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`${styles.chatMessage} ${msg.role === "ai" ? styles.aiMessage : styles.userMessage}`}
            >
              {msg.content}
            </div>
          ))}
        </div>
        <div className={styles.inputArea}>
          <textarea
            className={styles.chatInput}
            placeholder="Ask AI for help with templates..."
            rows={1}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <button className={styles.sendButton} onClick={handleSendMessage}>
            <Send size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}
