const { generateContent, REVIEW_MODES, SUPPORTED_LANGUAGES } = require("../services/ai.service")

const MAX_CODE_LENGTH = 20000;


module.exports.getReview = async (req, res) => {

    const { code, language = "Auto Detect", mode = "full" } = req.body;

    if (typeof code !== "string" || !code.trim()) {
        return res.status(400).json({
            message: "Please paste some code before requesting a review."
        });
    }

    if (code.length > MAX_CODE_LENGTH) {
        return res.status(413).json({
            message: `Code is too large. Please keep it under ${MAX_CODE_LENGTH} characters.`
        });
    }

    if (!SUPPORTED_LANGUAGES.includes(language)) {
        return res.status(400).json({
            message: "Unsupported language selection."
        });
    }

    if (!Object.keys(REVIEW_MODES).includes(mode)) {
        return res.status(400).json({
            message: "Unsupported review mode."
        });
    }

    try {
        const response = await generateContent({ code, language, mode });

        res.json(response);
    } catch (error) {
        console.error("AI review failed:", error.message);

        const isQuotaError = error.status === 429 || error.message.includes("Too Many Requests") || error.message.includes("quota");
        const isInvalidKey = error.status === 400 && error.message.includes("API key not valid");
        const message = error.message === "GOOGLE_GEMINI_KEY is missing"
            ? "Gemini API key is missing on the backend."
            : isInvalidKey
                ? "Gemini API key is invalid. Please add a valid key in the root .env file."
                : isQuotaError
                    ? "Gemini free-tier quota is exhausted for this API key. Please wait for the quota to reset, enable billing, or use a different Gemini API key/project."
                    : "AI review failed. Please try again later.";
        const statusCode = isQuotaError ? 429 : isInvalidKey ? 401 : 500;

        res.status(statusCode).json({ message });
    }
}
