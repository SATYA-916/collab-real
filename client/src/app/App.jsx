import "./App.css"
import { Editor } from "@monaco-editor/react"
import { MonacoBinding } from "y-monaco"
import { useRef, useMemo, useState, useEffect, useCallback } from "react"
import * as Y from "yjs"
import { SocketIOProvider } from "y-socket.io"

const SUPPORTED_LANGUAGES = [
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "json", label: "JSON" },
  { id: "java", label: "Java" },
  { id: "cpp", label: "C++" },
  { id: "csharp", label: "C#" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "php", label: "PHP" },
  { id: "ruby", label: "Ruby" },
  { id: "sql", label: "SQL" },
  { id: "markdown", label: "Markdown" },
  { id: "xml", label: "XML" },
  { id: "yaml", label: "YAML" },
]

const EXT_LANG_MAP = {
  js: "javascript", jsx: "javascript", mjs: "javascript",
  ts: "typescript", tsx: "typescript",
  py: "python", rb: "ruby", rs: "rust", go: "go",
  java: "java", cpp: "cpp", c: "cpp", h: "cpp", cs: "csharp",
  php: "php", html: "html", htm: "html", css: "css", scss: "css",
  json: "json", xml: "xml", yml: "yaml", yaml: "yaml",
  md: "markdown", sql: "sql",
}

const DEFAULT_CODE = {
  javascript: '// Start coding...\n',
  typescript: '// Start coding...\n',
  python: '# Start coding...\n',
  html: '<!DOCTYPE html>\n<html>\n<head>\n  <title>Page</title>\n</head>\n<body>\n\n</body>\n</html>\n',
  css: '/* Start coding... */\n',
}

function getLanguageFromName(name) {
  const ext = name.split(".").pop()?.toLowerCase() || ""
  return EXT_LANG_MAP[ext] || "javascript"
}

let fileIdCounter = 1

function App() {
  const editorRef = useRef(null)
  const bindingRef = useRef(null)
  const providerRef = useRef(null)

  const [username, setUsername] = useState(() => {
    return new URLSearchParams(window.location.search).get("username") || ""
  })
  const [users, setUsers] = useState([])

  const ydoc = useMemo(() => new Y.Doc(), [])

  // ── File Management ──────────────────────────────────────────
  const [files, setFiles] = useState(() => [
    { id: "file-0", name: "script.js", language: "javascript" },
  ])
  const [activeFileId, setActiveFileId] = useState("file-0")
  const [showNewFileInput, setShowNewFileInput] = useState(false)
  const [newFileName, setNewFileName] = useState("")
  const [showLangDropdown, setShowLangDropdown] = useState(false)

  const activeFile = files.find((f) => f.id === activeFileId) || files[0]

  const getYText = useCallback((fileId) => ydoc.getText(fileId), [ydoc])

  // Editor mount – called each time Editor re-mounts (file switch via key)
  const handleMount = useCallback(
    (editor) => {
      editorRef.current = editor
      bindingRef.current?.destroy()

      const yText = getYText(activeFileId)

      bindingRef.current = new MonacoBinding(
        yText,
        editor.getModel(),
        new Set([editor]),
      )
    },
    [activeFileId, getYText],
  )

  // ── File Actions ──────────────────────────────────────────────
  const handleCreateFile = () => {
    const name = newFileName.trim()
    if (!name) return

    const id = `file-${fileIdCounter++}`
    const language = getLanguageFromName(name)

    setFiles((prev) => [...prev, { id, name, language }])
    setActiveFileId(id)
    setShowNewFileInput(false)
    setNewFileName("")
  }

  const handleLanguageChange = (langId) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === activeFileId ? { ...f, language: langId } : f)),
    )
    setShowLangDropdown(false)

    // Update Monaco model language directly for instant feedback
    if (editorRef.current) {
      const model = editorRef.current.getModel()
      if (model) {
        const monaco = window.monaco
        if (monaco) monaco.editor.setModelLanguage(model, langId)
      }
    }
  }

  const handleDeleteFile = (e, fileId) => {
    e.stopPropagation()
    if (files.length <= 1) return
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
    if (activeFileId === fileId) {
      setActiveFileId(files.find((f) => f.id !== fileId).id)
    }
  }

  // ── Join & WebSocket ──────────────────────────────────────────
  const handleJoin = (e) => {
    e.preventDefault()
    const name = e.target.username.value
    setUsername(name)
    window.history.pushState({}, "", "?username=" + name)
  }

  useEffect(() => {
    if (!username) return

    const provider = new SocketIOProvider("/", "monaco", ydoc, {
      autoConnect: true,
    })
    providerRef.current = provider

    provider.awareness.setLocalStateField("user", { username })

    const updateUsers = () => {
      const states = Array.from(provider.awareness.getStates().values())
      setUsers(
        states
          .filter((state) => state.user && state.user.username)
          .map((state) => state.user),
      )
    }

    updateUsers()
    provider.awareness.on("change", updateUsers)

    const handleBeforeUnload = () => {
      provider.awareness.setLocalStateField("user", null)
    }
    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      provider.disconnect()
      provider.awareness.off("change", updateUsers)
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [username, ydoc])

  // ── Login Screen ──────────────────────────────────────────────
  if (!username) {
    return (
      <main className="h-screen w-full bg-gray-950 flex items-center justify-center">
        <form
          onSubmit={handleJoin}
          className="flex flex-col gap-5 p-10 rounded-2xl bg-gray-900/60 backdrop-blur-md border border-gray-800 shadow-2xl w-full max-w-sm"
        >
          <h1 className="text-3xl font-bold text-white text-center tracking-tight">
            Collab<span className="text-amber-400">Code</span>
          </h1>
          <p className="text-gray-400 text-sm text-center -mt-3">
            Real-time collaborative editor
          </p>
          <input
            type="text"
            placeholder="Enter your username"
            className="p-3 rounded-xl bg-gray-800 text-white placeholder-gray-500 border border-gray-700 outline-none focus:border-amber-500 transition"
            name="username"
          />
          <button className="p-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-gray-950 font-bold hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer">
            Join Workspace
          </button>
        </form>
      </main>
    )
  }

  // ── Workspace ─────────────────────────────────────────────────
  return (
    <main className="h-screen w-full bg-gray-950 flex gap-3 p-3 overflow-hidden">
      {/* ─── Sidebar ─────────────────────────────────────────────── */}
      <aside className="h-full w-72 min-w-0 flex flex-col bg-gray-900/70 backdrop-blur-md rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
        {/* Files Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Files
          </h2>
          <button
            onClick={() => setShowNewFileInput(true)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition cursor-pointer text-lg leading-none"
            title="New file"
          >
            +
          </button>
        </div>

        {/* New File Input */}
        {showNewFileInput && (
          <div className="mx-3 mt-3 p-2 rounded-xl bg-gray-800/80 border border-gray-700 flex gap-2">
            <input
              autoFocus
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFile()
                if (e.key === "Escape") {
                  setShowNewFileInput(false)
                  setNewFileName("")
                }
              }}
              placeholder="e.g. app.js"
              className="flex-1 px-2 py-1.5 rounded-lg bg-gray-900 text-white text-sm placeholder-gray-500 outline-none border border-gray-700 focus:border-amber-500 transition"
            />
            <button
              onClick={handleCreateFile}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-gray-950 font-semibold text-sm hover:bg-amber-400 transition cursor-pointer"
            >
              Add
            </button>
          </div>
        )}

        {/* File List */}
        <ul className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {files.map((file) => (
            <li
              key={file.id}
              onClick={() => setActiveFileId(file.id)}
              className={`group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all text-sm ${
                activeFileId === file.id
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200 border border-transparent"
              }`}
            >
              <span className="text-base">📄</span>
              <span className="flex-1 truncate font-mono text-xs">
                {file.name}
              </span>
              <span className="text-[10px] opacity-50 uppercase">
                {file.language}
              </span>
              {files.length > 1 && (
                <button
                  onClick={(e) => handleDeleteFile(e, file.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition cursor-pointer text-sm"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>

        {/* Users Section */}
        <div className="border-t border-gray-800">
          <div className="px-4 py-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Online — {users.length}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {users.map((user, index) => (
                <span
                  key={index}
                  className="px-2.5 py-1 rounded-full bg-gray-800 text-gray-300 text-xs border border-gray-700"
                >
                  {user.username}
                </span>
              ))}
              {users.length === 0 && (
                <span className="text-xs text-gray-600">No other users</span>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Editor Area ─────────────────────────────────────────── */}
      <section className="flex-1 flex flex-col gap-2 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-900/70 backdrop-blur-md rounded-2xl border border-gray-800">
          {/* Active file name */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/80 border border-gray-700">
            <span className="text-blue-400 text-sm">📄</span>
            <span className="text-white text-sm font-mono">
              {activeFile?.name}
            </span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Language selector */}
          <div className="relative">
            <button
              onClick={() => setShowLangDropdown((p) => !p)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/80 border border-gray-700 hover:border-amber-500/50 transition text-white text-sm cursor-pointer"
            >
              <span className="text-xs opacity-70">🌐</span>
              <span>{activeFile?.language}</span>
              <span className="text-xs opacity-50">▾</span>
            </button>

            {showLangDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowLangDropdown(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 w-44 max-h-60 overflow-y-auto rounded-xl bg-gray-900 border border-gray-700 shadow-2xl py-1">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => handleLanguageChange(lang.id)}
                      className={`w-full text-left px-4 py-2 text-sm transition cursor-pointer ${
                        activeFile?.language === lang.id
                          ? "text-amber-400 bg-amber-500/10"
                          : "text-gray-400 hover:text-white hover:bg-gray-800"
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1 bg-gray-900/70 backdrop-blur-md rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
          <Editor
            key={activeFileId}
            height="100%"
            language={activeFile?.language || "javascript"}
            defaultValue={DEFAULT_CODE[activeFile?.language] || "// Start coding..."}
            theme="vs-dark"
            onMount={handleMount}
            options={{
              fontSize: 14,
              fontFamily: "'Fira Code', 'Cascadia Code', monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 12 },
              smoothScrolling: true,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              bracketPairColorization: { enabled: true },
              automaticLayout: true,
            }}
          />
        </div>
      </section>
    </main>
  )
}

export default App
