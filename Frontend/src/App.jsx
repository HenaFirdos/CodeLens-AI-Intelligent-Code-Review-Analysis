import { useEffect, useMemo, useRef, useState } from 'react'
import "prismjs/themes/prism-tomorrow.css"
import Editor from "react-simple-code-editor"
import prism from "prismjs"
import "prismjs/components/prism-clike"
import "prismjs/components/prism-markup"
import "prismjs/components/prism-markup-templating"
import "prismjs/components/prism-c"
import "prismjs/components/prism-cpp"
import "prismjs/components/prism-csharp"
import "prismjs/components/prism-go"
import "prismjs/components/prism-java"
import "prismjs/components/prism-javascript"
import "prismjs/components/prism-jsx"
import "prismjs/components/prism-php"
import "prismjs/components/prism-python"
import "prismjs/components/prism-rust"
import "prismjs/components/prism-sql"
import "prismjs/components/prism-typescript"
import './App.css'

const languages = [
  'Auto Detect',
  'C++',
  'C',
  'Java',
  'Python',
  'JavaScript',
  'TypeScript',
  'C#',
  'Go',
  'Rust',
  'PHP',
  'SQL'
]

const reviewModes = [
  { value: 'quick', label: 'Quick Review' },
  { value: 'bugs', label: 'Bug Detection' },
  { value: 'security', label: 'Security Review' },
  { value: 'performance', label: 'Performance Review' },
  { value: 'learning', label: 'Learning Mode' },
  { value: 'full', label: 'Full Review' }
]

const languageMap = {
  'C': 'c',
  'C++': 'cpp',
  'C#': 'csharp',
  'Go': 'go',
  'Java': 'java',
  'JavaScript': 'javascript',
  'PHP': 'php',
  'Python': 'python',
  'Rust': 'rust',
  'SQL': 'sql',
  'TypeScript': 'typescript'
}

const exampleCode = `function sum(numbers) {
  return numbers.reduce((total, value) => total + value, 0)
}

console.log(sum([1, 2, 3]))`

const severityLabels = {
  critical: 'Critical',
  error: 'Error',
  warning: 'Warning',
  suggestion: 'Suggestion',
  good: 'Good'
}

const historyStorageKey = 'ai-code-review-history'
const maxHistoryItems = 8

function App() {
  const [code, setCode] = useState(exampleCode)
  const [language, setLanguage] = useState('Auto Detect')
  const [mode, setMode] = useState('full')
  const [review, setReview] = useState(null)
  const [error, setError] = useState('')
  const [isReviewing, setIsReviewing] = useState(false)
  const [copied, setCopied] = useState('')
  const [codeHistory, setCodeHistory] = useState(() => loadCodeHistory())
  const editorWrapRef = useRef(null)

  const lineCount = useMemo(
    () => Math.max(code.split('\n').length, 1),
    [code]
  )

  const issueLines = useMemo(() => {
    if (!review?.issues) return new Set()

    return new Set(
      review.issues
        .map((issue) => issue.line)
        .filter(Boolean)
    )
  }, [review])

  const selectedPrismLanguage = languageMap[language] || 'clike'

  useEffect(() => {
    prism.highlightAll()
  }, [code, review, language])

  function highlightCode(value) {
    const grammar =
      prism.languages[selectedPrismLanguage] ||
      prism.languages.clike

    return grammar
      ? prism.highlight(
          value,
          grammar,
          selectedPrismLanguage
        )
      : escapeHtml(value)
  }

  async function copyText(value, label) {
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)

      window.setTimeout(
        () => setCopied(''),
        1400
      )
    } catch {
      setCopied('Copy failed')
    }
  }

  async function reviewCode() {
    if (!code.trim() || isReviewing) {
      setError(
        'Please paste code before requesting a review.'
      )
      return
    }

    setIsReviewing(true)
    setReview(null)
    setError('')

    try {
      const API_URL =
        import.meta.env.VITE_API_URL ||
        'https://codelens-ai-backend-93jw.onrender.com'

      const res = await fetch(
        `${API_URL}/ai/get-review`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            code,
            language,
            mode
          })
        }
      )

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(
          data?.message ||
          'Review request failed.'
        )
      }

      setReview(data)

      saveCodeHistory({
        code,
        language,
        mode,
        reviewedAt: new Date().toISOString()
      })
    } catch (requestError) {
      setError(
        requestError.message ||
        'Error contacting backend.'
      )
    } finally {
      setIsReviewing(false)
    }
  }

  function saveCodeHistory(nextItem) {
    const trimmedCode = nextItem.code.trim()

    if (!trimmedCode) return

    const nextHistory = [
      {
        ...nextItem,
        code: trimmedCode
      },
      ...codeHistory.filter(
        (item) =>
          item.code.trim() !== trimmedCode
      )
    ].slice(0, maxHistoryItems)

    setCodeHistory(nextHistory)

    localStorage.setItem(
      historyStorageKey,
      JSON.stringify(nextHistory)
    )
  }

  function restoreCodeHistory(index) {
    if (index === '') return

    const item = codeHistory[Number(index)]

    if (!item) return

    setCode(item.code)
    setLanguage(
      item.language || 'Auto Detect'
    )
    setMode(item.mode || 'full')
    setReview(null)
    setError('')
  }

  function clearAll() {
    setCode('')
    setReview(null)
    setError('')
  }

  function jumpToLine(line) {
    if (!line || !editorWrapRef.current) return

    const lineHeight = 24

    editorWrapRef.current.scrollTo({
      top: Math.max(
        (line - 3) * lineHeight,
        0
      ),
      behavior: 'smooth'
    })
  }

  return (
    <main className="app-shell">

      <header className="app-header">
        <div>
          <p className="eyebrow">
            AI Code Review
          </p>

          <h1>
            CodeLens AI — Intelligent Code Review & Analysis
          </h1>
        </div>

        <div className="status-pill">
          <span className="status-dot" />
          Backend ready
        </div>
      </header>

      <section
        className="control-bar"
        aria-label="Review controls"
      >

        <label className="control-field">
          <span>Language</span>

          <select
            value={language}
            onChange={(event) =>
              setLanguage(event.target.value)
            }
          >
            {languages.map((item) => (
              <option
                value={item}
                key={item}
              >
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="control-field">
          <span>Review mode</span>

          <select
            value={mode}
            onChange={(event) =>
              setMode(event.target.value)
            }
          >
            {reviewModes.map((item) => (
              <option
                value={item.value}
                key={item.value}
              >
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="control-field history-field">
          <span>Previous code</span>

          <select
            value=""
            onChange={(event) =>
              restoreCodeHistory(
                event.target.value
              )
            }
            disabled={!codeHistory.length}
          >
            <option value="">
              {codeHistory.length
                ? 'Restore previous code'
                : 'No previous code yet'}
            </option>

            {codeHistory.map(
              (item, index) => (
                <option
                  value={index}
                  key={`${item.reviewedAt}-${index}`}
                >
                  {historyLabel(item)}
                </option>
              )
            )}
          </select>
        </label>

        <div className="control-actions">

          <button
            type="button"
            className="ghost-button"
            onClick={() =>
              setCode(exampleCode)
            }
          >
            Example
          </button>

          <button
            type="button"
            className="ghost-button"
            onClick={() =>
              copyText(
                code,
                'Code copied'
              )
            }
          >
            Copy Code
          </button>

          <button
            type="button"
            className="ghost-button"
            onClick={clearAll}
          >
            Clear
          </button>

          <button
            type="button"
            onClick={reviewCode}
            className="primary-button"
            disabled={
              isReviewing ||
              !code.trim()
            }
          >
            {isReviewing
              ? 'Analyzing...'
              : 'Review Code'}
          </button>

        </div>
      </section>

      {copied && (
        <div className="toast">
          {copied}
        </div>
      )}

      <section
        className="workspace"
        aria-label="Code review workspace"
      >

        <div className="panel editor-panel">

          <div className="panel-topbar">

            <div>
              <p className="panel-label">
                Input
              </p>

              <h2>
                Source code
              </h2>
            </div>

            <span className="language-badge">
              {language}
            </span>

          </div>

          <div
            className="code-shell"
            ref={editorWrapRef}
          >

            <div
              className="line-gutter"
              aria-hidden="true"
            >
              {Array.from(
                { length: lineCount },
                (_, index) => (
                  <button
                    type="button"
                    className={
                      issueLines.has(index + 1)
                        ? 'line-number has-issue'
                        : 'line-number'
                    }
                    key={index + 1}
                    tabIndex={-1}
                  >
                    {index + 1}
                  </button>
                )
              )}
            </div>

            <div className="code">

              <Editor
                value={code}
                onValueChange={setCode}
                highlight={highlightCode}
                padding={18}
                style={{
                  fontFamily:
                    '"Fira code", "Fira Mono", monospace',
                  fontSize: 15,
                  lineHeight: 1.65,
                  minHeight: "100%",
                  width: "100%",
                  outline: "none"
                }}
              />

            </div>
          </div>
        </div>

        <div className="panel review-panel">

          <div className="panel-topbar">

            <div>
              <p className="panel-label">
                Output
              </p>

              <h2>
                Review results
              </h2>
            </div>

            <div className="result-actions">

              {review && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        JSON.stringify(
                          review,
                          null,
                          2
                        ),
                        'Review copied'
                      )
                    }
                  >
                    Copy Review
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setReview(null)
                    }
                  >
                    Clear Review
                  </button>
                </>
              )}

            </div>
          </div>

          <div className="review-content">

            {isReviewing ? (

              <div className="empty-state">
                <span className="loader" />
                <p>
                  Analyzing your code...
                </p>
              </div>

            ) : error ? (

              <div className="message-card error-message">
                <h3>
                  Review failed
                </h3>

                <p>
                  {error}
                </p>
              </div>

            ) : review ? (

              <ReviewResults
                review={review}
                onJumpToLine={jumpToLine}
                onCopy={copyText}
              />

            ) : (

              <div className="empty-state">
                <p>
                  Your review will show verdict,
                  errors, output, security,
                  performance, tests, and fixes.
                </p>
              </div>

            )}

          </div>
        </div>
      </section>
    </main>
  )
}

function ReviewResults({
  review,
  onJumpToLine,
  onCopy
}) {
  const stats =
    review.statistics || {}

  const issues =
    Array.isArray(review.issues)
      ? review.issues
      : []

  const improvedCode =
    review.improved_code?.trim()

  return (
    <div className="results-stack">

      <section
        className={`summary-card verdict-${review.verdict}`}
      >

        <div>

          <p className="panel-label">
            Verdict
          </p>

          <h3>
            {formatVerdict(
              review.verdict
            )}
          </h3>

          <p>
            {review.summary}
          </p>

        </div>

        <div className="score-ring">
          <strong>
            {review.score ?? 0}
          </strong>

          <span>
            /10
          </span>
        </div>

      </section>

      <div className="stat-grid">

        <Stat
          label="Critical"
          value={stats.critical || 0}
          tone="critical"
        />

        <Stat
          label="Errors"
          value={stats.errors || 0}
          tone="error"
        />

        <Stat
          label="Warnings"
          value={stats.warnings || 0}
          tone="warning"
        />

        <Stat
          label="Suggestions"
          value={stats.suggestions || 0}
          tone="suggestion"
        />

      </div>

      <details
        className="result-section"
        open
      >
        <summary>
          Findings
        </summary>

        {issues.length ? (

          <div className="findings-list">

            {issues.map(
              (issue, index) => (

                <article
                  className={`finding severity-${issue.severity}`}
                  key={`${issue.title}-${index}`}
                >

                  <div className="finding-header">

                    <span
                      className={`severity-badge severity-${issue.severity}`}
                    >
                      {severityLabels[
                        issue.severity
                      ] || 'Suggestion'}
                    </span>

                    <span className="category-badge">
                      {issue.category}
                    </span>

                    {issue.line && (

                      <button
                        type="button"
                        className="line-chip"
                        onClick={() =>
                          onJumpToLine(
                            issue.line
                          )
                        }
                      >
                        Line {issue.line}
                      </button>

                    )}

                  </div>

                  <h4>
                    {issue.title}
                  </h4>

                  {issue.description && (
                    <p>
                      {issue.description}
                    </p>
                  )}

                  {issue.why_it_matters && (
                    <p>
                      <strong>
                        Why it matters:
                      </strong>{' '}
                      {issue.why_it_matters}
                    </p>
                  )}

                  {issue.suggested_fix && (
                    <p>
                      <strong>
                        Suggested fix:
                      </strong>{' '}
                      {issue.suggested_fix}
                    </p>
                  )}

                  <button
                    type="button"
                    className="copy-small"
                    onClick={() =>
                      onCopy(
                        formatIssue(issue),
                        'Finding copied'
                      )
                    }
                  >
                    Copy Finding
                  </button>

                </article>

              )
            )}

          </div>

        ) : (

          <p className="muted">
            No real errors found.
          </p>

        )}

      </details>

      <details
        className="result-section"
        open
      >
        <summary>
          Performance and Complexity
        </summary>

        <div className="mini-grid">

          <InfoTile
            label="Time"
            value={
              review.complexity?.time ||
              'Unknown'
            }
          />

          <InfoTile
            label="Space"
            value={
              review.complexity?.space ||
              'Unknown'
            }
          />

        </div>

        {review.complexity?.explanation && (
          <p>
            {review.complexity.explanation}
          </p>
        )}

      </details>

      <details
        className="result-section"
        open
      >
        <summary>
          Security
        </summary>

        <p>
          <strong>
            Status:
          </strong>{' '}
          {formatLabel(
            review.security?.status ||
            'not_applicable'
          )}
        </p>

        {review.security?.findings?.length ? (

          <ul>
            {review.security.findings.map(
              (finding, index) => (
                <li key={index}>
                  {String(finding)}
                </li>
              )
            )}
          </ul>

        ) : (

          <p className="muted">
            No supported security concerns found.
          </p>

        )}

      </details>

      <details className="result-section">

        <summary>
          Edge Cases
        </summary>

        <SimpleList
          items={review.edge_cases}
          empty="No specific edge cases suggested."
        />

      </details>

      <details className="result-section">

        <summary>
          Suggested Test Cases
        </summary>

        {review.test_cases?.length ? (

          <div className="test-list">

            {review.test_cases.map(
              (test, index) => (

                <article
                  className="test-card"
                  key={index}
                >

                  <h4>
                    {test.name ||
                      `Test ${index + 1}`}
                  </h4>

                  {test.input && (
                    <p>
                      <strong>
                        Input:
                      </strong>{' '}
                      {test.input}
                    </p>
                  )}

                  {test.expected && (
                    <p>
                      <strong>
                        Expected:
                      </strong>{' '}
                      {test.expected}
                    </p>
                  )}

                  {test.reason && (
                    <p>
                      <strong>
                        Reason:
                      </strong>{' '}
                      {test.reason}
                    </p>
                  )}

                </article>

              )
            )}

          </div>

        ) : (

          <p className="muted">
            No meaningful test cases suggested.
          </p>

        )}

      </details>

      <details
        className="result-section"
        open={Boolean(improvedCode)}
      >

        <summary>
          Improved Code
        </summary>

        {improvedCode ? (

          <>
            <button
              type="button"
              className="copy-small"
              onClick={() =>
                onCopy(
                  improvedCode,
                  'Improved code copied'
                )
              }
            >
              Copy Improved Code
            </button>

            <pre>
              <code>
                {improvedCode}
              </code>
            </pre>
          </>

        ) : (

          <p className="muted">
            No fix required.
          </p>

        )}

      </details>

    </div>
  )
}

function Stat({
  label,
  value,
  tone
}) {
  return (
    <div
      className={`stat-card stat-${tone}`}
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  )
}

function InfoTile({
  label,
  value
}) {
  return (
    <div className="info-tile">

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  )
}

function SimpleList({
  items,
  empty
}) {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return (
      <p className="muted">
        {empty}
      </p>
    )
  }

  return (
    <ul>
      {items.map(
        (item, index) => (
          <li key={index}>
            {typeof item === 'string'
              ? item
              : JSON.stringify(item)}
          </li>
        )
      )}
    </ul>
  )
}

function formatVerdict(value) {
  const labels = {
    working: 'Code is working',
    issues_found: 'Issues found',
    critical: 'Critical issues found'
  }

  return (
    labels[value] ||
    'Review complete'
  )
}

function formatLabel(value) {
  return String(value).replaceAll(
    '_',
    ' '
  )
}

function formatIssue(issue) {
  return [
    `${severityLabels[issue.severity] || 'Suggestion'}: ${issue.title}`,
    issue.line
      ? `Line: ${issue.line}`
      : '',
    issue.category
      ? `Category: ${issue.category}`
      : '',
    issue.description || '',
    issue.suggested_fix
      ? `Suggested fix: ${issue.suggested_fix}`
      : ''
  ]
    .filter(Boolean)
    .join('\n')
}

function loadCodeHistory() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(
        historyStorageKey
      ) || '[]'
    )

    return Array.isArray(saved)
      ? saved.slice(
          0,
          maxHistoryItems
        )
      : []
  } catch {
    return []
  }
}

function historyLabel(item) {
  const firstLine =
    item.code
      .split('\n')
      .find(Boolean) ||
    'Saved code'

  const shortCode =
    firstLine.length > 34
      ? `${firstLine.slice(0, 34)}...`
      : firstLine

  return `${
    item.language || 'Code'
  } - ${shortCode}`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export default App