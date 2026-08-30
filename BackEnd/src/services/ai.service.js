const { GoogleGenAI } = require("@google/genai");

const REVIEW_MODES = {
    quick: "Quick Review: keep the review short and focus only on the most important findings.",
    bugs: "Bug Detection: focus on syntax errors, runtime failures, incorrect logic, undefined behavior, and edge cases.",
    security: "Security Review: focus on vulnerabilities, unsafe input handling, secrets, injection, auth issues, and data exposure.",
    performance: "Performance Review: focus on time complexity, space complexity, resource usage, memory, and bottlenecks.",
    learning: "Learning Mode: explain issues in beginner-friendly language with clear reasons and examples.",
    full: "Full Review: analyze correctness, security, performance, maintainability, readability, edge cases, and tests."
};

const SUPPORTED_LANGUAGES = [
    "Auto Detect",
    "C++",
    "C",
    "Java",
    "Python",
    "JavaScript",
    "TypeScript",
    "C#",
    "Go",
    "Rust",
    "PHP",
    "SQL"
];

const EMPTY_REVIEW = {
    verdict: "issues_found",
    summary: "The AI response could not be parsed into the expected structure.",
    language: "Unknown",
    score: 0,
    statistics: {
        critical: 0,
        errors: 1,
        warnings: 0,
        suggestions: 0,
        good: 0
    },
    issues: [
        {
            severity: "error",
            category: "runtime",
            line: null,
            title: "Invalid AI response",
            description: "The AI service returned a malformed response.",
            why_it_matters: "The application needs predictable JSON to render the review safely.",
            suggested_fix: "Try the review again. If it continues, check the backend logs."
        }
    ],
    complexity: {
        time: "Unknown",
        space: "Unknown",
        explanation: "Complexity could not be determined."
    },
    security: {
        status: "not_applicable",
        findings: []
    },
    edge_cases: [],
    test_cases: [],
    improved_code: "",
    raw_response: ""
};

function getModel() {
    if (!process.env.GOOGLE_GEMINI_KEY) {
        throw new Error("GOOGLE_GEMINI_KEY is missing");
    }

    return new GoogleGenAI({
        apiKey: process.env.GOOGLE_GEMINI_KEY
    });
}

const SYSTEM_INSTRUCTION = `
You are an expert software engineer and code reviewer.

Analyze the supplied source code accurately.
Never invent errors.
Distinguish actual defects from optional improvements.
Prioritize correctness, security, performance, memory/resource usage, edge cases, and maintainability.
Only report findings supported by the provided code.
Provide line numbers only when reliably identifiable.
Do not claim that code was compiled or executed.
If the code is correct, clearly state that no real correctness issues were found.
Do not unnecessarily rewrite correct code.
Never classify formatting, missing trailing newlines, or personal style preferences as errors.
"using namespace std;" is not automatically an error. It is at most a maintainability or best-practice suggestion.

Return only valid JSON. Do not wrap JSON in Markdown.

Required schema:
{
  "verdict": "working | issues_found | critical",
  "summary": "Short summary",
  "language": "Detected or selected language",
  "score": 0,
  "statistics": {
    "critical": 0,
    "errors": 0,
    "warnings": 0,
    "suggestions": 0,
    "good": 0
  },
  "issues": [
    {
      "severity": "critical | error | warning | suggestion | good",
      "category": "syntax | runtime | logic | security | performance | memory | style | maintainability | best_practice | testing | edge_case",
      "line": null,
      "title": "Short issue title",
      "description": "Clear explanation",
      "why_it_matters": "Why this matters",
      "suggested_fix": "How to fix it"
    }
  ],
  "complexity": {
    "time": "O(?) or Unknown or Not applicable",
    "space": "O(?) or Unknown or Not applicable",
    "explanation": "Brief reasoning"
  },
  "security": {
    "status": "safe | concerns_found | not_applicable",
    "findings": []
  },
  "edge_cases": [],
  "test_cases": [
    {
      "name": "Test name",
      "input": "Input",
      "expected": "Expected result",
      "reason": "Why this test matters"
    }
  ],
  "improved_code": "Corrected code only when useful, otherwise empty string"
}
`;

function withLineNumbers(code) {
    return code
        .split("\n")
        .map((line, index) => `${index + 1}: ${line}`)
        .join("\n");
}

function extractJson(text) {
    const trimmed = String(text || "").trim();

    if (!trimmed) {
        throw new Error("Empty AI response");
    }

    try {
        return JSON.parse(trimmed);
    } catch (error) {
        const start = trimmed.indexOf("{");
        const end = trimmed.lastIndexOf("}");

        if (start === -1 || end === -1 || end <= start) {
            throw error;
        }

        return JSON.parse(trimmed.slice(start, end + 1));
    }
}

function normalizeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function normalizeScore(score, statistics) {
    const aiScore = Math.max(0, Math.min(10, normalizeNumber(score, 0)));

    if (statistics.critical > 0) {
        return Math.min(aiScore, 4);
    }

    if (statistics.errors > 0) {
        return Math.min(aiScore, 7);
    }

    if (statistics.warnings > 0) {
        return Math.min(aiScore, 8);
    }

    if (statistics.suggestions > 0) {
        return Math.min(aiScore, 9);
    }

    return aiScore;
}

function normalizeReview(review, rawResponse) {
    const issues = Array.isArray(review.issues) ? review.issues : [];

    const normalizedIssues = issues
        .filter(Boolean)
        .map((issue) => ({
            severity: [
                "critical",
                "error",
                "warning",
                "suggestion",
                "good"
            ].includes(issue.severity)
                ? issue.severity
                : "suggestion",

            category: issue.category || "maintainability",

            line:
                Number.isInteger(issue.line) && issue.line > 0
                    ? issue.line
                    : null,

            title: issue.title || "Review finding",

            description: issue.description || "",

            why_it_matters: issue.why_it_matters || "",

            suggested_fix: issue.suggested_fix || ""
        }));

    const statistics = {
        critical: normalizedIssues.filter(
            (issue) => issue.severity === "critical"
        ).length,

        errors: normalizedIssues.filter(
            (issue) => issue.severity === "error"
        ).length,

        warnings: normalizedIssues.filter(
            (issue) => issue.severity === "warning"
        ).length,

        suggestions: normalizedIssues.filter(
            (issue) => issue.severity === "suggestion"
        ).length,

        good: normalizedIssues.filter(
            (issue) => issue.severity === "good"
        ).length
    };

    const hasCritical = statistics.critical > 0;

    const hasIssues =
        hasCritical ||
        statistics.errors > 0 ||
        statistics.warnings > 0;

    const verdict = [
        "working",
        "issues_found",
        "critical"
    ].includes(review.verdict)
        ? review.verdict
        : hasCritical
            ? "critical"
            : hasIssues
                ? "issues_found"
                : "working";

    return {
        verdict,

        summary: review.summary || "Review complete.",

        language: review.language || "Unknown",

        score: normalizeScore(review.score, statistics),

        statistics,

        issues: normalizedIssues,

        complexity: {
            time: review.complexity?.time || "Unknown",
            space: review.complexity?.space || "Unknown",
            explanation: review.complexity?.explanation || ""
        },

        security: {
            status: [
                "safe",
                "concerns_found",
                "not_applicable"
            ].includes(review.security?.status)
                ? review.security.status
                : "not_applicable",

            findings: Array.isArray(review.security?.findings)
                ? review.security.findings.filter(Boolean)
                : []
        },

        edge_cases: Array.isArray(review.edge_cases)
            ? review.edge_cases.filter(Boolean)
            : [],

        test_cases: Array.isArray(review.test_cases)
            ? review.test_cases.filter(Boolean)
            : [],

        improved_code:
            typeof review.improved_code === "string"
                ? review.improved_code
                : "",

        raw_response: rawResponse
    };
}

async function generateContent({
    code,
    language = "Auto Detect",
    mode = "full"
}) {
    const ai = getModel();

    const selectedMode =
        REVIEW_MODES[mode] || REVIEW_MODES.full;

    const selectedLanguage =
        SUPPORTED_LANGUAGES.includes(language)
            ? language
            : "Auto Detect";

    const promptWithLineNumbers =
        withLineNumbers(code);

    const result = await ai.models.generateContent({
        model: "gemini-3.6-flash",

        contents: `
Review mode: ${selectedMode}

Selected language: ${selectedLanguage}

Review this code. The numbers at the start of each line are line numbers for reference only.

\`\`\`
${promptWithLineNumbers}
\`\`\`
`,

        config: {
            responseMimeType: "application/json",
            temperature: 0.2,
            systemInstruction: SYSTEM_INSTRUCTION
        }
    });

    const rawResponse = result.text;

    try {
        return normalizeReview(
            extractJson(rawResponse),
            rawResponse
        );
    } catch (error) {
        console.error(
            "AI JSON parse failed:",
            error.message
        );

        return {
            ...EMPTY_REVIEW,
            raw_response: rawResponse
        };
    }
}

module.exports = {
    generateContent,
    REVIEW_MODES,
    SUPPORTED_LANGUAGES
};