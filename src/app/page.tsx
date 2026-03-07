"use client";

import React, { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, FileEdit, MessageSquare, Play, Eye, Code } from "lucide-react";
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
  const [messages, setMessages] = useState([
    { role: "ai", content: "Hello! How can I help you with your templates today?" },
  ]);

  useEffect(() => {
    const initPlugin = async () => {
      try {
        // Expose joplin globally if the plugin expects it
        (window as any).joplin = joplin;

        console.log("Loading plugin...");
        // We use require because it's a non-module JS file usually
        require("../../templates-plugin/index.js");
        console.log("Plugin loaded successfully");
      } catch (error) {
        console.error("Error loading plugin:", error);
      }
    };

    initPlugin();
  }, []);

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    setMessages((prev) => [...prev, { role: "user", content: chatInput }]);
    setChatInput("");

    // Simulate AI response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "I'm a placeholder AI. I received your message: " + chatInput },
      ]);
    }, 1000);
  };

  const handleTryItOut = () => {
    createNoteWithTemplate(editor1Content ?? "");
  };

  return (
    <div className={styles.container}>
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
              theme="vs-dark"
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
                  className={`${styles.toggleButton} ${previewMode === "source" ? styles.toggleActive : ""
                    }`}
                  onClick={() => setPreviewMode("source")}
                  title="Show Source"
                >
                  <Code size={14} />
                </button>
                <button
                  className={`${styles.toggleButton} ${previewMode === "rendered" ? styles.toggleActive : ""
                    }`}
                  onClick={() => setPreviewMode("rendered")}
                  title="Show Rendered"
                >
                  <Eye size={14} />
                </button>
              </div>
            </div>
          </div>
          <div className={styles.editor}>
            {previewMode === "source" ? (
              <Editor
                height="100%"
                language="markdown"
                theme="vs-dark"
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
        <div className={styles.chatHistory}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`${styles.chatMessage} ${msg.role === "ai" ? styles.aiMessage : styles.userMessage
                }`}
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
