// netlify/functions/generate.js
// Deploy this file to netlify/functions/generate.js
// Set environment variable GEMINI_API_KEY in Netlify dashboard

const GEMINI_MODEL = "gemini-1.5-flash";

export const handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
    };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Parse request body
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid JSON body" }),
      };
    }

    const { review, tone } = body;

    // Validation
    if (!review || typeof review !== "string" || review.trim().length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Review is required and cannot be empty" }),
      };
    }

    if (!tone || typeof tone !== "string") {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Tone is required" }),
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY environment variable is not set");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          reply: "Sorry, the AI service is not configured properly. Please contact support.",
        }),
      };
    }

    // Build prompt exactly as requested + quality enhancers
    const prompt = `Write a ${tone} reply to this Google review:

"${review}"

Requirements:
- Sound natural and human
- Be concise (max 120 words)
- Be professional yet warm
- Address the customer's specific concern
- End with a positive note or invitation to return
- Never mention that you are an AI`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.75,
        maxOutputTokens: 350,
        topP: 0.95,
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error ${response.status}:`, errorText);
      throw new Error(`Gemini API returned ${response.status}`);
    }

    const data = await response.json();

    // Extract the generated text safely
    const generatedText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Thank you for your review. We appreciate your feedback and will work on improving our service.";

    // Clean up any markdown or extra newlines
    const cleanReply = generatedText
      .trim()
      .replace(/^["']|["']$/g, "") // remove wrapping quotes if any
      .replace(/\n+/g, "\n\n"); // normalize line breaks

    return {
      statusCode: 200,
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reply: cleanReply,
      }),
    };
  } catch (error) {
    console.error("Function error:", error);

    return {
      statusCode: 200, // Return 200 so frontend doesn't break
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reply: "Sorry, we couldn't generate a reply right now. Please try again in a few seconds.",
      }),
    };
  }
};