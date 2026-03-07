"use client";

import React, { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, FileEdit, MessageSquare, Play, Eye, Code, AlertCircle } from "lucide-react";
import { joplin, createNoteWithTemplate } from "../../fake-joplin";
import styles from "./page.module.css";

export default function Home() {
  const [editor1Content, setEditor1Content] = useState<string | undefined>(
    "# Template Editor\n\nStart typing your Joplin template here..."
  );
  const [editor2Content, setEditor2Content] = useState<string | undefined>(
    "# Preview\n\nClick 'Try it out' to see the result here."
  );
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

  const variableInputsCallback = (html: string) => {
    setDialogHtml(html);
    setIsDialogOpen(true);
    return new Promise<any>((resolve) => {
      dialogResolverRef.current = resolve;
    });
  };

  const handleDialogClose = (action: 'ok' | 'cancel') => {
    if (!dialogResolverRef.current) return;

    if (action === 'cancel') {
      dialogResolverRef.current({ id: 'cancel' });
    } else {
      const formData: any = {};
      if (formRef.current) {
        const data = new FormData(formRef.current);
        const variables: any = {};
        data.forEach((value, key) => {
          variables[key] = value;
        });
        // The Joplin plugin expects formData: { [formName]: { [fieldName]: value } }
        // We'll use "variables" as the default form name if not found
        const formName = formRef.current.name || "variables";
        formData[formName] = variables;
      }
      dialogResolverRef.current({ id: 'ok', formData });
    }

    setIsDialogOpen(false);
    setDialogHtml("");
    dialogResolverRef.current = null;
  };

  const handleTryItOut = async () => {
    setError(null);
    try {
      const note = await createNoteWithTemplate(editor1Content ?? "", variableInputsCallback);
      if (!!note) {
        setEditor2Content(note.body);
      }
    } catch (err: any) {
      setError(err.message || "An unknown error occurred during template parsing.");
    }
  };

  const editorTheme = isDarkMode ? "vs-dark" : "light";

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
            ) : previewMode === "source" ? (
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
